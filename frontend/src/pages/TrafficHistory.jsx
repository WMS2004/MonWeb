import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Activity, Server, Shield } from 'lucide-react';

const TrafficHistory = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/traffic/history');
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch traffic history:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // 强大的前端过滤逻辑：可以搜索 IP, 协议, 地理位置或公司名称
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      (log.destIp && log.destIp.toLowerCase().includes(term)) ||
      (log.isp && log.isp.toLowerCase().includes(term)) ||
      (log.location && log.location.toLowerCase().includes(term)) ||
      (log.protocol && log.protocol.toLowerCase().includes(term)) ||
      (log.destPort && log.destPort.toString().includes(term))
    );
  });

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server color="#4F46E5" /> Network Traffic Logs
          </h2>
          <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>
            Comprehensive audit log of all intercepted network connections.
          </p>
        </div>
        
        <button 
          onClick={fetchHistory}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            padding: '10px 16px', backgroundColor: 'white', 
            border: '1px solid #cbd5e1', borderRadius: '8px',
            color: '#475569', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          <RefreshCw size={16} className={isLoading ? "spin" : ""} /> 
          {isLoading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      {/* 搜索和过滤栏 */}
      <div style={{ backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px 12px 0 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search by IP, Company, Location or Port..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '10px 10px 10px 40px', 
              borderRadius: '8px', border: '1px solid #cbd5e1',
              outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
        <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 'bold' }}>
          Showing {filteredLogs.length} results
        </div>
      </div>

      {/* 数据表格主体 */}
      <div style={{ backgroundColor: 'white', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '15px 20px', fontWeight: 'bold' }}>Timestamp</th>
                <th style={{ padding: '15px 20px', fontWeight: 'bold' }}>Source IP</th>
                <th style={{ padding: '15px 20px', fontWeight: 'bold' }}>Protocol</th>
                <th style={{ padding: '15px 20px', fontWeight: 'bold' }}>Destination (IP : Port)</th>
                <th style={{ padding: '15px 20px', fontWeight: 'bold' }}>Location & ISP</th>
                <th style={{ padding: '15px 20px', fontWeight: 'bold' }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No traffic logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  // 解析后端传来的暗号，判断是否是攻击
                  const isAttack = log.isp && log.isp.includes('🚨');
                  let displayIsp = log.isp;
                  let attackLabel = null;
                  
                  if (isAttack) {
                    const match = log.isp.match(/\[(🚨.*?)\]\s*(.*)/);
                    if (match) {
                      attackLabel = match[1];
                      displayIsp = match[2];
                    }
                  }

                  // 动态判断协议的颜色
                  let pBg = '#f3f4f6', pText = '#374151';
                  if (log.protocol === 'TCP') { pBg = '#dbeafe'; pText = '#1e40af'; }
                  else if (log.protocol === 'UDP') { pBg = '#fef3c7'; pText = '#92400e'; }
                  else if (log.protocol === 'DNS') { pBg = '#fce7f3'; pText = '#be185d'; }
                  else if (log.protocol === 'ICMP') { pBg = '#e0e7ff'; pText = '#4338ca'; }

                  return (
                    <tr 
                      key={log.id} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        transition: 'background 0.2s',
                        // 如果是攻击，整行默认显示危险的淡红色背景
                        backgroundColor: isAttack ? '#fef2f2' : 'transparent' 
                      }} 
                      // 悬浮时也会保持对应的红色加深或灰色加深
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isAttack ? '#fee2e2' : '#f8fafc'} 
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isAttack ? '#fef2f2' : 'transparent'}
                    >
                      <td style={{ padding: '15px 20px', color: isAttack ? '#ef4444' : '#64748b', fontSize: '13px', fontWeight: isAttack ? 'bold' : 'normal' }}>
                        {log.timestamp}
                      </td>
                      <td style={{ padding: '15px 20px', fontWeight: 'bold', color: isAttack ? '#dc2626' : '#334155' }}>
                        {log.sourceIp}
                      </td>
                      <td style={{ padding: '15px 20px' }}>
                        <span style={{ 
                          backgroundColor: isAttack ? '#fee2e2' : pBg, 
                          color: isAttack ? '#dc2626' : pText, 
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' 
                        }}>
                          {log.protocol}
                        </span>
                      </td>
                      <td style={{ padding: '15px 20px', fontFamily: 'monospace' }}>
                        <span style={{ color: log.protocol === 'DNS' ? '#be185d' : (isAttack ? '#dc2626' : '#2563eb'), fontWeight: 'bold' }}>
                          {log.destIp}
                        </span>
                        <span style={{ color: isAttack ? '#f87171' : '#94a3b8' }}> : {log.destPort}</span>
                      </td>
                      <td style={{ padding: '15px 20px' }}>
                        {/* 如果是攻击，在这里显示出显眼的红色预警 Badge */}
                        {isAttack && (
                          <div style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', display: 'inline-block', backgroundColor: '#fca5a5', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 4px rgba(220,38,38,0.2)' }}>
                            {attackLabel}
                          </div>
                        )}
                        <div style={{ fontWeight: 'bold', color: isAttack ? '#dc2626' : '#1E293B' }}>{displayIsp}</div>
                        <div style={{ fontSize: '12px', color: isAttack ? '#ef4444' : '#64748b' }}>{log.location}</div>
                      </td>
                      <td style={{ padding: '15px 20px', color: isAttack ? '#ef4444' : '#64748b', fontWeight: isAttack ? 'bold' : 'normal' }}>
                        {log.size} B
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default TrafficHistory;