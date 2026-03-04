import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Lock, Upload } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  
  // 核心状态：存储表单数据
  const [formData, setFormData] = useState({
    id: null,
    username: '',
    email: '',
    currentPassword: '',
    newPassword: ''
  });
  
  const [role, setRole] = useState('User');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 1. 初始化：从 localStorage 获取当前用户信息
  useEffect(() => {
    const storedUser = localStorage.getItem('monweb_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setFormData(prev => ({
        ...prev,
        id: parsedUser.id,
        username: parsedUser.username || '',
        email: parsedUser.email || ''
      }));
      setRole(parsedUser.role || 'User');
    }
  }, []);

  // 处理输入框变更
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 2. 核心功能：提交修改到后端
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.id) return;

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    // 准备发送的数据（密码如果没填就不发送）
    const payload = {
      username: formData.username,
      email: formData.email
    };
    if (formData.newPassword.trim() !== '') {
      payload.password = formData.newPassword;
    }

    fetch(`http://localhost:5000/api/users/${formData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(async (res) => {
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: '资料更新成功！' });
        
        // 关键：更新 localStorage 中的缓存，防止刷新后变回原样
        const updatedStorage = {
          id: formData.id,
          username: formData.username,
          email: formData.email,
          role: role
        };
        localStorage.setItem('monweb_user', JSON.stringify(updatedStorage));
        
        // 清空密码框
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
      } else {
        setMessage({ type: 'error', text: data.error || '更新失败' });
      }
    })
    .catch(err => {
      setMessage({ type: 'error', text: '网络错误，无法连接到服务器' });
    })
    .finally(() => setIsSaving(false));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      
      {/* 顶部标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#1e293b' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>个人资料设置</h1>
      </div>

      {/* 消息提示 */}
      {message.text && (
        <div style={{ 
          padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', fontSize: '14px',
          backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}40`
        }}>
          {message.text}
        </div>
      )}

      {/* 区域 1：基本信息 (展示区) */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>基本信息</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '16px' }}>
          
          {/* 渐变头像 */}
          <div style={{ position: 'relative' }}>
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '50%', 
              background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)', // 还原截图的蓝紫渐变
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '40px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {formData.username ? formData.username.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>

          {/* 信息文本 */}
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
              {formData.username || 'Loading...'}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
              {formData.email || 'No email set'}
            </div>
            
            {/* 角色徽章 (只读) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ 
                backgroundColor: role === 'Admin' ? '#2563eb' : (role === 'Technical' ? '#16a34a' : '#4b5563'), 
                color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' 
              }}>
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 区域 2 & 3：表单修改区 */}
      <div style={cardStyle}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 编辑资料 */}
          <div>
            <h2 style={sectionTitleStyle}>编辑资料</h2>
            
            <div style={inputGroupStyle}>
              <div style={labelStyle}><User size={16} /> 用户名</div>
              <input 
                required type="text" name="username" value={formData.username} onChange={handleChange}
                style={inputStyle} placeholder="输入您的用户名"
              />
            </div>

            <div style={inputGroupStyle}>
              <div style={labelStyle}><Mail size={16} /> 邮箱地址</div>
              <input 
                required type="email" name="email" value={formData.email} onChange={handleChange}
                style={inputStyle} placeholder="输入您的邮箱"
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0' }} />

          {/* 更改密码 */}
          <div>
            <h2 style={sectionTitleStyle}>更改密码</h2>
            
            <div style={inputGroupStyle}>
              <div style={labelStyle}><Lock size={16} /> 当前密码 (安全验证用 - 暂时留空即可)</div>
              <input 
                type="password" name="currentPassword" value={formData.currentPassword} onChange={handleChange}
                style={inputStyle} placeholder="输入当前密码"
              />
            </div>

            <div style={inputGroupStyle}>
              <div style={labelStyle}><Lock size={16} /> 新密码</div>
              <input 
                type="password" name="newPassword" value={formData.newPassword} onChange={handleChange}
                style={inputStyle} placeholder="输入新密码"
              />
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                留空则不修改密码
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
            <button 
              type="submit" 
              disabled={isSaving}
              style={{ 
                width: '100%', maxWidth: '300px', backgroundColor: '#0f172a', color: 'white', 
                border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', 
                fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', transition: '0.2s',
                opacity: isSaving ? 0.7 : 1
              }}
            >
              {isSaving ? '正在更新...' : '更新资料'}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};

// --- 共用样式 ---
const cardStyle = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '30px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0',
  marginBottom: '20px'
};

const sectionTitleStyle = {
  margin: '0 0 20px 0',
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#0f172a'
};

const inputGroupStyle = {
  marginBottom: '20px'
};

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: '600',
  color: '#334155',
  marginBottom: '8px'
};

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#f1f5f9', // 还原截图中的浅灰色背景框
  fontSize: '14px',
  outline: 'none',
  color: '#334155',
  boxSizing: 'border-box',
  transition: 'box-shadow 0.2s'
};

export default Profile;