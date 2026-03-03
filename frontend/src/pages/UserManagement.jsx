import React, { useEffect, useState } from 'react';
import { Lock, AlertTriangle, UserPlus, X, Edit, Trash2 } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 创建新用户的状态
  const [showForm, setShowForm] = useState(false); 
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'Technical' });

  // 编辑用户的状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState({ id: null, username: '', email: '', password: '', role: '' });

  // --- 新增：删除用户的状态 ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState({ id: null, username: '' });

  // 1. 拉取数据
  const fetchUsers = () => {
    setLoading(true);
    fetch('http://localhost:5000/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. 创建用户
  const handleCreateUser = (e) => {
    e.preventDefault();
    fetch('http://localhost:5000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    .then(async (res) => {
      if (res.ok) {
        setShowForm(false);
        setFormData({ username: '', email: '', password: '', role: 'Technical' }); 
        fetchUsers(); 
      } else {
        const errData = await res.json();
        alert(errData.error || "创建用户失败");
      }
    });
  };

  // 3. 编辑用户相关逻辑
  const handleEditClick = (user) => {
    setEditingUser({ id: user.id, username: user.username, email: user.email, password: '', role: user.role });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = (e) => {
    e.preventDefault();
    fetch(`http://localhost:5000/api/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: editingUser.username,
        email: editingUser.email,
        password: editingUser.password,
        role: editingUser.role
      }),
    })
    .then(async (res) => {
      if (res.ok) {
        setIsEditModalOpen(false); 
        fetchUsers(); 
      } else {
        try {
          const errData = await res.json();
          alert(errData.error || "更新失败");
        } catch(e) {
          alert("后端服务器异常，请检查后端运行状态！"); 
        }
      }
    })
    .catch(err => {
      console.error(err);
      alert("网络错误或后端未开启！");
    });
  };

  // --- 4. 删除用户相关逻辑 (新增弹窗处理) ---
  
  // 打开删除二次确认弹窗
  const handleDeleteClick = (user) => {
    setUserToDelete({ id: user.id, username: user.username });
    setIsDeleteModalOpen(true);
  };

  // 确认执行删除请求
  const confirmDelete = () => {
    if (!userToDelete.id) return;
    
    fetch(`http://localhost:5000/api/users/${userToDelete.id}`, { method: 'DELETE' })
      .then(async (res) => {
        if (res.ok) {
          fetchUsers(); // 删除成功，刷新列表
          setIsDeleteModalOpen(false); // 关闭弹窗
          setUserToDelete({ id: null, username: '' }); // 清空状态
        } else {
          const errData = await res.json();
          alert(errData.error || "删除失败");
        }
      })
      .catch(err => {
        console.error(err);
        alert("网络错误");
      });
  };

  // 角色 Badge 样式
  const renderRoleBadge = (role) => {
    if (role === 'Admin') return <span style={{ color: '#2563eb', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Admin</span>;
    if (role === 'Technical') return <span style={{ color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Technical</span>;
    return <span style={{ color: '#4b5563', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>User</span>;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px' }}>
      
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>用户管理</h1>
          <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: '14px' }}>管理系统用户和权限</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
        >
          {showForm ? <X size={18} /> : <UserPlus size={18} />}
          {showForm ? '取消创建' : '创建新用户'}
        </button>
      </div>

      {/* 权限等级说明卡片 */}
      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#1e3a8a', fontWeight: 'bold' }}>
          <Lock size={18} /> 权限等级说明
        </div>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
          <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 'bold', color: '#2563eb', marginBottom: '5px' }}>Admin (管理员)</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>完全权限：可以管理用户、添加/编辑/删除网站</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontWeight: 'bold', color: '#16a34a', marginBottom: '5px' }}>Technical (技术)</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>部分管理权限：可以添加和编辑网站，查看所有数据</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 'bold', color: '#4b5563', marginBottom: '5px' }}>User (查看者)</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>只读权限：仅可查看监控数据和报告</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#b45309' }}>
          <AlertTriangle size={14} /> 注意：系统保持单一 Admin 权限，Admin 不能创建另一个 Admin
        </div>
      </div>

      {/* 创建新用户表单 */}
      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>填写新用户信息</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>用户名 *</label>
              <input required type="text" placeholder="例如: john_tech" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>邮箱 *</label>
              <input required type="email" placeholder="john@company.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>临时密码 *</label>
              <input required type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>分配角色 *</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={inputStyle}>
                <option value="Technical">Technical (部分管理权限)</option>
                <option value="User">User (只读权限)</option>
              </select>
            </div>
            <button type="submit" style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', height: '42px', transition: '0.2s' }}>
              保存用户
            </button>
          </form>
        </div>
      )}

      {/* 用户列表表格 */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>所有用户</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: '#6b7280', fontWeight: '500' }}>用户名</th>
              <th style={{ padding: '16px 20px', color: '#6b7280', fontWeight: '500' }}>邮箱</th>
              <th style={{ padding: '16px 20px', color: '#6b7280', fontWeight: '500' }}>角色</th>
              <th style={{ padding: '16px 20px', color: '#6b7280', fontWeight: '500', textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>暂无用户数据</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 20px', fontWeight: '500', color: '#111827' }}>
                    {user.username}
                    {user.role === 'Admin' && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#4b5563', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontWeight: 'normal' }}>当前用户</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#4b5563' }}>{user.email || '未设置'}</td>
                  <td style={{ padding: '16px 20px' }}>{renderRoleBadge(user.role)}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    {user.role === 'Admin' ? (
                      <span style={{ color: '#9ca3af', fontSize: '13px' }}>不可编辑</span>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                        <button 
                          onClick={() => handleEditClick(user)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }} 
                          title="编辑用户"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(user)} // <--- 这里改为了触发弹窗
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} 
                          title="删除用户"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- 自定义编辑用户弹窗 (Modal) --- */}
      {isEditModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white', padding: '24px', borderRadius: '12px',
            width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setIsEditModalOpen(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#111827' }}>编辑用户</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>修改用户信息和权限</p>

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>用户名</label>
                <input required type="text" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>邮箱</label>
                <input required type="email" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} style={{...inputStyle, backgroundColor: '#f3f4f6'}} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>新密码 (不修改请留空)</label>
                <input type="password" placeholder="••••••••" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} style={{...inputStyle, backgroundColor: '#f3f4f6'}} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>角色</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} style={{...inputStyle, backgroundColor: '#f3f4f6'}}>
                  <option value="Technical">Technical (部分管理权限)</option>
                  <option value="User">User (只读权限)</option>
                </select>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>注意：Admin 不能创建另一个 Admin</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontWeight: '600', cursor: 'pointer' }}>取消</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '600', cursor: 'pointer' }}>保存更改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 自定义删除确认弹窗 (Modal) 完全匹配截图 --- */}
      {isDeleteModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white', padding: '30px', borderRadius: '12px',
            width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
          }}>
            {/* 顶部红底警告图标 */}
            <div style={{ backgroundColor: '#fee2e2', padding: '15px', borderRadius: '50%', marginBottom: '20px' }}>
              <AlertTriangle size={32} color="#dc2626" />
            </div>

            {/* 标题 */}
            <h2 style={{ margin: '0 0 15px 0', fontSize: '22px', color: '#111827' }}>Delete User</h2>

            {/* 说明文字 */}
            <p style={{ margin: '0 0 25px 0', fontSize: '15px', color: '#4b5563', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>{userToDelete.username}</strong>? This action cannot be undone.
            </p>

            {/* 按钮组 (双栏平分) */}
            <div style={{ display: 'flex', width: '100%', gap: '15px' }}>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '15px' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '15px' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db',
  backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box', fontSize: '14px'
};

export default UserManagement;