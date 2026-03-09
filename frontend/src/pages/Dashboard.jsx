import React, { useState, useEffect } from 'react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Server, AlertTriangle, CheckCircle, ArrowRight, RefreshCw, Zap } from 'lucide-react';

// --- 1. Mock Data ---
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
  const [websites, setWebsites] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [scanning, setScanning] = useState(false); 

  // AI Insight 专属 State
  const [aiInsight, setAiInsight] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 从后端获取数据
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

  // 手动触发扫描
  const handleScan = () => {
    setScanning(true);
    fetch('http://localhost:5000/api/scan', { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        fetchWebsites(); 
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

    // 调用已有的 /api/generate-report 接口
    fetch('http://localhost:5000/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeRange: '24h', targetSite: 'all' })
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          // 提取后端的 AI 报告摘要和分析结果
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
  }, []);

  // 动态计算各个状态的网站数量
  const upCount = websites.filter(site => site.status === 'Up').length;
  const downCount = websites.filter(site => site.status === 'Down').length;
  const warningCount = websites.filter(site => site.status === 'Warning').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- A. 顶部统计 --- */}
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
            paddingRight: '10px' // 给滚动条留出空间
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

        {/* 👇 右侧：AI Insights (已更新为真实功能) 👇 */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', minWidth: '250px', border: '1px solid #E0E7FF', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>✨</span>
              <h3 style={{ margin: 0, color: '#4F46E5' }}>AI Insights</h3>
            </div>
            {/* Analyze 按钮 */}
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
            color: '#555', 
            lineHeight: '1.6', 
            fontSize: '14px', 
            flex: 1, 
            maxHeight: '350px',
            overflowY: 'auto',
            paddingRight: '10px' // 给滚动条留出空间 
            }}>
            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: '#6366F1' }}>
                <span className="spin-animation">✨</span>
                <span style={{ fontSize: '13px' }}>AI is analyzing system logs...</span>
              </div>
            ) : aiInsight ? (
              // 显示 AI 分析结果
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
              // 默认提示状态
              <div style={{ backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <strong style={{ color: '#333' }}>System Ready</strong><br/>
                <span style={{ color: '#666', fontSize: '13px' }}>Click "Analyze" to generate a real-time AI summary based on the latest monitoring data.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- C. 底部大图表 --- */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', height: '350px' }}>
        <h3 style={{ margin: '0 0 20px 0' }}>Response Time Trend</h3>
        <ResponsiveContainer width="99%" height="100%">
          <LineChart data={mockChartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="ms" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* 👇 补充全局样式（滚动条美化 + 旋转动画） 👇 */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        /* 隐藏滚动条但保留滚动功能 (可选修饰) */
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

export default Dashboard;