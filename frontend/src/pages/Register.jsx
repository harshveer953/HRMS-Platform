import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Register({ onLoginRedirect }) {
  const { registerTenant } = useAuth();
  const [form, setForm] = useState({ companyName: '', domain: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await registerTenant(form.companyName, form.domain, form.adminName, form.adminEmail, form.adminPassword);
      setDone(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }



  if (done) return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Organization Registered!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Your HRMS workspace is ready. Login with your admin credentials.</p>
          <button onClick={onLoginRedirect} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>Go to Login →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💠</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>Register Organization</h1>
          <p style={{ color: '#64748b', marginTop: '0.4rem', fontSize: '0.9rem' }}>Set up your company's HRMS workspace</p>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'Acme Corporation' },
            { key: 'domain', label: 'Company Domain (unique ID)', type: 'text', placeholder: 'acme-corp' },
            { key: 'adminName', label: 'Admin Full Name', type: 'text', placeholder: 'John Smith' },
            { key: 'adminEmail', label: 'Admin Email', type: 'email', placeholder: 'admin@acme.com' },
            { key: 'adminPassword', label: 'Admin Password', type: 'password', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}</label>
              <input className="form-input" type={f.type} required placeholder={f.placeholder} value={form[f.key]} onChange={set(f.key)} />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}>
            {loading ? 'Creating workspace...' : 'Create Organization'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
          Already registered?{' '}
          <button onClick={onLoginRedirect} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>Sign in here</button>
        </div>
      </div>
    </div>
  );
}
