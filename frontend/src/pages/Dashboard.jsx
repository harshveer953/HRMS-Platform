import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ setCurrentPage }) {
  const { user, apiCall } = useAuth();
  const [stats, setStats] = useState(null);
  const [todayAtt, setTodayAtt] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchData() {
    try {
      const [statsRes, attRes, notifRes] = await Promise.all([
        apiCall('/dashboard/stats'),
        apiCall('/attendance/today'),
        apiCall('/notifications'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (attRes.ok) setTodayAtt(await attRes.json());
      if (notifRes.ok) {
        const all = await notifRes.json();
        setNotifications(all.filter(n => !n.isRead).slice(0, 5));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  function handlePunch(type) {
    setPunching(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => { await doPunch(type, { lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        async () => { await doPunch(type, { lat: 0, lng: 0 }); },
        { timeout: 5000 }
      );
    } else { doPunch(type, { lat: 0, lng: 0 }); }
  }

  async function doPunch(type, location) {
    try {
      const res = await apiCall('/attendance/punch', { method: 'POST', body: { type, location } });
      const data = await res.json();
      if (!res.ok) alert(data.message || 'Punch failed');
      else fetchData();
    } catch (err) { console.error(err); }
    finally { setPunching(false); }
  }

  const statusColor = { Present: '#10b981', Late: '#f59e0b', 'Half-day': '#f59e0b', Absent: '#ef4444', 'On Leave': '#6366f1' };
  const hasIn = todayAtt?.punches?.some(p => p.type === 'IN');
  const hasOut = todayAtt?.punches?.some(p => p.type === 'OUT');
  const lastIn = todayAtt?.punches?.slice().reverse().find(p => p.type === 'IN');
  const lastOut = todayAtt?.punches?.slice().reverse().find(p => p.type === 'OUT');

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem', fontSize: '1.1rem' }}>Loading dashboard...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0] || 'User'} 👋</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: '#6366f1', fontWeight: 700 }}>{time}</div>
      </header>

      {/* Punch Card */}
      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>Today's Attendance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor[todayAtt?.status] || '#64748b', boxShadow: `0 0 8px ${statusColor[todayAtt?.status] || '#64748b'}` }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{todayAtt?.status || 'Not Punched'}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.5rem', display: 'flex', gap: '1.25rem' }}>
            {lastIn && <span>🟢 In: {new Date(lastIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            {lastOut && <span>🔴 Out: {new Date(lastOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            {todayAtt?.workHours > 0 && <span>⏱ {todayAtt.workHours}h worked</span>}
            {todayAtt?.overtimeHours > 0 && <span>🕐 +{todayAtt.overtimeHours}h OT</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handlePunch('IN')}
            disabled={punching || (hasIn && !hasOut)}
            className="btn btn-primary"
            style={{ opacity: (hasIn && !hasOut) ? 0.5 : 1 }}
          >
            {punching ? '...' : '🟢 Punch IN'}
          </button>
          <button
            onClick={() => handlePunch('OUT')}
            disabled={punching || !hasIn || hasOut}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: '10px', padding: '0.75rem 1.5rem', cursor: (!hasIn || hasOut) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (!hasIn || hasOut) ? 0.5 : 1 }}
          >
            {punching ? '...' : '🔴 Punch OUT'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {stats?.ess?.balances?.map(b => (
          <div key={b.type} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{b.type}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', margin: '0.4rem 0' }}>{b.available}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>days available · {b.used} used</div>
          </div>
        ))}

        {stats?.mss && (
          <>
            <div className="glass-card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => setCurrentPage('approvals')}>
              <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase' }}>Pending Approvals</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', margin: '0.4rem 0' }}>{stats.mss.pendingApprovalsCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>click to review →</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Team Present Today</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', margin: '0.4rem 0' }}>{stats.mss.attendanceToday?.present || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>of {stats.mss.teamSize} · {stats.mss.attendanceToday?.late || 0} late</div>
            </div>
          </>
        )}

        {stats?.admin && (
          <>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>Total Headcount</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', margin: '0.4rem 0' }}>{stats.admin.totalHeadcount}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>active employees</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Attendance Rate</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', margin: '0.4rem 0' }}>{stats.admin.activeAttendanceRate}%</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>present today</div>
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem' }}>🔔 Unread Notifications</h3>
            <button onClick={() => setCurrentPage('notifications')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.82rem' }}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {notifications.map(n => (
              <div key={n._id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.7rem 0.85rem', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.1)' }}>
                <span>{n.type === 'ACTION_REQUIRED' ? '🔔' : n.type === 'STATUS_UPDATE' ? '✅' : 'ℹ️'}</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{n.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
        {[
          { page: 'attendance', icon: '⏰', label: 'My Timesheet' },
          { page: 'leave', icon: '🌴', label: 'Apply Leave' },
          { page: 'holidays', icon: '🗓️', label: 'Holidays' },
          { page: 'directory', icon: '📁', label: 'Directory' },
          { page: 'profile', icon: '👤', label: 'My Profile' },
          ...(user?.role === 'HR/Admin' || user?.role === 'Reporting Manager' ? [{ page: 'approvals', icon: '✅', label: 'Approvals' }] : []),
          ...(user?.role === 'HR/Admin' ? [{ page: 'reports', icon: '📊', label: 'Reports' }] : []),
        ].map(link => (
          <button key={link.page} onClick={() => setCurrentPage(link.page)} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>{link.icon}</span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
