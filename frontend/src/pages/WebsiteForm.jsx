import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, Activity, ArrowLeft } from 'lucide-react';

const InputGroup = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
    <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{label}</label>
    {children}
  </div>
);

// 提取出来的专属配置卡片组件
const MonitorConfigCard = ({ type, config, onChange }) => {
  const isHttp = type === 'http';
  return (
    <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '10px', display: 'flex', gap: '20px' }}>
      <InputGroup label={`${isHttp ? 'HTTP' : 'Ping'} Dedicated detection frequency`}>
        <select value={config.interval} onChange={(e) => onChange(type, 'interval', parseInt(e.target.value))} style={inputStyle}>
          <option value="1">Every 1 minute</option>
          <option value="5">Every 5 minutes</option>
          <option value="15">Every 15 minutes</option>
          <option value="60">Every 1 hour</option>
        </select>
      </InputGroup>
      <InputGroup label={`${isHttp ? 'HTTP' : 'Ping'} Dedicated timeout (seconds)`}>
        <input type="number" value={config.timeout} onChange={(e) => onChange(type, 'timeout', parseInt(e.target.value))} style={inputStyle} min="1" max="60"/>
      </InputGroup>
    </div>
  );
};

const WebsiteForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editSiteId = location.state?.editSiteId; 

  const [formData, setFormData] = useState({ name: '', url: '' });
  // 👇 核心状态：用数组管理激活的监控任务及其独立配置
  const [monitors, setMonitors] = useState([
    { type: 'http', interval: 5, timeout: 10 }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editSiteId);

  useEffect(() => {
    if (editSiteId) {
      fetch(`http://localhost:5000/api/websites/${editSiteId}/logs`)
        .then(res => res.json())
        .then(data => {
          if (data && data.website) {
            setFormData({
              name: data.website.name || '',
              url: data.website.url || '',
            });
            if (data.website.monitors && data.website.monitors.length > 0) {
              setMonitors(data.website.monitors);
            }
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch site details:", err);
          setIsLoading(false);
        });
    }
  }, [editSiteId]);

  const handleBasicChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 勾选/取消勾选某种监控类型
  const toggleMonitorType = (type) => {
    setMonitors(prev => {
      const exists = prev.find(m => m.type === type);
      if (exists) {
        return prev.filter(m => m.type !== type); // 取消勾选，移除配置
      } else {
        // 新勾选，给予默认配置 (Ping默认更短)
        const defaultInterval = type === 'ping' ? 1 : 5;
        const defaultTimeout = type === 'ping' ? 2 : 10;
        return [...prev, { type, interval: defaultInterval, timeout: defaultTimeout }];
      }
    });
  };

  // 修改某种监控的专属时间配置
  const handleMonitorConfigChange = (type, field, value) => {
    setMonitors(prev => prev.map(m => m.type === type ? { ...m, [field]: value } : m));
  };

  const hasMonitor = (type) => monitors.some(m => m.type === type);
  const getMonitor = (type) => monitors.find(m => m.type === type);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (monitors.length === 0) {
      alert("Please select at least one detection type.");
      return;
    }

    setIsSubmitting(true);
    // 👇 发送给后端的是包含 monitors 数组的全新结构
    const payload = {
      name: formData.name,
      url: formData.url,
      monitors: monitors
    };

    const url = editSiteId ? `http://localhost:5000/api/websites/${editSiteId}` : 'http://localhost:5000/api/websites';
    const method = editSiteId ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(res => {
      if (res.ok) navigate('/status'); // 假设添加完跳回状态列表页
      else alert("Operation failed, please check backend logs.");
    })
    .catch(err => alert("Connection error: " + err))
    .finally(() => setIsSubmitting(false));
  };

  if (isLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading configuration...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => navigate(-1)} style={{ border:'none', background:'none', cursor:'pointer', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px', color:'#64748b' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={28} color="#0f172a" />
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>{editSiteId ? "Edit Monitoring Site" : "Add New Monitoring Site"}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <InputGroup label="Website Name *">
            <input required name="name" value={formData.name} onChange={handleBasicChange} placeholder="For example: Main website" style={inputStyle} />
          </InputGroup>
          <InputGroup label="Website URL *">
            <input required name="url" value={formData.url} onChange={handleBasicChange} placeholder="https://www.example.com" style={inputStyle} />
          </InputGroup>
        </div>

        <div>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '10px', display: 'block' }}>Detection Types & Configuration</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* HTTP 配置块 */}
            <div>
              <div 
                onClick={() => toggleMonitorType('http')}
                style={{ border: hasMonitor('http') ? '2px solid #0f172a' : '1px solid #e2e8f0', backgroundColor: hasMonitor('http') ? '#f8fafc' : 'white', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Globe size={20} color="#475569" />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>HTTP/HTTPS Detect</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Detect website HTTP response status</div>
                  </div>
                </div>
                <input type="checkbox" checked={hasMonitor('http')} readOnly />
              </div>
              {hasMonitor('http') && <MonitorConfigCard type="http" config={getMonitor('http')} onChange={handleMonitorConfigChange} />}
            </div>

            {/* Ping 配置块 */}
            <div>
              <div 
                onClick={() => toggleMonitorType('ping')}
                style={{ border: hasMonitor('ping') ? '2px solid #0f172a' : '1px solid #e2e8f0', backgroundColor: hasMonitor('ping') ? '#f8fafc' : 'white', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Activity size={20} color="#475569" />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>ICMP Ping Detect</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Detect server network connectivity (Latency)</div>
                  </div>
                </div>
                <input type="checkbox" checked={hasMonitor('ping')} readOnly />
              </div>
              {hasMonitor('ping') && <MonitorConfigCard type="ping" config={getMonitor('ping')} onChange={handleMonitorConfigChange} />}
            </div>

          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            {isSubmitting ? 'Saving...' : (editSiteId ? "Save Changes" : "＋ Add Website")}
          </button>
        </div>
      </form>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };

export default WebsiteForm;