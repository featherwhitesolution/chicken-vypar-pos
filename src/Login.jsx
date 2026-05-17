import React, { useState } from 'react';
import { Store, Tractor, Building2, User, Lock, ArrowRight } from 'lucide-react';

export default function Login({ onLogin }) {
  const [role, setRole] = useState('Retailer');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('1123456');
  
  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin_farhan' && password === 'Farhans@27') {
      onLogin({ username, role: 'developer_admin' });
    } else if (username === 'admin' && password === '1123456') {
      onLogin({ username, role });
    } else {
      alert("Invalid credentials. Try admin_farhan / Farhans@27 or admin / 1123456");
    }
  };

  const roles = [
    { id: 'Farm', icon: <Tractor className="w-5 h-5" /> },
    { id: 'Wholesaler', icon: <Building2 className="w-5 h-5" /> },
    { id: 'Retailer', icon: <Store className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        {/* Decorative background blobs */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary-700/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-4 transform transition-transform duration-300 hover:scale-105">
              <img src="/logo.png" alt="Chicken Vypyar Logo" className="w-full h-full object-contain rounded-2xl shadow-2xl shadow-primary-500/20" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Chicken Vypyar</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Select your role and sign in</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* 3-way toggle */}
            <div className="bg-slate-200/50 dark:bg-slate-800/80 p-1.5 rounded-xl flex items-center justify-between gap-1 shadow-inner">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                    role === r.id 
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-md transform scale-100 ring-1 ring-primary-500/20' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50 scale-95'
                  }`}
                >
                  <div className="mb-1">{r.icon}</div>
                  {r.id}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                    placeholder="Enter password"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-primary-500/30 text-base font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all transform hover:-translate-y-0.5"
            >
              Sign In to {role}
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
