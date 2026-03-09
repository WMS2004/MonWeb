import os
import platform
import subprocess
import requests
import time
import json 
from google import genai
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
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
    interval = db.Column(db.Integer, default=5)      # 监控频率 (分钟)
    status = db.Column(db.String(20), default='Unknown') # Up, Down, Warning
    last_checked = db.Column(db.DateTime, default=datetime.now)
    timeout = db.Column(db.Integer, default=10)        # 超时阈值
    monitor_type = db.Column(db.String(20), default='http') # http 或 ping
    ai_enabled = db.Column(db.Boolean, default=True)   # 是否启用 AI
    is_muted = db.Column(db.Boolean, default=False) # 是否静默 (不发通知)
    logs = db.relationship('MonitoringLog', backref='website', lazy=True, cascade="all, delete-orphan") # 关联日志表，删除网站时也删除相关日志

class AlertSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    browser_notify = db.Column(db.Boolean, default=True)
    sound_enabled = db.Column(db.Boolean, default=True)
    fail_count = db.Column(db.Integer, default=2) # 触发次数
    smart_mute = db.Column(db.Boolean, default=True) # 智能静音
    mp3_url = db.Column(db.String(500), default='https://actions.google.com/sounds/v1/alarms/beep_short.ogg')

# 监控日志表 (存历史数据用来画图)
class MonitoringLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    response_time = db.Column(db.Float) # 毫秒 (ms)
    status_code = db.Column(db.Integer) # 200, 404, 500
    status = db.Column(db.String(20))   # "UP" or "DOWN"
    latency = db.Column(db.Float)       # 毫秒
    timestamp = db.Column(db.DateTime, default=datetime.now)

# --- 3. 核心监控逻辑 (你的 Python 脚本复活了！) ---
def ping_host(host):
    """
    执行 Ping 命令，返回 (是否成功, 耗时ms)
    """
    # Windows 使用 -n 1, Linux/Mac 使用 -c 1
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    command = ['ping', param, '1', host]
    
    try:
        start_time = time.time()
        # 执行命令，禁止输出到控制台
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        end_time = time.time()
        
        duration = (end_time - start_time) * 1000 # 转换为毫秒
        
        if result.returncode == 0:
            return True, round(duration, 2)
        else:
            return False, 0
    except Exception as e:
        print(f"Ping Error for {host}: {e}")
        return False, 0

def scan_all_websites():
    """
    后台任务：扫描所有网站并更新数据库
    """
    with app.app_context():
        print(f"\n[Scheduler] Starting scan at {datetime.now().strftime('%H:%M:%S')}...")
        websites = Website.query.all()
        
        for site in websites:
            # 简单的逻辑：如果是 http 开头就不用处理，如果是 IP 或域名则直接用
            target = site.url.replace('https://', '').replace('http://', '').split('/')[0]
            
            is_up, latency = ping_host(target)
            
            # --- 智能状态判断逻辑 ---
            old_status = site.status
            if not is_up:
                new_status = "Down"
            elif latency > 400: # 超过 400ms 算 Warning
                new_status = "Warning"
            else:
                new_status = "Up"
            
            # 更新 Website 表状态
            site.status = new_status
            site.last_checked = datetime.now()
            
            # 插入历史日志 (MonitoringLog)
            new_log = MonitoringLog(
                website_id=site.id,
                response_time=latency,
                status_code=200 if is_up else 500 # 简单模拟状态码
            )
            db.session.add(new_log)
            
            print(f" - {site.name}: {new_status} ({latency}ms)")

        db.session.commit()
        print("[Scheduler] Scan finished.\n")

# --- 4. 启动定时任务 ---
# 只有在主进程才启动 Scheduler，防止 Debug 模式下启动两次
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=scan_all_websites, trigger="interval", seconds=60) # 每60秒自动扫描
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

        # --- 新增：初始化 admin 用户 ---
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@monweb.com', password='1234', role='Admin')
            db.session.add(admin_user)

        if not Website.query.first():
            # 添加几个更有趣的测试网站
            sites = [
                Website(name="Google DNS", url="8.8.8.8", status="Unknown"),
                Website(name="Cloudflare DNS", url="1.1.1.1", status="Unknown"),
                Website(name="Localhost", url="127.0.0.1", status="Unknown"),
                Website(name="Github", url="github.com", status="Unknown"),
                Website(name="Fake Website", url="this-site-definitely-does-not-exist.com", status="Unknown") # 测试宕机
            ]
            db.session.add_all(sites)
            db.session.commit()
            return jsonify({"message": "Database initialized with test data!"})
        return jsonify({"message": "Database already exists."})

@app.route('/api/websites', methods=['GET'])
def get_websites():
    websites = Website.query.all()
    output = []
    for site in websites:
        # 👇 新增：去日志表里找该网站最新的一条扫描记录
        latest_log = MonitoringLog.query.filter_by(website_id=site.id).order_by(MonitoringLog.timestamp.desc()).first()
        
        # 👇 新增：如果有记录，就提取 response_time
        res_time = latest_log.response_time if latest_log else None

        output.append({
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "status": site.status,
            "last_checked": site.last_checked.strftime("%H:%M:%S") if site.last_checked else "Never",
            "response_time": res_time,  # 👇 新增：把响应时间传给前端！
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
    
    new_site = Website(
        name=data['name'],
        url=data['url'],
        interval=int(data.get('interval', 5)),
        timeout=int(data.get('timeout', 10)),           # 新增：保存超时设置
        monitor_type=data.get('checkType', 'http'),     # 新增：保存检测类型
        ai_enabled=bool(data.get('aiEnabled', True)),   # 新增：保存AI开关
        status="Unknown"
    )
    
    try:
        db.session.add(new_site)
        db.session.commit()
        return jsonify({"message": "Website added!", "id": new_site.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- 2. 编辑/更新网站 API (全新增加) ---
@app.route('/api/websites/<int:id>', methods=['PUT'])
def update_website(id):
    site = Website.query.get_or_404(id)
    data = request.json
    if not data:
        return jsonify({"error": "Invalid data"}), 400
        
    # 逐一更新传过来的字段
    if 'name' in data: site.name = data['name']
    if 'url' in data: site.url = data['url']
    if 'interval' in data: site.interval = int(data['interval'])
    if 'timeout' in data: site.timeout = int(data['timeout'])
    if 'checkType' in data: site.monitor_type = data['checkType']
    if 'aiEnabled' in data: site.ai_enabled = bool(data['aiEnabled'])
    if 'is_muted' in data: site.is_muted = bool(data['is_muted'])
    
    try:
        db.session.commit()
        return jsonify({"message": "Website updated successfully!"}), 200
    except Exception as e:
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
    
    # 从数据库获取该网站最近的 30 条日志记录
    logs = MonitoringLog.query.filter_by(website_id=id).order_by(MonitoringLog.timestamp.desc()).limit(30).all()
    
    # 倒序排列，因为我们要画图，时间必须是从左到右（过去 -> 现在）
    logs_data = []
    for log in reversed(logs):
        logs_data.append({
            "time": log.timestamp.strftime("%H:%M:%S"),
            "response_time": log.response_time,
            "status_code": log.status_code
        })
        
    return jsonify({
        "website": {
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "status": site.status,
            "interval": site.interval,
            "timeout": site.timeout,
            "monitor_type": site.monitor_type,
            "ai_enabled": site.ai_enabled,
            "monitoring_since": site.last_checked.strftime("%Y/%m/%d") if site.last_checked else "N/A"
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
    # 联表查询：找出状态码非200，或者响应时间为0（宕机），或者状态标记为Down的记录
    logs = db.session.query(MonitoringLog, Website).join(Website).filter(
        db.or_(
            MonitoringLog.status_code != 200,
            MonitoringLog.response_time == 0,
            MonitoringLog.status == 'Down'
        )
    ).order_by(MonitoringLog.timestamp.desc()).limit(30).all()

    output = []
    for log, site in logs:
        output.append({
            "id": log.id,
            "website_name": site.name,
            "url": site.url,
            "status_code": log.status_code,
            "response_time": log.response_time,
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
    return jsonify(output)

if __name__ == '__main__':
    app.run(debug=True, port=5000)