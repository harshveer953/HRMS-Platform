import React, { useState } from 'react';
import { useAuth, API_BASE } from '../context/AuthContext';

const REPORTS = [
  { type: 'headcount', label: 'Headcount & Roster', icon: '📊', desc: 'Active employees, departments, locations, joining dates.' },
  { type: 'attendance', label: 'Attendance Summary', icon: '⏰', desc: 'Daily punch logs, work hours, overtime, late/absent statuses.' },
  { type: 'leave', label: 'Leave Balances', icon: '🌴', desc: 'Allocated, used, pending, available leave per employee.' },
  { type: 'overtime', label: 'Overtime Report', icon: '🕐', desc: 'Employees with overtime hours, filtered by date range.' },
];

export default function Reports() {
  const { token } = useAuth();
  const [downloading, setDownloading] = useState('');
  const [filters, setFilters] = useState({ from: '', to: '', department: '', location: '', status: '' });
  const [format, setFormat] = useState('csv');
  const [msg, setMsg] = useState('');

  async function triggerDownload(type) {
    setDownloading(type);
    setMsg('');
    try {
      const params = new URLSearchParams({ type, format });
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.department) params.append('department', filters.department);
      if (filters.location) params.append('location', filters.location);
      if (filters.status) params.append('status', filters.status);

      const res = await fetch(`${API_BASE}/dashboard/reports/download?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        setMsg(err.message || 'Failed to generate report');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg(`${type} report downloaded successfully!`);
    } catch (err) {
      setMsg('Download failed. Check console for details.');
    } finally {
      setDownloading('');
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Export workforce reports in CSV or PDF with advanced filters.</p>
        </div>
      </header>

      {/* Filters Panel */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🔧 Report Filters (optional)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <input className="form-input" placeholder="e.g. Engineering" value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" placeholder="e.g. Remote" value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Exited">Exited</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Export Format</label>
            <select className="form-select" value={format} onChange={e => setFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>
        {(filters.from || filters.department || filters.location || filters.status) && (
          <button onClick={() => setFilters({ from: '', to: '', department: '', location: '', status: '' })} style={{ marginTop: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
            Clear Filters
          </button>
        )}
      </div>

      {msg && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', background: msg.includes('success') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('success') ? '#34d399' : '#f87171', border: `1px solid ${msg.includes('success') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {msg}
        </div>
      )}

      {/* Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {REPORTS.map(r => (
          <div key={r.type} className="glass-card" style={{ textAlign: 'center', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{r.icon}</div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{r.label}</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.5, flex: 1 }}>{r.desc}</p>
            <button onClick={() => triggerDownload(r.type)} disabled={!!downloading} className="btn btn-primary" style={{ width: '100%' }}>
              {downloading === r.type ? 'Generating...' : `📥 Export ${format.toUpperCase()}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
