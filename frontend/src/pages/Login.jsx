import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, User as UserIcon, Lock } from 'lucide-react';

export default function Login() {
  // The form status is left blank by default.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Send a real login request to the backend
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        // Login successful, store user information in local storage and navigate
        localStorage.setItem('monweb_user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        // Login failed
        setError(data.message || 'Invalid username or password');
      }
    } catch (err) {
      setError('Cannot connect to server. Please check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Dark blue gradient background + network node pattern decoration
    <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
      
      {/* Background dot matrix of simulated network nodes*/}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', 
          backgroundSize: '32px 32px' 
        }}
      ></div>

      {/* White rounded corners login card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative z-10 mx-4">
        
        {/* Brand Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">MonWeb</h1>
          <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">Real-time Security & Availability</p>
          <p className="text-xs text-slate-400 mt-1">AI-driven website monitoring system</p>
        </div>

        {/* Error message display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}