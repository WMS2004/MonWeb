import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Globe, Activity, ArrowLeft, ShieldAlert } from 'lucide-react';

const InputGroup = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
    <label style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{label}</label>
    {children}
  </div>
);

const MonitorConfigCard = ({ type, config, onChange }) => {
  const isHttp = type === 'http';
  return (
    <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '12px', display: 'flex', gap: '20px', animation: 'fadeIn 0.3s ease-in-out' }}>
      <InputGroup label={`${isHttp ? 'HTTP' : 'PING'} Dedicated detection frequency`}>
        {/* 👇 关键修改 1：使用 parseFloat，并加入 0.5 (30秒) 选项 👇 */}
        <select value={config.interval} onChange={(e) => onChange(type, 'interval', parseFloat(e.target.value))} style={inputStyle}>
          <option value="0.5">Every 30 seconds</option>
          <option value="1">Every 1 minute</option>
          <option value="2">Every 2 minutes</option>
          <option value="3">Every 3 minutes</option>
          <option value="5">Every 5 minutes</option>
          <option value="10">Every 10 minutes</option>
          <option value="15">Every 15 minutes</option>
          <option value="20">Every 20 minutes</option>
          <option value="30">Every 30 minutes</option>
          <option value="60">Every 1 hour</option>
        </select>
      </InputGroup>
      <InputGroup label={`${isHttp ? 'HTTP' : 'PING'} Dedicated timeout (seconds)`}>
        <input 
          type="number" 
          value={config.timeout === '' ? '' : config.timeout} 
          onChange={(e) => {
            const val = e.target.value;
            onChange(type, 'timeout', val === '' ? '' : parseInt(val));
          }} 
          style={inputStyle} 
          min="1" 
          max="60"
        />
      </InputGroup>
    </div>
  );
};

const WebsiteForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editSiteId = location.state?.editSiteId; 

  // --- 鉴权 ---
  const currentUser = JSON.parse(localStorage.getItem('monweb_user') || '{}');
  const isUserRole = currentUser.role === 'User'; 

  const [formData, setFormData] = useState({ name: '', url: '' });
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
            let cleanUrl = data.website.url || '';
            if (cleanUrl.startsWith('https://')) cleanUrl = cleanUrl.replace('https://', '');
            else if (cleanUrl.startsWith('http://')) cleanUrl = cleanUrl.replace('http://', '');

            setFormData({
              name: data.website.name || '',
              url: cleanUrl,
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

  const toggleMonitorType = (type) => {
    setMonitors(prev => {
      const exists = prev.find(m => m.type === type);
      if (exists) {
        return prev.filter(m => m.type !== type); 
      } else {
        // PING 默认也可以设置为 0.5 (30秒) 或者 1
        const defaultInterval = type === 'ping' ? 1 : 5;
        const defaultTimeout = type === 'ping' ? 2 : 10;
        return [...prev, { type, interval: defaultInterval, timeout: defaultTimeout }];
      }
    });
  };

  const handleMonitorConfigChange = (type, field, value) => {
    setMonitors(prev => prev.map(m => m.type === type ? { ...m, [field]: value } : m));
  };

  const hasMonitor = (type) => monitors.some(m => m.type === type);
  const getMonitor = (type) => monitors.find(m => m.type === type);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const isTimeoutValid = monitors.every(m => m.timeout !== '' && m.timeout > 0);
    if (!isTimeoutValid) {
      alert("Please ensure all Timeout fields have a valid number.");
      return;
    }

    if (monitors.length === 0) {
      alert("Please select at least one detection type.");
      return;
    }

    let finalUrl = formData.url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    setIsSubmitting(true);
    const payload = {
      name: formData.name,
      url: finalUrl,
      monitors: monitors
    };

    const url = editSiteId ? `http://localhost:5000/api/websites/${editSiteId}` : 'http://localhost:5000/api/websites';
    const method = editSiteId ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(async res => {
      if (res.ok) {
        alert(editSiteId ? "✅ Website updated successfully!" : "✅ Website added successfully!");
        navigate('/status'); 
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Operation failed: ${errorData.error || 'Please check backend logs.'}`);
      }
    })
    .catch(err => alert("Connection error: " + err))
    .finally(() => setIsSubmitting(false));
  };

  if (isUserRole) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#991b1b', maxWidth: '600px', margin: '0 auto' }}>
        <ShieldAlert size={48} style={{ margin: '0 auto 20px' }} />
        <h2>Access Denied</h2>
        <p>You do not have permission to add or edit websites. Please contact the Administrator.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '6px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold' }}>
          Go Back
        </button>
      </div>
    );
  }

  if (isLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading configuration...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      
      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => navigate(-1)} style={{ border:'none', background:'none', cursor:'pointer', marginBottom:'15px', display:'flex', alignItems:'center', gap:'5px', color:'#64748b', fontWeight: '500' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Globe size={32} color="#4F46E5" />
          <h1 style={{ margin: 0, fontSize: '26px', color: '#0f172a' }}>{editSiteId ? "Edit Monitoring Site" : "Add New Monitoring Site"}</h1>
        </div>
        <p style={{ margin: '8px 0 0 44px', color: '#64748b', fontSize: '14px' }}>Configure target website details and monitoring intervals.</p>
      </div>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <InputGroup label="Website Name *">
              <input required name="name" value={formData.name} onChange={handleBasicChange} placeholder="For example: Production API" style={inputStyle} />
            </InputGroup>
            <InputGroup label="Website URL *">
              <input required type="text" name="url" value={formData.url} onChange={handleBasicChange} placeholder="apu.edu.my" style={inputStyle} />
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>System will automatically prepend https:// if missing</span>
            </InputGroup>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />

          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px', display: 'block' }}>Detection Types & Configuration</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <div 
                  onClick={() => toggleMonitorType('http')}
                  style={{ border: hasMonitor('http') ? '2px solid #4F46E5' : '1px solid #e2e8f0', backgroundColor: hasMonitor('http') ? '#e0e7ff' : 'white', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ backgroundColor: hasMonitor('http') ? '#4F46E5' : '#f1f5f9', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                      <Globe size={22} color={hasMonitor('http') ? "white" : "#64748b"} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>HTTP/HTTPS Detect</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Detect website HTTP response status and TTFB</div>
                    </div>
                  </div>
                  <input type="checkbox" checked={hasMonitor('http')} readOnly style={{ width: '18px', height: '18px', accentColor: '#4F46E5' }} />
                </div>
                {hasMonitor('http') && <MonitorConfigCard type="http" config={getMonitor('http')} onChange={handleMonitorConfigChange} />}
              </div>

              <div>
                <div 
                  onClick={() => toggleMonitorType('ping')}
                  style={{ border: hasMonitor('ping') ? '2px solid #4F46E5' : '1px solid #e2e8f0', backgroundColor: hasMonitor('ping') ? '#e0e7ff' : 'white', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ backgroundColor: hasMonitor('ping') ? '#4F46E5' : '#f1f5f9', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                      <Activity size={22} color={hasMonitor('ping') ? "white" : "#64748b"} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>ICMP Ping Detect</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Detect server network connectivity (Latency)</div>
                    </div>
                  </div>
                  <input type="checkbox" checked={hasMonitor('ping')} readOnly style={{ width: '18px', height: '18px', accentColor: '#4F46E5' }} />
                </div>
                {hasMonitor('ping') && <MonitorConfigCard type="ping" config={getMonitor('ping')} onChange={handleMonitorConfigChange} />}
              </div>

            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 30px', fontSize: '15px', fontWeight: 'bold', cursor: isSubmitting ? 'wait' : 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)', transition: 'background-color 0.2s' }}>
              {isSubmitting ? 'Saving...' : (editSiteId ? "Save Changes" : "Confirm & Add Website")}
            </button>
          </div>
        </form>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' };

export default WebsiteForm;