import React, { useState } from 'react';
import { Store, Tractor, Building2, User, Lock, ArrowRight, Shield, Smartphone } from 'lucide-react';
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
  
  const handleLogin = (e) => {
    e.preventDefault();
    const normalizedUser = username.trim().replace(/\s+/g, '');

    if (normalizedUser === 'admin_farhan' && password === 'Farhans@27') {
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
    { id: 'Farm', icon: <Tractor className="w-4 h-4" />, label: 'Farm' },
    { id: 'Wholesaler', icon: <Building2 className="w-4 h-4" />, label: 'Wholesale' },
    { id: 'Retailer', icon: <Store className="w-4 h-4" />, label: 'Retail' },
    { id: 'Staff', icon: <Smartphone className="w-4 h-4" />, label: 'Staff' }
  ];

  return (
    <div className="login-page-wrapper">
      {/* Animated gradient background */}
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
        <div className="login-orb login-orb-4"></div>
      </div>

      {/* Glass card */}
      <div className="login-glass-card">
        {/* Avatar circle */}
        <div className="login-avatar">
          <div className="login-avatar-inner">
            <img src="/logo.png" alt="Chicken Vypar" style={{width:'48px', height:'48px', objectFit:'contain', borderRadius:'12px'}} />
          </div>
        </div>

        {/* Logo & Title */}
        <div className="login-header">
          <h1>Chicken Vypar</h1>
          <p>Select your role and sign in</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {/* Role switcher */}
          <div className="login-role-bar">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRole(r.id);
                  setLoginMethod('password');
                  setOtpSent(false);
                  setOtpValue('');
                  if (r.id === 'Retailer') {
                    setUsername('9876543210');
                  } else {
                    setUsername('');
                  }
                }}
                className={`login-role-btn ${role === r.id ? 'active' : ''}`}
              >
                {r.icon}
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {/* Input fields */}
          <div className="login-fields">
            {/* Username / mobile */}
            <div className="login-input-group">
              <div className="login-input-icon">
                <User className="w-4 h-4" />
              </div>
              <input
                type={role === 'Retailer' || role === 'Staff' ? 'tel' : 'text'}
                value={username}
                disabled={otpSent}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={role === 'Retailer' || role === 'Staff' ? 'Mobile Number' : 'Username'}
              />
            </div>

            {/* OTP or Password */}
            {role === 'Retailer' && loginMethod === 'otp' ? (
              otpSent && (
                <div className="login-input-group" style={{animationName: 'loginSlideUp', animationDuration:'0.3s', animationFillMode:'both'}}>
                  <div className="login-input-icon">
                    <Shield className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength="6"
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter OTP Code"
                    style={{textAlign:'center', letterSpacing:'0.25em', fontWeight:700}}
                  />
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtpValue(''); }}
                    className="login-edit-btn"
                  >
                    Edit
                  </button>
                </div>
              )
            ) : (
              <div className="login-input-group">
                <div className="login-input-icon">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  maxLength={role === 'Staff' ? '6' : undefined}
                  value={password}
                  onChange={(e) => setPassword(role === 'Staff' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                  placeholder={role === 'Staff' ? 'PIN Passcode' : 'Password'}
                />
              </div>
            )}
          </div>

          {/* OTP toggle for retailer */}
          {role === 'Retailer' && (
            <div className="login-otp-toggle">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod(loginMethod === 'password' ? 'otp' : 'password');
                  setOtpSent(false);
                  setOtpValue('');
                }}
              >
                {loginMethod === 'password' ? '⚡ Sign in with OTP instead' : '🔑 Sign in with Password instead'}
              </button>
            </div>
          )}

          {/* Remember me + Forgot */}
          <div className="login-meta-row">
            <label className="login-remember">
              <input type="checkbox" defaultChecked />
              <span>Remember me</span>
            </label>
            <a href="#" className="login-forgot" onClick={e => e.preventDefault()}>Forgot Password?</a>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isVerifyingStaff}
            className="login-submit-btn"
          >
            <span>
              {isVerifyingStaff ? (
                'Verifying...'
              ) : isSendingOtp ? (
                'Sending OTP...'
              ) : role === 'Retailer' && loginMethod === 'otp' ? (
                otpSent ? 'VERIFY & SIGN IN' : 'SEND OTP CODE'
              ) : (
                'LOGIN'
              )}
            </span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </form>
      </div>

      <style>{`
        /* ====== LOGIN PAGE STYLES ====== */
        .login-page-wrapper {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Gradient background */
        .login-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a0a2e 0%, #16213e 30%, #0f3460 55%, #2c1654 80%, #1a0a2e 100%);
          z-index: 0;
        }

        /* Floating orbs for depth */
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          animation: loginOrbFloat 12s ease-in-out infinite;
        }
        .login-orb-1 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(180, 50, 120, 0.7), transparent 70%);
          top: -10%;
          left: 20%;
          animation-delay: 0s;
        }
        .login-orb-2 {
          width: 280px;
          height: 280px;
          background: radial-gradient(circle, rgba(80, 40, 160, 0.7), transparent 70%);
          bottom: -5%;
          right: 15%;
          animation-delay: -4s;
        }
        .login-orb-3 {
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(60, 100, 200, 0.5), transparent 70%);
          top: 40%;
          right: 5%;
          animation-delay: -8s;
        }
        .login-orb-4 {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(200, 60, 100, 0.4), transparent 70%);
          bottom: 20%;
          left: -5%;
          animation-delay: -6s;
        }

        @keyframes loginOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }

        /* Glass card */
        .login-glass-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 380px;
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.12) 0%,
            rgba(255, 255, 255, 0.06) 50%,
            rgba(255, 255, 255, 0.03) 100%
          );
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 24px;
          padding: 2.5rem 2rem 2rem;
          box-shadow:
            0 0 0 0.5px rgba(255, 255, 255, 0.1) inset,
            0 25px 50px -12px rgba(0, 0, 0, 0.5),
            0 0 80px rgba(120, 50, 180, 0.15);
          animation: loginCardAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes loginCardAppear {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Avatar circle at top */
        .login-avatar {
          display: flex;
          justify-content: center;
          margin-bottom: 1.25rem;
        }
        .login-avatar-inner {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.15),
            rgba(255, 255, 255, 0.05)
          );
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 0 30px rgba(180, 60, 120, 0.25),
            0 0 0 0.5px rgba(255, 255, 255, 0.1) inset;
          animation: loginAvatarGlow 4s ease-in-out infinite alternate;
        }

        @keyframes loginAvatarGlow {
          from { box-shadow: 0 0 30px rgba(180, 60, 120, 0.25), 0 0 0 0.5px rgba(255, 255, 255, 0.1) inset; }
          to { box-shadow: 0 0 40px rgba(120, 40, 180, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.15) inset; }
        }

        /* Header */
        .login-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .login-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          margin: 0 0 0.25rem;
          letter-spacing: -0.02em;
        }
        .login-header p {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.45);
          margin: 0;
          font-weight: 400;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Role switcher bar */
        .login-role-bar {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 4px;
        }
        .login-role-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 8px 4px;
          border-radius: 11px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.35);
          font-size: 0.65rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          letter-spacing: 0.02em;
        }
        .login-role-btn:hover {
          color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.04);
        }
        .login-role-btn.active {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.15),
            rgba(255, 255, 255, 0.07)
          );
          color: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        /* Input fields */
        .login-fields {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .login-input-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        .login-input-icon {
          position: absolute;
          left: 14px;
          color: rgba(255, 255, 255, 0.35);
          display: flex;
          align-items: center;
          pointer-events: none;
          z-index: 2;
          transition: color 0.2s;
        }
        .login-input-group:focus-within .login-input-icon {
          color: rgba(200, 150, 255, 0.8);
        }
        .login-input-group input {
          width: 100%;
          padding: 14px 14px 14px 42px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.875rem;
          font-weight: 400;
          outline: none;
          transition: all 0.25s ease;
          backdrop-filter: blur(10px);
          font-family: inherit;
        }
        .login-input-group input::placeholder {
          color: rgba(255, 255, 255, 0.3);
          font-weight: 400;
        }
        .login-input-group input:focus {
          border-color: rgba(180, 120, 255, 0.4);
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 20px rgba(140, 80, 220, 0.15);
        }
        .login-input-group input:disabled {
          opacity: 0.5;
        }

        .login-edit-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: rgba(180, 140, 255, 0.8);
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          z-index: 2;
          letter-spacing: 0.03em;
        }
        .login-edit-btn:hover {
          color: rgba(200, 170, 255, 1);
        }

        /* Remember & Forgot row */
        .login-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .login-remember {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .login-remember input[type="checkbox"] {
          width: 14px;
          height: 14px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          accent-color: #a855f7;
          cursor: pointer;
        }
        .login-remember span {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.45);
          font-weight: 400;
        }
        .login-forgot {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.35);
          text-decoration: none;
          font-weight: 400;
          transition: color 0.2s;
        }
        .login-forgot:hover {
          color: rgba(200, 160, 255, 0.8);
        }

        /* OTP toggle */
        .login-otp-toggle {
          text-align: center;
        }
        .login-otp-toggle button {
          background: none;
          border: none;
          color: rgba(180, 140, 255, 0.7);
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
          letter-spacing: 0.02em;
          font-family: inherit;
        }
        .login-otp-toggle button:hover {
          color: rgba(200, 170, 255, 1);
        }

        /* Submit button */
        .login-submit-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          border: none;
          border-radius: 14px;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: white;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          font-family: inherit;
          background: linear-gradient(
            135deg,
            rgba(100, 60, 180, 0.6) 0%,
            rgba(60, 40, 150, 0.5) 50%,
            rgba(40, 80, 180, 0.6) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow:
            0 8px 25px rgba(80, 40, 160, 0.3),
            0 0 0 0.5px rgba(255, 255, 255, 0.08) inset;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 12px 35px rgba(80, 40, 160, 0.4),
            0 0 0 0.5px rgba(255, 255, 255, 0.12) inset;
          background: linear-gradient(
            135deg,
            rgba(120, 70, 200, 0.7) 0%,
            rgba(70, 50, 170, 0.6) 50%,
            rgba(50, 90, 200, 0.7) 100%
          );
        }
        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0.5px);
        }
        .login-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes loginSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Mobile responsiveness */
        @media (max-width: 420px) {
          .login-glass-card {
            padding: 2rem 1.25rem 1.5rem;
            border-radius: 20px;
          }
          .login-avatar-inner {
            width: 64px;
            height: 64px;
          }
          .login-header h1 {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
