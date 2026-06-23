import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const typeColors = { ACTION_REQUIRED: '#f59e0b', STATUS_UPDATE: '#10b981', INFO: '#6366f1', SECURITY: '#ef4444' };
const typeIcons = { ACTION_REQUIRED: '🔔', STATUS_UPDATE: '✅', INFO: 'ℹ️', SECURITY: '🔒' };

export default function Notifications() {
  const { apiCall } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [prefMsg, setPrefMsg] = useState('');

  async function fetchData() {
    const [notifRes, prefsRes] = await Promise.all([apiCall('/notifications'), apiCall('/notifications/prefs')]);
    if (notifRes.ok) setNotifications(await notifRes.json());
    if (prefsRes.ok) setPrefs(await prefsRes.json());
  }

  useEffect(() => { setLoading(true); fetchData().finally(() => setLoading(false)); }, []);

  async function markRead(id) {
    const res = await apiCall('/notifications/read', { method: 'POST', body: id ? { id } : {} });
    if (res.ok) fetchData();
  }

  async function savePrefs() {
    const res = await apiCall('/notifications/prefs', { method: 'PUT', body: prefs });
    const data = await res.json();
    if (res.ok) { setPrefMsg('Preferences saved!'); fetchData(); }
    else setPrefMsg(data.message || 'Error saving');
    setTimeout(() => setPrefMsg(''), 3000);
  }

  const filtered = notifications.filter(n => activeTab === 'all' ? true : activeTab === 'unread' ? !n.isRead : n.isRead);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading notifications...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Stay updated on approvals, attendance, and HR events.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markRead(null)} className="btn btn-primary">Mark All Read ({unreadCount})</button>
        )}
      </header>

      <div className="responsive-grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        {/* Notifications List */}
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['all', 'unread', 'read'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? 'rgba(99,102,241,0.15)' : 'none',
                border: activeTab === tab ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                color: activeTab === tab ? '#fff' : '#94a3b8',
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', textTransform: 'capitalize'
              }}>
                {tab} {tab === 'unread' && unreadCount > 0 && `(${unreadCount})`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                No {activeTab} notifications
              </div>
            ) : (
              filtered.map(n => (
                <div key={n._id} onClick={() => !n.isRead && markRead(n._id)} style={{
                  padding: '1rem 1.25rem', borderRadius: '12px', cursor: n.isRead ? 'default' : 'pointer',
                  background: n.isRead ? 'rgba(255,255,255,0.01)' : 'rgba(99,102,241,0.06)',
                  border: n.isRead ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(99,102,241,0.15)',
                  display: 'flex', gap: '1rem', alignItems: 'flex-start',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ fontSize: '1.3rem', flexShrink: 0, marginTop: '0.1rem' }}>{typeIcons[n.type] || 'ℹ️'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{n.title}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', flexShrink: 0 }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.83rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{n.message}</p>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '20px', background: `${typeColors[n.type] || '#6366f1'}20`, color: typeColors[n.type] || '#6366f1' }}>{n.type}</span>
                  </div>
                  {!n.isRead && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: '0.4rem' }} />}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Preferences Panel */}
        {prefs && (
          <div className="glass-card" style={{ alignSelf: 'flex-start', position: 'sticky', top: '1rem' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>⚙️ Preferences</h3>
            {prefMsg && <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: prefMsg.includes('saved') ? '#34d399' : '#f87171' }}>{prefMsg}</div>}

            {[
              { key: 'email', label: 'Email Notifications', locked: false },
              { key: 'inApp', label: 'In-App Notifications', locked: false },
              { key: 'leaveUpdates', label: 'Leave Updates', locked: false },
              { key: 'attendanceAlerts', label: 'Attendance Alerts', locked: false },
              { key: 'systemAlerts', label: 'Security Alerts', locked: true },
            ].map(({ key, label, locked }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: locked ? '#94a3b8' : '#fff' }}>{label}</div>
                  {locked && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cannot be disabled</div>}
                </div>
                <div style={{
                  width: '40px', height: '22px', borderRadius: '11px', cursor: locked ? 'not-allowed' : 'pointer',
                  background: prefs[key] ? '#6366f1' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0
                }} onClick={() => !locked && setPrefs(p => ({ ...p, [key]: !p[key] }))}>
                  <div style={{ position: 'absolute', top: '3px', left: prefs[key] ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}

            <button onClick={savePrefs} className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }}>
              Save Preferences
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
