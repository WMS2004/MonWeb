import React, { useState, useEffect } from 'react';
import { Bell, Globe, ShieldAlert, History } from 'lucide-react'; 

const Alerts = () => {
  const currentUser = JSON.parse(localStorage.getItem('monweb_user') || '{}');
  const isUserRole = currentUser.role === 'User'; 

  const [settings, setSettings] = useState({
    browserNotify: true, soundEnabled: true 
  });
  const [websites, setWebsites] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser.id) return;
    
    // 1. 获取设置
    fetch(`http://localhost:5000/api/alerts/settings/${currentUser.id}`)
      .then(res => res.json())
      .then(data => setSettings({ browserNotify: data.browserNotify, soundEnabled: data.soundEnabled }))
      .catch(err => console.error(err));

    // 2. 获取网站列表
    fetch('http://localhost:5000/api/websites')
      .then(res => res.json())
      .then(data => {
        setWebsites(data);
        setIsLoading(false);
      });

    // 3. 仅获取警报历史数据用于展示 (弹窗逻辑已被移至 MainLayout 全局)
    const fetchHistory = () => {
      fetch('http://localhost:5000/api/alerts/history')
        .then(res => res.json())
        .then(data => setAlertHistory(data))
        .catch(err => console.error("无法获取警报历史: ", err));
    };

    fetchHistory();
    const intervalId = setInterval(fetchHistory, 10000);
    return () => clearInterval(intervalId);
  }, [currentUser.id]);

  const handleChange = (key, value) => {
    if (isUserRole) return;
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'browserNotify' && value && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  };

  const handleMuteToggle = (siteId, currentMuteStatus) => {
    if (isUserRole) return;
    const newStatus = !currentMuteStatus;
    setWebsites(websites.map(s => s.id === siteId ? { ...s, is_muted: newStatus } : s));

    fetch(`http://localhost:5000/api/websites/${siteId}/mute`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_muted: newStatus })
    }).catch(() => alert("同步失败"));
  };

  const handleSave = () => {
    if (isUserRole) return;
    setIsSaving(true);
    const payload = { ...settings, failCount: 2, smartMute: true };
    fetch(`http://localhost:5000/api/alerts/settings/${currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (res.ok) alert("✅ Alert configurations saved successfully! Changes apply globally.");
    }).finally(() => setIsSaving(false));
  };

  const handleTest = () => {
    if (settings.soundEnabled) {
      new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(e => console.error("音频需交互后播放:", e));
    }
    if (settings.browserNotify && Notification.permission === 'granted') {
      new Notification('🚨 MonWeb 弹窗测试', {
        body: '这是一条测试警报。如果您能看到此弹窗并听到声音，说明全局系统配置正确！',
        icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
      });
    } else if (settings.browserNotify) {
      Notification.requestPermission().then(permission => {
        if (permission !== 'granted') alert("⚠️ 请在浏览器地址栏允许通知权限！");
      });
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0f172a' }}>Alarm Notification Settings</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Personalize your monitoring alert configurations and view live history.</p>
      </div>

      {isUserRole && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', color: '#991b1b' }}>
          <ShieldAlert size={20} />
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Permission Limited: User role can only view configurations. Contact Admin to make changes.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 卡片 1 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Bell size={20} color="#475569" /> Notification & Sound Settings</div>
          <div style={{ ...itemBoxStyle, borderLeft: '4px solid #2563eb', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>Browser Popup Notifications</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Receive system-level popups across ALL pages when a website goes down.</div>
            </div>
            <input type="checkbox" disabled={isUserRole} checked={settings.browserNotify} onChange={(e) => handleChange('browserNotify', e.target.checked)} style={checkboxStyle}/>
          </div>
          <div style={{ ...itemBoxStyle, borderLeft: '4px solid #8b5cf6' }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>Notification Sound</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Play an audible warning beep when an alert is triggered globally.</div>
            </div>
            <input type="checkbox" disabled={isUserRole} checked={settings.soundEnabled} onChange={(e) => handleChange('soundEnabled', e.target.checked)} style={checkboxStyle} />
          </div>
        </div>

        {/* 卡片 2 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Globe size={20} color="#0ea5e9" /> Independent Target Website Silent (Mute)</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
            ) : websites.map((site, index) => (
              <div key={site.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: site.is_muted ? '#f8fafc' : 'white', borderBottom: index !== websites.length - 1 ? '1px solid #e2e8f0' : 'none'}}>
                <div style={{ fontWeight: 'bold', color: site.is_muted ? '#94a3b8' : '#1e293b', fontSize: '14px' }}>
                  {site.name} {site.is_muted && <span style={{ fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>Muted</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '13px', color: site.is_muted ? '#ef4444' : '#10b981', fontWeight: '600' }}>{site.is_muted ? 'Alert Disabled' : 'Alert Enabled'}</span>
                  <input type="checkbox" disabled={isUserRole} checked={!site.is_muted} onChange={() => handleMuteToggle(site.id, site.is_muted)} style={checkboxStyle}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部按钮区 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <button onClick={handleTest} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155', fontWeight: 'bold', cursor: 'pointer' }}>
            Send Test Pop-up
          </button>
          {!isUserRole && (
            <button onClick={handleSave} disabled={isSaving} style={{ padding: '12px 30px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>

        {/* 历史卡片 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><History size={20} color="#f59e0b" /> Real-Time Alert History (Top 30)</div>
          <div style={{ maxHeight: '400px', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{position: 'sticky', top: 0, zIndex: 10}}>
                <tr style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Website</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status / Metric</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Alert Details</th>
                </tr>
              </thead>
              <tbody>
                {alertHistory.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Great! There are currently no system alert records.</td></tr>
                ) : (
                  alertHistory.map((record, index) => (
                    <tr key={index} style={{ borderBottom: index !== alertHistory.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: 'white', transition: 'background 0.2s' }}>
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {record.time.split(' ')[1]}
                        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{record.time.split(' ')[0]}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                        {record.website_name}
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal', marginTop: '2px' }}>{record.url}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>{record.monitor_type}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                        {record.monitor_type === 'PING' ? (
                          <span style={{ color: record.response_time === 0 ? '#ef4444' : '#d97706' }}>{record.response_time} ms</span>
                        ) : (
                          <span style={{ color: !record.status_code || record.status_code >= 400 ? '#ef4444' : '#10b981' }}>HTTP {record.status_code || 0}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: record.status === 'Down' ? '#ef4444' : '#d97706', backgroundColor: record.status === 'Down' ? '#fef2f2' : '#fef3c7', border: `1px solid ${record.status === 'Down' ? '#fca5a5' : '#fde68a'}`, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            {record.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={record.error_details}>
                            {record.error_details || 'High Latency / Unstable'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const cardStyle = { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const cardHeaderStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '20px' };
const itemBoxStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' };
const checkboxStyle = { width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' };

export default Alerts;