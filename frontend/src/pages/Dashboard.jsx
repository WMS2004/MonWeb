import React, { useState, useEffect } from 'react'; // <--- 1. 修改：引入 useState 和 useEffect
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Server, AlertTriangle, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';

// --- 1. Mock Data (暂时保留，之后会被后端数据替代) ---
const mockChartData = [
  { time: '00:00', ms: 120 }, { time: '04:00', ms: 135 },
  { time: '08:00', ms: 450 }, 
  { time: '12:00', ms: 125 }, { time: '16:00', ms: 140 },
  { time: '20:00', ms: 130 }, { time: '24:00', ms: 128 },
];

// --- 2. 辅助小组件 ---
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

// --- 3. 主页面组件 ---
const Dashboard = () => {
  // --- State 定义 ---
  const [websites, setWebsites] = useState([]); // 存储从数据库拿来的网站列表
  const [loading, setLoading] = useState(true); // 加载状态
  const [scanning, setScanning] = useState(false); // 扫描加载状态

// --- 核心功能：从后端获取数据 ---
  const fetchWebsites = () => {
    setLoading(true);
    fetch('http://localhost:5000/api/websites')
      .then(response => response.json())
      .then(data => {
        console.log("Database Data:", data); 
        setWebsites(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching websites:", error);
        setLoading(false);
      });
  };

  // --- 新增：手动触发扫描 ---
    const handleScan = () => {
      setScanning(true);
      // 1. 告诉后端：开始扫描！
      fetch('http://localhost:5000/api/scan', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          console.log("Scan Result:", data.message);
          // 2. 扫描完后，重新获取最新数据
          fetchWebsites(); 
          setScanning(false);
        })
        .catch(error => {
          console.error("Scan failed:", error);
          setScanning(false);
        });
    };

  // 页面一加载就运行
  useEffect(() => {
    fetchWebsites();
  }, []);

  // 👇 --- 新增：动态计算各个状态的网站数量 --- 👇
  const upCount = websites.filter(site => site.status === 'Up').length;
  const downCount = websites.filter(site => site.status === 'Down').length;
  const warningCount = websites.filter(site => site.status === 'Warning').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- A. 顶部统计 (动态绑定真实数字) --- */}
      {/* 使用 loading 状态做了小优化：
          当正在请求数据时显示 "..."，数据请求完毕后显示具体的数字 (upCount, downCount 等) 
      */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Total Monitored" value={loading ? "..." : websites.length} icon={Activity} color="#4F46E5" />
        <StatCard title="Online Status" value={loading ? "..." : upCount} icon={CheckCircle} color="#10B981" />
        <StatCard title="Incidents" value={loading ? "..." : downCount} icon={AlertTriangle} color="#EF4444" />
        <StatCard title="Warnings" value={loading ? "..." : warningCount} icon={Server} color="#F59E0B" />
      </div>

      {/* --- B. 中间内容区 --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 左侧：从数据库读取的真实列表 */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Live Status (Real-time)</h3>
            <button 
              onClick={handleScan} 
              disabled={scanning}
              style={{ 
                border: 'none', 
                background: scanning ? '#ccc' : '#4F46E5', // 扫描时变灰，平时是蓝色
                color: 'white',
                cursor: scanning ? 'not-allowed' : 'pointer',
                padding: '8px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'background 0.3s'
              }}
            >
              {/* 如果 scanning 为 true，就加 spin-animation 类名 */}
              <RefreshCw size={16} className={scanning ? "spin-animation" : ""} /> 
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading && !scanning ? (
              <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>Connecting to MonWeb Brain...</p>
            ) : websites.length === 0 ? (
              <p style={{ color: '#999', padding: '20px', textAlign: 'center' }}>
                Database is empty. <br/>
                (Try clicking "Scan Now" or run init-db)
              </p>
            ) : (
              websites.map((site) => (
                <div key={site.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px', border: '1px solid #eee', borderRadius: '8px',
                  borderLeft: `4px solid ${site.status === 'Down' ? '#EF4444' : site.status === 'Warning' ? '#F59E0B' : '#10B981'}`
                }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{site.name}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{site.url}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      backgroundColor: site.status === 'Down' ? '#FEE2E2' : site.status === 'Warning' ? '#FFFBEB' : '#ECFDF5', 
                      color: site.status === 'Down' ? '#B91C1C' : site.status === 'Warning' ? '#B45309' : '#047857',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                    }}>
                      {(site.status || 'Unknown').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '12px', color: '#ccc' }}>
                       Last: {site.last_checked}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：AI Insights (保持不变) */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '250px', border: '1px solid #E0E7FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>✨</span>
            <h3 style={{ margin: 0, color: '#4F46E5' }}>AI Insights</h3>
          </div>
          <p style={{ color: '#555', lineHeight: '1.6', fontSize: '14px' }}>
            <strong>System Ready:</strong><br/>
            Click the "Scan Now" button to perform a live latency check on all configured endpoints.
          </p>
        </div>
      </div>

      {/* --- C. 底部大图表 (暂时保留 Mock Data) --- */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', height: '350px' }}>
        <h3 style={{ margin: '0 0 20px 0' }}>Response Time Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockChartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="ms" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default Dashboard;