import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, MoreHorizontal, ArrowUpDown, 
  CheckCircle, XCircle, AlertTriangle, Eye, Edit2, 
  Trash2, RefreshCw, Activity 
} from 'lucide-react';

const WebsiteStatus = () => {
  const navigate = useNavigate();
  const [websites, setWebsites] = useState([]);
  const [filter, setFilter] = useState('All'); // 'All', 'Up', 'Down', 'Warning'
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false); // 扫描状态

  // --- 获取当前登录用户的 Role (RBAC 核心) ---
  const currentUser = JSON.parse(localStorage.getItem('monweb_user') || '{}');
  const userRole = currentUser.role || 'User';

  // --- 弹窗相关的 State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState(null);

  // --- 1. 获取数据 (Fetch) ---
  const fetchWebsites = () => {
    if (websites.length === 0) setLoading(true);
    
    fetch('http://localhost:5000/api/websites')
      .then(res => res.json())
      .then(data => {
        setWebsites(data);
        setLoading(false);
      })
      .catch(err => console.error("Fetch error:", err));
  };

  // --- 2. 自动刷新机制 (Auto-Refresh) ---
  useEffect(() => {
    fetchWebsites(); 
    const intervalId = setInterval(() => {
      fetchWebsites();
    }, 10000); 
    return () => clearInterval(intervalId);
  }, []);

  // --- 3. 手动扫描 (Scan Button) ---
  const handleScan = () => {
    setScanning(true);
    fetch('http://localhost:5000/api/scan', { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        fetchWebsites(); 
        setScanning(false);
      })
      .catch(err => {
        console.error("Scan failed:", err);
        setScanning(false);
      });
  };

  // --- 4. 删除逻辑 (弹窗触发 & 确认删除) ---
  const handleDeleteClick = (id, name) => {
    setSiteToDelete({ id, name });
    setIsModalOpen(true);
  };

  const handleCancelDelete = () => {
    setIsModalOpen(false);
    setSiteToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (!siteToDelete) return;
    
    fetch(`http://localhost:5000/api/websites/${siteToDelete.id}`, { method: 'DELETE' })
      .then(async res => {
        if (res.ok) {
          fetchWebsites(); 
          setIsModalOpen(false); 
          setSiteToDelete(null); 
        } else {
          const errText = await res.text();
          console.error("Delete failed with status:", res.status, errText);
          alert(`Deletion failed! Status: ${res.status}\nPlease check your backend app.py.`);
        }
      })
      .catch(err => {
        console.error("Delete error:", err);
        alert("An error occurred while deleting.");
      });
  };

  // --- 5. 过滤数据 ---
  const filteredWebsites = websites.filter(site => {
    if (filter === 'All') return true;
    return site.status === filter;
  });

  const counts = {
    All: websites.length,
    Up: websites.filter(s => s.status === 'Up').length,
    Down: websites.filter(s => s.status === 'Down').length,
    Warning: websites.filter(s => s.status === 'Warning').length,
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Up': return { color: '#059669', bg: '#D1FAE5', icon: CheckCircle, label: 'Up' };
      case 'Down': return { color: '#DC2626', bg: '#FEE2E2', icon: XCircle, label: 'Down' };
      case 'Warning': return { color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle, label: 'Warning' };
      default: return { color: '#6B7280', bg: '#F3F4F6', icon: Activity, label: 'Unknown' };
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'Never';
    const date = new Date(timeStr.replace(' ', 'T') + 'Z');
    if (isNaN(date)) return timeStr;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* --- 顶部 Header --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Website Status</h1>
          <p style={{ margin: '5px 0 0', color: '#6B7280', fontSize: '14px' }}>Monitor the real-time status and performance of all websites</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Scan 按钮 (所有人可见) */}
          <button 
            onClick={handleScan}
            disabled={scanning}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              backgroundColor: 'white', color: '#374151', cursor: scanning ? 'wait' : 'pointer', fontWeight: '500'
            }}
          >
            <RefreshCw size={18} className={scanning ? "spin-animation" : ""} />
            {scanning ? "Scanning..." : "Scan Now"}
          </button>

          {/* 【RBAC 核心】: 只有 Admin 和 Technical 可以添加网站 */}
          {(userRole === 'Admin' || userRole === 'Technical') && (
            <Link to="/add-website" style={{ textDecoration: 'none' }}>
              <button style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: '500'
              }}>
                <Plus size={18} />
                Add New Website
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* --- Tab 过滤器 --- */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {['All', 'Up', 'Down', 'Warning'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              backgroundColor: filter === tab ? '#2563eb' : 'white', 
              color: filter === tab ? 'white' : '#64748b',
              fontWeight: '500',
              boxShadow: filter === tab ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
          >
            {tab} <span style={{ marginLeft: '5px', opacity: 0.8, fontSize: '12px' }}>({counts[tab]})</span>
          </button>
        ))}
      </div>

      {/* --- 表格区域 --- */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Website Name</th>
              <th style={thStyle}>URL</th>
              <th style={thStyle}>Last Check</th>
              <th style={thStyle}>Response time</th>
              <th style={thStyle}>Availability (Mock)</th>
              <th style={{...thStyle, textAlign: 'right'}}>Operations</th>
            </tr>
          </thead>
          <tbody>
            {loading && websites.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Loading data...</td></tr>
            ) : filteredWebsites.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>No websites found in this category.</td></tr>
            ) : (
              filteredWebsites.map(site => {
                const status = getStatusStyle(site.status);
                const StatusIcon = status.icon;

                return (
                  <tr key={site.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '999px',
                        backgroundColor: status.bg, color: status.color,
                        fontWeight: '600', fontSize: '12px', border: `1px solid ${status.color}20`
                      }}>
                        <StatusIcon size={14} strokeWidth={2.5} />
                        {status.label.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '16px 24px' }}>
                      <Link to={`/website/${site.id}`} style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}>
                        {site.name}
                      </Link>
                    </td>

                    <td style={{ padding: '16px 24px', color: '#6B7280' }}>
                      {site.url}
                    </td>

                    <td style={{ padding: '16px 24px', color: '#374151' }}>
                      {formatTime(site.last_checked)}
                    </td>

                    <td style={{ padding: '16px 24px', fontWeight: '500', 
                      color: !site.status || site.status === 'Down' || parseFloat(site.response_time) === 0 ? '#DC2626' : (parseFloat(site.response_time) > 300 ? '#D97706' : '#059669') 
                    }}>
                      {site.response_time !== null && site.response_time !== undefined && site.response_time !== '' 
                        ? `${site.response_time}ms` 
                        : '0ms'}
                    </td>

                    <td style={{ padding: '16px 24px', color: '#059669', fontWeight: '500' }}>
                      99.9%
                    </td>

                    {/* 【RBAC 核心】: 操作按钮组 */}
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        
                        {/* 详情按钮 (所有人可见) */}
                        <Link to={`/website/${site.id}`} title="View Details">
                          <button style={iconButtonStyle}><Eye size={18} /></button>
                        </Link>
                        
                        {/* 只有 Admin 和 Technical 可以看到 Edit 按钮 */}
                        {(userRole === 'Admin' || userRole === 'Technical') && (
                          <button 
                            // 👇 修改这里：跳转时通过 state 传递当前网站的 ID
                            onClick={() => navigate('/add-website', { state: { editSiteId: site.id } })}
                            style={iconButtonStyle} 
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        
                        {/* 只有 Admin 可以看到 Delete 按钮 */}
                        {userRole === 'Admin' && (
                          <button 
                            onClick={() => handleDeleteClick(site.id, site.name)}
                            style={{ ...iconButtonStyle, color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- 自定义删除确认弹窗 (Modal) --- */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999 
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ backgroundColor: '#FEE2E2', padding: '12px', borderRadius: '50%', marginBottom: '16px' }}>
              <AlertTriangle size={32} color="#DC2626" />
            </div>
            
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#111827' }}>Delete Website</h2>
            
            <p style={{ margin: '0 0 24px', color: '#4B5563', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>{siteToDelete?.name}</strong>? This action cannot be undone.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', width: '100%' }}>
              <button
                onClick={handleCancelDelete}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB',
                  backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#DC2626', color: 'white', cursor: 'pointer', fontWeight: '500'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- CSS 样式对象 ---
const thStyle = {
  padding: '16px 24px',
  color: '#6B7280',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const iconButtonStyle = {
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid #E5E7EB',
  backgroundColor: 'white',
  color: '#6B7280',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
};

export default WebsiteStatus;