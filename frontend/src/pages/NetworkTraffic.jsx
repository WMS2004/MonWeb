import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Wifi, Play, Square, Crosshair, ShieldAlert, MonitorSmartphone } from 'lucide-react';

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
  const [isSniffing, setIsSniffing] = useState(false);
  const [targetHost, setTargetHost] = useState('neverssl.com');
  const [networkInterface, setNetworkInterface] = useState('All Interfaces (Default)');
  
  const [trafficLogs, setTrafficLogs] = useState([]);
  const [chartData, setChartData] = useState([]);

  // 1. 控制启动/停止抓包
  const toggleSniffing = async () => {
    try {
      if (isSniffing) {
        await fetch('http://localhost:5000/api/traffic/stop', { method: 'POST' });
        setIsSniffing(false);
      } else {
        await fetch('http://localhost:5000/api/traffic/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetHost: targetHost })
        });
        setTrafficLogs([]); // 清空旧数据
        setChartData([]);
        setIsSniffing(true);
      }
    } catch (error) {
      console.error("Sniffer Error:", error);
      alert("Failed to connect to backend sniffer.");
    }
  };

  // 2. 轮询获取真实的抓包数据
  useEffect(() => {
    let interval;
    if (isSniffing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:5000/api/traffic/logs');
          const data = await res.json();
          setTrafficLogs(data);

          // 动态构建图表数据 (按最新日志数量)
          if (data.length > 0) {
              const latestTime = data[0].timestamp;
              setChartData(prev => {
                  const newPoint = { time: latestTime, hits: data.length };
                  const newData = [...prev, newPoint];
                  if (newData.length > 10) newData.shift(); // 保持图表最多10个点
                  return newData;
              });
          }
        } catch (error) {
          console.error("Fetch Logs Error:", error);
        }
      }, 500); // 每2秒去后端拿一次最新的真实数据
    }
    return () => clearInterval(interval);
  }, [isSniffing]);

  const uniqueIPs = new Set(trafficLogs.map(log => log.sourceIp)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 顶部控制台 */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="#4F46E5" /> Local Network Traffic Sniffer
          </h2>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Monitor and capture unencrypted HTTP requests targeting specific hosts over shared network.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Interface</label>
            <select disabled={isSniffing} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: isSniffing ? '#f1f5f9' : 'white' }}>
              <option>{networkInterface}</option>
            </select>
          </div>

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

          <button 
            onClick={toggleSniffing}
            style={{ 
              marginTop: '16px', border: 'none', 
              background: isSniffing ? '#EF4444' : '#10B981', 
              color: 'white', cursor: 'pointer',
              padding: '10px 20px', borderRadius: '8px',
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'background 0.3s'
            }}
          >
            {isSniffing ? <><Square size={18} /> Stop Sniffing</> : <><Play size={18} /> Start Sniffing</>}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Target Filter" value={targetHost} icon={Crosshair} color="#4F46E5" />
        <StatCard title="Active Unique IPs" value={isSniffing ? uniqueIPs : 0} icon={MonitorSmartphone} color="#F59E0B" />
        <StatCard title="Total Packets Matched" value={isSniffing ? trafficLogs.length : 0} icon={Wifi} color="#10B981" />
        <StatCard title="Engine Status" value={isSniffing ? "Listening on Port 80..." : "Idle"} icon={ShieldAlert} color={isSniffing ? "#10B981" : "#94a3b8"} />
      </div>

      {/* 数据表与图表 */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 左侧：数据表 */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '400px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Live Intercepted Requests (Real Data)</span>
            {isSniffing && <span style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="pulse-dot"></span> Live
            </span>}
          </h3>

          <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
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
                      {isSniffing ? "Sniffing active. Awaiting HTTP traffic on Port 80..." : "Click 'Start Sniffing' to begin capture."}
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

        {/* 右侧：图表 */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Request Frequency (Live)</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Line type="stepAfter" dataKey="hits" stroke="#4F46E5" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #10B981; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      `}</style>
    </div>
  );
};

export default NetworkTraffic;