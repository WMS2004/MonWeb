import React, { useEffect, useState, useRef } from 'react';
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

  // --- 全局警报引擎相关 State & Ref ---
  const failTrackerRef = useRef({}); // 记录每个网站连续失败的次数: { "site_1": 1, "site_2": 3 }
  const lastCheckedMap = useRef({}); // 核心：记录后端上次扫描的时间戳

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

// 🌟 核心：全局后台静默警报引擎 (Alert Engine)
  useEffect(() => {
    // 【修复1】：未登录、或者正在登录页时，绝对不执行轮询！
    if (!user || location.pathname === '/login') return;

    const checkWebsiteStatus = async () => {
      try {
        // 去后端拿取真实的警报设置
        let settings = { browserNotify: true, soundEnabled: true };
        try {
           const setRes = await fetch(`http://localhost:5000/api/alerts/settings/${user.id}`);
           if (setRes.ok) settings = await setRes.json();
        } catch(e) {
           console.log("无法获取用户配置，使用默认配置");
        }

        const res = await fetch('http://localhost:5000/api/websites');
        const sites = await res.json();

        let newlyDownSites = []; // 存放本次扫描发现的宕机网站

        sites.forEach(site => {
          // 【静音拦截】：如果被单独静音，直接无视
          if (site.is_muted) return;

          if (site.status === 'Down') {
            // 【轰炸机制核心】：只要后端扫描的时间变了（说明刚扫完一次），我们就判定一次
            if (lastCheckedMap.current[site.id] !== site.last_checked) {
              
              failTrackerRef.current[site.id] = (failTrackerRef.current[site.id] || 0) + 1;
              lastCheckedMap.current[site.id] = site.last_checked;

              // 只要达到或超过设置的 failCount 阈值，就加入警报名单！(意味着不恢复就会一直弹)
              if (failTrackerRef.current[site.id] >= settings.failCount) {
                newlyDownSites.push(site.name);
              }
            }
          } else {
            // 如果恢复 Up，重置计数器
            failTrackerRef.current[site.id] = 0;
            lastCheckedMap.current[site.id] = site.last_checked;
          }
        });

        // 触发最终的弹窗与声音（合并防风暴）
        if (newlyDownSites.length > 0) {
          if (settings.soundEnabled && settings.mp3Url) {
            const audio = new Audio(settings.mp3Url);
            audio.play().catch(e => console.log("Audio blocked by browser"));
          }

          if (settings.browserNotify && Notification.permission === 'granted') {
            const title = `🚨 监控警报：${newlyDownSites.length} 个服务宕机！`;
            // 如果超过3个，截断文字防止弹窗撑爆
            let bodyText = newlyDownSites.length > 3 
              ? `${newlyDownSites.slice(0, 3).join(', ')}...等网站` 
              : newlyDownSites.join(', ');
            
            new Notification(title, { 
              body: `离线目标: ${bodyText}\n系统将持续播报，直到服务恢复或被您手动静音。`,
              icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
            });
          }
        }
      } catch (error) {
        console.error("Alert Engine Error:", error);
      }
    };

    const intervalId = setInterval(checkWebsiteStatus, 15000);
    checkWebsiteStatus(); 

    return () => clearInterval(intervalId);
  }, [user, location.pathname]); // user 状态改变时才会重新挂载

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
          <NavItem to="/reports" icon={FileText} label="Reports" />
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