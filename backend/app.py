# import time
# import requests
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# from flask_sqlalchemy import SQLAlchemy
# from flask_apscheduler import APScheduler
# from datetime import datetime
# import os

# app = Flask(__name__)
# CORS(app, resources={r"/*": {"origins": "*"}})
# # CORS(app)

# custom_db_folder = r"D:\Learn\MonWeb-FYP\database"

# # 关键修正：如果文件夹不存在，自动创建它！
# if not os.path.exists(custom_db_folder):
#     os.makedirs(custom_db_folder)
#     print(f"Auto Create File Path For Database: {custom_db_folder}")

# # 3. 拼接完整的文件路径
# db_path = os.path.join(custom_db_folder, 'monweb.db')

# # 配置数据库 (会在当前文件夹生成 monweb.db)
# app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SCHEDULER_API_ENABLED'] = True

# db = SQLAlchemy(app)
# scheduler = APScheduler()

# def create_admin():
#     with app.app_context():
#         db.create_all() # 创建所有表
#         # 检查是否已有 admin
#         if not User.query.filter_by(username='admin').first():
#             new_admin = User(username='admin', email='admin@gmail.com', password='admin', role='Admin')
#             db.session.add(new_admin)
#             db.session.commit()
#             print(">>> Default Admin Created!")

# # --- 数据库模型 ---
# # 1. 用户表 (User Management 页面用)
# class User(UserMixin, db.Model):
#     id = db.Column(db.Integer, primary_key=True)
#     username = db.Column(db.String(150), unique=True, nullable=False)
#     email = db.Column(db.String(150), unique=True, nullable=False)
#     password = db.Column(db.String(200), nullable=False)
#     # 关键字段：Role。默认是 'User'，但你将创建一个 'Admin'
#     role = db.Column(db.String(20), default='User', nullable=False) 

# # 2. 网站表 (Dashboard & Website Status 页面用)
# class Website(db.Model):
#     id = db.Column(db.Integer, primary_key=True)
#     name = db.Column(db.String(100), nullable=False) # Friendly Name
#     url = db.Column(db.String(500), nullable=False)
#     check_type = db.Column(db.String(10), default='http') # http or ping
#     interval = db.Column(db.Integer, default=5) # 监控频率 (分钟)
#     # 存储最新状态，方便 Dashboard 快速读取
#     last_status = db.Column(db.String(20), default='Pending') # Up, Down, Warning
#     last_response_time = db.Column(db.Float, default=0)

# # 3. 监控日志表 (Details & NLP Reports 页面用)
# class MonitorLog(db.Model):
#     id = db.Column(db.Integer, primary_key=True)
#     website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
#     status_code = db.Column(db.Integer) # 200, 404, 500
#     response_time = db.Column(db.Float)
#     timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# # --- 3. 核心监控功能 (新增部分) ---
# def check_website(website_id, url):
#     """
#     实际执行 Ping/Request 的函数
#     """
#     with app.app_context(): # 必须在 Flask 上下文中运行以访问数据库
#         try:
#             start_time = time.time()
#             # 发送请求，超时设置为 10 秒
#             response = requests.get(url, timeout=10)
#             # 计算延迟 (毫秒)
#             latency = round((time.time() - start_time) * 1000, 2)
            
#             # 判断状态
#             if response.status_code == 200:
#                 status = "UP"
#             else:
#                 status = f"ERR {response.status_code}"
            
#             print(f"[Monitoring] {url} -> {status} ({latency}ms)")

#         except Exception as e:
#             # 如果请求失败（比如断网或网站挂了）
#             latency = 0
#             status = "DOWN"
#             print(f"[Error] {url} -> DOWN: {str(e)}")

#         # 将结果存入 Log 表
#         new_log = Log(website_id=website_id, status=status, latency=latency)
#         db.session.add(new_log)
#         db.session.commit()

# # --- 4. 定时任务 (新增部分) ---
# # 设置为每 30 秒执行一次监控
# @scheduler.task('interval', id='monitor_job', seconds=30)
# def scheduled_monitoring():
#     with app.app_context():
#         websites = Website.query.all()
#         print(f"\n--- A new round of monitoring begins ({len(websites)} per websites) ---")
#         for site in websites:
#             # 这里调用上面的 check_website 函数
#             check_website(site.id, site.url)

# def init_db():
#     with app.app_context():
#         db.create_all()
        
#         # 定义你想要的所有默认网站
#         target_sites = [
#             {"name": "Google", "url": "https://www.google.com"},
#             {"name": "The Star", "url": "https://www.thestar.com.my"},
#             {"name": "APU", "url": "https://www.apu.edu.my"},
#             {"name": "YouTube", "url": "https://www.youtube.com"}, # 新增的
#             {"name": "GitHub", "url": "https://www.github.com"} # 新增的
#         ]

#         print("Checking New Websites Lists...")
        
#         for site_data in target_sites:
#             # 检查这个 URL 是否已经存在于数据库中
#             existing_site = Website.query.filter_by(url=site_data['url']).first()
            
#             if not existing_site:
#                 # 如果不存在，才添加
#                 new_site = Website(name=site_data['name'], url=site_data['url'])
#                 db.session.add(new_site)
#                 print(f"Done Add New Websites: {site_data['name']}")
#             else:
#                 print(f"Skip Add Websites: {site_data['name']}")

#         db.session.commit()
#         print("Done Update Websites Lists!")

# # --- API 接口 ---
# @app.route('/api/websites', methods=['GET'])
# def get_websites():
#     sites = Website.query.all()
#     output = []
#     for site in sites:
#         output.append({
#             "id": site.id,
#             "name": site.name,
#             "url": site.url,
#             "interval": site.interval
#         })
#     return jsonify(output)

# # (新增) 获取最新监控状态 - 供前端 Dashboard 使用
# @app.route('/api/status', methods=['GET'])
# def get_status():
#     results = []
#     websites = Website.query.all()
#     for site in websites:
#         # 获取该网站最新的一条 Log
#         latest_log = Log.query.filter_by(website_id=site.id).order_by(Log.timestamp.desc()).first()
        
#         results.append({
#             "id": site.id,
#             "name": site.name,
#             "url": site.url,
#             "status": latest_log.status if latest_log else "PENDING",
#             "latency": latest_log.latency if latest_log else 0,
#             "last_check": latest_log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if latest_log else "Never"
#         })
#     return jsonify(results)



# if __name__ == '__main__':
#     init_db() # 运行前先检查数据库

#     # 2. 启动定时任务调度器
#     scheduler.init_app(app)
#     scheduler.start()
#     print("MonWeb Monitoring Scheduler Started...")

#     app.run(debug=True, port=5000)

import os
import platform
import subprocess
import requests
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

app = Flask(__name__)
CORS(app)

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
    last_checked = db.Column(db.DateTime, default=datetime.utcnow)
    # 新增字段 (为了匹配你的设计图)
    timeout = db.Column(db.Integer, default=10)        # 超时阈值
    monitor_type = db.Column(db.String(20), default='http') # http 或 ping
    ai_enabled = db.Column(db.Boolean, default=True)   # 是否启用 AI
    logs = db.relationship('MonitoringLog', backref='website', lazy=True)

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
            site.last_checked = datetime.utcnow()
            
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
        output.append({
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "status": site.status,
            "last_checked": site.last_checked.strftime("%H:%M:%S") if site.last_checked else "Never"
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)