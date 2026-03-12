import os
import platform
import subprocess
import requests
import time
import json 
import concurrent.futures
import random
from google import genai
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = "AIzaSyCLLZgWEULDccRaEzQLEVqqZMfB4wHLTBc" 
ai_client = genai.Client(api_key=GEMINI_API_KEY)

# --- 1. 数据库配置 ---
# 数据库文件会生成在 backend 文件夹下的 instance 目录或根目录
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'monweb.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- 2. 定义数据表 (Models) ---

# 用户表
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False) # 暂时存明文，后面再加加密
    role = db.Column(db.String(20), default='User') # Admin, Technical, User

# 网站表 (代替原本的 PING_GROUPS)
class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False) # 比如 "Company Blog"
    url = db.Column(db.String(500), nullable=False)  # 比如 "https://google.com"
    is_muted = db.Column(db.Boolean, default=False) # 是否静默 (不发通知)
    monitor_tasks = db.relationship('MonitorTask', backref='website', lazy=True, cascade="all, delete-orphan") # 关联监控任务表，删除网站时也删除相关任务

class MonitorTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    monitor_type = db.Column(db.String(20), nullable=False) # 'http', 'ping', 未来可加 'ssl', 'dns'
    interval = db.Column(db.Integer, default=5)      # 专属的监控频率
    timeout = db.Column(db.Integer, default=10)      # 专属的超时阈值
    status = db.Column(db.String(20), default='Unknown') # 当前任务是 Up 还是 Down
    last_checked = db.Column(db.DateTime, default=datetime.now)

# 监控日志表 (存历史数据用来画图)
class MonitoringLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    monitor_task_id = db.Column(db.Integer, db.ForeignKey('monitor_task.id'), nullable=False)
    response_time = db.Column(db.Float) # 毫秒 (ms)
    status_code = db.Column(db.Integer) # 200, 404, 500
    status = db.Column(db.String(20))   # "UP" or "DOWN"
    error_details = db.Column(db.Text, nullable=True) # 可选：存储错误信息
    timestamp = db.Column(db.DateTime, default=datetime.now)

class AlertSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    browser_notify = db.Column(db.Boolean, default=True)
    sound_enabled = db.Column(db.Boolean, default=True)
    fail_count = db.Column(db.Integer, default=2) # 触发次数
    smart_mute = db.Column(db.Boolean, default=True) # 智能静音
    mp3_url = db.Column(db.String(500), default='https://actions.google.com/sounds/v1/alarms/beep_short.ogg')

# 核心监控逻辑 PING
def ping_host(host, timeout_sec):
    # 执行 PING
    # Windows 使用 -n 1, Linux/Mac 使用 -c 1
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    timeout_arg = '-w' if platform.system().lower() == 'windows' else '-W'
    timeout_val = str(timeout_sec * 1000) if platform.system().lower() == 'windows' else str(timeout_sec)
    command = ['ping', param, '1', timeout_arg, timeout_val, host]
    
    try:
        start_time = time.time()
        # 执行命令，禁止输出到控制台
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout_sec + 2, text=True)
        duration = (time.time() - start_time) * 1000 # 转换为毫秒
        
        if result.returncode == 0:
            return True, round(duration, 2), 200, None
        else:
            error_output = (result.stderr.strip() or result.stdout.strip())
            if "could not find host" in error_output.lower() or "name or service not known" in error_output.lower():
                return False, 0, 0, "DNS Resolution Failed: Host not found."
            elif "timed out" in error_output.lower() or "100% loss" in error_output.lower():
                return False, 0, 0, f"Ping Timeout: No response within {timeout_sec} seconds."
            else:
                return False, 0, 0, f"ICMP Error: {error_output[:500]}" # 截断太长的日志
            return False, 0, 0, f"Ping Failed: {error_output[:500]}" # 截断太长的日志
    except subprocess.TimeoutExpired:
        return False, 0, 0, f"Process Error: Command execution exceeded {timeout_sec}s."
    except Exception as e:
        return False, 0, 0, f"System Exception: {str(e)}"

# --- 定义全局的 User-Agent 池 ---
USER_AGENT_POOL = [
    # Windows - Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Windows - Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    # Windows - Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    # macOS - Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
    # macOS - Chrome
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Linux - Chrome
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
]

def http_check(url, timeout_sec):
    """
    HTTP 检查，返回: (是否成功, 耗时ms, 状态码, 详细错误信息)
    """
    target_url = url if url.startswith('http') else 'https://' + url
    random_user_agent = random.choice(USER_AGENT_POOL)
    headers = {
        "User-Agent": random_user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7", # 告诉服务器接受英文和中文
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1", # 模拟浏览器自动尝试从 HTTP 升级到 HTTPS
        "Sec-Fetch-Dest": "document",     # 现代浏览器发出的跨域请求防范头
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1"
    }
    try:
        start_time = time.time()
        # allow_redirects=True 允许跟随跳转
        response = requests.get(target_url, headers=headers, timeout=timeout_sec, allow_redirects=True)
        duration = (time.time() - start_time) * 1000
        
        if 200 <= response.status_code < 400:
            return True, round(duration, 2), response.status_code, None
        else:
            # 捕获类似 404 Not Found, 502 Bad Gateway 这种具体错误
            return False, round(duration, 2), response.status_code, f"HTTP Error {response.status_code}: {response.reason}"
            
    except requests.exceptions.Timeout:
        return False, 0, 0, f"Connection Timeout: Server didn't respond in {timeout_sec}s."
    except requests.exceptions.SSLError:
        return False, 0, 0, "SSL Certificate Error: Invalid or expired certificate."
    except requests.exceptions.ConnectionError:
        return False, 0, 0, "Connection Refused: Server is down or DNS resolving failed."
    except Exception as e:
        return False, 0, 0, f"Request Exception: {str(e)}"

# 单站扫描函数，供多线程池调用
def execute_single_task(app, task_id):
    with app.app_context():
        task = db.session.get(MonitorTask, task_id)
        if not task: return
        site = task.website

        target = site.url
        is_up = False
        latency, status_code = 0,0
        error_msg = None

        # 1. 根据类型分配检测任务
        if task.monitor_type == 'ping':
            clean_target = target.replace('https://', '').replace('http://', '').split('/')[0]
            is_up, latency, status_code, error_msg = ping_host(clean_target, task.timeout)
        elif task.monitor_type == 'http':
            is_up, latency, status_code, error_msg = http_check(target, task.timeout)
            
        # 2. 智能状态判断 (与旧逻辑类似)
        if not is_up:
            new_status = "Down"
        elif task.monitor_type == 'ping' and latency > 500:
            new_status = "Warning"
        elif task.monitor_type == 'http' and latency > 3000:
            new_status = "Warning"
        else:
            new_status = "Up"
            
        task.status = new_status
        task.last_checked = datetime.now()
        
        # 3. 写入包含了【详细错误原因】的日志表！
        new_log = MonitoringLog(
            monitor_task_id=task.id,
            response_time=latency,
            status_code=status_code,
            status=new_status,
            error_details=error_msg # <- 这个就是喂给AI的灵魂数据！
        )
        db.session.add(new_log)
        db.session.commit()
        
        log_text = f"[{task.monitor_type.upper()}] {site.name}: {new_status} ({latency}ms)"
        if error_msg: log_text += f" -> Error: {error_msg}"
        print(log_text)

# 全站扫描函数，供定时器调用
def scan_all_websites():
    """使用多线程池并发执行所有监控任务"""
    with app.app_context():
        print(f"\n[Scheduler] Starting scan at {datetime.now().strftime('%H:%M:%S')}...")
        tasks = MonitorTask.query.all()
        
        if not tasks:
            print("[Scheduler] No tasks to scan.")
            return
        task_to_run = []
        now = datetime.now()
        for task in tasks:
            if not task.last_checked or now >= task.last_checked + timedelta(minutes=task.interval):
                task_to_run.append(task)
        if not task_to_run:
            print("[Scheduler] No tasks are due for scanning at this time.")
            return
        print(f"[Scheduler] {len(task_to_run)} tasks are due for scanning.")

        # 使用线程池并发执行，max_workers 控制并发数量
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            # 传递 app 对象进去以重建上下文
            futures = [executor.submit(execute_single_task, app, task.id) for task in task_to_run]
            concurrent.futures.wait(futures)
            
        print("[Scheduler] Scan finished.\n")

# --- 4. 启动定时任务 ---
# 只有在主进程才启动 Scheduler，防止 Debug 模式下启动两次
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    scheduler = BackgroundScheduler()
    # 每30秒扫描一次
    scheduler.add_job(func=scan_all_websites, trigger="interval", seconds=30) # 每30秒自动扫描
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown()) # 退出时关闭

# --- 5. API 路由 ---
@app.route('/')
def home():
    return "MonWeb Intelligent Backend Running!"

@app.route('/api/test', methods=['GET'])
def test_connection():
    return jsonify({"status": "success", "message": "Backend Connected"})

@app.route('/api/init-db', methods=['POST'])
def init_db():
    with app.app_context():
        db.create_all()

        # 初始化 admin 用户
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@monweb.com', password='1234', role='Admin')
            db.session.add(admin_user)

        if not Website.query.first():
            # 预设测试网站
            sites_data = [
                {"name": "Eye On The Ball", "url": "https://eyeontheballfilm.com/"},
                {"name": "StarProperty Fair", "url": "https://fair.starproperty.my/"},
                {"name": "Kirana", "url": "https://kirana.my/"},
                {"name": "StarProperty Pullout", "url": "https://pullout.starproperty.my/"},
                {"name": "Rage", "url": "https://www.rage.com.my/"},
                {"name": "Kuntum", "url": "https://www.kuntum.com.my/"},
                {"name": "Kuali Startup", "url": "https://startup.kuali.com/"},
                {"name": "Fake Website", "url": "this-site-definitely-does-not-exist.com"}  # 测试宕机
            ]
            for s_data in sites_data:
                # 先创建网站
                site = Website(name=s_data["name"], url=s_data["url"])
                db.session.add(site)
                db.session.commit() # 提交后 site.id 才有值
                # 创建独立的监控任务
                # HTTP 任务
                http_task = MonitorTask(website_id=site.id, monitor_type='http', interval=5, timeout=10)
                # PING 任务
                ping_task = MonitorTask(website_id=site.id, monitor_type='ping', interval=1, timeout=10)
                db.session.add_all([http_task, ping_task])
            db.session.commit()
            return jsonify({"message": "Database initialized with test data!"})
        return jsonify({"message": "Database already exists."})

@app.route('/api/websites', methods=['GET'])
def get_websites():
    websites = Website.query.all()
    output = []
    for site in websites:
        tasks_data = []
        down_count = 0
        warning_count = 0

        # 遍历该网站名下的所有监控任务
        for task in site.monitor_tasks:
            # 找到该任务最近的一条日志提取延迟
            latest_log = MonitoringLog.query.filter_by(monitor_task_id=task.id).order_by(MonitoringLog.timestamp.desc()).first()
            res_time = latest_log.response_time if latest_log else None
            s_code = latest_log.status_code if latest_log else None
            err_msg = latest_log.error_details if latest_log else None
            
            tasks_data.append({
                "id": task.id,
                "type": task.monitor_type,
                "status": task.status, # Up, Down, Warning
                "interval": task.interval,
                "timeout": task.timeout,
                "response_time": res_time,
                "status_code": s_code,
                "error": err_msg
            })
            
            if task.status == 'Down': down_count += 1
            if task.status == 'Warning': warning_count += 1
            
        # --- 核心：计算该网站的综合状态 (Overall Status) ---
        total_tasks = len(tasks_data)
        if total_tasks == 0:
            overall_status = "Unknown"
        elif down_count == total_tasks:
            overall_status = "Down" # 全部挂了才是真挂了
        elif down_count > 0 or warning_count > 0:
            overall_status = "Warning" # 只要有部分任务 Down (如禁 Ping) 或者有任务高延迟，统统算 Warning
        else:
            overall_status = "Up" # 全绿

        output.append({
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "status": overall_status,   # 👇 返回综合状态给大盘红绿灯
            "monitors": tasks_data,     # 👇 把子任务也发给前端，用来显示小徽章
            "is_muted": site.is_muted
        })
    return jsonify(output)

# 新增：手动触发扫描接口
@app.route('/api/scan', methods=['POST'])
def manual_scan():
    scan_all_websites()
    return jsonify({"message": "Scan completed successfully!"})

# --- 1. 添加新网站 API (更新：支持存储全部字段) ---
@app.route('/api/websites', methods=['POST'])
def add_website():
    data = request.json
    if not data or 'name' not in data or 'url' not in data:
        return jsonify({"error": "Invalid data"}), 400
    
    # 1. 先创建父级 Website
    new_site = Website(name=data['name'], url=data['url'])
    db.session.add(new_site)
    db.session.flush() # 拿到 new_site.id 但先不提交
    
    # 2. 遍历前端传来的监控任务数组
    # 前端传过来的格式例如: "monitors": [{"type": "http", "interval": 5, "timeout": 10}, {"type": "ping", "interval": 1, "timeout": 2}]
    monitors_data = data.get('monitors', [])
    for m in monitors_data:
        new_task = MonitorTask(
            website_id=new_site.id,
            monitor_type=m['type'],
            interval=int(m.get('interval', 5)),
            timeout=int(m.get('timeout', 10))
        )
        db.session.add(new_task)
        
    try:
        db.session.commit()
        return jsonify({"message": "Website and tasks added!", "id": new_site.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- 2. 编辑/更新网站 API (全新增加) ---
@app.route('/api/websites/<int:id>', methods=['PUT'])
def update_website(id):
    site = Website.query.get_or_404(id)
    data = request.json
    
    if 'name' in data: site.name = data['name']
    if 'url' in data: site.url = data['url']
    if 'is_muted' in data: site.is_muted = bool(data['is_muted'])
    
    # 更新监控任务：最简单的做法是先删除旧任务，再根据前端传来的重新创建
    if 'monitors' in data:
        MonitorTask.query.filter_by(website_id=site.id).delete()
        for m in data['monitors']:
            new_task = MonitorTask(
                website_id=site.id,
                monitor_type=m['type'],
                interval=int(m.get('interval', 5)),
                timeout=int(m.get('timeout', 10))
            )
            db.session.add(new_task)
            
    try:
        db.session.commit()
        return jsonify({"message": "Website updated successfully!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# 2. 删除网站 API
@app.route('/api/websites/<int:id>', methods=['DELETE'])
def delete_website(id):
    site = Website.query.get_or_404(id)
    try:
        # 也要删除关联的日志，否则可能会留垃圾数据
        # (因为我们在 Model 里没设级联删除，这里简单处理先只删网站，日志留着也行)
        db.session.delete(site)
        db.session.commit()
        return jsonify({"message": "Website deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"status": "error", "message": "Missing credentials"}), 400
        
    username = data['username']
    password = data['password']
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.password == password:
        return jsonify({
            "status": "success", 
            "message": "Login successful",
            "user": {
                "id": user.id,              # 👇 新增：必须返回 ID
                "email": user.email,        # 👇 新增：必须返回 Email
                "username": user.username, 
                "role": user.role
            }
        }), 200
    else:
        return jsonify({"status": "error", "message": "Invalid username or password"}), 401

# 获取单个网站的详细信息和最近的监控日志 (用于状态详情页)
@app.route('/api/websites/<int:id>/logs', methods=['GET'])
def get_website_logs(id):
    site = Website.query.get_or_404(id)
    
    # 联表获取该网站名下所有任务的最近日志 (取30条)
    logs = db.session.query(MonitoringLog, MonitorTask)\
             .join(MonitorTask)\
             .filter(MonitorTask.website_id == id)\
             .order_by(MonitoringLog.timestamp.desc()).limit(30).all()
    
    logs_data = []
    for log, task in reversed(logs):
        logs_data.append({
            "time": log.timestamp.strftime("%H:%M:%S"),
            "response_time": log.response_time,
            "status_code": log.status_code,
            "type": task.monitor_type.upper(), # 区分是 HTTP 还是 PING 的日志
            "error": log.error_details
        })
        
    # 提取它的监控任务配置
    monitors_data = []
    for task in site.monitor_tasks:
        monitors_data.append({
            "type": task.monitor_type,
            "interval": task.interval,
            "timeout": task.timeout,
            "status": task.status
        })
        
    return jsonify({
        "website": {
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "is_muted": site.is_muted,
            "monitors": monitors_data # 把配置数组发给前端
        },
        "logs": logs_data
    })

# AI/NLP 报告生成接口
@app.route('/api/reports/daily', methods=['GET'])
def get_daily_report():
    websites = Website.query.all()
    total_sites = len(websites)
    
    if total_sites == 0:
        return jsonify({"summary": "No websites are currently being monitored.", "details": [], "metrics": {}})

    report_details = []
    down_sites = 0
    warning_sites = 0

    # 分析每个网站的数据
    for site in websites:
        # 获取最近的 10 条记录用来分析趋势
        logs = MonitoringLog.query.filter_by(website_id=site.id).order_by(MonitoringLog.timestamp.desc()).limit(10).all()
        
        if not logs:
            report_details.append(f"• {site.name}: Insufficient data for analysis.")
            continue

        avg_ping = sum(log.response_time for log in logs) / len(logs)
        errors = sum(1 for log in logs if log.status_code != 200)

        # NLP 自然语言生成逻辑
        if site.status == 'Down' or errors > 0:
            down_sites += 1
            report_details.append(f"• {site.name} is currently DOWN. It experienced {errors} connection failures in recent checks. Immediate attention is required.")
        elif site.status == 'Warning' or avg_ping > 400:
            warning_sites += 1
            report_details.append(f"• {site.name} is ONLINE but experiencing HIGH LATENCY. The average response time is {avg_ping:.0f}ms, which exceeds the normal threshold.")
        else:
            report_details.append(f"• {site.name} is performing optimally with a healthy average response time of {avg_ping:.0f}ms.")

    # 生成总体摘要 (Executive Summary)
    if down_sites == 0 and warning_sites == 0:
        summary_intro = f"Excellent news! All {total_sites} monitored websites are running smoothly with no detected anomalies or downtime."
    elif down_sites > 0:
        summary_intro = f"CRITICAL ALERT: {down_sites} out of {total_sites} monitored systems are currently experiencing downtime. Please review the details below."
    else:
        summary_intro = f"Notice: All systems are online, but {warning_sites} site(s) are experiencing performance degradation (High Latency)."

    # 计算总体健康度
    health_score = ((total_sites - down_sites) / total_sites) * 100

    return jsonify({
        "date": datetime.utcnow().strftime("%B %d, %Y"),
        "summary": summary_intro,
        "details": report_details,
        "metrics": {
            "health_score": f"{health_score:.1f}%",
            "total": total_sites,
            "down": down_sites,
            "warning": warning_sites
        }
    })

@app.route('/api/generate-report', methods=['POST'])
def generate_ai_report():
    try:
        data = request.json
        time_range = data.get('timeRange', '7d')
        target_site = data.get('targetSite', 'all')
        
        print(f"[AI Report] Retrieving database records... Scope: {time_range}, Target: {target_site}")
        
        # 1. 从数据库提取真实的监控日志 (此处提取最近 200 条作为样本)
        logs = MonitoringLog.query.order_by(MonitoringLog.timestamp.desc()).limit(200).all()
        
        if not logs:
            return jsonify({"status": "error", "message": "There is no monitoring data in the database yet. Please wait for the system to run for a while before generating a report."}), 400
            
        # 2. 在后端进行基础的数据清洗与聚合
        total_requests = len(logs)
        errors = {'500': 0, '502': 0, '404': 0, 'Timeout': 0}
        latencies = []
        
        for log in logs:
            if log.status_code == 500: errors['500'] += 1
            elif log.status_code == 502: errors['502'] += 1
            elif log.status_code == 404: errors['404'] += 1
            elif log.status == 'Down' or log.response_time > 1000: errors['Timeout'] += 1
            
            latencies.append(log.response_time)
            
        avg_latency = sum(latencies) / total_requests if total_requests > 0 else 0
        error_count = sum(errors.values())
        uptime_percent = ((total_requests - error_count) / total_requests) * 100 if total_requests > 0 else 100
        
        # 构建要喂给 AI 的统计字典
        db_stats = {
            "Total Detection Count": total_requests,
            "Average Response Time (ms)": round(avg_latency, 2),
            "Overall Availability": f"{uptime_percent:.2f}%",
            "Incident Counts by Type": errors
        }

        # 3. 构建严密的 Prompt (提示词)
        prompt = f"""
        You are a senior AIOps and cybersecurity architect with 10 years of experience.
        Please generate a professional system diagnostic report based on the following latest website monitoring data.
        
        Monitoring Data:
        {json.dumps(db_stats, ensure_ascii=False)}

        【Important Mandatory Requirements】
        You must return only valid JSON data, and absolutely do not include any markdown code block markers (such as ```json`). Output the raw JSON string starting with curly braces.
        JSON It must strictly conform to the following structure:
        {{
            "summary": "Execution Summary (3-4 sentences for overall evaluation, please combine availability and response time data)",
            "healthScore": "Health Score, can only be selected from A, B, C, D (if no errors then A, many errors then C or D)",
            "incidentAnalysis": "Incident and Root Cause Analysis Detailed Paragraph (if no errors, praise the system's extreme stability; if there are errors, speculate on causes like server overload, network fluctuations, etc.)",
            "insights": ["Performance or Security Insight 1", "Performance or Security Insight 2"],
            "recommendations": ["Specific maintenance recommendations 1", "Specific maintenance recommendations 2", "Specific maintenance recommendations 3"]
        }}
        """

        print("[AI Report] Calling Gemini 2.5 Flash large model to analyze data....")
        
        # 4. 调用新版 Gemini API
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        response_text = response.text.strip()
        print("\n========== Gemini AI Raw returned data ==========")
        print(response_text)
        print("==========================================\n")
        
        # 去除大模型有时会附带的 Markdown 标记
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]

        # 解析 AI 返回的 JSON 字符串
        ai_data = json.loads(response_text.strip())

        # 5. 组装图表所需的前端数据格式
        # 错误分布饼图数据
        error_chart = [{"name": k, "value": v} for k, v in errors.items() if v > 0]
        if not error_chart:
            error_chart = [{"name": "正常请求", "value": total_requests}] # 如果全是好的，就画个全蓝的饼图
            
        # 延迟趋势柱状图数据 (取最近 7 个点)
        recent_logs = logs[:7]
        recent_logs.reverse() # 时间正序
        latency_chart = [{"name": log.timestamp.strftime("%H:%M"), "ms": round(log.response_time, 2)} for log in recent_logs]

        # 6. 将 AI 文字报告与图表数据合并返回
        final_report = {
            "summary": ai_data.get("summary", ""),
            "healthScore": ai_data.get("healthScore", "A"),
            "incidentAnalysis": ai_data.get("incidentAnalysis", ""),
            "insights": ai_data.get("insights", []),
            "recommendations": ai_data.get("recommendations", []),
            "errorChartData": error_chart,
            "latencyChartData": latency_chart
        }

        print("[AI Report] 报告生成完毕，已下发给前端！")
        return jsonify({"status": "success", "data": final_report}), 200

    except Exception as e:
        print(f"[AI Report] 发生错误: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/support-chat', methods=['POST'])
def support_chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({"status": "error", "message": "Message cannot be empty"}), 400

        # 核心：通过严格的 Prompt 设定 AI 的人设和回答格式
        prompt = f"""
        You are the exclusive AI Assistant for MonWeb (a real-time website monitoring system).
        A user is currently asking for help on the Support page.
        
        Please strictly follow these rules:
        1. Tone must be highly humanized, relaxed like an experienced tech senior.
        2. Responses must be concise, getting straight to the point without long paragraphs.
        3. ABSOLUTELY NEVER use any Markdown asterisks (*) for bolding or lists! Pure text output only.
        4. If the user asks a question unrelated to website monitoring, humorously steer the conversation back to the MonWeb system.
        5. You MUST reply entirely in English.
        
        The user's question is:
        {user_message}
        """

        print(f"[Support AI] Thinking about user issues: {user_message}")
        
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        # 拿到文本后，为了100%确保没有星号，我们在后端做一次暴力替换清洗
        clean_reply = response.text.strip().replace('*', '')
        print(clean_reply)

        return jsonify({"status": "success", "reply": clean_reply}), 200

    except Exception as e:
        print(f"[Support AI] 发生错误: {e}")
        return jsonify({"status": "error", "message": "Oops! My brain short-circuited for a moment. Please try again later."}), 500

# --- 6. 用户管理 API (/api/users) ---
@app.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    output = []
    for u in users:
        output.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,  # 返回给前端展示
            "role": u.role
        })
    return jsonify(output)

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    # 确保接收 email 和必需字段
    if not data or 'username' not in data or 'password' not in data or 'email' not in data:
        return jsonify({"error": "Invalid data (missing fields)"}), 400
    
    # 检查用户名或邮箱是否已存在
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 400
        
    new_user = User(
        username=data['username'],
        email=data['email'],       # 存入数据库
        password=data['password'], 
        role=data.get('role', 'User')
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User created successfully!", "id": new_user.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    user = User.query.get_or_404(id)
    
    # 后端防呆逻辑：绝对不允许删除 Admin
    if user.role == 'Admin':
        return jsonify({"error": "Permission Denied: Cannot delete an Admin user."}), 403
        
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 7. 更新/编辑用户 API ---
@app.route('/api/users/<int:id>', methods=['PUT'])
def update_user(id):
    user = User.query.get_or_404(id)
    data = request.json
    if not data:
        return jsonify({"error": "Invalid data"}), 400
        
    # --- 安全逻辑修改 ---
    # 如果前端传了 role，我们需要验证权限
    if 'role' in data:
        # 不允许将现有账号提升为 Admin
        if user.role != 'Admin' and data['role'] == 'Admin':
            return jsonify({"error": "Cannot assign Admin role to existing users."}), 403
        # 不允许降级 Admin
        if user.role == 'Admin' and data['role'] != 'Admin':
            return jsonify({"error": "Cannot downgrade an Admin user."}), 403
        user.role = data['role']

    # 检查重名和重邮箱
    if 'username' in data and data['username'] != user.username:
        if User.query.filter_by(username=data['username']).first():
            return jsonify({"error": "Username already exists"}), 400
        user.username = data['username']
            
    if 'email' in data and data['email'] != user.email:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email already exists"}), 400
        user.email = data['email']

    # 修改密码
    if 'password' in data and data['password'].strip() != "": 
        current_password = data.get('currentPassword', '')
        if user.password != current_password:
            return jsonify({"error": "Current password is incorrect."}), 400
        user.password = data['password']
    try:
        db.session.commit()
        return jsonify({"message": "User updated successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 新增：获取与保存 Alert 设置
@app.route('/api/alerts/settings/<int:user_id>', methods=['GET', 'POST'])
def manage_alert_settings(user_id):
    if request.method == 'GET':
        setting = AlertSetting.query.filter_by(user_id=user_id).first()
        if not setting:
            return jsonify({
                "browserNotify": True, "soundEnabled": True, "failCount": 2, 
                "smartMute": True, "mp3Url": "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
            })
        return jsonify({
            "browserNotify": setting.browser_notify, "soundEnabled": setting.sound_enabled,
            "failCount": setting.fail_count, "smartMute": setting.smart_mute, "mp3Url": setting.mp3_url
        })
    else:
        data = request.json
        setting = AlertSetting.query.filter_by(user_id=user_id).first()
        if not setting:
            setting = AlertSetting(user_id=user_id)
            db.session.add(setting)
        
        setting.browser_notify = data.get('browserNotify', True)
        setting.sound_enabled = data.get('soundEnabled', True)
        setting.fail_count = data.get('failCount', 2)
        setting.smart_mute = data.get('smartMute', True)
        setting.mp3_url = data.get('mp3Url', 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
        db.session.commit()
        return jsonify({"message": "Settings saved"})

# 新增：单站静音切换
@app.route('/api/websites/<int:id>/mute', methods=['PUT'])
def toggle_site_mute(id):
    site = Website.query.get_or_404(id)
    site.is_muted = request.json.get('is_muted', False)
    db.session.commit()
    return jsonify({"message": "Mute status updated"})

# 👇 新增：获取全站 Top 30 警报/异常历史记录
@app.route('/api/alerts/history', methods=['GET'])
def get_alert_history():
    # 联表查询：通过 MonitorTask 作为桥梁，连接 Log 和 Website
    logs = db.session.query(MonitoringLog, MonitorTask, Website)\
        .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
        .join(Website, MonitorTask.website_id == Website.id)\
        .filter(
            db.or_(
                MonitoringLog.status_code != 200,
                MonitoringLog.response_time == 0,
                MonitoringLog.status == 'Down'
            )
        ).order_by(MonitoringLog.timestamp.desc()).limit(30).all()

    output = []
    # 注意：这里现在需要解包 3 个对象 (log, task, site)
    for log, task, site in logs:
        output.append({
            "id": log.id,
            "website_name": f"{site.name} ({task.monitor_type.upper()})", # 加上是HTTP还是PING挂了
            "url": site.url,
            "status_code": log.status_code,
            "response_time": log.response_time,
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
    return jsonify(output)

if __name__ == '__main__':
    app.run(debug=True, port=5000)