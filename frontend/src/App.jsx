// import { useState, useEffect } from 'react'

// function App() {
//   const [websites, setWebsites] = useState([])

//   // useEffect(() => {
//   //   // 这里向你的 Flask 后端发送请求
//   //   fetch('http://localhost:5000/api/websites')
//   //     .then(response => response.json())
//   //     .then(data => {
//   //       console.log("Get Data:", data) // 你可以在浏览器控制台看到这个
//   //       setWebsites(data)
//   //     })
//   //     .catch(error => console.error("Connect Fail:", error))
//   // }, [])

// //   return (
// //     <div style={{ padding: "20px", fontFamily: "Arial" }}>
// //       <h1>MonWeb Monitoring Dashboard</h1>
// //       <hr />
// //       {backendData ? (
// //         <div>
// //           <h2 style={{ color: "green" }}>{backendData.message}</h2>
// //           <p>System status: {backendData.system_status}</p>
// //         </div>
// //       ) : (
// //         <p>Connecting to the backend server...</p>
// //       )}
// //     </div>
// //   )
// // }

// // return (
// //     <div style={{ padding: "20px", fontFamily: "Arial" }}>
// //       <h1>MonWeb Monitoring Dashboard</h1>
// //       <hr />
      
// //       {/* 修正2：根据列表是否有数据来显示 */}
// //       {websites.length > 0 ? (
// //         <div>
// //           <h3>Target Monitoring Lists (Database Loaded):</h3>
// //           <ul>
// //             {/* 修正3：使用 map 循环显示列表中的每一个网站 */}
// //             {websites.map((site) => (
// //               <li key={site.id} style={{ marginBottom: "10px" }}>
// //                 <strong>{site.name}</strong> 
// //                 <br />
// //                 <span style={{ color: "gray", fontSize: "0.9em" }}>
// //                   {site.url} (Interval: {site.interval}s)
// //                 </span>
// //               </li>
// //             ))}
// //           </ul>
// //         </div>
// //       ) : (
// //         <p>Loading website list from database...</p>
// //       )}
// //     </div>
// //   )
// // }

// // --- 修复点：定义 fetchData 函数 ---
//   const fetchData = () => {
//     // 注意：这里我们请求的是 /api/status，不是 /api/websites
//     // 因为 /api/status 才有 latency (延迟) 和 status (状态) 数据
//     fetch('http://localhost:5000/api/status')
//       .then(response => response.json())
//       .then(data => {
//         console.log("Received the latest monitoring data:", data) 
//         setWebsites(data)
//       })
//       .catch(error => console.error("Connection to backend failed:", error))
//   }

// useEffect(() => {
//     fetchData() // 第一次加载时获取
//     const interval = setInterval(fetchData, 5000) // 每 5 秒刷新一次数据
//     return () => clearInterval(interval)
//   }, [])

// return (
//     <div style={{ padding: "40px", fontFamily: "Arial", maxWidth: "800px", margin: "0 auto" }}>
//       <h1>MonWeb Real Time Monitoring Dashboard</h1>
      
//       {/* 如果没有数据，显示加载中 */}
//       {websites.length === 0 ? (
//         <p>Waiting for backend data (Please ensure the backend is running.)...</p>
//       ) : (
//         <table border="1" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
//           <thead>
//             <tr style={{ background: "#f4f4f4" }}>
//               <th style={{ padding: "10px" }}>Website Name</th>
//               <th style={{ padding: "10px" }}>Status</th>
//               <th style={{ padding: "10px" }}>Delay (ms)</th>
//               <th style={{ padding: "10px" }}>Last Updated</th>
//             </tr>
//           </thead>
//           <tbody>
//             {websites.map((site, index) => (
//               <tr key={index}>
//                 <td style={{ padding: "10px" }}>
//                   <strong>{site.name}</strong><br/>
//                   <small style={{color: "gray"}}>{site.url}</small>
//                 </td>
//                 <td style={{ padding: "10px", color: site.status === "UP" ? "green" : "red", fontWeight: "bold" }}>
//                   {site.status}
//                 </td>
//                 <td style={{ padding: "10px" }}>{site.latency} ms</td>
//                 <td style={{ padding: "10px" }}>{site.last_check}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   )
// }

// export default App

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
          <Route index element={<Navigate to="/dashboard" replace />} />
          
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
        </Route>

        {/* Catch all - Redirect to login or 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;