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
import { Activity, Server, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

// --- 1. Mock Data (暂时保留，之后会被后端数据替代) ---
const mockChartData = [
  { time: '00:00', ms: 120 }, { time: '04:00', ms: 135 },
  { time: '08:00', ms: 450 }, 
  { time: '12:00', ms: 125 }, { time: '16:00', ms: 140 },
  { time: '20:00', ms: 130 }, { time: '24:00', ms: 128 },
];

const priorityWebsites = [
  { name: 'Payment Gateway', url: 'pay.example.com', status: 'down', time: '502ms' },
  { name: 'User Login', url: 'auth.example.com', status: 'warning', time: '320ms' },
  { name: 'Company Blog', url: 'blog.example.com', status: 'up', time: '45ms' },
  { name: 'API Server', url: 'api.example.com', status: 'up', time: '60ms' },
  { name: 'Dashboard', url: 'dashboard.example.com', status: 'up', time: '30ms' },
  { name: 'Email Service', url: 'email.example.com', status: 'up', time: '50ms' },
  { name: 'Analytics', url: 'analytics.example.com', status: 'down', time: '540ms' },
  { name: 'File Storage', url: 'storage.example.com', status: 'up', time: '55ms' },
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
  // --- A. 新增：连接后端的逻辑 ---
  const [backendMessage, setBackendMessage] = useState('Connecting to backend...');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 尝试访问我们在 backend/app.py 里写的测试接口
    fetch('http://localhost:5000/api/test')
      .then(response => response.json())
      .then(data => {
        console.log("后端返回的数据:", data); 
        setBackendMessage(data.message); // 设置消息
        setIsConnected(true);            // 标记为已连接
      })
      .catch(error => {
        console.error("连接失败:", error);
        setBackendMessage("Connection Failed. Is Flask running? (Port 5000)");
        setIsConnected(false);
      });
  }, []);

  // --- B. 原有的排序逻辑 ---
  const statusWeight = { 'down': 3, 'warning': 2, 'up': 1 };
  const sortedWebsites = [...priorityWebsites].sort((a, b) => {
    return statusWeight[b.status] - statusWeight[a.status];
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- C. 新增：连接状态条 (调试用，连接成功变绿，失败变红) --- */}
      <div style={{ 
        padding: '12px 20px', 
        backgroundColor: isConnected ? '#D1FAE5' : '#FEE2E2', 
        color: isConnected ? '#065F46' : '#991B1B',
        borderRadius: '8px',
        border: `1px solid ${isConnected ? '#34D399' : '#F87171'}`,
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        {isConnected ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
        <span><strong>System Status:</strong> {backendMessage}</span>
      </div>

      {/* --- D. 原有的顶部统计卡片 --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Total Monitored" value="12" icon={Activity} color="#4F46E5" />
        <StatCard title="Current Online" value="11" icon={CheckCircle} color="#10B981" />
        <StatCard title="Today's Incidents" value="1" icon={AlertTriangle} color="#EF4444" />
        <StatCard title="Warnings" value="1" icon={Server} color="#F59E0B" />
      </div>

      {/* --- E. 原有的中间内容区 --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 左侧列表 */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Priority Status (AI Ranked)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sortedWebsites.map((site, index) => (
              <div key={index} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px', border: '1px solid #eee', borderRadius: '8px',
                borderLeft: `4px solid ${site.status === 'down' ? '#EF4444' : site.status === 'warning' ? '#F59E0B' : '#10B981'}`
              }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{site.name}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{site.url}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    backgroundColor: site.status === 'down' ? '#FEE2E2' : (site.status === 'warning' ? '#FEF3C7' : '#ECFDF5'), 
                    color: site.status === 'down' ? '#B91C1C' : (site.status === 'warning' ? '#B45309' : '#047857'),
                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px'
                  }}>
                    {site.status.toUpperCase()}
                  </span>
                  <ArrowRight size={16} color="#ccc" style={{ cursor: 'pointer' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧 AI 摘要 */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '250px', border: '1px solid #E0E7FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>✨</span>
            <h3 style={{ margin: 0, color: '#4F46E5' }}>AI Insights</h3>
          </div>
          <p style={{ color: '#555', lineHeight: '1.6', fontSize: '14px' }}>
            <strong>Daily Summary:</strong> All systems are currently running smoothly, except... <b>Payment Gateway</b>。
            <br/><br/>
            AI detected that this service's response time has been fluctuating over the past hour (from 120ms to 502ms).
          </p>
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#F5F3FF', borderRadius: '6px', fontSize: '12px', color: '#6366F1' }}>
            Next scan in: 08:59
          </div>
        </div>
      </div>

      {/* --- F. 原有的图表 --- */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', height: '350px' }}>
        <h3 style={{ margin: '0 0 20px 0' }}>Overall Latency (24h)</h3>
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