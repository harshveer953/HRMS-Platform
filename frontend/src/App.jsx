import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Directory from './pages/Directory';
import Profile from './pages/Profile';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Approvals from './pages/Approvals';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Holidays from './pages/Holidays';
import Notifications from './pages/Notifications';
import OrgChartPage from './pages/OrgChartPage';
import OrgSettings from './pages/OrgSettings';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>💠</div>
        <h2 style={{ fontWeight: 400, color: '#94a3b8' }}>Initializing HRMS Portal...</h2>
      </div>
    );
  }

  if (!user) {
    if (isRegistering) return <Register onLoginRedirect={() => setIsRegistering(false)} />;
    return <Login onRegisterRedirect={() => setIsRegistering(true)} />;
  }

  const pages = {
    dashboard: <Dashboard setCurrentPage={setCurrentPage} />,
    directory: <Directory />,
    profile: <Profile />,
    attendance: <Attendance />,
    leave: <Leave />,
    holidays: <Holidays />,
    notifications: <Notifications />,
    approvals: <Approvals />,
    'org-chart': <OrgChartPage />,
    reports: <Reports />,
    'org-settings': <OrgSettings />,
    'audit-logs': <AuditLogs />,
  };

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
          >
            ☰
          </button>
          <span style={{ fontSize: '1.2rem' }}>💠</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', textTransform: 'capitalize' }}>
            {currentPage.replace('-', ' ')}
          </span>
        </div>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', color: '#fff' }}>
          {(user?.name || 'U').substring(0, 2).toUpperCase()}
        </div>
      </div>

      {/* Sidebar backdrop overlay */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <main className="main-content">
        {pages[currentPage] || <Dashboard setCurrentPage={setCurrentPage} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
