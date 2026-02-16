// import React from 'react';
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// import { Activity, Server, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

// // --- 1. Mock Data (模拟数据，之后会从后端获取) ---
// const mockChartData = [
//   { time: '00:00', ms: 120 }, { time: '04:00', ms: 135 },
//   { time: '08:00', ms: 450 }, // 模拟一次波动
//   { time: '12:00', ms: 125 }, { time: '16:00', ms: 140 },
//   { time: '20:00', ms: 130 }, { time: '24:00', ms: 128 },
// ];

// const priorityWebsites = [
//   { name: 'Payment Gateway', url: 'pay.example.com', status: 'down', time: '502ms' },
//   { name: 'User Login', url: 'auth.example.com', status: 'warning', time: '320ms' },
//   { name: 'Company Blog', url: 'blog.example.com', status: 'up', time: '45ms' },
//   { name: 'API Server', url: 'api.example.com', status: 'up', time: '60ms' },
//   { name: 'Dashboard', url: 'dashboard.example.com', status: 'up', time: '30ms' },
//   { name: 'Email Service', url: 'email.example.com', status: 'up', time: '50ms' },
//   { name: 'Analytics', url: 'analytics.example.com', status: 'down', time: '540ms' },
//   { name: 'File Storage', url: 'storage.example.com', status: 'up', time: '55ms' },
// ];

// // --- 2. 辅助小组件 ---
// const StatCard = ({ title, value, color, icon: Icon }) => (
//   <div style={{
//     backgroundColor: 'white', padding: '20px', borderRadius: '12px',
//     boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px', flex: 1
//   }}>
//     <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: `${color}20` }}>
//       <Icon size={24} color={color} />
//     </div>
//     <div>
//       <div style={{ color: '#888', fontSize: '14px' }}>{title}</div>
//       <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{value}</div>
//     </div>
//   </div>
// );

// // --- 3. 主页面组件 ---
// const Dashboard = () => {
//   // --- 核心修改：在这里添加排序逻辑 ---
//   // 定义优先级权重：down(3) > warning(2) > up(1)
//   const statusWeight = { 'down': 3, 'warning': 2, 'up': 1 };

//   const sortedWebsites = [...priorityWebsites].sort((a, b) => {
//     // 权重大的排在前面 (降序排列)
//     return statusWeight[b.status] - statusWeight[a.status];
//   });

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
//       {/* --- A. 顶部统计卡片行 --- */}
//       <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
//         <StatCard title="Total Monitored" value="12" icon={Activity} color="#4F46E5" />
//         <StatCard title="Current Online" value="11" icon={CheckCircle} color="#10B981" />
//         <StatCard title="Today's Incidents" value="1" icon={AlertTriangle} color="#EF4444" />
//         <StatCard title="Warnings" value="1" icon={Server} color="#F59E0B" />
//       </div>

//       {/* --- B. 中间内容区 (左列表 / 右AI) --- */}
//       <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
//         {/* 左侧：智能优先级列表 */}
//         <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px' }}>
//           <h3 style={{ margin: '0 0 15px 0' }}>Priority Status (AI Ranked)</h3>
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
//             {/* 修改：这里遍历 sortedWebsites 而不是 priorityWebsites */}
//             {sortedWebsites.map((site, index) => (
//               <div key={index} style={{
//                 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
//                 padding: '12px', border: '1px solid #eee', borderRadius: '8px',
//                 borderLeft: `4px solid ${site.status === 'down' ? '#EF4444' : site.status === 'warning' ? '#F59E0B' : '#10B981'}`
//               }}>
//                 <div>
//                   <div style={{ fontWeight: '600' }}>{site.name}</div>
//                   <div style={{ fontSize: '12px', color: '#999' }}>{site.url}</div>
//                 </div>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//                   <span style={{ 
//                     backgroundColor: site.status === 'down' ? '#FEE2E2' : (site.status === 'warning' ? '#FEF3C7' : '#ECFDF5'), 
//                     color: site.status === 'down' ? '#B91C1C' : (site.status === 'warning' ? '#B45309' : '#047857'),
//                     padding: '4px 8px', borderRadius: '4px', fontSize: '12px'
//                   }}>
//                     {site.status.toUpperCase()}
//                   </span>
//                   <ArrowRight size={16} color="#ccc" style={{ cursor: 'pointer' }} />
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* 右侧：AI 智能摘要 (重点功能) */}
//         <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '250px', border: '1px solid #E0E7FF' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
//             <span style={{ fontSize: '20px' }}>✨</span>
//             <h3 style={{ margin: 0, color: '#4F46E5' }}>AI Insights</h3>
//           </div>
//           <p style={{ color: '#555', lineHeight: '1.6', fontSize: '14px' }}>
//             <strong>Daily Summary:</strong> All systems are currently running smoothly, except... <b>Payment Gateway</b>。
//             <br/><br/>
//             AI detected that this service's response time has been fluctuating over the past hour (from 120ms to 502ms), suggesting a check of AWS load balancer configuration is needed.
//           </p>
//           <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#F5F3FF', borderRadius: '6px', fontSize: '12px', color: '#6366F1' }}>
//             Next scan in: 08:59
//           </div>
//         </div>
//       </div>

//       {/* --- C. 底部大图表 --- */}
//       <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', height: '350px' }}>
//         <h3 style={{ margin: '0 0 20px 0' }}>Overall Latency (24h)</h3>
//         <ResponsiveContainer width="100%" height="100%">
//           <LineChart data={mockChartData}>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} />
//             <XAxis dataKey="time" />
//             <YAxis />
//             <Tooltip />
//             <Line type="monotone" dataKey="ms" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
//           </LineChart>
//         </ResponsiveContainer>
//       </div>

//     </div>
//   );
// };

// export default Dashboard;

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
  const [scanning, setScanning] = useState(false); // 新增：扫描加载状态

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- A. 顶部统计 (后续再绑定真实数字) --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Total Monitored" value={websites.length} icon={Activity} color="#4F46E5" />
        <StatCard title="Online Status" value="Checking..." icon={CheckCircle} color="#10B981" />
        <StatCard title="Incidents" value="0" icon={AlertTriangle} color="#EF4444" />
        <StatCard title="Warnings" value="0" icon={Server} color="#F59E0B" />
      </div>

      {/* --- B. 中间内容区 --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 左侧：从数据库读取的真实列表 */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px' }}>

        {/* --- 重点修改：这里加入了 Scan 按钮和动画逻辑 --- */}
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
          {/* -------------------------------------------------- */}

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