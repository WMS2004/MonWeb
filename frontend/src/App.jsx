import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// 引入布局
import MainLayout from './layouts/MainLayout';

// 引入所有页面
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WebsiteStatus from './pages/WebsiteStatus';
import WebsiteDetails from './pages/WebsiteDetails';
import Reports from './pages/Reports';
import WebsiteForm from './pages/WebsiteForm';
import Alerts from './pages/Alerts';
import UserManagement from './pages/UserManagement';
import Support from './pages/Support';
import Profile from './pages/Profile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* === Public Routes === */}
        <Route path="/login" element={<Login />} />

        {/* === Protected Routes (Inside MainLayout) === */}
        <Route path="/" element={<MainLayout />}>
          {/* Default redirect to dashboard */}
          <Route index element={<Navigate to="/login" replace />} />
          
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="status" element={<WebsiteStatus />} />
          <Route path="details/:id" element={<WebsiteDetails />} /> {/* Dynamic ID */}
          <Route path="reports" element={<Reports />} />
          <Route path="add-website" element={<WebsiteForm />} />
          <Route path="edit-website/:id" element={<WebsiteForm />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="support" element={<Support />} />
          <Route path="profile" element={<Profile />} />
          <Route path="/website/:id" element={<div>详情页开发中... ID: {window.location.pathname.split('/').pop()}</div>} />
        </Route>

        {/* Catch all - Redirect to login or 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;