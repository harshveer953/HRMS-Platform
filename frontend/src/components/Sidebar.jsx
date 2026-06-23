import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard', roles: ['all'] },
  { id: 'attendance', icon: '⏰', label: 'Attendance', roles: ['all'] },
  { id: 'leave', icon: '🌴', label: 'Leave', roles: ['all'] },
  { id: 'holidays', icon: '🗓️', label: 'Holidays', roles: ['all'] },
  { id: 'notifications', icon: '🔔', label: 'Notifications', roles: ['all'] },
  { id: 'profile', icon: '👤', label: 'My Profile', roles: ['all'] },
  { id: 'directory', icon: '📁', label: 'Directory', roles: ['all'] },
  { id: 'org-chart', icon: '🌿', label: 'Org Chart', roles: ['all'] },
  { id: 'approvals', icon: '✅', label: 'Approvals', roles: ['Reporting Manager', 'HR/Admin'] },
  { id: 'reports', icon: '📊', label: 'Reports', roles: ['HR/Admin', 'Leadership'] },
  { id: 'org-settings', icon: '⚙️', label: 'Org Settings', roles: ['HR/Admin'] },
  { id: 'audit-logs', icon: '🔐', label: 'Audit Logs', roles: ['HR/Admin'] },
];

export default function Sidebar({ currentPage, setCurrentPage, isOpen, onClose }) {
  const { user, logout, apiCall } = useAuth();
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await apiCall('/notifications');
        if (res.ok) {
          const all = await res.json();
          setUnread(all.filter(n => !n.isRead).length);
        }
      } catch {}
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const visibleItems = NAV_ITEMS.filter(item =>
    item.roles.includes('all') || item.roles.includes(user?.role)
  );

  return (
    <aside
      className={`sidebar-drawer ${isOpen ? 'open' : ''}`}
      style={{
      width: collapsed ? '64px' : '220px',
      minHeight: '100vh',
      background: 'rgba(10,13,25,0.95)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      flexShrink: 0,
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '1.25rem 0' : '1.25rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>💠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>HRMS</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Portal</div>
            </div>
          </div>
        )}
        {collapsed && <span style={{ fontSize: '1.4rem' }}>💠</span>}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem', flexShrink: 0 }}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#fff', flexShrink: 0 }}>
              {(user?.name || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {visibleItems.map(item => {
          const isActive = currentPage === item.id;
          const showBadge = item.id === 'notifications' && unread > 0;
          return (
            <button
              key={item.id}
              onClick={() => { setCurrentPage(item.id); if (onClose) onClose(); }}
              title={collapsed ? item.label : ''}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: collapsed ? '0.7rem 0' : '0.65rem 1.25rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: 'none',
                borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                color: isActive ? '#fff' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'Outfit, sans-serif',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>}
              {showBadge && (
                <span style={{
                  position: collapsed ? 'absolute' : 'static',
                  top: collapsed ? '8px' : undefined,
                  right: collapsed ? '8px' : undefined,
                  marginLeft: collapsed ? undefined : 'auto',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => { logout(); if (onClose) onClose(); }} style={{
          width: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
          color: '#f87171', borderRadius: '8px', padding: '0.6rem',
          cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start', gap: '0.5rem', fontFamily: 'Outfit, sans-serif'
        }}>
          <span>🚪</span>{!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
