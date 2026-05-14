import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Wifi, Play, Square, Globe, ShieldAlert, MonitorSmartphone, Cpu } from 'lucide-react';

const StatCard = ({ title, value, color, icon: Icon }) => (
  <div style={{
    backgroundColor: 'white', padding: '20px', borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '15px', flex: 1,
    border: '1px solid #f1f5f9'
  }}>
    <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: `${color}15`, color: color }}>
      <Icon size={26} strokeWidth={2.5} />
    </div>
    <div>
      <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      <div style={{ fontSize: '26px', fontWeight: '900', color: '#1E293B', marginTop: '4px' }}>{value}</div>
    </div>
  </div>
);

const NetworkTraffic = () => {
  const [isSniffing, setIsSniffing] = useState(false);
  const [trafficLogs, setTrafficLogs] = useState([]);
  
  // 初始化15个空数据点，让图表从右向左平滑滚动
  const [chartData, setChartData] = useState(Array(15).fill({ time: '', pps: 0 })); 
  
  const lastLogIdRef = useRef(0); // 使用 useRef 追踪最新的 ID，避免闭包陷阱

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
            body: JSON.stringify({})
        });
        setTrafficLogs([]); 
        setChartData(Array(15).fill({ time: '', pps: 0 })); // 重置图表
        lastLogIdRef.current = 0;
        setIsSniffing(true);
      }
    } catch (error) {
      console.error("Sniffer Error:", error);
      alert("Failed to connect to backend sniffer.");
    }
  };

  // 2. 轮询获取真实的抓包数据 (每 1000ms 一次，正好计算每秒数据包 PPS)
  useEffect(() => {
    let interval;
    if (isSniffing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:5000/api/traffic/logs');
          const data = await res.json();
          
          setTrafficLogs(data);

          if (data.length > 0) {
            const currentMaxId = data[0].id;
            const prevMaxId = lastLogIdRef.current;
            
            let newPacketsCount = 0;
            if (prevMaxId === 0) {
                newPacketsCount = data.length; // 第一次加载显示初始数量
            } else {
                // Calculate how many new records have been added compared to the last polling.
                newPacketsCount = data.filter(log => log.id > prevMaxId).length;
            }
            
            lastLogIdRef.current = currentMaxId; // 更新最新ID

            const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            setChartData(prev => {
                const newData = [...prev, { time: currentTime, pps: newPacketsCount }];
                if (newData.length > 15) newData.shift(); // 保持15个点
                return newData;
            });
          }
        } catch (error) {
          console.error("Fetch Logs Error:", error);
        }
      }, 1000); // 改为 1秒 (1000ms) 轮询，使图表代表真实的吞吐量曲线
    }
    return () => clearInterval(interval);
  }, [isSniffing]);

  const uniqueIPs = new Set(trafficLogs.map(log => log.sourceIp)).size;

  // 动态生成不同协议的徽章颜色
  const getProtocolStyle = (protocol) => {
    switch(protocol) {
        case 'TCP': return { bg: '#dbeafe', text: '#1e40af' };
        case 'UDP': return { bg: '#fef3c7', text: '#92400e' };
        case 'DNS': return { bg: '#fce7f3', text: '#be185d' }; // DNS 专属高亮粉色！
        case 'ICMP': return { bg: '#e0e7ff', text: '#4338ca' };
        default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 顶部控制台 */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px' }}>
            <Activity color="#4F46E5" size={28} /> Network Traffic Sniffer
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={16} /> All Interfaces & Protocols
          </div>

          <button 
            onClick={toggleSniffing}
            style={{ 
              border: 'none', 
              background: isSniffing ? '#EF4444' : '#10B981', 
              color: 'white', cursor: 'pointer',
              padding: '12px 24px', borderRadius: '10px',
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.3s', fontSize: '15px',
              boxShadow: isSniffing ? '0 4px 12px rgba(239,68,68,0.3)' : '0 4px 12px rgba(16,185,129,0.3)'
            }}
          >
            {isSniffing ? <><Square size={20} fill="currentColor" /> Stop Engine</> : <><Play size={20} fill="currentColor" /> Initialize Sniffer</>}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Throughput (PPS)" value={chartData[chartData.length-1].pps} icon={Cpu} color="#4F46E5" />
        <StatCard title="Active Client IPs" value={isSniffing ? uniqueIPs : 0} icon={MonitorSmartphone} color="#F59E0B" />
        <StatCard title="Packets In Buffer" value={isSniffing ? trafficLogs.length : 0} icon={Wifi} color="#06b6d4" />
        <StatCard title="Protection Bypass" value={isSniffing ? "Active" : "Offline"} icon={ShieldAlert} color={isSniffing ? "#10B981" : "#94a3b8"} />
      </div>

      {/* 数据表与图表 */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 左侧：数据表 */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '24px', borderRadius: '16px', minWidth: '450px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#1E293B' }}>
            <span>Live Intercepted Metadata</span>
            {isSniffing && <span style={{ fontSize: '13px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
              <span className="pulse-dot"></span> Listening...
            </span>}
          </h3>

          <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 10px', fontWeight: 'bold' }}>Time</th>
                  <th style={{ padding: '12px 10px', fontWeight: 'bold' }}>Source Client</th>
                  <th style={{ padding: '12px 10px', fontWeight: 'bold' }}>Protocol</th>
                  <th style={{ padding: '12px 10px', fontWeight: 'bold' }}>Destination / Domain</th>
                  <th style={{ padding: '12px 10px', fontWeight: 'bold' }}>Location (GeoIP)</th>
                </tr>
              </thead>
              <tbody>
                {trafficLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '50px', color: '#94a3b8', fontSize: '15px' }}>
                      {isSniffing ? "Engine is running. Awaiting network connections..." : "Click 'Initialize Sniffer' to begin real-time capture."}
                    </td>
                  </tr>
                ) : (
                  trafficLogs.map((log) => {
                    const pStyle = getProtocolStyle(log.protocol);
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', animation: 'fadeIn 0.5s ease-out' }}>
                        <td style={{ padding: '14px 10px', color: '#64748b' }}>{log.timestamp}</td>
                        <td style={{ padding: '14px 10px', fontWeight: 'bold', color: '#334155' }}>{log.sourceIp}</td>
                        <td style={{ padding: '14px 10px' }}>
                          <span style={{ backgroundColor: pStyle.bg, color: pStyle.text, padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                            {log.protocol}
                          </span>
                        </td>
                        <td style={{ padding: '14px 10px', fontFamily: 'monospace', fontSize: '13px' }}>
                          <span style={{ color: log.protocol === 'DNS' ? '#be185d' : '#2563eb', fontWeight: log.protocol === 'DNS' ? 'bold' : 'normal' }}>
                            {log.destIp}
                          </span>
                          <span style={{ color: '#94a3b8' }}> : {log.destPort}</span>
                        </td>
                        <td style={{ padding: '14px 10px', maxWidth: '220px' }}>
                          <div style={{ fontWeight: 'bold', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.isp}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{log.location}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧：图表 */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '24px', borderRadius: '16px', minWidth: '350px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1E293B' }}>Network Activity (Packets/s)</h3>
          <div style={{ height: '310px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }} 
                  labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="pps" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorPps)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .pulse-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #10B981; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      `}</style>
    </div>
  );
};

export default NetworkTraffic;