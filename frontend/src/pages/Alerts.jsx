import React, { useState, useEffect } from 'react';
import { Bell, Zap, Volume2, Globe, ShieldAlert, History } from 'lucide-react'; // 新增了 History 图标

const Alerts = () => {
  // --- 鉴权 ---
  const currentUser = JSON.parse(localStorage.getItem('monweb_user') || '{}');
  const isUserRole = currentUser.role === 'User'; 

  const [settings, setSettings] = useState({
    browserNotify: true, failCount: 2, smartMute: true, soundEnabled: true 
  });
  const [websites, setWebsites] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]); // 新增：用于存放警报历史
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- 初始化加载数据 & 设置自动更新 ---
  useEffect(() => {
    if (!currentUser.id) return;
    
    // 1. 获取全局设置
    fetch(`http://localhost:5000/api/alerts/settings/${currentUser.id}`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));

    // 2. 获取网站列表
    fetch('http://localhost:5000/api/websites')
      .then(res => res.json())
      .then(data => {
        setWebsites(data);
        setIsLoading(false);
      });

    // 3. 获取警报历史记录的函数
    const fetchHistory = () => {
      fetch('http://localhost:5000/api/alerts/history')
        .then(res => res.json())
        .then(data => setAlertHistory(data))
        .catch(err => console.error("无法获取警报历史: ", err));
    };

    // 初次加载时获取一次历史
    fetchHistory();

    // 设定定时器：每 10 秒自动更新一次警报历史记录
    const intervalId = setInterval(fetchHistory, 10000);

    // 组件卸载时清除定时器
    return () => clearInterval(intervalId);
  }, [currentUser.id]);

  // --- 交互逻辑 ---
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
    fetch(`http://localhost:5000/api/alerts/settings/${currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).then(res => {
      if (res.ok) alert("✅ 配置已保存至数据库！全局引擎已自动应用新规则。");
    }).finally(() => setIsSaving(false));
  };

  const handleTest = () => {
    if (settings.soundEnabled) {
      // 移除自定义 MP3，使用固定系统提示音
      new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(e => console.error("音频需交互后播放:", e));
    }
    if (settings.browserNotify && Notification.permission === 'granted') {
      new Notification('🚨 MonWeb 弹窗测试', {
        body: '这是一条测试警报。如果您能看到此弹窗并听到声音，说明配置正确！',
        icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
      });
    } else if (settings.browserNotify) {
      alert("⚠️ 请在浏览器地址栏允许通知权限！");
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0f172a' }}>Alarm Notification Settings</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Personalize your monitoring alert configurations and view history</p>
      </div>

      {isUserRole && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', color: '#991b1b' }}>
          <ShieldAlert size={20} />
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Permission Limited: User role can only view configurations. Contact Admin to make changes.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 卡片 1：通知渠道 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Bell size={20} color="#475569" /> Notification Channels</div>
          <div style={{ ...itemBoxStyle, borderLeft: '4px solid #2563eb' }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>Browser Popup Notifications</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Display real-time alert popups in the browser (even when on other tabs)</div>
            </div>
            <input 
              type="checkbox" disabled={isUserRole} checked={settings.browserNotify} 
              onChange={(e) => handleChange('browserNotify', e.target.checked)} 
              style={checkboxStyle}
            />
          </div>
        </div>

        {/* 卡片 2：触发条件 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Zap size={20} color="#475569" /> Trigger Conditions</div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#334155', marginBottom: '8px' }}>Consecutive Failure Count</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="number" min="1" max="10" disabled={isUserRole} value={settings.failCount} 
                onChange={(e) => handleChange('failCount', parseInt(e.target.value))}
                style={{ width: '80px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
              <span style={{ fontSize: '14px', color: '#475569' }}>An alarm Will be Sent Afterward.</span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
              Set the number of consecutive failures required to trigger an alert notification. Subsequent scans will continue to display popups until the site is restored.
            </div>
          </div>
        </div>

        {/* 卡片 3：智能功能 & 声音设置 (移除了 MP3 URL 输入框) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Volume2 size={20} color="#8b5cf6" /> Smart Features & Sound Settings</div>
          
          <div style={{ ...itemBoxStyle, backgroundColor: '#faf5ff', borderColor: '#e9d5ff', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>Smart Mute Mode</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>AI automatically detects non-critical errors to reduce interruptions</div>
            </div>
            <input type="checkbox" disabled={isUserRole} checked={settings.smartMute} onChange={(e) => handleChange('smartMute', e.target.checked)} style={checkboxStyle} />
          </div>

          <div style={itemBoxStyle}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>Notification Sound</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Play system default notification sound when an alert is triggered</div>
            </div>
            <input type="checkbox" disabled={isUserRole} checked={settings.soundEnabled} onChange={(e) => handleChange('soundEnabled', e.target.checked)} style={checkboxStyle} />
          </div>
        </div>

        {/* 卡片 4：独立单站静音 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><Globe size={20} color="#0ea5e9" /> Independent Target Website Silent (Mute)</div>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>
            Known error websites can be individually blocked, and muted websites will not display popups regardless of how long they are down.
          </p>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
            ) : websites.map((site, index) => (
              <div key={site.id} style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '16px', backgroundColor: site.is_muted ? '#f8fafc' : 'white',
                borderBottom: index !== websites.length - 1 ? '1px solid #e2e8f0' : 'none'
              }}>
                <div style={{ fontWeight: 'bold', color: site.is_muted ? '#94a3b8' : '#1e293b', fontSize: '14px' }}>
                  {site.name} {site.is_muted && <span style={{ fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>已静音</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '13px', color: site.is_muted ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                    {site.is_muted ? 'Alert Disabled' : 'Alert Enabled'}
                  </span>
                  <input 
                    type="checkbox" disabled={isUserRole} checked={!site.is_muted} 
                    onChange={() => handleMuteToggle(site.id, site.is_muted)} 
                    style={checkboxStyle}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部按钮区 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={handleTest} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155', fontWeight: 'bold', cursor: 'pointer' }}>
              Send Test Pop-up
            </button>
          </div>
          {!isUserRole && (
            <button onClick={handleSave} disabled={isSaving} style={{ padding: '12px 30px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>

        {/* --- 新增：自动更新的警报历史卡片 --- */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <History size={20} color="#f59e0b" /> Alert History (Top 30)
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>
            Displays The 30 Most Recent Website Anomalies and Outages in RealTtime (Automatically Refreshed).
          </p>
          
          <div style={{
            maxHeight: '400px', 
            overflowX: 'auto', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px' 
            }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '13px', 
              textAlign: 'left' 
              }}>
              <thead style={{position: 'sticky', top: 0, zIndex: 10}}>
                <tr style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Time of Occurrence</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Target Website</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>HTTP Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Response Time</th>
                </tr>
              </thead>
              <tbody>
                {alertHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                      Great! There are currently no system alert records.
                    </td>
                  </tr>
                ) : (
                  alertHistory.map((record, index) => (
                    <tr key={index} style={{ borderBottom: index !== alertHistory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {record.time}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                        {record.website_name}
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal', marginTop: '2px' }}>
                          {record.url}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' 
                        }}>
                          DOWN
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: record.status_code !== 200 ? '#ef4444' : '#10b981' }}>
                        {record.status_code || 'N/A'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 'bold' }}>
                        {record.response_time === 0 ? 'Timeout' : `${record.response_time} ms`}
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

// --- 样式定义 ---
const cardStyle = { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const cardHeaderStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '20px' };
const itemBoxStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' };
const checkboxStyle = { width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' };

export default Alerts;