import React, { useState, useEffect } from 'react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Server, AlertTriangle, CheckCircle, ArrowRight, RefreshCw, Zap, Info } from 'lucide-react';

// --- Accessories ---
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

// --- 主页面组件 ---
const Dashboard = () => {
  // --- State 定义 ---
  const [websites, setWebsites] = useState([]); 
  const [chartData, setChartData] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [scanning, setScanning] = useState(false); 

  // AI Insight 专属 State
  const [aiInsight, setAiInsight] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 从后端获取网站列表
  const fetchWebsites = () => {
    setLoading(true);
    fetch('http://localhost:5000/api/websites')
      .then(response => response.json())
      .then(data => {
        setWebsites(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching websites:", error);
        setLoading(false);
      });
  };

  // Retrieve real chart trend data from the backend
  const fetchChartData = () => {
    fetch('http://localhost:5000/api/dashboard/chart')
      .then(response => response.json())
      .then(data => setChartData(data))
      .catch(error => console.error("Error fetching chart data:", error));
  };

  // 手动触发扫描
  const handleScan = () => {
    setScanning(true);
    fetch('http://localhost:5000/api/scan', { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        fetchWebsites(); 
        fetchChartData(); // 扫描完立刻刷新图表数据
        setScanning(false);
      })
      .catch(error => {
        console.error("Scan failed:", error);
        setScanning(false);
      });
  };

  // 调用 AI 接口进行分析
  const handleAnalyze = () => {
    setAnalyzing(true);
    setAiInsight(null); // 清空上次的结果

    fetch('http://localhost:5000/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeRange: '24h', targetSite: 'all' })
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          const summary = data.data.summary;
          const rootCause = data.data.incidentAnalysis;
          setAiInsight({ summary, rootCause });
        } else {
          setAiInsight({ error: data.message || "Analysis failed, please try again later." });
        }
        setAnalyzing(false);
      })
      .catch(error => {
        console.error("AI Analysis failed:", error);
        setAiInsight({ error: "Network request failed, please ensure the backend is running and the AI API Key is valid." });
        setAnalyzing(false);
      });
  };

  // 页面一加载就运行
  useEffect(() => {
    fetchWebsites();
    fetchChartData(); // 初次加载图表数据

    // 设置定时器，每 15 秒自动静默获取一次最新数据
    const intervalId = setInterval(() => {
      fetch('http://localhost:5000/api/websites')
        .then(response => response.json())
        .then(data => setWebsites(data))
        .catch(error => console.error("Auto-refresh failed:", error));
        
      fetchChartData(); // 定时刷新图表
    }, 15000); 

    return () => clearInterval(intervalId);
  }, []);

  // 动态计算各个状态的网站数量
  const upCount = websites.filter(site => site.status === 'Up').length;
  const downCount = websites.filter(site => site.status === 'Down').length;
  const warningCount = websites.filter(site => site.status === 'Warning').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- A. Top Statistics --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <StatCard title="Total Monitored" value={loading ? "..." : websites.length} icon={Activity} color="#4F46E5" />
        <StatCard title="Online Status" value={loading ? "..." : upCount} icon={CheckCircle} color="#10B981" />
        <StatCard title="Incidents" value={loading ? "..." : downCount} icon={AlertTriangle} color="#EF4444" />
        <StatCard title="Warnings" value={loading ? "..." : warningCount} icon={Server} color="#F59E0B" />
      </div>

      {/* --- B. Middle content area --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Left side: The actual list read from the database */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Live Status (Real-time)</h3>
            <button 
              onClick={handleScan} 
              disabled={scanning}
              style={{ 
                border: 'none', 
                background: scanning ? '#ccc' : '#4F46E5', 
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
              <RefreshCw size={16} className={scanning ? "spin-animation" : ""} /> 
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px',
            maxHeight: '350px',
            overflowY: 'auto',
            paddingRight: '10px'
            }}>
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
                  padding: '12px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px',
                  borderLeft: `4px solid ${site.status === 'Down' ? '#EF4444' : site.status === 'Warning' ? '#F59E0B' : '#10B981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{site.name}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>{site.url}</div>
                    </div>
                    <span style={{ 
                      backgroundColor: site.status === 'Down' ? '#FEE2E2' : site.status === 'Warning' ? '#FFFBEB' : '#ECFDF5', 
                      color: site.status === 'Down' ? '#B91C1C' : site.status === 'Warning' ? '#B45309' : '#047857',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                    }}>
                      {(site.status || 'Unknown').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {site.monitors && site.monitors.map(monitor => {
                      let displayText = monitor.type.toUpperCase();
                      if (monitor.type === 'http' && monitor.status_code) {
                        displayText += ` ${monitor.status_code}`;
                      }
                      displayText += `: ${monitor.status}`;
                      
                      if (monitor.response_time) {
                        displayText += ` (${monitor.response_time}ms)`;
                      } 
                      return (
                        <span key={monitor.id} 
                        title={monitor.error || "Normal / No Errors"} 
                        style={{
                            fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
                            backgroundColor: monitor.status === 'Up' ? '#dcfce7' : monitor.status === 'Warning' ? '#fef3c7' : '#fee2e2',
                            color: monitor.status === 'Up' ? '#166534' : monitor.status === 'Warning' ? '#92400e' : '#991b1b',
                            border: `1px solid ${monitor.status === 'Up' ? '#bbf7d0' : monitor.status === 'Warning' ? '#fde68a' : '#fecaca'}`,
                            cursor: monitor.error ? 'help' : 'default' 
                        }}>
                          {displayText}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：AI Insights */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '250px', border: '1px solid #E0E7FF', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>✨</span>
              <h3 style={{ margin: 0, color: '#4F46E5' }}>AI Insights</h3>
            </div>
            <button 
              onClick={handleAnalyze} 
              disabled={analyzing}
              style={{ 
                border: 'none', 
                background: analyzing ? '#E0E7FF' : '#4F46E5', 
                color: analyzing ? '#4F46E5' : 'white',
                cursor: analyzing ? 'not-allowed' : 'pointer',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.3s'
              }}
            >
              {analyzing ? <RefreshCw size={14} className="spin-animation" /> : <Zap size={14} />} 
              {analyzing ? "Thinking..." : "Analyze"}
            </button>
          </div>

          <div style={{ 
            color: '#555', lineHeight: '1.6', fontSize: '14px', flex: 1, 
            maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' 
            }}>
            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: '#6366F1' }}>
                <span className="spin-animation">✨</span>
                <span style={{ fontSize: '13px' }}>AI is analyzing system logs...</span>
              </div>
            ) : aiInsight ? (
              aiInsight.error ? (
                <div style={{ color: '#EF4444', backgroundColor: '#FEE2E2', padding: '10px', borderRadius: '8px' }}>
                  {aiInsight.error}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #4F46E5' }}>
                    <strong style={{ color: '#1E293B', display: 'block', marginBottom: '4px' }}>Executive Summary:</strong>
                    {aiInsight.summary}
                  </div>
                  {aiInsight.rootCause && (
                    <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #F59E0B' }}>
                       <strong style={{ color: '#1E293B', display: 'block', marginBottom: '4px' }}>Root Cause Analysis:</strong>
                       {aiInsight.rootCause}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div style={{ backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <strong style={{ color: '#333' }}>System Ready</strong><br/>
                <span style={{ color: '#666', fontSize: '13px' }}>Click "Analyze" to generate a real-time AI summary based on the latest monitoring data.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- C. 底部大图表 (已接入真实数据与优化 UX) --- */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', height: '380px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* 👇 优化的标题和提示词 Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#111827', fontSize: '18px' }}>Overall Average Response Time (All Sites)</h3>
          <div 
            title="Displays the aggregated average HTTP and PING response times across all monitored targets. (展示所有受监控目标的 HTTP 和 PING 平均响应时间)"
            style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}
          >
            <Info size={16} color="#94a3b8" />
          </div>
        </div>

        <ResponsiveContainer width="99%" height="85%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            
            {/* 👇 Y 轴加入 ms 单位后缀 */}
            <YAxis tickFormatter={(value) => `${value} ms`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={65} />
            
            {/* 👇 Tooltip 显示具体数值和类型 */}
            <Tooltip 
              formatter={(value, name) => [`${value} ms`, name === 'http_ms' ? 'HTTP Average' : 'PING Average']}
              labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
            />
            
            {/* 👇 图例，告诉用户蓝色是HTTP，绿色是PING */}
            <Legend 
              verticalAlign="top" 
              height={36} 
              formatter={(value) => <span style={{ color: '#475569', fontWeight: 500 }}>{value === 'http_ms' ? 'HTTP Average' : 'PING Average'}</span>}
            />
            
            {/* 两条数据线 */}
            <Line type="monotone" dataKey="http_ms" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} animationDuration={1500} />
            <Line type="monotone" dataKey="ping_ms" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} animationDuration={1500} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default Dashboard;