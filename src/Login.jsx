import React, { useState } from 'react';
import { Store, Tractor, Building2, User, Lock, ArrowRight, Shield, Smartphone, Eye, EyeOff } from 'lucide-react';
import { supabase } from './supabase';

export default function Login({ onLogin }) {
  const [role, setRole] = useState('Retailer');
  const [username, setUsername] = useState('9876543210');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingStaff, setIsVerifyingStaff] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const handleLogin = (e) => {
    e.preventDefault();
    const normalizedUser = username.trim().replace(/\s+/g, '');

    if (normalizedUser === 'admin_farhan' && password === '123456') {
      onLogin({ username: normalizedUser, role: 'developer_admin' });
      return;
    }

    if (role === 'Staff') {
      setIsVerifyingStaff(true);
      supabase
        .from('field_staff')
        .select('*')
        .eq('phone', normalizedUser)
        .eq('status', 'Active')
        .then(({ data, error }) => {
          setIsVerifyingStaff(false);
          if (error || !data || data.length === 0) {
            alert("Invalid Phone number or inactive staff license.");
            return;
          }
          let authenticatedUser = null;
          data.forEach((row) => {
            if (row.passcode === password) {
              authenticatedUser = {
                username: normalizedUser,
                name: row.name,
                role: 'FieldStaff',
                staffId: row.staff_id,
                docId: row.id,
                assignedWholesalerId: row.current_shop_id || '',
                assignedWholesalerName: row.assigned_wholesaler_name
              };
            }
          });
          if (authenticatedUser) {
            onLogin(authenticatedUser);
          } else {
            alert("Incorrect PIN passcode.");
          }
        })
        .catch((err) => {
          setIsVerifyingStaff(false);
          console.error(err);
          alert("Verification failed due to database query error.");
        });
      return;
    }

    if (role === 'Retailer') {
      if (loginMethod === 'otp') {
        if (!otpSent) {
          if (normalizedUser.length < 10) {
            alert("Please enter a valid 10-digit mobile number.");
            return;
          }
          setIsSendingOtp(true);
          setTimeout(() => {
            setIsSendingOtp(false);
            setOtpSent(true);
            alert("Demo OTP code '123456' sent to " + username);
          }, 800);
        } else {
          if (otpValue === '123456') {
            onLogin({ username: normalizedUser, role });
          } else {
            alert("Invalid OTP code. Please enter '123456' for verification.");
          }
        }
      } else {
        if (normalizedUser.length >= 10 && password === '123456') {
          onLogin({ username: normalizedUser, role });
        } else {
          alert("Invalid Mobile Number or password. Please try again.");
        }
      }
    } else {
      if (normalizedUser === 'admin' && password === '123456') {
        onLogin({ username: normalizedUser, role });
      } else {
        alert("Invalid username or password. Please try again.");
      }
    }
  };

  const roles = [
    { id: 'Farm', icon: <Tractor className="w-5 h-5" /> },
    { id: 'Wholesaler', icon: <Building2 className="w-5 h-5" /> },
    { id: 'Retailer', icon: <Store className="w-5 h-5" /> },
    { id: 'Staff', icon: <Smartphone className="w-5 h-5" /> }
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
              <img src="/logo.png" alt="Chicken Vypar Logo" className="w-full h-full object-contain rounded-2xl shadow-2xl shadow-primary-500/20" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Chicken Vypar</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Select your role and sign in</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* 3-way toggle */}
            <div className="bg-slate-200/50 dark:bg-slate-800/80 p-1.5 rounded-xl flex items-center justify-between gap-1 shadow-inner">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id);
                    setLoginMethod('password');
                    setOtpSent(false);
                    setOtpValue('');
                    setShowPassword(false);
                    if (r.id === 'Retailer') {
                      setUsername('9876543210');
                    } else {
                      setUsername('');
                    }
                  }}
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {role === 'Retailer' || role === 'Staff' ? 'Mobile Number' : 'Username'}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type={role === 'Retailer' || role === 'Staff' ? 'tel' : 'text'}
                    value={username}
                    disabled={otpSent}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none disabled:opacity-60"
                    placeholder={role === 'Retailer' || role === 'Staff' ? 'Enter 10-digit Mobile Number' : 'Enter username'}
                  />
                </div>
              </div>

              {role === 'Retailer' && loginMethod === 'otp' ? (
                otpSent && (
                  <div className="animate-in slide-in-from-top duration-300">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">OTP Code</label>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpValue('');
                        }}
                        className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                      >
                        Edit Mobile
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Shield className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        maxLength="6"
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none font-bold text-center tracking-widest text-lg"
                        placeholder="••••••"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1.5 text-center">
                      For testing, type the mock code <span className="font-bold text-primary-500">123456</span>
                    </p>
                  </div>
                )
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {role === 'Staff' ? '4-Digit PIN Passcode' : 'Password'}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      maxLength={role === 'Staff' ? "6" : undefined}
                      value={password}
                      onChange={(e) => setPassword(role === 'Staff' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                      className="block w-full pl-11 pr-12 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                      placeholder={role === 'Staff' ? 'Enter PIN Passcode (e.g. 1234)' : 'Enter password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {role === 'Retailer' && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod(loginMethod === 'password' ? 'otp' : 'password');
                    setOtpSent(false);
                    setOtpValue('');
                    setShowPassword(false);
                  }}
                  className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline tracking-wide transition-all"
                >
                  {loginMethod === 'password' ? '⚡ Sign in with OTP instead' : '🔑 Sign in with Password instead'}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingStaff}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-primary-500/30 text-base font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isVerifyingStaff ? (
                <span>Verifying Staff Credentials...</span>
              ) : isSendingOtp ? (
                <span>Sending OTP...</span>
              ) : role === 'Retailer' && loginMethod === 'otp' ? (
                otpSent ? 'Verify & Sign In' : 'Send OTP Code'
              ) : (
                `Sign In to ${role}`
              )}
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
