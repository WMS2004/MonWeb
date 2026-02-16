import React from 'react';

const Login = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1a1a', color: 'white' }}>
      <div style={{ border: '1px solid #333', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
        <h1>MonWeb Login</h1>
        <p>Real-time Security & Availability</p>
        <button onClick={() => window.location.href='/dashboard'} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
          Mock Login (Click to Enter)
        </button>
      </div>
    </div>
  );
};

export default Login;