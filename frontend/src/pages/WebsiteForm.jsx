import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Activity, Zap, Bot, ArrowLeft } from 'lucide-react';

  // --- 样式组件 (为了代码整洁) ---
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
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s'
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
      {/* 模拟 Toggle 开关 UI */}
      <div className="toggle-switch">
        <input type="checkbox" checked={active} readOnly />
        <span className="slider"></span>
      </div>
    </div>
  );

const WebsiteForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    interval: 5,
    timeout: 10,
    checkType: 'http', // 'http' or 'ping'
    aiEnabled: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 处理输入框变化
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // 提交表单
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 准备发送给后端的数据
    // (目前后端可能只接收 name, url, interval，其他字段作为扩展保留)
    const payload = {
      name: formData.name,
      url: formData.url,
      interval: parseInt(formData.interval)
    };

    fetch('http://localhost:5000/api/websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(res => {
      if (res.ok) navigate('/dashboard'); // 成功就回首页
      else alert("Adding failed, please check the backend logs.");
    })
    .catch(err => alert("Connection error: " + err))
    .finally(() => setIsSubmitting(false));
  };



  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      
      {/* 头部标题 */}
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => navigate(-1)} style={{ border:'none', background:'none', cursor:'pointer', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px', color:'#64748b' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={28} color="#0f172a" />
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Add New Monitoring Site</h1>
        </div>
        <p style={{ color: '#64748b', marginTop: '5px', marginLeft: '38px' }}>Configure monitoring parameters for a new website. The system will automatically start monitoring based on your settings.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 第一行：网站名称 和 URL */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <InputGroup label="Website Name *">
            <input 
              required
              name="name" 
              value={formData.name} 
              onChange={handleChange}
              placeholder="For example: Main website" 
              style={inputStyle} 
            />
          </InputGroup>
          <InputGroup label="Website URL *">
            <input 
              required
              name="url" 
              value={formData.url} 
              onChange={handleChange}
              placeholder="https://www.example.com" 
              style={inputStyle} 
            />
          </InputGroup>
        </div>

        {/* 第二行：检测类型 (Cards) */}
        <div>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '10px', display: 'block' }}>检测类型</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <DetectionCard 
              title="HTTP/HTTPS Detect" 
              desc="Detect website HTTP response status" 
              icon={Globe}
              active={formData.checkType === 'http'}
              onClick={() => setFormData({...formData, checkType: 'http'})}
            />
            <DetectionCard 
              title="ICMP Ping Detect" 
              desc="Detect server network connectivity (Latency)" 
              icon={Activity}
              active={formData.checkType === 'ping'}
              onClick={() => setFormData({...formData, checkType: 'ping'})}
            />
          </div>
        </div>

        {/* 第三行：检测频率 和 超时 */}
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
            <input 
              type="number" 
              name="timeout" 
              value={formData.timeout} 
              onChange={handleChange}
              style={inputStyle} 
            />
          </InputGroup>
        </div>

        {/* 第四行：AI 推荐框 (蓝色背景) */}
        <div style={{ 
          backgroundColor: '#eff6ff', 
          border: '1px solid #dbeafe', 
          borderRadius: '8px', 
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Bot size={24} color="#3b82f6" />
            <div>
              <div style={{ color: '#1e40af', fontWeight: '600', fontSize: '14px' }}>Enable AI anomaly detection (Recommended)</div>
              <div style={{ color: '#3b82f6', fontSize: '12px' }}>Using machine learning algorithms to automatically identify abnormal patterns improves detection accuracy.</div>
            </div>
          </div>
          <div className="toggle-switch">
            <input 
              type="checkbox" 
              name="aiEnabled"
              checked={formData.aiEnabled} 
              onChange={handleChange}
            />
            <span className="slider"></span>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{ 
              backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', 
              padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Adding...' : '＋ Add Website'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/dashboard')}
            style={{ 
              backgroundColor: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '6px', 
              padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' 
            }}
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  );
};

// 通用的 Input 样式
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' // 关键：防止 padding 撑破布局
};

export default WebsiteForm;