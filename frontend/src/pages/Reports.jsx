import React, { useState, useEffect} from 'react';
import { Bot, Sparkles, Search, ShieldAlert, Lightbulb, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// 图表颜色配置
const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6'];

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [targetSite, setTargetSite] = useState('all');
  const [websites, setWebsites] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/websites')
      .then(res => res.json())
      .then(data => setWebsites(data))
      .catch(err => console.error("无法获取网站列表:", err));
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setReportData(null);
    try {
      const res = await fetch('http://localhost:5000/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRange, targetSite })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setReportData(json.data);
      }
    } catch (error) {
      console.error("Failed to fetch AI report:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 顶部控制台 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex flex-wrap items-center justify-between border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bot className="text-indigo-600" /> Smart Reports
          </h1>
          <p className="text-gray-500 text-sm mt-1">AI-driven diagnostics and system insights</p>
        </div>
        
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <select 
            value={targetSite} 
            onChange={(e) => setTargetSite(e.target.value)}
            className="border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
          >
            <option value="all">All Websites</option>
            {websites.map(site => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.url})
              </option>
            ))}
          </select>

          <button 
            onClick={handleGenerateReport}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'AI Analyzing...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-20 h-20 border-indigo-200 border-2 rounded-full"></div>
            <div className="w-20 h-20 border-indigo-600 border-t-2 animate-spin rounded-full absolute left-0 top-0"></div>
          </div>
          <p className="mt-6 text-indigo-600 font-medium animate-pulse text-lg">🤖 AI is reading system logs and response times...</p>
          <p className="text-gray-400 text-sm mt-2">Checking for network issues and server status</p>
        </div>
      )}

      {/* 报告内容区 */}
      {reportData && !loading && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* 模块 A: Executive Summary (去除了 Health Score) */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-800 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Generated
            </div>
            <h2 className="text-lg font-bold text-indigo-900 mb-3 flex items-center gap-2">
              Executive Summary
            </h2>
            <div className="text-gray-700 leading-relaxed text-base pr-20">
              {reportData.summary}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 模块 B: Incident & Root Cause */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Search className="text-blue-500" /> Incident & Root Cause
              </h2>
              <div className="text-gray-600 text-sm leading-relaxed mb-6">
                {reportData.incidentAnalysis}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reportData.errorChartData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {reportData.errorChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs mt-2 text-gray-500">
                {reportData.errorChartData.map((entry, index) => (
                  <span key={entry.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length]}}></span>
                    {entry.name}
                  </span>
                ))}
              </div>
            </div>

            {/* 模块 C: Performance Insights (👇图表已拆分) */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ShieldAlert className="text-red-500" /> Performance Insights
              </h2>
              
              {/* 文字 Insights */}
              <ul className="space-y-3 mb-6">
                {reportData.insights.map((insight, idx) => (
                  <li key={idx} className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {insight}
                  </li>
                ))}
              </ul>
              
              {/* 分开的 HTTP 与 PING 柱状图 */}
              <div className="flex flex-col gap-4 mt-auto">
                {/* HTTP 柱状图 */}
                {reportData.httpLatencyChartData && reportData.httpLatencyChartData.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 mb-2">HTTP Response Time (ms)</h3>
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.httpLatencyChartData}>
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} width={35} />
                          <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="ms" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* PING 柱状图 */}
                {reportData.pingLatencyChartData && reportData.pingLatencyChartData.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 mb-2">PING Latency (ms)</h3>
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.pingLatencyChartData}>
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} width={35} />
                          <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="ms" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 模块 D: Actionable Recommendations */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Lightbulb className="text-amber-500" /> Actionable Recommendations
            </h2>
            <div className="space-y-3">
              {reportData.recommendations.map((rec, idx) => (
                <label key={idx} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                  <input type="checkbox" className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer" />
                  <span className="text-sm text-gray-700">{rec}</span>
                </label>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Reports;