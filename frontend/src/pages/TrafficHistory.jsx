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
                filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '15px 20px', color: '#64748b', fontSize: '13px' }}>{log.timestamp}</td>
                    <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#334155' }}>{log.sourceIp}</td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ 
                        backgroundColor: log.protocol === 'TCP' ? '#dbeafe' : log.protocol === 'UDP' ? '#fef3c7' : '#f3f4f6', 
                        color: log.protocol === 'TCP' ? '#1e40af' : log.protocol === 'UDP' ? '#92400e' : '#374151', 
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' 
                      }}>
                        {log.protocol}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{log.destIp}</span>
                      <span style={{ color: '#94a3b8' }}> : {log.destPort}</span>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1E293B' }}>{log.isp}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{log.location}</div>
                    </td>
                    <td style={{ padding: '15px 20px', color: '#64748b' }}>{log.size} B</td>
                  </tr>
                ))
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