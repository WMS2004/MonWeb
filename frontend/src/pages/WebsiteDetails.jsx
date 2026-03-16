import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ArrowLeft, Activity, Clock, RefreshCw, Globe, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

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

  const hasPing = website.monitors?.some(m => m.type === 'ping') || false;
  const hasHttp = website.monitors?.some(m => m.type === 'http') || false;

  useEffect(() => {
    if (website.monitors) {
      if (!hasPing && activeTab === 'ping') setActiveTab('http');
      if (!hasHttp && activeTab === 'http') setActiveTab('ping');
    }
  }, [website.monitors, hasPing, hasHttp]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>;

  const currentLogs = logs.filter(log => log.type.toLowerCase() === activeTab);
  const latestLog = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1] : null;
  const latestResponseTime = latestLog ? latestLog.response_time : 0;
  const activeMonitorConfig = website.monitors?.find(m => m.type === activeTab) || {};

  // --- 重构后的日志表格组件 (动态列名 + 智能 Result) ---
  const LogsTable = ({ logsData, monitorType }) => {
    const topLogs = [...logsData].reverse().slice(0, 30);
    const isHttp = monitorType.toLowerCase() === 'http';
    
    return (
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#111827' }}>Monitoring Logs (Top 30)</h3>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <tr style={{ color: '#64748b' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Time</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                
                {/* 👇 根据当前监控类型，动态显示第三列的表头 */}
                {isHttp ? (
                  <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Status Code</th>
                ) : (
                  <th style={{ padding: '12px 16px', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>Response Time</th>
                )}
                
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
                  // 判断是否是异常记录
                  const isError = log.response_time === 0 || (isHttp && log.status_code >= 400) || log.error;
                  const aiInsight = isError ? (log.error || "Connection issue detected") : "Response time is normal, system is running smoothly.";
                  
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s', ':hover': { backgroundColor: '#f8fafc' } }}>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>{log.time}</td>
                      <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>{monitorType}</td>
                      
                      {/* 👇 动态第三列：如果是 HTTP 显示徽章，如果是 PING 显示时间 */}
                      {isHttp ? (
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                            color: isError ? '#DC2626' : '#059669', backgroundColor: isError ? '#FEE2E2' : '#D1FAE5'
                          }}>
                            {log.status_code !== undefined && log.status_code !== null ? log.status_code : (isError ? 'ERR' : 'OK')}
                          </span>
                        </td>
                      ) : (
                        <td style={{ padding: '12px 16px', color: isError ? '#DC2626' : '#475569', fontWeight: '500' }}>
                          {isError ? '-' : `${log.response_time} ms`}
                        </td>
                      )}

                      {/* 👇 智能 Result 列：巧妙融合 HTTP 的延迟信息 */}
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {isError ? (
                          <span style={{ color: '#DC2626', fontWeight: '600' }}>Error</span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: '500' }}>
                            {isHttp ? `Success (${log.response_time}ms)` : 'Success'}
                          </span>
                        )}
                      </td>

                      {/* 👇 AI Insight：放大 maxWidth 以容纳更多文本，超出才悬停显示 */}
                      <td style={{ padding: '12px 16px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }} title={aiInsight}>
                        {isError ? <AlertTriangle size={14} color="#ef4444" style={{flexShrink: 0}} /> : <CheckCircle size={14} color="#10b981" style={{flexShrink: 0}} />}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
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

      {/* --- 動態 Tab Navigation --- */}
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

      {/* --- 動態 Tab Content --- */}
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

          {/* 👇 渲染 PING 的日志表 */}
          <LogsTable logsData={currentLogs} monitorType="PING" />

        </div>
      ) : activeTab === 'http' && hasHttp ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease-in-out' }}>
          
          <div style={{ display: 'flex', gap: '20px' }}>
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

          {/* 👇 渲染 HTTP 的日志表 */}
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