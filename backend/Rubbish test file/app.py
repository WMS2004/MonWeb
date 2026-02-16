# from flask import Flask, jsonify
# from flask_cors import CORS

# app = Flask(__name__)
# # 允许所有来源访问（开发阶段这样做比较方便）
# CORS(app)

# # 这是一个测试接口 (API)
# @app.route('/api/test', methods=['GET'])
# def test_connection():
#     # 这里以后会换成你的监控数据
#     data = {
#         "status": "success",
#         "message": "MonWeb Backend connection successful!",
#         "system_status": "Running"
#     }
#     return jsonify(data)

# if __name__ == '__main__':
#     # debug=True 让你可以看到报错信息
#     app.run(debug=True, port=5000)

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

custom_db_folder = r"C:\Users\LENOVO\OneDrive - Asia Pacific University\MonWeb-FYP\database"

# 关键修正：如果文件夹不存在，自动创建它！
if not os.path.exists(custom_db_folder):
    os.makedirs(custom_db_folder)
    print(f"Auto Create File Path For Database: {custom_db_folder}")

# 3. 拼接完整的文件路径
db_path = os.path.join(custom_db_folder, 'monweb.db')

# 配置数据库 (会在当前文件夹生成 monweb.db)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- 数据库模型 ---
class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    interval = db.Column(db.Integer, default=60) # 监控间隔(秒)

class Log(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False) # "UP" or "DOWN"
    latency = db.Column(db.Float) # 毫秒
    timestamp = db.Column(db.DateTime, default=datetime.now)

# --- 初始化数据库 ---
def init_db():
    with app.app_context():
        db.create_all()
        # 如果没有网站，加几个默认的
        if not Website.query.first():
            print("Initialize the default website...")
            sample_sites = [
                Website(name="Google", url="https://www.google.com"),
                Website(name="The Star", url="https://www.thestar.com.my"),
                Website(name="APU", url="https://www.apu.edu.my")
            ]
            db.session.add_all(sample_sites)
            db.session.commit()
            print("The default website has been added!")

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

if __name__ == '__main__':
    init_db() # 运行前先检查数据库
    app.run(debug=True, port=5000)