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
import ipaddress
import queue
from collections import defaultdict
from scapy.all import sniff, IP, TCP, UDP, ICMP, Raw, conf, DNSQR
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

# --- 1. Database Configuration ---
# The database files will be generated in the instance directory or root directory under the backend folder.
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'monweb.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- 2. Define Data Models ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='User') # Admin, Technical, User

class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False) #  "Company Blog"
    url = db.Column(db.String(500), nullable=False)  # https://google.com"
    is_muted = db.Column(db.Boolean, default=False) 
    monitor_tasks = db.relationship('MonitorTask', backref='website', lazy=True, cascade="all, delete-orphan") # Associate the monitoring task table, delete the related tasks when deleting a website.

class MonitorTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    monitor_type = db.Column(db.String(20), nullable=False) # 'http', 'ping'
    interval = db.Column(db.Float, default=5.0)      
    timeout = db.Column(db.Integer, default=10)     
    status = db.Column(db.String(20), default='Unknown') #  Up or Down
    last_checked = db.Column(db.DateTime, default=datetime.now)

class MonitoringLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    monitor_task_id = db.Column(db.Integer, db.ForeignKey('monitor_task.id'), nullable=False)
    response_time = db.Column(db.Float) # ms
    status_code = db.Column(db.Integer) # 200, 404, 500
    status = db.Column(db.String(20))   # "UP" or "DOWN"
    error_details = db.Column(db.Text, nullable=True) 
    timestamp = db.Column(db.DateTime, default=datetime.now, index=True)

class AlertSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    browser_notify = db.Column(db.Boolean, default=True)
    sound_enabled = db.Column(db.Boolean, default=True)
    fail_count = db.Column(db.Integer, default=2) # Trigger count
    smart_mute = db.Column(db.Boolean, default=True) 
    mp3_url = db.Column(db.String(500), default='https://actions.google.com/sounds/v1/alarms/beep_short.ogg')

class TrafficLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.now)
    source_ip = db.Column(db.String(50))
    dest_ip = db.Column(db.String(50))
    dest_port = db.Column(db.String(20))
    protocol = db.Column(db.String(20))     # TCP, UDP, ICMP 
    location = db.Column(db.String(100))    # GeoIP Geographical location
    asn_isp = db.Column(db.String(150))     # Operators or organizations
    packet_size = db.Column(db.Integer)

# --- Define Global User-Agent Pool ---
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

# Core monitoring logic PING
def ping_host(host, timeout_sec):
    # Execute PING
    # Windows uses -n 1, Linux/Mac uses -c 1
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    timeout_arg = '-w' if platform.system().lower() == 'windows' else '-W'
    timeout_val = str(timeout_sec * 1000) if platform.system().lower() == 'windows' else str(timeout_sec)
    command = ['ping', param, '1', timeout_arg, timeout_val, host]
    
    try:
        start_time = time.time()
        # Execute command, suppress output to console
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout_sec + 2, text=True)
        duration = (time.time() - start_time) * 1000 # Convert to milliseconds
        
        if result.returncode == 0:
            return True, round(duration, 2), 200, None
        else:
            error_output = (result.stderr.strip() or result.stdout.strip())
            if "could not find host" in error_output.lower() or "name or service not known" in error_output.lower():
                return False, 0, 0, "DNS Resolution Failed: Host not found."
            elif "timed out" in error_output.lower() or "100% loss" in error_output.lower():
                return False, 0, 0, f"Ping Timeout: No response within {timeout_sec} seconds."
            else:
                return False, 0, 0, f"ICMP Error: {error_output[:500]}" # Truncate overly long logs
            return False, 0, 0, f"Ping Failed: {error_output[:500]}" # Truncate overly long logs
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
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7", # Tell server to accept English and Chinese
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1", # Simulate browser automatically trying to upgrade from HTTP to HTTPS
        "Sec-Fetch-Dest": "document",     # Modern browser发出的跨域请求防范头
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1"
    }
    try:
        start_time = time.time()
        # allow_redirects=True allows redirects.
        response = requests.get(target_url, headers=headers, timeout=timeout_sec, allow_redirects=True, stream=True)
        duration = (time.time() - start_time) * 1000
        response.close()
        
        if 200 <= response.status_code < 400:
            return True, round(duration, 2), response.status_code, None
        else:
            # Capture specific errors such as 404 Not Found, 502 Bad Gateway
            return False, round(duration, 2), response.status_code, f"HTTP Error {response.status_code}: {response.reason}"
            
    except requests.exceptions.Timeout:
        return False, 0, 0, f"Connection Timeout: Server didn't respond in {timeout_sec}s."
    except requests.exceptions.SSLError:
        return False, 0, 0, "SSL Certificate Error: Invalid or expired certificate."
    except requests.exceptions.ConnectionError:
        return False, 0, 0, "Connection Refused: Server is down or DNS resolving failed."
    except Exception as e:
        return False, 0, 0, f"Request Exception: {str(e)}"

# Single-site scan function, called by the thread pool
def execute_single_task(task_data):
    target = task_data['url']
    is_up = False
    latency, status_code = 0, 0
    error_msg = None

    # 1. Assign detection tasks based on type
    if task_data['type'] == 'ping':
        clean_target = target.replace('https://', '').replace('http://', '').split('/')[0]
        is_up, latency, status_code, error_msg = ping_host(clean_target, task_data['timeout'])
    elif task_data['type'] == 'http':
        is_up, latency, status_code, error_msg = http_check(target, task_data['timeout'])
        
    # 2. Intelligent Status Judgment
    if not is_up:
        new_status = "Down"
    elif task_data['type'] == 'ping' and latency > 500:
        new_status = "Warning"
    elif task_data['type'] == 'http' and latency > 3000:
        new_status = "Warning"
    else:
        new_status = "Up"
        
    # 3. Processing complete, package the results into a dictionary and return to the main scheduler
    return {
        "task_id": task_data['id'],
        "status": new_status,
        "latency": latency,
        "status_code": status_code,
        "error_msg": error_msg,
        "monitor_type": task_data['type'],
        "site_name": task_data['name']
    }  

# Full-site scan function, called by the timer
def scan_all_websites(force=False):
    """Use multiple threads to execute all monitoring tasks concurrently."""
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

        # 1. Extract the required data and package it for the threads (to avoid cross-thread operations with SQLAlchemy objects)
        tasks_data = [{
            'id': t.id,
            'url': t.website.url,
            'type': t.monitor_type,
            'timeout': t.timeout,
            'name': t.website.name
        } for t in task_to_run]

        results = []
        
        # 2. Create multiple threads and dispatch tasks.
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            # Submit tasks and collect Future states
            futures = [executor.submit(execute_single_task, td) for td in tasks_data]
            # Wait for all threads to complete and collect their results (results)
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())
        
        # 3. 🎯 Core essence: All network requests are done, now start writing to the database
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
                
                # Print terminal log
                log_text = f"[{res['monitor_type'].upper()}] {res['site_name']}: {res['status']} ({res['latency']}ms)"
                if res['error_msg']: log_text += f" -> Error: {res['error_msg']}"
                print(log_text)
        
        db.session.commit()
        
        print("[Scheduler] Scan finished.\n")

# Automatic database cleanup mechanism (Housekeeping)
def cleanup_old_logs():
    """定期清理超过 30 天的旧日志，防止数据库无限膨胀"""
    with app.app_context():
        try:
            # Calculate the time node 30 days ago (because AI reports need up to 30 days of data)
            cutoff_date = datetime.now() - timedelta(days=30)
            
            # Batch delete expired massive logs
            deleted_count = MonitoringLog.query.filter(MonitoringLog.timestamp < cutoff_date).delete()
            db.session.commit()
            
            if deleted_count > 0:
                print(f"🧹 [Housekeeping] Successfully cleaned up {deleted_count} outdated logs (older than 30 days).")
        except Exception as e:
            db.session.rollback()
            print(f"❌ [Housekeeping Error] Failed to clean logs: {e}")

# --- 4. Start a scheduled task ---
# Scheduler is only started in the main process to prevent it from starting twice in Debug mode.
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    scheduler = BackgroundScheduler()
    
    # 1. Core monitoring task: Scan all websites every 30 seconds
    scheduler.add_job(func=scan_all_websites, trigger="interval", seconds=30) 
    
    # 2. 👇 New cleanup task: Trigger database cleanup every 24 hours
    scheduler.add_job(func=cleanup_old_logs, trigger="interval", hours=24) 
    
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown()) # 退出时关闭

# --- Packet capture engine global variables ---
sniffer_thread = None
db_writer_thread = None
stop_sniffing_flag = threading.Event()
packet_queue = queue.Queue(maxsize=1000) # Preventing packet capture from being blocked
IP_CACHE = {}         # GeoIP cache pool to prevent API rate exceeding limits.
SEEN_CONNECTIONS = {} # Connection status records, used for throttling
ATTACK_TRACKER = defaultdict(lambda: {"ports": set(), "count": 0, "last_time": time.time()})

def get_geoip_info(ip):
    """GeoIP query with caching and anti-blocking mechanisms"""
    try:
        # If it's a local area network (LAN) IP address (like when you access your router), 
        # you don't need to look it up.
        if ipaddress.ip_address(ip).is_private:
            return "Local Network", "Private IP"
    except:
        return "Unknown", "Unknown"

    # If this IP has been queried before, it can be retrieved directly from memory
    if ip in IP_CACHE:
        return IP_CACHE[ip]['location'], IP_CACHE[ip]['isp']

    try:
        # # Use the free IP API (no API Key required)
        response = requests.get(f"http://ip-api.com/json/{ip}?fields=country,city,isp,org", timeout=2)
        if response.status_code == 200:
            data = response.json()
            location = f"{data.get('country', 'Unknown')} - {data.get('city', 'Unknown')}"
            isp = data.get('org') or data.get('isp') or "Unknown"
            
            # 存入缓存
            IP_CACHE[ip] = {'location': location, 'isp': isp}
            return location, isp
    except Exception:
        pass
    
    IP_CACHE[ip] = {'location': 'Unknown', 'isp': 'Unknown'}
    return "Unknown", "Unknown"

def packet_callback(packet):
    if IP not in packet:
        return
        
    src_ip = packet[IP].src
    dst_ip = packet[IP].dst
    packet_size = len(packet)
    
    protocol = "Other"
    dest_port = "N/A"
    
    if packet.haslayer(DNSQR) and packet.haslayer(UDP) and packet[UDP].dport == 53:
        try:
            # Extract the real domain name (e.g., apu.edu.my)
            domain_name = packet[DNSQR].qname.decode('utf-8').rstrip('.')
            dst_ip = domain_name 
            protocol = "DNS"
            dest_port = "53"
        except:
            pass

    elif TCP in packet:
        protocol = "TCP"
        dest_port = str(packet[TCP].dport)
    elif UDP in packet:
        protocol = "UDP"
        dest_port = str(packet[UDP].dport)
    elif ICMP in packet:
        protocol = "ICMP"
        dest_port = "Ping"

    attack_flag = None
    now = time.time()
    tracker = ATTACK_TRACKER[src_ip]

    # Slide the window in 10 seconds to clear expired records.
    if now - tracker["last_time"] > 10:
        tracker["ports"].clear()
        tracker["count"] = 0
        
    tracker["last_time"] = now
    tracker["count"] += 1
    if dest_port not in ["N/A", "Ping", "53"]:
        tracker["ports"].add(dest_port)

    # 【Rule 1】Port Scan: Accessing more than 8 different ports within 10 seconds.
    if len(tracker["ports"]) > 8:
        attack_flag = "🚨 Port Scan"
    # 【Rule 2】Denial-of-Service (DoS/Flood) attack: An abnormal surge in the number of packets sent within 10 seconds.
    elif tracker["count"] > 100:  # 调低阈值方便 FYP 演示
        attack_flag = "🚨 DoS Flood"
    # 【Rule 3】Malicious high-risk ports: (4444=Metasploit, 3389=RDP brute-force, 22=SSH brute-force, 
    # 23=Telnet brute-force, 135/445=Windows remote vulnerability exploitation)
    elif str(dest_port) in ["4444", "3389", "445", "135", "22", "23", "135"]:
        attack_flag = "🚨 Suspicious Port"
    # 【Rule 4】Ping of Death: An ICMP packet with an unusually large size.
    elif protocol == "ICMP" and packet_size > 1000:
        attack_flag = "🚨 Large ICMP (PoD)"

    conn_key = f"{src_ip}-{dst_ip}-{dest_port}"
    if not attack_flag:
        if conn_key in SEEN_CONNECTIONS:
            if now - SEEN_CONNECTIONS[conn_key] < 2.0:
                return 
            
    SEEN_CONNECTIONS[conn_key] = now
    
    try:
        packet_queue.put_nowait({
            'src': src_ip, 'dst': dst_ip, 'port': dest_port,
            'proto': protocol, 'size': packet_size,
            'attack_flag': attack_flag
        })
    except queue.Full:
        pass 

def db_writer_worker():
    """Backend database writing thread, responsible for querying GeoIP and inserting into the database"""
    while not stop_sniffing_flag.is_set():
        try:
            # Extract packet, 1-second timeout to prevent thread deadlock
            pkt = packet_queue.get(timeout=1)
            
            # Because of caching, API restrictions will not be triggered here.
            location, isp = get_geoip_info(pkt['dst'])
            final_isp = isp
            if pkt.get('attack_flag'):
                final_isp = f"[{pkt['attack_flag']}] {isp}"
            
            with app.app_context():
                new_log = TrafficLog(
                    source_ip=pkt['src'],
                    dest_ip=pkt['dst'],
                    dest_port=pkt['port'],
                    protocol=pkt['proto'],
                    location=location,
                    asn_isp=final_isp,
                    packet_size=pkt['size']
                )
                db.session.add(new_log)
                db.session.commit()
        except queue.Empty:
            continue
        except Exception as e:
            pass 

def start_sniffing_task():
    global stop_sniffing_flag, db_writer_thread
    conf.ifaces.reload()
    
    hotspot_iface = None
    for iface in conf.ifaces.values():
        if iface.ip == '192.168.137.1':
            hotspot_iface = iface
            break
            
    if not hotspot_iface:
        print("❌ Could not find Hotspot interface.")
        return

    # Start background write thread
    db_writer_thread = threading.Thread(target=db_writer_worker)
    db_writer_thread.daemon = True
    db_writer_thread.start()

    print(f"[*] 🚀 Sniffer engine starting on: {hotspot_iface.name}")
    try:
        sniff(
            filter="ip", 
            iface=hotspot_iface,  
            prn=packet_callback, 
            store=0, 
            stop_filter=lambda p: stop_sniffing_flag.is_set()
        )
    except Exception as e:
        print(f"❌ Sniffer Error: {e}")

# --- 5. API Routes ---
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

        # Traverse all monitoring tasks under this website.
        for task in site.monitor_tasks:
            # Find the most recent log entry for this task and extract the delay.
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
            
        # --- Core: Calculate the overall status of the website (Overall Status) ---
        total_tasks = len(tasks_data)
        if total_tasks == 0:
            overall_status = "Unknown"
        elif down_count == total_tasks:
            overall_status = "Down" # All tasks are Down (e.g., HTTP is down and Ping is down), then the website is Down
        elif down_count > 0 or warning_count > 0:
            overall_status = "Warning" # Only some tasks are Down (e.g., Ping is disabled) or have high latency, then the website is Warning
        else:
            overall_status = "Up" # All tasks are Up

        output.append({
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "status": overall_status,  
            "monitors": tasks_data,     
            "is_muted": site.is_muted
        })
    return jsonify(output)

# Scan Now Button Manually trigger scan interface
@app.route('/api/scan', methods=['POST'])
def manual_scan():
    scan_all_websites(force=True)
    return jsonify({"message": "Scan completed successfully!"})

# --- Add New Website ---
@app.route('/api/websites', methods=['POST'])
def add_website():
    data = request.json
    if not data or 'name' not in data or 'url' not in data:
        return jsonify({"error": "Invalid data"}), 400
    
    # 1. First create the parent Website
    new_site = Website(name=data['name'], url=data['url'])
    db.session.add(new_site)
    db.session.flush() 
    
    # 2. Traverse the monitoring tasks array sent from the frontend
    # The format sent from the frontend might look like: "monitors": 
    # [{"type": "http", "interval": 5, "timeout": 10}, {"type": "ping", "interval": 1, "timeout": 2}]
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

# --- Edit/Update Website API (Full Add) ---
@app.route('/api/websites/<int:id>', methods=['PUT'])
def update_website(id):
    site = Website.query.get_or_404(id)
    data = request.json
    
    if 'name' in data: site.name = data['name']
    if 'url' in data: site.url = data['url']
    if 'is_muted' in data: site.is_muted = bool(data['is_muted'])
    if 'monitors' in data:
        # Extract the monitoring type sent from the front end (['http', 'ping']).
        frontend_types = [m['type'] for m in data['monitors']]
        
        # 1. Update an existing task or create a new task.
        for m in data['monitors']:
            existing_task = MonitorTask.query.filter_by(website_id=site.id, monitor_type=m['type']).first()
            if existing_task:
                # Only update the parameters, keep the original ID, so that historical logs will not be lost!
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
                
        # 2. If the user unchecks a monitoring type in the frontend, delete that task
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

# 2. Delete website API
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
                "id": user.id,             
                "email": user.email,       
                "username": user.username, 
                "role": user.role
            }
        }), 200
    else:
        return jsonify({"status": "error", "message": "Invalid username or password"}), 401

# Get detailed information and recent monitoring logs for a single website (for status detail page)
@app.route('/api/websites/<int:id>/logs', methods=['GET'])
def get_website_logs(id):
    site = Website.query.get_or_404(id)
    
    # Join tables to fetch the most recent logs for all tasks under this website (fetch 30 records)
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
            "type": task.monitor_type.upper(), # Distinguishing between HTTP and PING logs
            "error": log.error_details
        })
        
    # Extract its monitoring task configurations
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
            "monitors": monitors_data # Send the configuration array to the frontend
        },
        "logs": logs_data
    })

# AI/NLP Report generation interface
@app.route('/api/reports/daily', methods=['GET'])
def get_daily_report():
    websites = Website.query.all()
    total_sites = len(websites)
    
    if total_sites == 0:
        return jsonify({"summary": "No websites are currently being monitored.", "details": [], "metrics": {}})

    report_details = []
    down_sites = 0
    warning_sites = 0

    # Analyze data from each website
    for site in websites:
        # Get the most recent 30 records for trend analysis
        logs = MonitoringLog.query.filter_by(website_id=site.id).order_by(MonitoringLog.timestamp.desc()).limit(30).all()
        
        if not logs:
            report_details.append(f"• {site.name}: Insufficient data for analysis.")
            continue

        avg_ping = sum(log.response_time for log in logs) / len(logs)
        errors = sum(1 for log in logs if log.status_code != 200)

        # NLP Natural Language Generation Logic
        if site.status == 'Down' or errors > 0:
            down_sites += 1
            report_details.append(f"• {site.name} is currently DOWN. It experienced {errors} connection failures in recent checks. Immediate attention is required.")
        elif site.status == 'Warning' or avg_ping > 400:
            warning_sites += 1
            report_details.append(f"• {site.name} is ONLINE but experiencing HIGH LATENCY. The average response time is {avg_ping:.0f}ms, which exceeds the normal threshold.")
        else:
            report_details.append(f"• {site.name} is performing optimally with a healthy average response time of {avg_ping:.0f}ms.")

    # Generate an executive summary.
    if down_sites == 0 and warning_sites == 0:
        summary_intro = f"Excellent news! All {total_sites} monitored websites are running smoothly with no detected anomalies or downtime."
    elif down_sites > 0:
        summary_intro = f"CRITICAL ALERT: {down_sites} out of {total_sites} monitored systems are currently experiencing downtime. Please review the details below."
    else:
        summary_intro = f"Notice: All systems are online, but {warning_sites} site(s) are experiencing performance degradation (High Latency)."

    # Calculate overall health score
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
        
        # 1. Calculate the threshold based on the time range sent from the front end.
        now = datetime.now()
        if time_range == '24h':
            time_threshold = now - timedelta(hours=24)
        elif time_range == '30d':
            time_threshold = now - timedelta(days=30)
        else: 
            time_threshold = now - timedelta(days=7)

        # 2. Build the joined query
        query = db.session.query(MonitoringLog, MonitorTask, Website)\
            .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
            .join(Website, MonitorTask.website_id == Website.id)\
            .filter(MonitoringLog.timestamp >= time_threshold)

        if target_site != 'all':
            query = query.filter(Website.id == int(target_site))
            
        logs = query.order_by(MonitoringLog.timestamp.desc()).limit(1000).all()
        
        if not logs:
            return jsonify({"status": "error", "message": "No monitoring data found for the selected time range and website."}), 400
            
        # 3. Data cleaning and aggregation
        site_stats = {}
        errors_summary = {'HTTP_Errors': 0, 'PING_Errors': 0, 'Timeouts': 0}
        
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
            
            # Let the AI ​​know the specific HTTP Status Code (e.g., 404, 500).
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
                    
            # Collect chart data separately
            chart_point = {
                "name": log.timestamp.strftime("%H:%M"),
                "ms": round(log.response_time, 2)
            }
            if m_type == 'HTTP':
                http_latencies.append(chart_point)
            elif m_type == 'PING':
                ping_latencies.append(chart_point)

        # Calculate the average delay and convert the Set to a List.
        for site, types in site_stats.items():
            for t, s in types.items():
                s["avg_latency_ms"] = round(sum(s["latencies"]) / s["total_checks"], 2) if s["total_checks"] > 0 else 0
                del s["latencies"] 
                s["error_reasons"] = list(s["error_reasons"])
                if "status_codes" in s:
                    s["status_codes"] = list(s["status_codes"])
                
        # AI prompt
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
        
        # Force filtering of Markdown asterisks that might be secretly generated by large models.
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

        # Send the separate chart data to the front end.
        final_report = {
            "summary": ai_data.get("summary", ""),
            "incidentAnalysis": ai_data.get("incidentAnalysis", ""),
            "insights": ai_data.get("insights", []),
            "recommendations": ai_data.get("recommendations", []),
            "errorChartData": error_chart,
            "httpLatencyChartData": http_latencies[-10:], # Get the most recent 10 points
            "pingLatencyChartData": ping_latencies[-10:]  # Get the most recent 10 points
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

        # setting the AI's persona and response format through a prompt,
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
        
        # After getting the text, we do a force cleanup to ensure no asterisks are present
        clean_reply = response.text.strip().replace('*', '')
        print(clean_reply)

        return jsonify({"status": "success", "reply": clean_reply}), 200

    except Exception as e:
        print(f"[Support AI] 发生错误: {e}")
        return jsonify({"status": "error", "message": "Oops! My brain short-circuited for a moment. Please try again later."}), 500

# --- 6. User Management API (/api/users) ---
@app.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    output = []
    for u in users:
        output.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,  
            "role": u.role
        })
    return jsonify(output)

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    # Make sure to receive emails and the required fields.
    if not data or 'username' not in data or 'password' not in data or 'email' not in data:
        return jsonify({"error": "Invalid data (missing fields)"}), 400
    
    # Check if the username or email already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 400
        
    new_user = User(
        username=data['username'],
        email=data['email'],       # Store in database
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
    
    # Deletion of Admin is absolutely prohibited.
    if user.role == 'Admin':
        return jsonify({"error": "Permission Denied: Cannot delete an Admin user."}), 403
        
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Update/Edit User API ---
@app.route('/api/users/<int:id>', methods=['PUT'])
def update_user(id):
    user = User.query.get_or_404(id)
    data = request.json
    if not data:
        return jsonify({"error": "Invalid data"}), 400
        
    # --- Security Logic ---
    if 'role' in data:
        # Existing accounts are not allowed to be upgraded to Admin
        if user.role != 'Admin' and data['role'] == 'Admin':
            return jsonify({"error": "Cannot assign Admin role to existing users."}), 403
        # Downgrading is not allowed Admin
        if user.role == 'Admin' and data['role'] != 'Admin':
            return jsonify({"error": "Cannot downgrade an Admin user."}), 403
        user.role = data['role']

    # Check for duplicate usernames and emails
    if 'username' in data and data['username'] != user.username:
        if User.query.filter_by(username=data['username']).first():
            return jsonify({"error": "Username already exists"}), 400
        user.username = data['username']
            
    if 'email' in data and data['email'] != user.email:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email already exists"}), 400
        user.email = data['email']

    # Change password
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

# Get and save Alert settings
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

# Toggle site mute status
@app.route('/api/websites/<int:id>/mute', methods=['PUT'])
def toggle_site_mute(id):
    site = Website.query.get_or_404(id)
    site.is_muted = request.json.get('is_muted', False)
    db.session.commit()
    return jsonify({"message": "Mute status updated"})

# Get the site's top 30 alerts/anomalies history.
@app.route('/api/alerts/history', methods=['GET'])
def get_alert_history():
    # Connect Log and Website using MonitorTask as a bridge
    logs = db.session.query(MonitoringLog, MonitorTask, Website)\
        .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
        .join(Website, MonitorTask.website_id == Website.id)\
        .filter(
            db.or_(
                MonitoringLog.status == 'Down',
                MonitoringLog.status == 'Warning'
            )
        ).order_by(MonitoringLog.timestamp.desc()).limit(30).all()

    output = []
    for log, task, site in logs:
        output.append({
            "id": log.id,
            "website_name": site.name,
            "monitor_type": task.monitor_type.upper(),
            "url": site.url,
            "status": log.status, # Transmit the current status (Down or Warning)
            "status_code": log.status_code,
            "response_time": log.response_time,
            "error_details": log.error_details, # Transmit the specific error details to the frontend
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "is_muted": site.is_muted
        })
    return jsonify(output)

# Get dashboard global response time trend chart data
@app.route('/api/dashboard/chart', methods=['GET'])
def get_dashboard_chart():
    # Retrieve the latest 200 records from the join table.
    logs = db.session.query(MonitoringLog, MonitorTask)\
        .join(MonitorTask, MonitoringLog.monitor_task_id == MonitorTask.id)\
        .order_by(MonitoringLog.timestamp.desc()).limit(200).all()
        
    trend_data = {}
    for log, task in logs:
        # Exclude data that timed out (0ms) to avoid lowering the average and distorting the chart.
        if not log.response_time or log.response_time <= 0: 
            continue
            
        # Aggregate by "HH:MM" in minutes
        time_str = log.timestamp.strftime("%H:%M")
        m_type = task.monitor_type.lower()
        
        if time_str not in trend_data:
            trend_data[time_str] = {"http": [], "ping": []}
            
        trend_data[time_str][m_type].append(log.response_time)
        
    output = []
    for time_str, data in trend_data.items():
        http_avg = round(sum(data["http"]) / len(data["http"]), 2) if data["http"] else 0
        ping_avg = round(sum(data["ping"]) / len(data["ping"]), 2) if data["ping"] else 0
        
        # Add any data point to the chart.
        if http_avg > 0 or ping_avg > 0:
            output.append({
                "time": time_str,
                "http_ms": http_avg,
                "ping_ms": ping_avg
            })
            
    # Arranged in chronological order (from left to right)
    output.sort(key=lambda x: x['time'])
    
    # Only take the most recent 15 points to ensure the chart is visually appealing and not crowded
    return jsonify(output[-15:])

# --- Traffic Sniffer API ---
@app.route('/api/traffic/start', methods=['POST'])
def start_traffic_sniff():
    global sniffer_thread, stop_sniffing_flag
    
    if sniffer_thread and sniffer_thread.is_alive():
        return jsonify({"message": "Sniffer is already running"}), 200

    stop_sniffing_flag.clear()
    sniffer_thread = threading.Thread(target=start_sniffing_task)
    sniffer_thread.daemon = True # Automatically close when the main program exits
    sniffer_thread.start()
    
    return jsonify({
        "message": "Sniffing started", 
    })

@app.route('/api/traffic/stop', methods=['POST'])
def stop_traffic_sniff():
    global stop_sniffing_flag
    stop_sniffing_flag.set() # Send Signal to Stop Sniffer Thread
    return jsonify({"message": "Sniffing stopped"})

@app.route('/api/traffic/logs', methods=['GET'])
def get_traffic_logs():
    logs = TrafficLog.query.order_by(TrafficLog.timestamp.desc()).limit(20).all()
    output = []
    for log in logs:
        output.append({
            "id": log.id,
            "timestamp": log.timestamp.strftime("%H:%M:%S"),
            "sourceIp": log.source_ip,
            "destIp": log.dest_ip,
            "destPort": log.dest_port,
            "protocol": log.protocol,     
            "isp": log.asn_isp,           
            "size": log.packet_size
        })
    return jsonify(output)

@app.route('/api/traffic/history', methods=['GET'])
def get_traffic_history():
    # Retrieve the latest 1000 records (to prevent the browser from freezing while ensuring sufficient data volume).
    logs = TrafficLog.query.order_by(TrafficLog.timestamp.desc()).limit(1000).all()
    output = []
    for log in logs:
        output.append({
            "id": log.id,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"), 
            "sourceIp": log.source_ip,
            "destIp": log.dest_ip,
            "destPort": log.dest_port,
            "protocol": log.protocol,     
            "location": log.location,
            "isp": log.asn_isp,           
            "size": log.packet_size
        })
    return jsonify(output)

# Functions for automatically initializing the database
def auto_setup_database():
    with app.app_context():
        # 1. Automatically create tables (skip if they already exist)
        db.create_all()
        
        # 2. Automatically check and create Admin account
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@monweb.com', password='@dmIni$trator852', role='Admin')
            db.session.add(admin_user)
            db.session.commit()
            print("✅ [System] Admin account created automatically.")

        # 3. Automatically populate test data with the new architecture (if the database is empty)
        if not Website.query.first():
            print("⏳ [System] Populating production websites...")
            sites_data = [
                # === Group 1: Check PING every 30 seconds (0.5 minutes).===
                {"name": "Majoriti", "url": "https://majoriti.com.my/", "ping_int": 0.5},
                {"name": "mStar", "url": "https://www.mstar.com.my/", "ping_int": 0.5},
                {"name": "Suria", "url": "https://suria.my/", "ping_int": 0.5},
                {"name": "Star Media Group", "url": "https://www.starmediagroup.my/", "ping_int": 0.5},
                {"name": "The Star", "url": "https://www.thestar.com.my/", "ping_int": 0.5},

                # === Group 2: Check PING every 1 minute ===
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

                # === Group 3: Check PING every 2 minutes ===
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
                
                # All HTTP tasks are uniformly set to 4 minutes.
                http_task = MonitorTask(website_id=site.id, monitor_type='http', interval=4, timeout=10)
                # The PING task is dynamically configured based on the specific settings in the array.
                ping_task = MonitorTask(website_id=site.id, monitor_type='ping', interval=s_data["ping_int"], timeout=10)
                
                db.session.add_all([http_task, ping_task])
            db.session.commit()
            print("✅ [System] Data populated successfully!")
        else:
            print("✅ [System] Database already initialized. No action needed.")

if __name__ == '__main__':
    auto_setup_database()
    app.run(debug=True, port=5000)