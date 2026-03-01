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
    # 新增字段 (为了匹配你的设计图)
    timeout = db.Column(db.Integer, default=10)        # 超时阈值
    monitor_type = db.Column(db.String(20), default='http') # http 或 ping
    ai_enabled = db.Column(db.Boolean, default=True)   # 是否启用 AI
    logs = db.relationship('MonitoringLog', backref='website', lazy=True, cascade="all, delete-orphan") # 关联日志表，删除网站时也删除相关日志

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
            "response_time": res_time  # 👇 新增：把响应时间传给前端！
        })
    return jsonify(output)

# 新增：手动触发扫描接口
@app.route('/api/scan', methods=['POST'])
def manual_scan():
    scan_all_websites()
    return jsonify({"message": "Scan completed successfully!"})

# --- 添加新网站 API ---
@app.route('/api/websites', methods=['POST'])
def add_website():
    data = request.json
    if not data or 'name' not in data or 'url' not in data:
        return jsonify({"error": "Invalid data"}), 400
    
    # 简单的逻辑：不管前端选 HTTP 还是 Ping，我们后端暂时都先存下来
    # 真正的高级检测逻辑以后再根据 type 细分
    new_site = Website(
        name=data['name'],
        url=data['url'],
        interval=int(data.get('interval', 5)),
        status="Unknown"
    )
    
    try:
        db.session.add(new_site)
        db.session.commit()
        return jsonify({"message": "Website added!", "id": new_site.id}), 201
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
    
    # 在 User 表中查询匹配的用户
    user = User.query.filter_by(username=username).first()
    
    # 验证用户名和密码 (当前为明文对比)
    if user and user.password == password:
        return jsonify({
            "status": "success", 
            "message": "Login successful",
            "user": {
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
        
        print(f"[AI Report] 正在提取数据库记录... 范围: {time_range}, 目标: {target_site}")
        
        # 1. 从数据库提取真实的监控日志 (此处提取最近 200 条作为样本)
        logs = MonitoringLog.query.order_by(MonitoringLog.timestamp.desc()).limit(200).all()
        
        if not logs:
            return jsonify({"status": "error", "message": "数据库中尚无监控数据，请等待系统运行一段时间后再生成报告。"}), 400
            
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
            "总检测次数": total_requests,
            "平均响应时间 (ms)": round(avg_latency, 2),
            "整体可用性": f"{uptime_percent:.2f}%",
            "各类错误发生次数": errors
        }

        # 3. 构建严密的 Prompt (提示词)
        prompt = f"""
        你是一个拥有10年经验的高级 AIOps 与网络安全架构师。
        请基于以下最新的网站监控数据，用中文生成一份专业的系统诊断报告。
        
        监控数据：
        {json.dumps(db_stats, ensure_ascii=False)}

        【重要强制要求】
        你必须且只能返回合法的 JSON 格式数据，绝对不要包含任何 markdown 代码块标记 (比如 ```json )，直接输出花括号开头的原生 JSON 字符串。
        JSON 必须严格符合以下结构：
        {{
            "summary": "执行摘要（3-4句话的总体评价，请结合数据中的可用性和响应时间来写）",
            "healthScore": "健康评分，只能从 A, B, C, D 中选一个 (如果没有错误就是A，错误多就是C或D)",
            "incidentAnalysis": "故障与根因分析详细段落 (如果错误为0，就表扬系统极度稳定；如果有错误，请像专家一样合理推测原因，比如服务器过载、网络波动等)",
            "insights": ["性能或安全洞察点1", "性能或安全洞察点2"],
            "recommendations": ["具体运维建议1", "具体运维建议2", "具体运维建议3"]
        }}
        """

        print("[AI Report] 正在调用 Gemini 2.5 Flash 大模型分析数据...")
        
        # 4. 调用新版 Gemini API
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        response_text = response.text.strip()
        print("\n========== Gemini AI 原始返回数据 ==========")
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
        你现在是 MonWeb (一个网站实时监控系统) 的专属 AI 助理。
        现在有一个用户正在 Support 页面向你求助。
        
        请遵循以下严格规则：
        1. 语气必须非常人性化、像一个懂技术的老前辈一样轻松。
        2. 回答必须精简，直接切中要点，不要长篇大论。
        3. 绝对、绝对、绝对不要使用任何 Markdown 的星号 (*) 来进行加粗或做列表！纯文本输出即可。
        4. 如果用户问的问题和网站监控无关，请幽默地把它拉回 MonWeb 系统的话题上。
        
        用户的问题是：
        {user_message}
        """

        print(f"[Support AI] 正在思考用户问题: {user_message}")
        
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
        return jsonify({"status": "error", "message": "Oops! 我的大脑短路了一下，请稍后再试。"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)