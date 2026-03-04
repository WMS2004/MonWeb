import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, Activity, Bot, ArrowLeft } from 'lucide-react';

const InputGroup = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
    <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{label}</label>
    {children}
  </div>
);

const DetectionCard = ({ title, desc, icon: Icon, active, onClick }) => (
  <div 
    onClick={onClick}
    style={{
      border: active ? '2px solid #0f172a' : '1px solid #e2e8f0',
      backgroundColor: active ? '#f8fafc' : 'white',
      borderRadius: '8px', padding: '16px', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
      cursor: 'pointer', transition: 'all 0.2s'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ padding: '8px', background: '#e2e8f0', borderRadius: '6px' }}>
        <Icon size={20} color="#475569" />
      </div>
      <div>
        <div style={{ fontWeight: '600', fontSize: '14px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>{desc}</div>
      </div>
    </div>
    <div className="toggle-switch">
      <input type="checkbox" checked={active} readOnly />
      <span className="slider"></span>
    </div>
  </div>
);

const WebsiteForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 👇 核心：接收从 WebsiteStatus 传过来的编辑目标 ID
  const editSiteId = location.state?.editSiteId; 

  const [formData, setFormData] = useState({
    name: '', url: '', interval: 5, timeout: 10, checkType: 'http', aiEnabled: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editSiteId); // 如果是编辑模式，先显示加载

  // 👇 核心逻辑：如果是编辑模式，组件加载时去后端拉取该网站的数据，并自动填充
  useEffect(() => {
    if (editSiteId) {
      // 借用详情接口获取完整配置
      fetch(`http://localhost:5000/api/websites/${editSiteId}/logs`)
        .then(res => res.json())
        .then(data => {
          if (data && data.website) {
            setFormData({
              name: data.website.name || '',
              url: data.website.url || '',
              interval: data.website.interval || 5,
              timeout: data.website.timeout || 10,
              checkType: data.website.monitor_type || 'http',
              aiEnabled: data.website.ai_enabled !== false // 默认 true
            });
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch site details:", err);
          setIsLoading(false);
        });
    }
  }, [editSiteId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev, [name]: type === 'checkbox' ? checked : value
    }));
  };

  // 👇 核心逻辑：智能判断是调用 POST(新建) 还是 PUT(更新)
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      name: formData.name,
      url: formData.url,
      interval: parseInt(formData.interval),
      timeout: parseInt(formData.timeout),
      checkType: formData.checkType,
      aiEnabled: formData.aiEnabled
    };

    // 如果有 editSiteId 就用 PUT 请求更新，否则用 POST 添加
    const url = editSiteId 
      ? `http://localhost:5000/api/websites/${editSiteId}` 
      : 'http://localhost:5000/api/websites';
    const method = editSiteId ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(res => {
      // 成功后，跳回到 Status 列表页
      if (res.ok) navigate('/status'); 
      else alert("Operation failed, please check backend logs.");
    })
    .catch(err => alert("Connection error: " + err))
    .finally(() => setIsSubmitting(false));
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading configuration...</div>;
  }

  // 动态变更页面文案
  const pageTitle = editSiteId ? "Edit Monitoring Site" : "Add New Monitoring Site";
  const pageDesc = editSiteId ? "Modify configuration for the selected website." : "Configure monitoring parameters for a new website.";
  const submitText = editSiteId ? "Save Changes" : "＋ Add Website";

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => navigate(-1)} style={{ border:'none', background:'none', cursor:'pointer', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px', color:'#64748b' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={28} color="#0f172a" />
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>{pageTitle}</h1>
        </div>
        <p style={{ color: '#64748b', marginTop: '5px', marginLeft: '38px' }}>{pageDesc}</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ display: 'flex', gap: '20px' }}>
          <InputGroup label="Website Name *">
            <input required name="name" value={formData.name} onChange={handleChange} placeholder="For example: Main website" style={inputStyle} />
          </InputGroup>
          <InputGroup label="Website URL *">
            <input required name="url" value={formData.url} onChange={handleChange} placeholder="https://www.example.com" style={inputStyle} />
          </InputGroup>
        </div>

        <div>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '10px', display: 'block' }}>Detection Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <DetectionCard title="HTTP/HTTPS Detect" desc="Detect website HTTP response status" icon={Globe} active={formData.checkType === 'http'} onClick={() => setFormData({...formData, checkType: 'http'})} />
            <DetectionCard title="ICMP Ping Detect" desc="Detect server network connectivity (Latency)" icon={Activity} active={formData.checkType === 'ping'} onClick={() => setFormData({...formData, checkType: 'ping'})} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <InputGroup label="Detection frequency">
            <select name="interval" value={formData.interval} onChange={handleChange} style={inputStyle}>
              <option value="1">Every 1 minute</option>
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="60">Every 1 hour</option>
            </select>
          </InputGroup>
          <InputGroup label="Timeout threshold (Seconds)">
            <input type="number" name="timeout" value={formData.timeout} onChange={handleChange} style={inputStyle} />
          </InputGroup>
        </div>

        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Bot size={24} color="#3b82f6" />
            <div>
              <div style={{ color: '#1e40af', fontWeight: '600', fontSize: '14px' }}>Enable AI anomaly detection (Recommended)</div>
              <div style={{ color: '#3b82f6', fontSize: '12px' }}>Using machine learning algorithms to automatically identify abnormal patterns.</div>
            </div>
          </div>
          <div className="toggle-switch">
            <input type="checkbox" name="aiEnabled" checked={formData.aiEnabled} onChange={handleChange} />
            <span className="slider"></span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? 'Saving...' : submitText}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ backgroundColor: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

      </form>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };

export default WebsiteForm;