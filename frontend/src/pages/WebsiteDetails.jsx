// import React, { useEffect, useState } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { 
//   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
// } from 'recharts';
// import { ArrowLeft, Activity, TrendingUp, Clock, RefreshCw, Globe, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

// const WebsiteDetails = () => {
//   const { id } = useParams(); 
//   const navigate = useNavigate();
  
//   const [data, setData] = useState({ website: {}, logs: [] });
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [activeTab, setActiveTab] = useState('ping');

//   // --- 模拟 HTTP 监控数据 (保留需要的 TTFB 和状态码) ---
//   const mockHttpData = {
//     statusCode: 200,
//     statusText: 'OK',
//     ttfb: 124, 
//   };

//   const fetchDetails = (isInitial = false) => {
//     if (isInitial) setLoading(true);
//     else setRefreshing(true);

//     fetch(`http://localhost:5000/api/websites/${id}/logs`)
//       .then(res => res.json())
//       .then(resData => {
//         setData(resData);
//         setLoading(false);
//         setRefreshing(false);
//       })
//       .catch(err => {
//         console.error("Error fetching logs:", err);
//         setLoading(false);
//         setRefreshing(false);
//       });
//   };

//   useEffect(() => {
//     fetchDetails(true); 
//     const intervalId = setInterval(() => {
//       fetchDetails(false); 
//     }, 10000); 
//     return () => clearInterval(intervalId); 
//   }, [id]);

//   // 👇 1. 解析网站拥有的监控类型 (必须放在 if (loading) 之前，确保 Hook 顺序不变)
//   const monitorTypes = data.website.monitor_type ? data.website.monitor_type.split(',') : ['http'];
//   const hasPing = monitorTypes.includes('ping');
//   const hasHttp = monitorTypes.includes('http');

//   // 👇 2. 自动修正默认打开的标签页
//   useEffect(() => {
//     if (data.website.monitor_type) {
//       if (!hasPing && activeTab === 'ping') setActiveTab('http');
//       if (!hasHttp && activeTab === 'http') setActiveTab('ping');
//     }
//   }, [data.website.monitor_type, hasPing, hasHttp]);

//   // 拦截加载状态
//   if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>;

//   const { website, logs } = data;
//   const latestResponseTime = logs.length > 0 ? logs[logs.length - 1].response_time : 0;

//   // --- 抽取复用的日志表格组件 (加入滚动条设计) ---
//   const LogsTable = ({ logsData, monitorType }) => {
//     // 获取最新的 10 条记录
//     const top10Logs = [...logsData].reverse().slice(0, 10);
    
//     return (
//       <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
//         <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#111827' }}>Monitoring Logs (Top 10)</h3>
        
//         <div style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
//           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
//             <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
//               <tr style={{ color: '#64748b' }}>
//                 <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Time</th>
//                 <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Monitor Type</th>
//                 <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Status Code</th>
//                 <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Result</th>
//                 <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>AI Insight</th>
//               </tr>
//             </thead>
//             <tbody>
//               {top10Logs.length === 0 ? (
//                 <tr>
//                   <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No log data available</td>
//                 </tr>
//               ) : (
//                 top10Logs.map((log, index) => {
//                   const isError = log.response_time === 0 || log.status_code >= 400;
//                   const aiInsight = isError ? "AI detected connection issues, please check server status" : "Response time is within normal range, system is running smoothly";
                  
//                   return (
//                     <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s', ':hover': { backgroundColor: '#f8fafc' } }}>
//                       <td style={{ padding: '12px 16px', color: '#475569' }}>{log.time}</td>
//                       <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '500' }}>{monitorType}</td>
//                       <td style={{ padding: '12px 16px' }}>
//                         <span style={{ 
//                           padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
//                           color: isError ? '#DC2626' : '#059669', backgroundColor: isError ? '#FEE2E2' : '#D1FAE5'
//                         }}>
//                           {log.status_code || (isError ? '599' : '200')}
//                         </span>
//                       </td>
//                       <td style={{ padding: '12px 16px', color: '#475569' }}>
//                         {isError ? 'Error' : `Success - ${log.response_time}ms`}
//                       </td>
//                       <td style={{ padding: '12px 16px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
//                         {isError ? <AlertTriangle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
//                         {aiInsight}
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
//       {/* --- Header --- */}
//       <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Dashboard</div>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
//           <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
//             <ArrowLeft size={24} color="#333" />
//           </button>
//           <div>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//               <h2 style={{ margin: 0, fontSize: '22px', color: '#111827' }}>{website.name}</h2>
//               <span style={{ 
//                 fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold',
//                 color: website.status === 'Up' ? '#059669' : website.status === 'Down' ? '#DC2626' : '#D97706',
//                 backgroundColor: website.status === 'Up' ? '#D1FAE5' : website.status === 'Down' ? '#FEE2E2' : '#FEF3C7',
//               }}>
//                 {website.status ? website.status.toUpperCase() : 'UNKNOWN'}
//               </span>
//             </div>
//             <div style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>{website.url}</div>
//           </div>
//         </div>

//         <button onClick={() => fetchDetails(false)} disabled={refreshing} style={refreshBtnStyle}>
//           <RefreshCw size={16} className={refreshing ? "spin-animation" : ""} />
//           {refreshing ? "Refreshing..." : "Refresh Data"}
//         </button>
//       </div>

//       {/* 👇 3. 动态 Tab Navigation --- */}
//       <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
//         {hasPing && (
//           <button onClick={() => setActiveTab('ping')} style={getTabStyle(activeTab === 'ping')}>
//             <Activity size={18} /> Ping (Latency)
//           </button>
//         )}
//         {hasHttp && (
//           <button onClick={() => setActiveTab('http')} style={getTabStyle(activeTab === 'http')}>
//             <Globe size={18} /> HTTP Monitor
//           </button>
//         )}
//       </div>

//       {/* 👇 4. 动态 Tab Content --- */}
//       {activeTab === 'ping' && hasPing ? (
//         // ==========================================
//         //  Tab 1: Ping (Latency)
//         // ==========================================
//         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease-in-out' }}>
          
//           {/* KPI Cards */}
//           <div style={{ display: 'flex', gap: '20px' }}>
//             <KpiCard icon={<Activity size={32} color="#3b82f6" />} title="Current Response Time" value={`${latestResponseTime} ms`} />
//             <KpiCard icon={<TrendingUp size={32} color="#10b981" />} title="Availability" value="99.9%" />
//             <KpiCard icon={<Clock size={32} color="#8b5cf6" />} title="Check Interval" value={`Every ${website.interval || 5} mins`} />
//           </div>

//           {/* Line Chart */}
//           <div style={chartContainerStyle}>
//             <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#111827' }}>Ping Response Time (ms)</h3>
//             <div style={{ height: '300px', width: '100%' }}>
//               <ResponsiveContainer width="100%" height="100%">
//                 <LineChart data={logs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
//                   <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
//                   <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
//                   <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
//                   <Line type="monotone" dataKey="response_time" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} animationDuration={1500} />
//                 </LineChart>
//               </ResponsiveContainer>
//             </div>
//           </div>

//           {/* Logs Table */}
//           <LogsTable logsData={logs} monitorType="Ping" />

//         </div>
//       ) : activeTab === 'http' && hasHttp ? (
//         // ==========================================
//         //  Tab 2: HTTP Monitor
//         // ==========================================
//         <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease-in-out' }}>
          
//           {/* HTTP KPI Cards (已移除 SSL Card) */}
//           <div style={{ display: 'flex', gap: '20px' }}>
//             <KpiCard icon={<Globe size={32} color={mockHttpData.statusCode < 400 ? "#10b981" : "#ef4444"} />} title="Current HTTP Status" value={`${mockHttpData.statusCode} ${mockHttpData.statusText}`} valueColor={mockHttpData.statusCode < 400 ? '#059669' : '#DC2626'} />
//             <KpiCard icon={<Zap size={32} color="#f59e0b" />} title="Time to First Byte (TTFB)" value={`${mockHttpData.ttfb} ms`} />
//           </div>

//           {/* Line Chart (HTTP) */}
//           <div style={chartContainerStyle}>
//             <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#111827' }}>HTTP Monitoring Data / Response Time (ms)</h3>
//             <div style={{ height: '300px', width: '100%' }}>
//               <ResponsiveContainer width="100%" height="100%">
//                 <LineChart data={logs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
//                   <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
//                   <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
//                   <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
//                   <Line type="monotone" dataKey="response_time" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} animationDuration={1500} />
//                 </LineChart>
//               </ResponsiveContainer>
//             </div>
//           </div>

//           {/* Logs Table */}
//           <LogsTable logsData={logs} monitorType="HTTP" />

//         </div>
//       ) : null}

//       <style>{`
//         @keyframes fadeIn {
//           from { opacity: 0; transform: translateY(5px); }
//           to { opacity: 1; transform: translateY(0); }
//         }
//         .spin-animation {
//           animation: spin 1s linear infinite;
//         }
//         @keyframes spin {
//           100% { transform: rotate(360deg); }
//         }
//         /* 隐藏滚动条但保留滚动功能 (可选修饰) */
//         ::-webkit-scrollbar {
//           width: 8px;
//           height: 8px;
//         }
//         ::-webkit-scrollbar-track {
//           background: #f1f5f9; 
//           border-radius: 4px;
//         }
//         ::-webkit-scrollbar-thumb {
//           background: #cbd5e1; 
//           border-radius: 4px;
//         }
//         ::-webkit-scrollbar-thumb:hover {
//           background: #94a3b8; 
//         }
//       `}</style>
//     </div>
//   );
// };

// // --- Helper Styles & Components ---
// const cardStyle = { flex: 1, backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' };
// const chartContainerStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
// const refreshBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' };

// const getTabStyle = (isActive) => ({
//   background: 'none', border: 'none', padding: '10px 15px', cursor: 'pointer',
//   fontSize: '15px', fontWeight: isActive ? '600' : '500',
//   color: isActive ? '#4F46E5' : '#64748b',
//   borderBottom: isActive ? '2px solid #4F46E5' : '2px solid transparent',
//   display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
// });

// const KpiCard = ({ icon, title, value, valueColor = '#0f172a' }) => (
//   <div style={cardStyle}>
//     <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
//       {icon}
//       <div>
//         <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>{title}</div>
//         <div style={{ fontSize: '24px', fontWeight: 'bold', color: valueColor }}>{value}</div>
//       </div>
//     </div>
//   </div>
// );

// export default WebsiteDetails;

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ArrowLeft, Activity, TrendingUp, Clock, RefreshCw, Globe, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

const WebsiteDetails = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  
  const [data, setData] = useState({ website: {}, logs: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ping'); // 預設顯示 ping

  const fetchDetails = (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    fetch(`http://localhost:5000/api/websites/${id}/logs`)
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        console.error("Error fetching logs:", err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchDetails(true); 
    const intervalId = setInterval(() => {
      fetchDetails(false); 
    }, 10000); 
    return () => clearInterval(intervalId); 
  }, [id]);

  const { website, logs } = data;

  // 👇 1. 解析網站擁有的監控類型
  const hasPing = website.monitors?.some(m => m.type === 'ping') || false;
  const hasHttp = website.monitors?.some(m => m.type === 'http') || false;

  // 👇 2. 自動修正預設打開的標籤頁
  useEffect(() => {
    if (website.monitors) {
      if (!hasPing && activeTab === 'ping') setActiveTab('http');
      if (!hasHttp && activeTab === 'http') setActiveTab('ping');
    }
  }, [website.monitors, hasPing, hasHttp]);

  // 攔截加載狀態
  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>;

  // 👇 3. 根據當前啟用的 Tab 過濾出對應的日誌
  const currentLogs = logs.filter(log => log.type.toLowerCase() === activeTab);
  
  // 獲取當前監控項的最新一筆日誌 (數組最後一個)
  const latestLog = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1] : null;
  const latestResponseTime = latestLog ? latestLog.response_time : 0;
  
  // 獲取當前監控項的設定 (例如 Interval)
  const activeMonitorConfig = website.monitors?.find(m => m.type === activeTab) || {};

  // --- 抽取復用的日誌表格組件 (加入滾動條設計) ---
  const LogsTable = ({ logsData, monitorType }) => {
    // 👇 修改點：獲取最新的 30 條記錄 (將過濾好的 logsData 反轉並切片)
    const topLogs = [...logsData].reverse().slice(0, 30);
    
    return (
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* 👇 修改點：標題改為 Top 30 */}
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#111827' }}>Monitoring Logs (Top 30)</h3>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <tr style={{ color: '#64748b' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Time</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Monitor Type</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Status Code</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Result</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>AI Insight</th>
              </tr>
            </thead>
            <tbody>
              {topLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No log data available</td>
                </tr>
              ) : (
                topLogs.map((log, index) => {
                  const isError = log.response_time === 0 || log.status_code >= 400 || log.error;
                  const aiInsight = isError ? (log.error || "Connection issue detected") : "Response time is normal, system is running smoothly";
                  
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s', ':hover': { backgroundColor: '#f8fafc' } }}>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>{log.time}</td>
                      <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '500' }}>{monitorType}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                          color: isError ? '#DC2626' : '#059669', backgroundColor: isError ? '#FEE2E2' : '#D1FAE5'
                        }}>
                          {/* 👇 修改點：確保數字 0 也會被渲染出來，而不是變成 ERR */}
                          {log.status_code !== undefined && log.status_code !== null ? log.status_code : (isError ? 'ERR' : 'OK')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {isError ? 'Error' : `Success - ${log.response_time}ms`}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }} title={aiInsight}>
                        {isError ? <AlertTriangle size={14} color="#ef4444" style={{flexShrink: 0}} /> : <CheckCircle size={14} color="#10b981" style={{flexShrink: 0}} />}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                          {aiInsight}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- Header --- */}
      <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Dashboard</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={24} color="#333" />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#111827' }}>{website.name}</h2>
              <span style={{ 
                fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold',
                color: (website.monitors?.some(m => m.status === 'Down')) ? '#DC2626' : (website.monitors?.some(m => m.status === 'Warning')) ? '#D97706' : '#059669',
                backgroundColor: (website.monitors?.some(m => m.status === 'Down')) ? '#FEE2E2' : (website.monitors?.some(m => m.status === 'Warning')) ? '#FEF3C7' : '#D1FAE5',
              }}>
                {(website.monitors?.some(m => m.status === 'Down')) ? 'DOWN' : (website.monitors?.some(m => m.status === 'Warning')) ? 'WARNING' : 'UP'}
              </span>
            </div>
            <div style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>{website.url}</div>
          </div>
        </div>

        <button onClick={() => fetchDetails(false)} disabled={refreshing} style={refreshBtnStyle}>
          <RefreshCw size={16} className={refreshing ? "spin-animation" : ""} />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* 👇 4. 動態 Tab Navigation --- */}
      <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
        {hasPing && (
          <button onClick={() => setActiveTab('ping')} style={getTabStyle(activeTab === 'ping')}>
            <Activity size={18} /> Ping (Latency)
          </button>
        )}
        {hasHttp && (
          <button onClick={() => setActiveTab('http')} style={getTabStyle(activeTab === 'http')}>
            <Globe size={18} /> HTTP Monitor
          </button>
        )}
      </div>

      {/* 👇 5. 動態 Tab Content --- */}
      {activeTab === 'ping' && hasPing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease-in-out' }}>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <KpiCard icon={<Activity size={32} color="#3b82f6" />} title="Current Response Time" value={`${latestResponseTime} ms`} />
            <KpiCard icon={<CheckCircle size={32} color={activeMonitorConfig.status === 'Up' ? "#10b981" : "#ef4444"} />} title="Ping Status" value={activeMonitorConfig.status || 'Unknown'} valueColor={activeMonitorConfig.status === 'Up' ? '#059669' : '#DC2626'} />
            <KpiCard icon={<Clock size={32} color="#8b5cf6" />} title="Check Interval" value={`Every ${activeMonitorConfig.interval || 1} mins`} />
          </div>

          <div style={chartContainerStyle}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#111827' }}>Ping Response Time (ms)</h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentLogs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="response_time" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <LogsTable logsData={currentLogs} monitorType="Ping" />

        </div>
      ) : activeTab === 'http' && hasHttp ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease-in-out' }}>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* 👇 修改點：即使是 0，也會明確顯示為 HTTP 0 (Network Error)，而不是 Error */}
            <KpiCard 
              icon={<Globe size={32} color={(!latestLog || latestLog.status_code >= 400 || latestLog.status_code === 0) ? "#ef4444" : "#10b981"} />} 
              title="Current HTTP Status" 
              value={latestLog?.status_code !== undefined && latestLog.status_code !== null ? `HTTP ${latestLog.status_code}` : 'No Data'} 
              valueColor={(!latestLog || latestLog.status_code >= 400 || latestLog.status_code === 0) ? '#DC2626' : '#059669'} 
            />
            <KpiCard icon={<Zap size={32} color="#f59e0b" />} title="Response Time (TTFB)" value={`${latestResponseTime} ms`} />
            <KpiCard icon={<Clock size={32} color="#8b5cf6" />} title="Check Interval" value={`Every ${activeMonitorConfig.interval || 5} mins`} />
          </div>

          <div style={chartContainerStyle}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#111827' }}>HTTP Monitoring Data / Response Time (ms)</h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentLogs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="response_time" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <LogsTable logsData={currentLogs} monitorType="HTTP" />

        </div>
      ) : null}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9; 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}</style>
    </div>
  );
};

// --- Helper Styles & Components ---
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' };
const chartContainerStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const refreshBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' };

const getTabStyle = (isActive) => ({
  background: 'none', border: 'none', padding: '10px 15px', cursor: 'pointer',
  fontSize: '15px', fontWeight: isActive ? '600' : '500',
  color: isActive ? '#4F46E5' : '#64748b',
  borderBottom: isActive ? '2px solid #4F46E5' : '2px solid transparent',
  display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
});

const KpiCard = ({ icon, title, value, valueColor = '#0f172a' }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      {icon}
      <div style={{ overflow: 'hidden' }}>
        <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: valueColor, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{value}</div>
      </div>
    </div>
  </div>
);

export default WebsiteDetails;