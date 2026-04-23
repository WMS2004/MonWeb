import os
import platform
import subprocess
import requests
import time
import json 
import concurrent.futures
import random
import atexit
import threading
from scapy.all import sniff, IP, TCP, Raw, conf
from google import genai
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler


app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = "AIzaSyB1FEGiMbIxrlYUOi2naULQjx-hZnoWQ9M" 
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
    interval = db.Column(db.Float, default=5.0)      # 专属的监控频率
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
    timestamp = db.Column(db.DateTime, default=datetime.now, index=True)

class AlertSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    browser_notify = db.Column(db.Boolean, default=True)
    sound_enabled = db.Column(db.Boolean, default=True)
    fail_count = db.Column(db.Integer, default=2) # 触发次数
    smart_mute = db.Column(db.Boolean, default=True) # 智能静音
    mp3_url = db.Column(db.String(500), default='https://actions.google.com/sounds/v1/alarms/beep_short.ogg')

# --- 网络流量抓包表 ---
class TrafficLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.now)
    source_ip = db.Column(db.String(50))
    method = db.Column(db.String(10))
    host = db.Column(db.String(255))
    # device 可以后续通过 User-Agent 解析，现在先存默认值
    device = db.Column(db.String(100), default="Unknown/Mobile")

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
def execute_single_task(task_data):
    target = task_data['url']
    is_up = False
    latency, status_code = 0, 0
    error_msg = None

    # 1. 根據類型分配檢測任務
    if task_data['type'] == 'ping':
        clean_target = target.replace('https://', '').replace('http://', '').split('/')[0]
        is_up, latency, status_code, error_msg = ping_host(clean_target, task_data['timeout'])
    elif task_data['type'] == 'http':
        is_up, latency, status_code, error_msg = http_check(target, task_data['timeout'])
        
    # 2. 智能狀態判斷
    if not is_up:
        new_status = "Down"
    elif task_data['type'] == 'ping' and latency > 500:
        new_status = "Warning"
    elif task_data['type'] == 'http' and latency > 3000:
        new_status = "Warning"
    else:
        new_status = "Up"
        
    # 3. 處理完畢，把結果打包成字典「回傳」給主排程器
    return {
        "task_id": task_data['id'],
        "status": new_status,
        "latency": latency,
        "status_code": status_code,
        "error_msg": error_msg,
        "monitor_type": task_data['type'],
        "site_name": task_data['name']
    }  

# 全站扫描函数，供定时器调用
def scan_all_websites(force=False):
    """使用多執行緒併發執行所有監控任務，跑完後【統一合併寫入】資料庫"""
    with app.app_context():
        print(f"\n[Scheduler] Starting scan at {datetime.now().strftime('%H:%M:%S')}(Force: {force})...")
        tasks = MonitorTask.query.all()
        
        if not tasks:
            print("[Scheduler] No tasks to scan.")
            return
            
        task_to_run = []
        now = datetime.now()
        for task in tasks:
            if force or not task.last_checked or now >= task.last_checked + timedelta(minutes=task.interval):
                task_to_run.append(task)
                
        if not task_to_run:
            print("[Scheduler] No tasks are due for scanning at this time.")
            return
            
        print(f"[Scheduler] {len(task_to_run)} tasks are due for scanning.")

        # 1. 將需要用到的資料提取出來，打包給執行緒 (避免跨執行緒操作 SQLAlchemy 物件)
        tasks_data = [{
            'id': t.id,
            'url': t.website.url,
            'type': t.monitor_type,
            'timeout': t.timeout,
            'name': t.website.name
        } for t in task_to_run]

        results = []
        
        # 2. 開啟多執行緒，把任務派發出去
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            # 提交任務並收集 Future 狀態
            futures = [executor.submit(execute_single_task, td) for td in tasks_data]
            # 等待所有執行緒跑完，並收集它們回傳的結果 (results)
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())
        
        # 3. 🎯 核心精髓：所有網路請求都跑完了，現在開始「一次性」寫入資料庫
        for res in results:
            task = db.session.get(MonitorTask, res['task_id'])
            if task:
                task.status = res['status']
                task.last_checked = datetime.now()
                
                new_log = MonitoringLog(
                    monitor_task_id=task.id,
                    response_time=res['latency'],
                    status_code=res['status_code'],
                    status=res['status'],
                    error_details=res['error_msg']
                )
                db.session.add(new_log)
                
                # 印出終端機 Log
                log_text = f"[{res['monitor_type'].upper()}] {res['site_name']}: {res['status']} ({res['latency']}ms)"
                if res['error_msg']: log_text += f" -> Error: {res['error_msg']}"
                print(log_text)
        
        # 💡 這一行最重要：統一提交！保證所有的 Log 都是「同生共死」的
        db.session.commit()
        
        print("[Scheduler] Scan finished.\n")

# 数据库自动清理机制 (Housekeeping)
def cleanup_old_logs():
    """定期清理超过 30 天的旧日志，防止数据库无限膨胀"""
    with app.app_context():
        try:
            # 计算 30 天前的时间节点 (因为 AI 报告最多需要 30 天的数据)
            cutoff_date = datetime.now() - timedelta(days=30)
            
            # 批量删除过期的海量日志
            deleted_count = MonitoringLog.query.filter(MonitoringLog.timestamp < cutoff_date).delete()
            db.session.commit()
            
            if deleted_count > 0:
                print(f"🧹 [Housekeeping] Successfully cleaned up {deleted_count} outdated logs (older than 30 days).")
        except Exception as e:
            db.session.rollback()
            print(f"❌ [Housekeeping Error] Failed to clean logs: {e}")

# --- 4. 启动定时任务 ---
# 只有在主进程才启动 Scheduler，防止 Debug 模式下启动两次
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    scheduler = BackgroundScheduler()
    
    # 1. 核心监控任务：每30秒自动扫描
    scheduler.add_job(func=scan_all_websites, trigger="interval", seconds=30) 
    
    # 2. 👇 新增的打扫任务：每 24 小时自动触发一次数据库清理
    scheduler.add_job(func=cleanup_old_logs, trigger="interval", hours=24) 
    
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown()) # 退出时关闭

# --- 抓包引擎全局变量 ---
sniffer_thread = None
stop_sniffing_flag = threading.Event()
current_target_host = ""

def packet_callback(packet):
    """当抓到一个包时的回调函数"""
    global current_target_host
    # 只处理带有 TCP Payload (Raw) 的 80 端口数据包
    if packet.haslayer(TCP) and packet.haslayer(Raw) and packet[TCP].dport == 80:
        try:
            # 尝试解码数据包内容
            payload = packet[Raw].load.decode('utf-8', errors='ignore')
            
            # 检查是否是 HTTP GET 请求
            if payload.startswith('GET') and 'Host: ' in payload:
                # 提取 Host 域名
                lines = payload.split('\r\n')
                host = ""
                for line in lines:
                    if line.startswith('Host: '):
                        host = line.split(' ')[1].strip()
                        break
                
                # 如果这个请求访问的域名，符合我们前端设置的目标 (比如 neverssl.com)
                if current_target_host in host:
                    with app.app_context():
                        new_log = TrafficLog(
                            source_ip=packet[IP].src,
                            method="GET",
                            host=host
                        )
                        db.session.add(new_log)
                        db.session.commit()
                        print(f"🚨 [Sniffer] Captured: {packet[IP].src} -> {host}")
        except Exception as e:
            pass # 忽略解析错误的干扰包

def start_sniffing_task():
    """在后台线程中运行的抓包任务"""
    global current_target_host
    
    # 动态寻找 IP 为 192.168.137.1 的热点网卡
    hotspot_iface = None
    for iface in conf.ifaces.values():
        if iface.ip == '192.168.137.1':
            hotspot_iface = iface
            break
            
    if not hotspot_iface:
        print("❌ [Sniffer Error] Could not find Hotspot interface (192.168.137.1). Is the hotspot turned on?")
        return

    print(f"[*] 🚀 Sniffer engine starting on: {hotspot_iface.name} ({hotspot_iface.ip})")
    
    try:
        sniff(
            filter="tcp port 80", 
            iface=hotspot_iface,  # 传入真实的网卡对象，而不是字符串名字
            prn=packet_callback, 
            store=0, 
            stop_filter=lambda p: stop_sniffing_flag.is_set()
        )
    except Exception as e:
        print(f"❌ [Sniffer Error] Could not start sniffing: {e}")

# --- 5. API 路由 ---
@app.route('/')
def home():
    return "MonWeb Intelligent Backend Running!"

@app.route('/api/test', methods=['GET'])
def test_connection():
    return jsonify({"status": "success", "message": "Backend Connected"})

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

# Scan Now Button 手动触发扫描接口
@app.route('/api/scan', methods=['POST'])
def manual_scan():
    scan_all_websites(force=True)
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
            interval=float(m.get('interval', 5.0)),
            timeout=int(m.get('timeout', 10.0))
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
        # 提取前端传来的监控类型 (比如 ['http', 'ping'])
        frontend_types = [m['type'] for m in data['monitors']]
        
        # 1. 更新已存在的任务，或创建新增的任务
        for m in data['monitors']:
            existing_task = MonitorTask.query.filter_by(website_id=site.id, monitor_type=m['type']).first()
            if existing_task:
                # 只更新参数，保留原有 ID，这样历史日志就不会丢失！
                existing_task.interval = float(m.get('interval', 5.0))
                existing_task.timeout = int(m.get('timeout', 10.0))
            else:
                new_task = MonitorTask(
                    website_id=site.id,
                    monitor_type=m['type'],
                    interval=float(m.get('interval', 5.0)),
                    timeout=int(m.get('timeout', 10.0))
                )
                db.session.add(new_task)
                
        # 2. 如果用户在前端取消勾选了某种监控，则删除该任务
        for old_task in site.monitor_tasks:
            if old_task.monitor_type not in frontend_types:
                MonitoringLog.query.filter_by(monitor_task_id=old_task.id).delete()
                db.session.delete(old_task)
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
        for task in site.monitor_tasks:
            MonitoringLog.query.filter_by(monitor_task_id=task.id).delete()
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
             .order_by(MonitoringLog.timestamp.desc()).limit(120).all()
    
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
        
        # 1. 根據前端傳來的時間範圍計算閾值
        now = datetime.now()
        if time_range == '24h':
            time_threshold = now - timedelta(hours=24)
        elif time_range == '30d':
            time_threshold = now - timedelta(days=30)
        else: # 預設 7d
            time_threshold = now - timedelta(days=7)

        # 2. 構建聯表查詢
        query = db.session.query(MonitoringLog, MonitorTask, Website)\
            .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
            .join(Website, MonitorTask.website_id == Website.id)\
            .filter(MonitoringLog.timestamp >= time_threshold)

        if target_site != 'all':
            query = query.filter(Website.id == int(target_site))
            
        logs = query.order_by(MonitoringLog.timestamp.desc()).limit(1000).all()
        
        if not logs:
            return jsonify({"status": "error", "message": "No monitoring data found for the selected time range and website."}), 400
            
        # 3. 數據清洗與聚合
        site_stats = {}
        errors_summary = {'HTTP_Errors': 0, 'PING_Errors': 0, 'Timeouts': 0}
        
        # 👇 核心修改：分開存儲 HTTP 和 PING 的圖表數據
        http_latencies = []
        ping_latencies = []
        
        for log, task, site in logs:
            site_name = site.name
            m_type = task.monitor_type.upper() 
            
            if site_name not in site_stats:
                site_stats[site_name] = {
                    "HTTP": {"total_checks": 0, "fails": 0, "error_reasons": set(), "latencies": [], "status_codes": set()},
                    "PING": {"total_checks": 0, "fails": 0, "error_reasons": set(), "latencies": []}
                }
                
            stats = site_stats[site_name][m_type]
            stats["total_checks"] += 1
            stats["latencies"].append(log.response_time)
            
            # 👇 讓 AI 知道具體的 HTTP Status Code (比如 404, 500)
            if m_type == 'HTTP' and log.status_code:
                stats["status_codes"].add(log.status_code)
            
            is_error = log.status == 'Down' or (log.status_code and log.status_code >= 400) or log.error_details
            
            if is_error:
                stats["fails"] += 1
                if log.error_details:
                    stats["error_reasons"].add(log.error_details)
                elif log.status_code:
                    stats["error_reasons"].add(f"HTTP Error {log.status_code}")
                else:
                    stats["error_reasons"].add("Unknown Error")
                    
                if m_type == 'HTTP': errors_summary['HTTP_Errors'] += 1
                if m_type == 'PING': errors_summary['PING_Errors'] += 1
                if 'timeout' in str(log.error_details).lower() or log.response_time == 0:
                    errors_summary['Timeouts'] += 1
                    
            # 👇 分開收集圖表數據
            chart_point = {
                "name": log.timestamp.strftime("%H:%M"),
                "ms": round(log.response_time, 2)
            }
            if m_type == 'HTTP':
                http_latencies.append(chart_point)
            elif m_type == 'PING':
                ping_latencies.append(chart_point)

        # 計算平均延遲並將 Set 轉換為 List
        for site, types in site_stats.items():
            for t, s in types.items():
                s["avg_latency_ms"] = round(sum(s["latencies"]) / s["total_checks"], 2) if s["total_checks"] > 0 else 0
                del s["latencies"] 
                s["error_reasons"] = list(s["error_reasons"])
                if "status_codes" in s:
                    s["status_codes"] = list(s["status_codes"])
                
        # 👇 4. 嚴密的白話文 Prompt (去除 HealthScore，禁止星號，禁深奧詞彙)
        prompt = f"""
        You are a helpful system monitoring assistant.
        Analyze the following website monitoring data, which separates HTTP and PING checks.
        
        Monitoring Data:
        {json.dumps(site_stats, ensure_ascii=False)}

        【Rules】
        1. Write in simple, natural, and easy-to-understand English. Do not use complex technical jargon.
        2. NEVER use technical examples like "(e.g., Apache, Nginx)". Just say "web server" or "website program".
        3. NEVER use asterisks (*) or any markdown formatting. Use plain text.
        4. Analyze the specific HTTP status codes and response times to give accurate insights.
        
        You must return ONLY valid JSON data. No markdown formatting.
        {{
            "summary": "A simple 2-3 sentence overview of how the websites are doing right now.",
            "incidentAnalysis": "A simple explanation of any problems found. If HTTP failed but PING worked, explain that the server is online but the website is not loading. Mention specific status codes if there are errors.",
            "insights": ["Simple insight 1 about response time or codes", "Simple insight 2"],
            "recommendations": ["Simple step 1 to fix the issue", "Simple step 2"]
        }}
        """

        print("[AI Report] Calling Gemini 2.5 Flash to diagnose system issues....")
        
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        # 👇 強制過濾大模型可能偷偷生成的 Markdown 星號
        response_text = response.text.strip().replace('*', '')
        
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]

        ai_data = json.loads(response_text.strip())

        error_chart = [{"name": k.replace('_', ' '), "value": v} for k, v in errors_summary.items() if v > 0]
        if not error_chart:
            error_chart = [{"name": "Normal Requests", "value": len(logs)}]
            
        http_latencies.reverse()
        ping_latencies.reverse()

        # 👇 5. 將分開的圖表數據傳給前端
        final_report = {
            "summary": ai_data.get("summary", ""),
            "incidentAnalysis": ai_data.get("incidentAnalysis", ""),
            "insights": ai_data.get("insights", []),
            "recommendations": ai_data.get("recommendations", []),
            "errorChartData": error_chart,
            "httpLatencyChartData": http_latencies[-10:], # 取最近10個點
            "pingLatencyChartData": ping_latencies[-10:]  # 取最近10個點
        }

        return jsonify({"status": "success", "data": final_report}), 200

    except Exception as e:
        print(f"[AI Report Error] {e}")
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

# 获取全站 Top 30 警报/异常历史记录
@app.route('/api/alerts/history', methods=['GET'])
def get_alert_history():
    # 联表查询：通过 MonitorTask 作为桥梁，连接 Log 和 Website
    logs = db.session.query(MonitoringLog, MonitorTask, Website)\
        .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
        .join(Website, MonitorTask.website_id == Website.id)\
        .filter(
            db.or_(
                MonitoringLog.status == 'Down',
                MonitoringLog.status == 'Warning' # 把 Warning 也納入警報歷史
            )
        ).order_by(MonitoringLog.timestamp.desc()).limit(30).all()

    output = []
    for log, task, site in logs:
        output.append({
            "id": log.id,
            "website_name": site.name,
            "monitor_type": task.monitor_type.upper(), # 獨立一個欄位告訴前端是 HTTP 還是 PING
            "url": site.url,
            "status": log.status, # 傳遞真實狀態 (Down 或 Warning)
            "status_code": log.status_code,
            "response_time": log.response_time,
            "error_details": log.error_details, # 把具體報錯原因傳給前端
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "is_muted": site.is_muted
        })
    return jsonify(output)

# 👇 新增：获取仪表盘全局响应时间趋势图数据
@app.route('/api/dashboard/chart', methods=['GET'])
def get_dashboard_chart():
    # 联表获取最新的 200 条记录
    logs = db.session.query(MonitoringLog, MonitorTask)\
        .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
        .order_by(MonitoringLog.timestamp.desc()).limit(200).all()
        
    trend_data = {}
    for log, task in logs:
        # 排除掉超时 (0ms) 的数据，避免拉低平均值导致图表失真
        if not log.response_time or log.response_time <= 0: 
            continue
            
        # 按 "HH:MM" 分钟级聚合
        time_str = log.timestamp.strftime("%H:%M")
        m_type = task.monitor_type.lower()
        
        if time_str not in trend_data:
            trend_data[time_str] = {"http": [], "ping": []}
            
        trend_data[time_str][m_type].append(log.response_time)
        
    output = []
    for time_str, data in trend_data.items():
        http_avg = round(sum(data["http"]) / len(data["http"]), 2) if data["http"] else 0
        ping_avg = round(sum(data["ping"]) / len(data["ping"]), 2) if data["ping"] else 0
        
        # 只要有任何一项数据就加入图表
        if http_avg > 0 or ping_avg > 0:
            output.append({
                "time": time_str,
                "http_ms": http_avg,
                "ping_ms": ping_avg
            })
            
    # 按时间正序排列 (从左到右)
    output.sort(key=lambda x: x['time'])
    
    # 只取最近的 15 个点以保证图表美观不拥挤
    return jsonify(output[-15:])

# --- 嗅探器 API ---
@app.route('/api/traffic/start', methods=['POST'])
def start_traffic_sniff():
    global sniffer_thread, stop_sniffing_flag, current_target_host
    data = request.json
    current_target_host = data.get('targetHost', 'neverssl.com')
    
    if sniffer_thread and sniffer_thread.is_alive():
        return jsonify({"message": "Sniffer is already running"}), 200

    # 启动前清空旧的历史记录
    with app.app_context():
        TrafficLog.query.delete()
        db.session.commit()

    stop_sniffing_flag.clear()
    sniffer_thread = threading.Thread(target=start_sniffing_task)
    sniffer_thread.daemon = True # 主程序退出时自动关闭
    sniffer_thread.start()
    
    return jsonify({"message": "Sniffing started", "target": current_target_host})

@app.route('/api/traffic/stop', methods=['POST'])
def stop_traffic_sniff():
    global stop_sniffing_flag
    stop_sniffing_flag.set() # 发送停止信号给 scapy
    return jsonify({"message": "Sniffing stopped"})

@app.route('/api/traffic/logs', methods=['GET'])
def get_traffic_logs():
    logs = TrafficLog.query.order_by(TrafficLog.timestamp.desc()).limit(15).all()
    output = []
    for log in logs:
        output.append({
            "id": log.id,
            "timestamp": log.timestamp.strftime("%H:%M:%S"),
            "sourceIp": log.source_ip,
            "method": log.method,
            "host": log.host
        })
    return jsonify(output)

# 👇 自动初始化数据库的函数
def auto_setup_database():
    with app.app_context():
        # 1. 自动建表（如果表已存在则会自动跳过）
        db.create_all()
        
        # 2. 自动检查并创建 Admin 账号
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@monweb.com', password='1234', role='Admin')
            db.session.add(admin_user)
            db.session.commit()
            print("✅ [System] Admin account created automatically.")

        # 3. 自动塞入全新架构的测试数据（如果数据库是空的）
        if not Website.query.first():
            print("⏳ [System] Populating production websites...")
            sites_data = [
                # === 第一组：每 30秒 (0.5分钟) 检查 PING ===
                {"name": "Majoriti", "url": "https://majoriti.com.my/", "ping_int": 0.5},
                {"name": "mStar", "url": "https://www.mstar.com.my/", "ping_int": 0.5},
                {"name": "Suria", "url": "https://suria.my/", "ping_int": 0.5},
                {"name": "Star Media Group", "url": "https://www.starmediagroup.my/", "ping_int": 0.5},
                {"name": "The Star", "url": "https://www.thestar.com.my/", "ping_int": 0.5},

                # === 第二组：每 1分钟 检查 PING ===
                {"name": "The Star Charts", "url": "https://charts.thestar.com.my/", "ping_int": 1},
                {"name": "Suria Dengar", "url": "https://dengar.suria.my/", "ping_int": 1},
                {"name": "Kuali", "url": "https://www.kuali.com/", "ping_int": 1},
                {"name": "988 Shop Now", "url": "https://shopnow.988.com.my/", "ping_int": 1},
                {"name": "The Star Events", "url": "https://events.thestar.com.my/", "ping_int": 1},
                {"name": "The Star Login", "url": "https://login.thestar.com.my/", "ping_int": 1},
                {"name": "myStarjob", "url": "https://mystarjob.com/", "ping_int": 1},
                {"name": "Star Leaders Council", "url": "https://starleaderscouncil.com.my/", "ping_int": 1},
                {"name": "SMG 360", "url": "https://smg360.com.my/", "ping_int": 1},
                {"name": "SOBA", "url": "https://soba.com.my/", "ping_int": 1},
                {"name": "The Star SSO", "url": "https://sso.thestar.com.my/", "ping_int": 1},
                {"name": "The Star TV", "url": "https://www.thestartv.com/", "ping_int": 1},
                {"name": "The Star Conference", "url": "https://conference.thestar.com.my/", "ping_int": 1},
                {"name": "StarProperty", "url": "https://www.starproperty.my/", "ping_int": 1},
                {"name": "CarSifu News", "url": "https://www.carsifu.my/news", "ping_int": 1},

                # === 第三组：每 2分钟 检查 PING ===
                {"name": "StarProperty Awards", "url": "https://awards.starproperty.my/national/2024/", "ping_int": 2},
                {"name": "StarProperty Best", "url": "https://best.starproperty.my/", "ping_int": 2},
                {"name": "Eye On The Ball", "url": "https://eyeontheballfilm.com/", "ping_int": 2},
                {"name": "StarProperty Fair", "url": "https://fair.starproperty.my/", "ping_int": 2},
                {"name": "Kirana", "url": "https://kirana.my/", "ping_int": 2},
                {"name": "StarProperty Pullout", "url": "https://pullout.starproperty.my/", "ping_int": 2},
                {"name": "Rage", "url": "https://www.rage.com.my/", "ping_int": 2},
                {"name": "Kuntum", "url": "https://www.kuntum.com.my/", "ping_int": 2},
                {"name": "Kuali Startup", "url": "https://startup.kuali.com/", "ping_int": 2},
                {"name": "Urban Biodiversity", "url": "https://www.urban-biodiversity.thestar.com.my/sime-darby-property/", "ping_int": 2}
            ]
            
            for s_data in sites_data:
                site = Website(name=s_data["name"], url=s_data["url"])
                db.session.add(site)
                db.session.commit() 
                
                # 👇 所有 HTTP 任务统一设置为 4 分钟
                http_task = MonitorTask(website_id=site.id, monitor_type='http', interval=4, timeout=10)
                # 👇 PING 任务根据数组里的专属配置动态设置
                ping_task = MonitorTask(website_id=site.id, monitor_type='ping', interval=s_data["ping_int"], timeout=10)
                
                db.session.add_all([http_task, ping_task])
            db.session.commit()
            print("✅ [System] Data populated successfully!")
        else:
            print("✅ [System] Database already initialized. No action needed.")

if __name__ == '__main__':
    auto_setup_database()  # 👈 每次启动 Flask 都会先自动执行这个安全检查！
    app.run(debug=True, port=5000)