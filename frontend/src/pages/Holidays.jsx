import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const HOLIDAY_TYPES = ['National', 'Regional', 'Optional'];

export default function Holidays() {
  const { user, apiCall } = useAuth();
  const isAdmin = user?.role === 'HR/Admin';

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('National');

  async function fetchHolidays() {
    setLoading(true);
    try {
      const params = filterLocation ? `?location=${encodeURIComponent(filterLocation)}` : '';
      const res = await apiCall(`/holidays${params}`);
      if (res.ok) {
        const data = await res.json();
        data.sort((a, b) => a.date.localeCompare(b.date));
        setHolidays(data);
      }
    } catch (err) {
      console.error('Fetch holidays error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHolidays(); }, [filterLocation]);

  async function handleAddHoliday(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiCall('/holidays', {
        method: 'POST',
        body: { name, date, location, type }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Holiday "${name}" added successfully!`);
        setName(''); setDate(''); setLocation(''); setType('National');
        setShowForm(false);
        fetchHolidays();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        alert(data.message || 'Failed to add holiday');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id, holidayName) {
    if (!window.confirm(`Delete holiday "${holidayName}"?`)) return;
    try {
      const res = await apiCall(`/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg(`Holiday deleted.`);
        fetchHolidays();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete holiday');
      }
    } catch (err) {
      alert('Network error');
    }
  }

  // Group by month
  const grouped = holidays.reduce((acc, h) => {
    const month = h.date.substring(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {});

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function getMonthLabel(ym) {
    const [year, month] = ym.split('-');
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  function typeColor(t) {
    if (t === 'National') return { bg: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: 'rgba(99,102,241,0.25)' };
    if (t === 'Regional') return { bg: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: 'rgba(16,185,129,0.25)' };
    return { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' };
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">🗓️ Holiday Calendar</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
            Company-wide holiday schedule — public holidays, regional closures, and optional leaves.
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}
          >
            {showForm ? '✕ Cancel' : '＋ Add Holiday'}
          </button>
        )}
      </header>

      {/* Success Banner */}
      {successMsg && (
        <div style={successBannerStyle} className="animate-fade-in">
          ✅ {successMsg}
        </div>
      )}

      {/* Add Holiday Form (Admin only) */}
      {isAdmin && showForm && (
        <div className="glass-card animate-fade-in" style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem', fontSize: '1rem' }}>📌 New Holiday Entry</h3>
          <form onSubmit={handleAddHoliday} className="holiday-form">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Holiday Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Independence Day"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {HOLIDAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Location (leave blank for all locations)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Mumbai — or leave blank for company-wide"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowForm(false)} style={cancelBtnStyle}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Adding...' : '✓ Add Holiday'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter bar */}
      <div style={filterBarStyle}>
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>📍 Filter by location:</span>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Remote, Mumbai..."
          value={filterLocation}
          onChange={e => setFilterLocation(e.target.value)}
          style={{ maxWidth: '220px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
        />
        {filterLocation && (
          <button onClick={() => setFilterLocation('')} style={clearBtnStyle}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.85rem' }}>
          {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '4rem' }}>Loading holidays...</div>
      ) : holidays.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
          <p>No holidays found. {isAdmin ? 'Add the first holiday above.' : 'Check back later.'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([month, items]) => (
          <div key={month} style={{ marginBottom: '2rem' }}>
            <div style={monthHeaderStyle}>{getMonthLabel(month)}</div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {items.map(holiday => {
                const tc = typeColor(holiday.type);
                return (
                  <div key={holiday._id} className="holiday-row glass-card">
                    {/* Date Badge */}
                    <div style={dateBadgeStyle}>
                      <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', lineHeight: 1 }}>
                        {holiday.date.split('-')[2]}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        {formatDate(holiday.date).split(' ')[0]}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>{holiday.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                        {formatDate(holiday.date)}
                        {holiday.location && ` · 📍 ${holiday.location}`}
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div style={{ ...typeBadgeBase, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                      {holiday.type}
                    </div>

                    {/* Delete (admin only) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(holiday._id, holiday.name)}
                        style={deleteBtnStyle}
                        title="Delete holiday"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Styles
const successBannerStyle = {
  background: 'rgba(16,185,129,0.1)',
  border: '1px solid rgba(16,185,129,0.25)',
  color: '#6ee7b7',
  padding: '0.75rem 1rem',
  borderRadius: '10px',
  fontSize: '0.85rem',
  marginBottom: '1.5rem',
};

const filterBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  marginBottom: '1.75rem',
  flexWrap: 'wrap',
};

const clearBtnStyle = {
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.2)',
  color: '#f87171',
  borderRadius: '8px',
  padding: '0.4rem 0.75rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const monthHeaderStyle = {
  fontSize: '0.8rem',
  fontWeight: '700',
  color: '#6366f1',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.75rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid rgba(99,102,241,0.15)',
};



const dateBadgeStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '52px',
  minWidth: '52px',
  height: '52px',
  borderRadius: '12px',
  background: 'rgba(99,102,241,0.12)',
  border: '1px solid rgba(99,102,241,0.2)',
};

const typeBadgeBase = {
  fontSize: '0.72rem',
  fontWeight: '600',
  padding: '0.3rem 0.7rem',
  borderRadius: '6px',
  whiteSpace: 'nowrap',
};

const deleteBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  opacity: 0.5,
  transition: 'opacity 0.2s',
  padding: '0.25rem',
};

const cancelBtnStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#94a3b8',
  padding: '0.6rem 1.25rem',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontFamily: 'Outfit, sans-serif',
};
