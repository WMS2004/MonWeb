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

if __name__ == '__main__':
    app.run(debug=True, port=5000)