import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  LayoutGrid, 
  Globe, 
  FileText, 
  Bell, 
  Users, 
  HelpCircle, 
  PlusCircle 
} from 'lucide-react';

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
      // 如果没有登录信息，强制跳回登录页
      navigate('/login');
    }
  }, [navigate]);

  if (!user) return null; 

  const userRole = user.role;
  const userName = user.username;

  // 1. 侧边栏整体样式 (采用截图中的深色背景)
  const sidebarStyle = {
    width: '260px', 
    backgroundColor: '#1b2332', // 接近截图的深灰蓝色
    color: '#fff',
    display: 'flex', 
    flexDirection: 'column', 
    height: '100vh',
    borderRight: '1px solid #273142'
  };

  // 2. 核心：自定义菜单项组件 (完全复刻截图的视觉效果)
  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <Link 
        to={to} 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          textDecoration: 'none',
          borderRadius: '10px', // 圆角设计
          color: isActive ? '#ffffff' : (isHovered ? '#ffffff' : '#94a3b8'),
          backgroundColor: isActive ? '#2563eb' : (isHovered ? '#273142' : 'transparent'), // 亮蓝色高亮
          fontWeight: isActive ? '600' : '400',
          transition: 'all 0.2s ease',
        }}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span style={{ fontSize: '15px' }}>{label}</span>
      </Link>
    );
  };

  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('monweb_user');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* --- 左侧侧边栏 --- */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', fontSize: '22px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '0.5px' }}>
          MonWeb System
        </div>
        
        {/* 导航菜单区 (增加 gap 实现间距) */}
        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <NavItem to="/dashboard" icon={LayoutGrid} label="Dashboard" />
          <NavItem to="/status" icon={Globe} label="Website Status" />
          <NavItem to="/reports" icon={FileText} label="NLP Reports" />
          <NavItem to="/alerts" icon={Bell} label="Alerts" />
          
          {/* RBAC: 只有 Admin 和 Technical 可以看到 Add Website */}
          {(userRole === 'Admin' || userRole === 'Technical') && (
            <NavItem to="/add-website" icon={PlusCircle} label="Add Website" />
          )}
          
          {/* RBAC: 只有 Admin 可以看到 Users 管理 */}
          {userRole === 'Admin' && (
            <NavItem to="/users" icon={Users} label="Users" />
          )}

          <div style={{ margin: '8px 0', height: '1px', backgroundColor: '#273142' }}></div>

          <NavItem to="/support" icon={HelpCircle} label="Support" />
        </nav>

        {/* 左下角：当前用户 Profile */}
        <div style={{ padding: '20px', backgroundColor: '#141b27' }}>
          <Link to="/profile" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '50%', 
              backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' 
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f1f5f9' }}>{userName}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>View Profile</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* --- 右侧主内容区 --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
        {/* 顶部栏 */}
        <header style={{ height: '64px', background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #e2e8f0' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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