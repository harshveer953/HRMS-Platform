import React, { useState } from 'react';
import { useAuth, API_BASE } from '../context/AuthContext';

export default function Login({ onRegisterRedirect }) {
  const { login } = useAuth();
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordSubmit(e) {
    e.preventDefault();
    if (!email) {
      setError('Please provide your email address');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }
      setSuccessMsg('OTP sent! Please check the backend server logs (console).');
      setView('reset');
    } catch (err) {
      setError(err.message || 'Error requesting OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    if (!email || !otp || !newPassword) {
      setError('Email, OTP, and new password are required');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Reset failed');
      }
      setSuccessMsg('Password reset successfully! Please log in.');
      setView('login');
      setPassword('');
      setOtp('');
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Error resetting password');
    } finally {
      setLoading(false);
    }
  }

  // Helper shortcut login triggers
  async function triggerQuickLogin(quickEmail) {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await login(quickEmail, 'Password123');
    } catch (err) {
      setError(err.message || 'Quick login failed. Verify test seed status.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card glass-card">
        {/* Header Title */}
        <div style={headerStyle}>
          <div style={logoIconStyle}>💠</div>
          <h1 style={titleStyle}>HRMS Platform</h1>
          <p style={subtitleStyle}>Human Resource Management Suite</p>
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        {successMsg && <div style={successBannerStyle}>{successMsg}</div>}

        {/* Form switcher */}
        {view === 'login' && (
          <form onSubmit={handleSubmit} style={formStyle}>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. employee@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
                <button type="button" onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }} style={forgotLinkStyle}>
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} style={submitBtnStyle} className="btn btn-primary">
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPasswordSubmit} style={formStyle}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: '1.4' }}>
              Enter your registered work email. We will generate a reset OTP.
            </p>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. employee@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} style={submitBtnStyle} className="btn btn-primary">
              {loading ? 'Sending OTP...' : 'Send Reset OTP'}
            </button>
            
            <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }} style={{ ...textLinkStyle, marginTop: '1rem', alignSelf: 'center' }}>
              ← Back to Login
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetPasswordSubmit} style={formStyle}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: '1.4' }}>
              Check your backend console logs for the OTP. Enter it below along with your new password.
            </p>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. employee@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">6-Digit OTP</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} style={submitBtnStyle} className="btn btn-primary">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            
            <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }} style={{ ...textLinkStyle, marginTop: '1rem', alignSelf: 'center' }}>
              ← Back to Login
            </button>
          </form>
        )}

        {/* Redirect */}
        {view === 'login' && (
          <div style={footerRedirectStyle}>
            Don't have an account?{' '}
            <button onClick={onRegisterRedirect} style={textLinkStyle}>
              Register Company Tenant
            </button>
          </div>
        )}

        {/* Quick Testing Panel */}
        {view === 'login' && (
          <div style={testPanelStyle}>
            <h4 style={testTitleStyle}>⚡ Developer Quick Logins</h4>
            <p style={testDescStyle}>Click to authenticate instantly and test multi-tenant roles:</p>
            <div style={btnGridStyle}>
              <button onClick={() => triggerQuickLogin('alice@acme.com')} style={testBtnStyle} className="btn-secondary">
                🏢 Acme HR Admin (Alice)
              </button>
              <button onClick={() => triggerQuickLogin('bob@acme.com')} style={testBtnStyle} className="btn-secondary">
                👤 Acme Employee (Bob)
              </button>
              <button onClick={() => triggerQuickLogin('charlie@beta.com')} style={testBtnStyle} className="btn-secondary">
                🏢 Beta HR Admin (Charlie)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom CSS-in-JS properties


const headerStyle = {
  textAlign: 'center',
  marginBottom: '2rem',
};

const logoIconStyle = {
  fontSize: '2.5rem',
  color: '#6366f1',
  marginBottom: '0.5rem',
  textShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
};

const titleStyle = {
  fontSize: '1.8rem',
  color: '#fff',
  fontWeight: '700',
};

const subtitleStyle = {
  fontSize: '0.85rem',
  color: '#94a3b8',
  marginTop: '0.25rem',
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const errorStyle = {
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#f87171',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  fontSize: '0.85rem',
  marginBottom: '1.25rem',
  textAlign: 'center',
};

const submitBtnStyle = {
  marginTop: '0.5rem',
  width: '100%',
};

const footerRedirectStyle = {
  textAlign: 'center',
  marginTop: '1.5rem',
  fontSize: '0.85rem',
  color: '#94a3b8',
};

const textLinkStyle = {
  background: 'none',
  border: 'none',
  color: '#6366f1',
  fontWeight: '600',
  cursor: 'pointer',
  padding: '0',
  fontFamily: 'inherit',
};

const testPanelStyle = {
  marginTop: '2.5rem',
  paddingTop: '1.5rem',
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
};

const testTitleStyle = {
  fontSize: '0.9rem',
  fontWeight: '600',
  color: '#fff',
  marginBottom: '0.25rem',
};

const testDescStyle = {
  fontSize: '0.75rem',
  color: '#64748b',
  marginBottom: '0.75rem',
};

const btnGridStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const testBtnStyle = {
  width: '100%',
  padding: '0.6rem 1rem',
  fontSize: '0.8rem',
  justifyContent: 'flex-start',
  borderRadius: '10px',
  cursor: 'pointer',
};

const forgotLinkStyle = {
  background: 'none',
  border: 'none',
  color: '#6366f1',
  fontSize: '0.8rem',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
};

const successBannerStyle = {
  background: 'rgba(16, 185, 129, 0.12)',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  color: '#6ee7b7',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  fontSize: '0.85rem',
  marginBottom: '1.25rem',
  textAlign: 'center',
};

