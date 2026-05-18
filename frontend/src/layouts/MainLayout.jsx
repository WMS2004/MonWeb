import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { LayoutGrid, Globe, FileText, Bell, Users, HelpCircle, PlusCircle, Radio, Server } from 'lucide-react';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // --- Global Alert Engine Related Ref ---
  const lastAlertIdRef = useRef(null); // Global reference to track the latest alert ID

  // Get the currently logged-in user information when the page loads
  useEffect(() => {
    const storedUser = localStorage.getItem('monweb_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Global Background Silent Alert Engine (Global Alert Engine)
  useEffect(() => {
    if (!user || location.pathname === '/login') return;

    const fetchGlobalAlerts = async () => {
      try {
        // 1. Retrieve the latest user configuration each time 
        // (ensure changes take effect immediately after being displayed on the Alert page).
        let settings = { browserNotify: true, soundEnabled: true };
        try {
          const setRes = await fetch(`http://localhost:5000/api/alerts/settings/${user.id}`);
          if (setRes.ok) settings = await setRes.json();
        } catch (e) {
          console.log("无法获取配置，使用默认配置");
        }

        // 2. Retrieve global alert history
        const histRes = await fetch('http://localhost:5000/api/alerts/history');
        if (!histRes.ok) return;
        const data = await histRes.json();

        if (data.length > 0) {
          const currentLatestId = data[0].id;

          // If the system has just loaded, only record the ID without showing a popup
          if (lastAlertIdRef.current === null) {
            lastAlertIdRef.current = currentLatestId;
            return;
          }

          // Found new alert! (consistent with the anti-pollution logic on the Alert page)
          if (currentLatestId > lastAlertIdRef.current) {
            const newLogs = data.filter(log => log.id > lastAlertIdRef.current);
            const alertableLogs = newLogs.filter(log => !log.is_muted);

            if (alertableLogs.length > 0) {
              
              // Trigger sound
              if (settings.soundEnabled) {
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(e => console.error("Audio block:", e));
              }

              // Trigger system popup
              if (settings.browserNotify && Notification.permission === 'granted') {
                if (alertableLogs.length === 1) {
                  const newAlert = alertableLogs[0];
                  new Notification(`🚨 MonWeb Alert: ${newAlert.website_name}`, {
                    body: `[${newAlert.monitor_type}] ${newAlert.status}\nError: ${newAlert.error_details || 'Unknown Issue'}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
                  });
                } else {
                  const uniqueSiteNames = [...new Set(alertableLogs.map(log => log.website_name))].join(', ');
                  new Notification(`🚨 MonWeb Alert: ${alertableLogs.length} issues detected!`, {
                    body: `Affected websites: ${uniqueSiteNames}\nPlease check the dashboard for details.`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
                  });
                }
              }
            }
            // Update the tracked ID
            lastAlertIdRef.current = currentLatestId;
          }
        }
      } catch (error) {
        console.error("Global Alert Engine Error:", error);
      }
    };

    fetchGlobalAlerts(); // Initial check
    const intervalId = setInterval(fetchGlobalAlerts, 10000); // Global check every 10 seconds

    return () => clearInterval(intervalId);
  }, [user]); // The engine keeps running as long as the user is online.

  if (!user) return null; 

  const userRole = user.role;
  const userName = user.username;

  const sidebarStyle = {
    width: '260px', 
    backgroundColor: '#1b2332', 
    color: '#fff',
    display: 'flex', 
    flexDirection: 'column', 
    height: '100vh',
    borderRight: '1px solid #273142'
  };

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <Link 
        to={to} 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px', textDecoration: 'none',
          borderRadius: '10px', 
          color: isActive ? '#ffffff' : (isHovered ? '#ffffff' : '#94a3b8'),
          backgroundColor: isActive ? '#2563eb' : (isHovered ? '#273142' : 'transparent'), 
          fontWeight: isActive ? '600' : '400',
          transition: 'all 0.2s ease',
        }}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span style={{ fontSize: '15px' }}>{label}</span>
      </Link>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('monweb_user');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* --- Left sidebar --- */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', fontSize: '22px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '0.5px' }}>
          MonWeb System
        </div>
        
        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <NavItem to="/dashboard" icon={LayoutGrid} label="Dashboard" />
          <NavItem to="/status" icon={Globe} label="Website Status" />
          <NavItem to="/reports" icon={FileText} label="Reports" />
          <NavItem to="/alerts" icon={Bell} label="Alerts" />
          <NavItem to="/traffic" icon={Radio} label="Network Traffic" />
          <NavItem to="/traffic-history" style={{ paddingLeft: '32px' }} icon={Server} label="Traffic History" />
          
          {(userRole === 'Admin' || userRole === 'Technical') && (
            <NavItem to="/add-website" icon={PlusCircle} label="Add Website" />
          )}
          
          {userRole === 'Admin' && (
            <NavItem to="/users" icon={Users} label="Users" />
          )}

          <div style={{ margin: '8px 0', height: '1px', backgroundColor: '#273142' }}></div>

          <NavItem to="/support" icon={HelpCircle} label="Support" />
        </nav>

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

      {/* --- Right main content area --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
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

        <main style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default MainLayout;