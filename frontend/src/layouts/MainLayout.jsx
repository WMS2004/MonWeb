import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // 页面加载时获取当前登录的用户信息
  useEffect(() => {
    const storedUser = localStorage.getItem('monweb_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // 如果没有登录信息，强制跳回登录页 (安全拦截)
      navigate('/login');
    }
  }, [navigate]);

  // 如果还没加载出用户信息，先不渲染 (避免闪烁)
  if (!user) return null; 

  const userRole = user.role;
  const userName = user.username;

  // 侧边栏样式
  const sidebarStyle = {
    width: '250px', backgroundColor: '#001529', color: '#fff',
    display: 'flex', flexDirection: 'column', height: '100vh'
  };

  // 菜单项样式
  const linkStyle = (path) => ({
    display: 'block', padding: '15px 20px', textDecoration: 'none',
    color: location.pathname === path ? '#1890ff' : 'rgba(255,255,255,0.65)',
    backgroundColor: location.pathname === path ? '#111d2c' : 'transparent',
    borderLeft: location.pathname === path ? '3px solid #1890ff' : '3px solid transparent'
  });

  // 根据当前路径动态设置顶部栏标题
  let headerTitle = location.pathname.replace('/', '').toUpperCase();
  if (location.pathname.startsWith('/website/')) headerTitle = 'WEBSITE DETAILS';

  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('monweb_user');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 1. 左侧侧边栏 */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '20px', fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #333' }}>
          MonWeb System
        </div>
        
        <nav style={{ flex: 1, paddingTop: '10px' }}>
          <Link to="/dashboard" style={linkStyle('/dashboard')}>📊 Dashboard</Link>
          <Link to="/status" style={linkStyle('/status')}>🌐 Website Status</Link>
          <Link to="/reports" style={linkStyle('/reports')}>📑 NLP Reports</Link>
          <Link to="/alerts" style={linkStyle('/alerts')}>🔔 Alerts</Link>
          
          <div style={{ padding: '10px 20px', fontSize: '12px', color: '#999', marginTop: '10px' }}>MANAGEMENT</div>
          
          {/* RBAC: 只有 Admin 和 Technical 可以看到 Add Website */}
          {(userRole === 'Admin' || userRole === 'Technical') && (
            <Link to="/add-website" style={linkStyle('/add-website')}>➕ Add Website</Link>
          )}
          
          {/* RBAC: 只有 Admin 可以看到 Users 管理 */}
          {userRole === 'Admin' && (
            <Link to="/users" style={linkStyle('/users')}>👥 Users</Link>
          )}

          <div style={{ padding: '10px 20px', fontSize: '12px', color: '#999', marginTop: '10px' }}>HELP</div>
          <Link to="/support" style={linkStyle('/support')}>❓ Support</Link>
        </nav>

        {/* 左下角：当前用户 Profile (点击跳转) */}
        <div style={{ padding: '20px', borderTop: '1px solid #333', backgroundColor: '#000c17' }}>
          <Link to="/profile" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{userName}</div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>View Profile</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* 2. 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' }}>
        {/* 顶部栏 */}
        <header style={{ height: '64px', background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <h3 style={{ margin: 0 }}>{headerTitle}</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* 右上角：动态 Role 徽章 */}
            <span style={{ 
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
              backgroundColor: userRole === 'Admin' ? '#eff6ff' : userRole === 'Technical' ? '#f0fdf4' : '#f3f4f6',
              color: userRole === 'Admin' ? '#2563eb' : userRole === 'Technical' ? '#16a34a' : '#4b5563',
              border: `1px solid ${userRole === 'Admin' ? '#bfdbfe' : userRole === 'Technical' ? '#bbf7d0' : '#e5e7eb'}`
            }}>
              {userRole}
            </span>
            
            <button onClick={handleLogout} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
              Logout
            </button>
          </div>
        </header>

        {/* 动态内容区 */}
        <main style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default MainLayout;