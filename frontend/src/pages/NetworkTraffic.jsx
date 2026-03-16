import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Wifi, Play, Square, Crosshair, ShieldAlert, MonitorSmartphone } from 'lucide-react';

// --- 辅助小组件：统计卡片 (沿用你 Dashboard 的风格) ---
const StatCard = ({ title, value, color, icon: Icon }) => (
  <div style={{
    backgroundColor: 'white', padding: '20px', borderRadius: '12px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px', flex: 1
  }}>
    <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: `${color}20` }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <div style={{ color: '#888', fontSize: '14px' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{value}</div>
    </div>
  </div>
);

const NetworkTraffic = () => {
  // --- 状态管理 ---
  const [isSniffing, setIsSniffing] = useState(false);
  const [targetHost, setTargetHost] = useState('neverssl.com');
  const [networkInterface, setNetworkInterface] = useState('wlan0 (Wi-Fi Hotspot)');
  
  const [trafficLogs, setTrafficLogs] = useState([]);
  const [chartData, setChartData] = useState([
    { time: '10:00:00', hits: 0 }, { time: '10:00:10', hits: 0 },
    { time: '10:00:20', hits: 0 }, { time: '10:00:30', hits: 0 },
    { time: '10:00:40', hits: 0 }, { time: '10:00:50', hits: 0 },
  ]);

  // 模拟抓包动态效果 (前端 PoC 演示用)
  useEffect(() => {
    let interval;
    if (isSniffing) {
      interval = setInterval(() => {
        // 随机生成一条抓包记录
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const randomIP = `192.168.137.${Math.floor(Math.random() * 50) + 10}`;
        
        const newLog = {
          id: Date.now(),
          timestamp: timeStr,
          sourceIp: randomIP,
          device: Math.random() > 0.5 ? 'Mobile (iPhone)' : 'Laptop (Windows)',
          method: 'GET',
          host: targetHost,
          status: 'Captured'
        };

        // 更新日志列表 (保留最新 10 条)
        setTrafficLogs(prev => [newLog, ...prev].slice(0, 10));

        // 模拟图表波动
        setChartData(prev => {
          const newData = [...prev.slice(1), { time: timeStr, hits: Math.floor(Math.random() * 5) + 1 }];
          return newData;
        });

      }, 2500); // 每 2.5 秒抓到一个包
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isSniffing, targetHost]);

  // 动态统计数据
  const totalHits = trafficLogs.length * 15; // 模拟总数
  const uniqueIPs = new Set(trafficLogs.map(log => log.sourceIp)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- 1. 顶部控制面板 (Control Panel) --- */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="#4F46E5" /> Local Network Traffic Sniffer
          </h2>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Monitor and capture unencrypted HTTP requests matching specific hosts over shared network (Hotspot/WLAN).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {/* 网络接口选择 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Interface</label>
            <select 
              value={networkInterface}
              onChange={(e) => setNetworkInterface(e.target.value)}
              disabled={isSniffing}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: isSniffing ? '#f1f5f9' : 'white' }}
            >
              <option value="wlan0 (Wi-Fi Hotspot)">wlan0 (Wi-Fi Hotspot)</option>
              <option value="eth0 (Ethernet)">eth0 (Ethernet)</option>
            </select>
          </div>

          {/* 目标域名输入 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Target Host (HTTP)</label>
            <input 
              type="text" 
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              disabled={isSniffing}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', width: '180px', backgroundColor: isSniffing ? '#f1f5f9' : 'white' }}
            />
          </div>

          {/* 启动/停止按钮 */}
          <button 
            onClick={() => setIsSniffing(!isSniffing)}
            style={{ 
              marginTop: '16px',
              border: 'none', 
              background: isSniffing ? '#EF4444' : '#10B981', 
              color: 'white',
              cursor: 'pointer',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.3s'
            }}
          >
            {isSniffing ? <><Square size={18} /> Stop Sniffing</> : <><Play size={18} /> Start Sniffing</>}
          </button>
        </div>
      </div>

      {/* --- 2. 统计卡片 --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Target Filter" value={targetHost} icon={Crosshair} color="#4F46E5" />
        <StatCard title="Active Unique IPs" value={isSniffing ? uniqueIPs : 0} icon={MonitorSmartphone} color="#F59E0B" />
        <StatCard title="Total Packets Matched" value={isSniffing ? totalHits : 0} icon={Wifi} color="#10B981" />
        <StatCard title="Engine Status" value={isSniffing ? "Listening..." : "Idle"} icon={ShieldAlert} color={isSniffing ? "#10B981" : "#94a3b8"} />
      </div>

      {/* --- 3. 下半部分：图表与实时日志 --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 左侧：实时抓包数据表 */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '400px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Live Intercepted Requests</span>
            {isSniffing && <span style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="pulse-dot"></span> Live
            </span>}
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 8px' }}>Time</th>
                  <th style={{ padding: '12px 8px' }}>Source IP</th>
                  <th style={{ padding: '12px 8px' }}>Method</th>
                  <th style={{ padding: '12px 8px' }}>Target Host</th>
                </tr>
              </thead>
              <tbody>
                {trafficLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      {isSniffing ? "Waiting for incoming packets..." : "Click 'Start Sniffing' to begin capture."}
                    </td>
                  </tr>
                ) : (
                  trafficLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc', animation: 'fadeIn 0.5s ease-in' }}>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>{log.timestamp}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#1E293B' }}>{log.sourceIp}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                          {log.method}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: '#2563eb', fontFamily: 'monospace' }}>{log.host}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧：流量波形图 */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Request Frequency (Hits/10s)</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Line 
                  type="stepAfter" // 使用 stepAfter 更有网络监控的数字感
                  dataKey="hits" 
                  stroke="#4F46E5" 
                  strokeWidth={3} 
                  dot={{ r: 3 }} 
                  activeDot={{ r: 6 }} 
                  isAnimationActive={false} // 禁用动画防止图表闪烁
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 动画 CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pulse-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #10B981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

export default NetworkTraffic;