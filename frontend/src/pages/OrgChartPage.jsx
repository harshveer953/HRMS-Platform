import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import OrgChart from '../components/OrgChart';

export default function OrgChartPage() {
  const { apiCall } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  async function fetchOrgChart() {
    setLoading(true);
    try {
      const res = await apiCall('/org/chart');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Org chart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgChart();
  }, []);

  // Get unique departments for filter
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  // Filter employees based on search and dept
  const filtered = employees.filter(emp => {
    const matchSearch = !searchTerm ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = !selectedDept || emp.department === selectedDept;
    return matchSearch && matchDept;
  });

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Organization Chart</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
            Visual hierarchy of your organization — reporting chains, teams, and structure.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#64748b', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.4rem 0.85rem', borderRadius: '8px' }}>
            👥 {employees.length} Active Members
          </span>
          <button onClick={fetchOrgChart} className="btn"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '0.85rem' }}>
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* Filter Row */}
      <div style={filterRowStyle}>
        <div style={searchBoxStyle}>
          <span style={searchIconStyle}>🔍</span>
          <input
            type="text"
            placeholder="Search by name or designation..."
            className="form-input"
            style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, color: '#fff', fontFamily: 'Outfit, sans-serif' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ width: '200px' }}
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Dept Summary Badges */}
      {!loading && departments.length > 0 && (
        <div style={deptSummaryStyle}>
          {departments.map(dept => {
            const count = employees.filter(e => e.department === dept).length;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(selectedDept === dept ? '' : dept)}
                style={selectedDept === dept ? activeDeptBadge : deptBadge}
              >
                {dept} <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Org Chart Visualization */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌳</div>
          Loading organizational hierarchy...
        </div>
      ) : (
        <>
          {(searchTerm || selectedDept) && filtered.length !== employees.length && (
            <div style={filterInfoStyle}>
              📌 Showing {filtered.length} of {employees.length} members
              <button
                onClick={() => { setSearchTerm(''); setSelectedDept(''); }}
                style={clearFilterBtn}
              >
                Clear filters ×
              </button>
            </div>
          )}
          <OrgChart employees={filtered} />
        </>
      )}
    </div>
  );
}

// Styles
const filterRowStyle = {
  display: 'flex',
  gap: '1rem',
  marginBottom: '1.25rem',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const searchBoxStyle = {
  flex: 1,
  minWidth: '240px',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '0.65rem 1rem',
};

const searchIconStyle = {
  fontSize: '1rem',
  flexShrink: 0,
};

const deptSummaryStyle = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '1.5rem',
  flexWrap: 'wrap',
};

const deptBadge = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#94a3b8',
  padding: '0.3rem 0.85rem',
  borderRadius: '20px',
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif',
  transition: 'all 0.2s',
};

const activeDeptBadge = {
  ...deptBadge,
  background: 'rgba(99,102,241,0.15)',
  border: '1px solid rgba(99,102,241,0.3)',
  color: '#a5b4fc',
  fontWeight: '600',
};

const filterInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  fontSize: '0.82rem',
  color: '#94a3b8',
  marginBottom: '1rem',
};

const clearFilterBtn = {
  background: 'none',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  padding: '0.2rem 0.65rem',
  borderRadius: '6px',
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif',
};
