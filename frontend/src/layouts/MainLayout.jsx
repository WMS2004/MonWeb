import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const MainLayout = () => {
  const location = useLocation();

  // 侧边栏样式
  const sidebarStyle = {
    width: '250px',
    backgroundColor: '#001529',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh'
  };

  // 菜单项样式
  const linkStyle = (path) => ({
    display: 'block',
    padding: '15px 20px',
    color: location.pathname === path ? '#1890ff' : 'rgba(255,255,255,0.65)',
    textDecoration: 'none',
    backgroundColor: location.pathname === path ? '#111d2c' : 'transparent',
    borderLeft: location.pathname === path ? '3px solid #1890ff' : '3px solid transparent'
  });

  // 根据当前路径动态设置顶部栏标题
  let headerTitle = location.pathname.replace('/', '').toUpperCase();
  if (location.pathname.startsWith('/website/')) {
    headerTitle = 'WEBSITE DETAILS';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 1. 左侧侧边栏 */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '20px', fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #333' }}>
          MonWeb Admin
        </div>
        <nav style={{ flex: 1, paddingTop: '10px' }}>
          <Link to="/dashboard" style={linkStyle('/dashboard')}>📊 Dashboard</Link>
          <Link to="/status" style={linkStyle('/status')}>🌐 Website Status</Link>
          <Link to="/reports" style={linkStyle('/reports')}>📑 NLP Reports</Link>
          <Link to="/alerts" style={linkStyle('/alerts')}>🔔 Alerts</Link>
          <div style={{ padding: '10px 20px', fontSize: '12px', color: '#999', marginTop: '10px' }}>MANAGEMENT</div>
          <Link to="/add-website" style={linkStyle('/add-website')}>➕ Add Website</Link>
          <Link to="/users" style={linkStyle('/users')}>👥 Users</Link>
          <div style={{ padding: '10px 20px', fontSize: '12px', color: '#999', marginTop: '10px' }}>HELP</div>
          <Link to="/support" style={linkStyle('/support')}>❓ Support</Link>
        </nav>
        <div style={{ padding: '20px', borderTop: '1px solid #333' }}>
          <Link to="/profile" style={{ color: 'white', textDecoration: 'none' }}>👤 My Profile</Link>
        </div>
      </aside>

      {/* 2. 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' }}>
        {/* 顶部栏 */}
        <header style={{ height: '64px', background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <h3 style={{ margin: 0 }}>{headerTitle}</h3>
          <div>
            <span style={{ marginRight: '15px' }}>Admin User</span>
            <Link to="/login" style={{ color: 'red', textDecoration: 'none' }}>Logout</Link>
          </div>
        </header>

        {/* 动态内容区：这里会根据路由显示不同的页面 */}
        <main style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default MainLayout;