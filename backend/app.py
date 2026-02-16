import time
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_apscheduler import APScheduler
from datetime import datetime
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
# CORS(app)

custom_db_folder = r"D:\Learn\MonWeb-FYP\database"

# 关键修正：如果文件夹不存在，自动创建它！
if not os.path.exists(custom_db_folder):
    os.makedirs(custom_db_folder)
    print(f"Auto Create File Path For Database: {custom_db_folder}")

# 3. 拼接完整的文件路径
db_path = os.path.join(custom_db_folder, 'monweb.db')

# 配置数据库 (会在当前文件夹生成 monweb.db)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SCHEDULER_API_ENABLED'] = True

db = SQLAlchemy(app)
scheduler = APScheduler()

def create_admin():
    with app.app_context():
        db.create_all() # 创建所有表
        # 检查是否已有 admin
        if not User.query.filter_by(username='admin').first():
            new_admin = User(username='admin', email='admin@gmail.com', password='admin', role='Admin')
            db.session.add(new_admin)
            db.session.commit()
            print(">>> Default Admin Created!")

# --- 数据库模型 ---
# 1. 用户表 (User Management 页面用)
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    # 关键字段：Role。默认是 'User'，但你将创建一个 'Admin'
    role = db.Column(db.String(20), default='User', nullable=False) 

# 2. 网站表 (Dashboard & Website Status 页面用)
class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False) # Friendly Name
    url = db.Column(db.String(500), nullable=False)
    check_type = db.Column(db.String(10), default='http') # http or ping
    interval = db.Column(db.Integer, default=5) # 监控频率 (分钟)
    # 存储最新状态，方便 Dashboard 快速读取
    last_status = db.Column(db.String(20), default='Pending') # Up, Down, Warning
    last_response_time = db.Column(db.Float, default=0)

# 3. 监控日志表 (Details & NLP Reports 页面用)
class MonitorLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    status_code = db.Column(db.Integer) # 200, 404, 500
    response_time = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# --- 3. 核心监控功能 (新增部分) ---
def check_website(website_id, url):
    """
    实际执行 Ping/Request 的函数
    """
    with app.app_context(): # 必须在 Flask 上下文中运行以访问数据库
        try:
            start_time = time.time()
            # 发送请求，超时设置为 10 秒
            response = requests.get(url, timeout=10)
            # 计算延迟 (毫秒)
            latency = round((time.time() - start_time) * 1000, 2)
            
            # 判断状态
            if response.status_code == 200:
                status = "UP"
            else:
                status = f"ERR {response.status_code}"
            
            print(f"[Monitoring] {url} -> {status} ({latency}ms)")

        except Exception as e:
            # 如果请求失败（比如断网或网站挂了）
            latency = 0
            status = "DOWN"
            print(f"[Error] {url} -> DOWN: {str(e)}")

        # 将结果存入 Log 表
        new_log = Log(website_id=website_id, status=status, latency=latency)
        db.session.add(new_log)
        db.session.commit()

# --- 4. 定时任务 (新增部分) ---
# 设置为每 30 秒执行一次监控
@scheduler.task('interval', id='monitor_job', seconds=30)
def scheduled_monitoring():
    with app.app_context():
        websites = Website.query.all()
        print(f"\n--- A new round of monitoring begins ({len(websites)} per websites) ---")
        for site in websites:
            # 这里调用上面的 check_website 函数
            check_website(site.id, site.url)

def init_db():
    with app.app_context():
        db.create_all()
        
        # 定义你想要的所有默认网站
        target_sites = [
            {"name": "Google", "url": "https://www.google.com"},
            {"name": "The Star", "url": "https://www.thestar.com.my"},
            {"name": "APU", "url": "https://www.apu.edu.my"},
            {"name": "YouTube", "url": "https://www.youtube.com"}, # 新增的
            {"name": "GitHub", "url": "https://www.github.com"} # 新增的
        ]

        print("Checking New Websites Lists...")
        
        for site_data in target_sites:
            # 检查这个 URL 是否已经存在于数据库中
            existing_site = Website.query.filter_by(url=site_data['url']).first()
            
            if not existing_site:
                # 如果不存在，才添加
                new_site = Website(name=site_data['name'], url=site_data['url'])
                db.session.add(new_site)
                print(f"Done Add New Websites: {site_data['name']}")
            else:
                print(f"Skip Add Websites: {site_data['name']}")

        db.session.commit()
        print("Done Update Websites Lists!")

# --- API 接口 ---
@app.route('/api/websites', methods=['GET'])
def get_websites():
    sites = Website.query.all()
    output = []
    for site in sites:
        output.append({
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "interval": site.interval
        })
    return jsonify(output)

# (新增) 获取最新监控状态 - 供前端 Dashboard 使用
@app.route('/api/status', methods=['GET'])
def get_status():
    results = []
    websites = Website.query.all()
    for site in websites:
        # 获取该网站最新的一条 Log
        latest_log = Log.query.filter_by(website_id=site.id).order_by(Log.timestamp.desc()).first()
        
        results.append({
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "status": latest_log.status if latest_log else "PENDING",
            "latency": latest_log.latency if latest_log else 0,
            "last_check": latest_log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if latest_log else "Never"
        })
    return jsonify(results)



if __name__ == '__main__':
    init_db() # 运行前先检查数据库

    # 2. 启动定时任务调度器
    scheduler.init_app(app)
    scheduler.start()
    print("MonWeb Monitoring Scheduler Started...")

    app.run(debug=True, port=5000)