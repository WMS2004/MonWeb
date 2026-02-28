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

  // 删除确认模态框状态
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    siteId: null,
    siteName: ''
  });

  // --- 1. 获取数据 (Fetch) ---
  const fetchWebsites = () => {
    // 只有第一次加载显示 loading，后续静默更新
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
    fetchWebsites(); // 初始加载

    // 每 10 秒自动拉取一次最新状态 (实现“实时动态”)
    const intervalId = setInterval(() => {
      fetchWebsites();
    }, 10000); 

    return () => clearInterval(intervalId); // 离开页面清理定时器
  }, []);

  // --- 3. 手动扫描 (Scan Button) ---
  const handleScan = () => {
    setScanning(true);
    fetch('http://localhost:5000/api/scan', { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        fetchWebsites(); // 扫描完立刻刷新列表
        setScanning(false);
      })
      .catch(err => {
        console.error("Scan failed:", err);
        setScanning(false);
      });
  };

// --- 4. 删除逻辑修改 ---
  // 点击删除图标时，不直接删除，而是打开弹窗
  const openDeleteModal = (id, name) => {
    setDeleteModal({ isOpen: true, siteId: id, siteName: name });
  };

  // 执行真正的删除操作
  const confirmDelete = () => {
    fetch(`http://localhost:5000/api/websites/${deleteModal.siteId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          setDeleteModal({ isOpen: false, siteId: null, siteName: '' });
          fetchWebsites(); // 成功后自动刷新列表
        } else {
          alert("Deletion failed");
        }
      });
  };

  // 关闭弹窗
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, siteId: null, siteName: '' });
  };

  // --- 5. 过滤数据 ---
  const filteredWebsites = websites.filter(site => {
    if (filter === 'All') return true;
    return site.status === filter; // 比如 "Up", "Down"
  });

  // 统计各个状态的数量
  const counts = {
    All: websites.length,
    Up: websites.filter(s => s.status === 'Up').length,
    Down: websites.filter(s => s.status === 'Down').length,
    Warning: websites.filter(s => s.status === 'Warning').length,
  };

  // 样式辅助函数
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Up': return { color: '#059669', bg: '#D1FAE5', icon: CheckCircle, label: 'Up' };
      case 'Down': return { color: '#DC2626', bg: '#FEE2E2', icon: XCircle, label: 'Down' };
      case 'Warning': return { color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle, label: 'Warning' };
      default: return { color: '#6B7280', bg: '#F3F4F6', icon: Activity, label: 'Unknown' };
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* --- 删除确认弹窗 (Modal) --- */}
      {deleteModal.isOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ color: '#DC2626', marginBottom: '15px' }}>
              <AlertCircle size={48} strokeWidth={1.5} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#111827' }}>Confirm Delete</h2>
            <p style={{ margin: '0 0 25px', color: '#6B7280', textAlign: 'center', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>"{deleteModal.siteName}"</strong>?<br />
              This action cannot be undone and all history logs will be lost.
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                onClick={closeDeleteModal} 
                style={cancelButtonStyle}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                style={deleteConfirmButtonStyle}
              >
                Delete Website
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* --- 顶部 Header --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Website Status</h1>
          <p style={{ margin: '5px 0 0', color: '#6B7280', fontSize: '14px' }}>Monitor the real-time status and performance of all websites</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Scan 按钮 */}
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

          {/* Add Website 按钮 */}
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
              backgroundColor: filter === tab ? '#2563eb' : 'white', // 选中变蓝
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
                    {/* 状态 Badge */}
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

                    {/* 网站名称 (点击可跳转) */}
                    <td style={{ padding: '16px 24px' }}>
                      <Link to={`/website/${site.id}`} style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}>
                        {site.name}
                      </Link>
                    </td>

                    {/* URL */}
                    <td style={{ padding: '16px 24px', color: '#6B7280' }}>
                      {site.url}
                    </td>

                    {/* 最后检查时间 */}
                    <td style={{ padding: '16px 24px', color: '#374151' }}>
                      {site.last_checked || 'Never'}
                    </td>

                    {/* 响应时间 (不同颜色区分快慢) */}
                    <td style={{ padding: '16px 24px', fontWeight: '500', 
                      color: !site.status || site.status === 'Down' ? '#DC2626' : (parseInt(site.response_time) > 300 ? '#D97706' : '#059669') 
                    }}>
                      {site.status === 'Down' ? 'N/A' : (site.response_time ? `${site.response_time}ms` : '-')}
                    </td>

                    {/* 可用性 (目前是假的，后期可以算) */}
                    <td style={{ padding: '16px 24px', color: '#059669', fontWeight: '500' }}>
                      99.9%
                    </td>

                    {/* 操作按钮组 */}
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        {/* 详情按钮 */}
                        <Link to={`/website/${site.id}`} title="View Details">
                          <button style={iconButtonStyle}><Eye size={18} /></button>
                        </Link>
                        {/* 编辑按钮 (暂未实现功能) */}
                        <button style={iconButtonStyle} title="Edit"><Edit2 size={18} /></button>
                        {/* 删除按钮 */}
                        <button 
                          onClick={() => handleDelete(site.id, site.name)}
                          style={{ ...iconButtonStyle, color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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

// --- 新增/更新的样式对象 ---

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.7)', // 深色半透明遮罩
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000, // 确保在最上层
  backdropFilter: 'blur(4px)' // 背景模糊
};

const modalContentStyle = {
  backgroundColor: 'white',
  padding: '32px',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '400px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};

const cancelButtonStyle = {
  flex: 1,
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  backgroundColor: 'white',
  color: '#374151',
  fontWeight: '600',
  cursor: 'pointer'
};

const deleteConfirmButtonStyle = {
  flex: 1,
  padding: '12px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#DC2626',
  color: 'white',
  fontWeight: '600',
  cursor: 'pointer'
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

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '999px',
  fontWeight: '600',
  fontSize: '12px'
};

const tableWrapperStyle = {
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  overflow: 'hidden'
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

const scanButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  backgroundColor: 'white',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const addNewButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#0f172a',
  color: 'white',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const tabButtonStyle = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '500',
  transition: 'all 0.2s'
};

export default WebsiteStatus;