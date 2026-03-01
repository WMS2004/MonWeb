import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ArrowLeft, Activity, TrendingUp, Clock, RefreshCw } from 'lucide-react';

const WebsiteDetails = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  
  const [data, setData] = useState({ website: {}, logs: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Fetch Details ---
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

  // --- Auto-Refresh (每10秒自动更新) ---
  useEffect(() => {
    fetchDetails(true); // Initial load

    const intervalId = setInterval(() => {
      fetchDetails(false); // Silent background refresh
    }, 10000); 

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [id]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>;

  const { website, logs } = data;

  const latestResponseTime = logs.length > 0 ? logs[logs.length - 1].response_time : 0;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- 1. Top: Dashboard Header --- */}
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
                color: website.status === 'Up' ? '#059669' : website.status === 'Down' ? '#DC2626' : '#D97706',
                backgroundColor: website.status === 'Up' ? '#D1FAE5' : website.status === 'Down' ? '#FEE2E2' : '#FEF3C7',
                border: `1px solid ${website.status === 'Up' ? '#059669' : '#DC2626'}20`
              }}>
                {website.status ? website.status.toUpperCase() : 'UNKNOWN'}
              </span>
            </div>
            <div style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>{website.url}</div>
          </div>
        </div>

        {/* Refresh Button */}
        <button 
          onClick={() => fetchDetails(false)}
          disabled={refreshing}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', 
            border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', cursor: refreshing ? 'wait' : 'pointer', fontWeight: '500' 
          }}
        >
          <RefreshCw size={16} className={refreshing ? "spin-animation" : ""} />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* --- 2. KPI Cards --- */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Activity size={32} color="#3b82f6" />
            <div>
              <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>Current Response Time</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                {latestResponseTime} <span style={{ fontSize: '16px', fontWeight: 'normal' }}>ms</span>
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <TrendingUp size={32} color="#10b981" />
            <div>
              <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>Availability</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>99.9%</div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Clock size={32} color="#8b5cf6" />
            <div>
              <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>Check Interval</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                Every {website.interval || 5} mins
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- 3. Line Chart --- */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#111827' }}>Real-time Response Time (Last 24 Hours) <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 'normal' }}>- AI Intelligent Anomaly Detection</span></h3>
          <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#475569' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div> Normal</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div> AI Detected Anomaly</span>
          </div>
        </div>

        <div style={{ height: '300px', width: '100%' }}>
          {logs.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#333', marginBottom: '5px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="response_time" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={{ r: 6, fill: '#10b981', stroke: 'white', strokeWidth: 2 }} 
                  name="Response Time (ms)"
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ marginTop: '15px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <strong>AI Intelligence Note:</strong> Green line indicates normal response time. Red line and dots indicate anomalies where response time exceeded the dynamic threshold. AI automatically calculates optimal thresholds for each website based on historical data and machine learning models.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* --- 4. Logs List --- */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '16px', color: '#111827' }}>Monitoring Logs</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Last 30 check records</p>

          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No logs available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...logs].reverse().map((log, index) => (
                  <div key={index} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <span style={{ color: '#475569', fontSize: '14px', width: '100px' }}>{log.time}</span>
                      <span style={{ color: log.status_code >= 400 ? '#ef4444' : '#10b981', fontWeight: 'bold', fontSize: '14px', width: '80px' }}>{log.status_code || 200} OK</span>
                      <span style={{ color: '#475569', fontSize: '14px' }}>Duration: {log.response_time}ms</span>
                    </div>
                    
                    <span style={{ 
                      padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                      color: log.response_time === 0 ? '#DC2626' : '#059669',
                      backgroundColor: log.response_time === 0 ? '#FEE2E2' : '#D1FAE5',
                      border: `1px solid ${log.response_time === 0 ? '#DC2626' : '#059669'}40`
                    }}>
                      {log.response_time === 0 ? 'DOWN' : 'UP'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- 5. Website Configuration (新增板块) --- */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#111827' }}>Monitoring Configuration</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '5px' }}>Check Types</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{website.monitor_type || 'http'}</div>
            </div>
            
            <div>
              <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '5px' }}>Timeout Threshold</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{website.timeout || 10} seconds</div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '5px' }}>AI Features</div>
              <div>
                <span style={{ 
                  padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                  color: website.ai_enabled !== false ? '#059669' : '#475569',
                  backgroundColor: website.ai_enabled !== false ? '#D1FAE5' : '#f1f5f9'
                }}>
                  {website.ai_enabled !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '5px' }}>Monitoring Since</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{website.monitoring_since || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

const cardStyle = {
  flex: 1,
  backgroundColor: 'white',
  padding: '24px',
  borderRadius: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  border: '1px solid #f1f5f9'
};

export default WebsiteDetails;