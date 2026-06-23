import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function OrgSettings() {
  const { apiCall } = useAuth();
  
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Local additions states
  const [newDept, setNewDept] = useState('');
  const [newLoc, setNewLoc] = useState('');

  // Local shift addition states
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [shiftGrace, setShiftGrace] = useState(15);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await apiCall('/org/settings');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
        setLocations(data.locations || []);
        setShifts(data.shifts || []);
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  // Add department to local list
  function handleAddDept(e) {
    e.preventDefault();
    if (!newDept.trim()) return;
    if (departments.includes(newDept.trim())) {
      alert('Department already exists');
      return;
    }
    setDepartments([...departments, newDept.trim()]);
    setNewDept('');
  }

  // Remove department from local list
  function handleRemoveDept(dept) {
    setDepartments(departments.filter(d => d !== dept));
  }

  // Add location to local list
  function handleAddLoc(e) {
    e.preventDefault();
    if (!newLoc.trim()) return;
    if (locations.includes(newLoc.trim())) {
      alert('Location already exists');
      return;
    }
    setLocations([...locations, newLoc.trim()]);
    setNewLoc('');
  }

  // Remove location from local list
  function handleRemoveLoc(loc) {
    setLocations(locations.filter(l => l !== loc));
  }

  // Add shift to local list
  function handleAddShift(e) {
    e.preventDefault();
    if (!shiftName.trim()) return;
    if (shifts.some(s => s.name.toLowerCase() === shiftName.trim().toLowerCase())) {
      alert('Shift name already exists');
      return;
    }
    const newShiftObj = {
      name: shiftName.trim(),
      start: shiftStart,
      end: shiftEnd,
      gracePeriod: parseInt(shiftGrace) || 0
    };
    setShifts([...shifts, newShiftObj]);
    setShiftName('');
    setShiftStart('09:00');
    setShiftEnd('18:00');
    setShiftGrace(15);
  }

  // Remove shift from local list
  function handleRemoveShift(name) {
    setShifts(shifts.filter(s => s.name !== name));
  }

  // Save configurations to backend
  async function handleSaveSettings() {
    setSaving(true);
    setSuccessMsg('');
    try {
      const res = await apiCall('/org/settings', {
        method: 'PUT',
        body: { departments, locations, shifts }
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('Organization settings saved successfully!');
        fetchSettings();
      } else {
        alert(data.message || 'Failed to update settings');
      }
    } catch (err) {
      alert('Network error saving settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading organization settings...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header className="page-header">
        <div>
          <h1 className="page-title">⚙️ Organization Settings</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
            Configure default departments, work locations, and shifts for this tenant.
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          className="btn btn-primary"
          disabled={saving}
          style={{ width: '180px' }}
        >
          {saving ? 'Saving...' : '✓ Save Config'}
        </button>
      </header>

      {successMsg && (
        <div style={successBannerStyle} className="animate-fade-in">
          ✅ {successMsg}
        </div>
      )}

      <div className="settings-grid">
        {/* Left Column: Depts & Locations */}
        <div style={columnStyle}>
          {/* Departments Card */}
          <div className="glass-card">
            <h3 style={sectionHeaderStyle}>🏢 Departments</h3>
            
            <form onSubmit={handleAddDept} style={addFormStyle}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Finance, QA, Design"
                value={newDept}
                onChange={e => setNewDept(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.20rem' }}>
                ＋ Add
              </button>
            </form>

            <div style={listContainerStyle}>
              {departments.length === 0 ? (
                <span style={emptyTextStyle}>No departments defined.</span>
              ) : (
                departments.map(dept => (
                  <div key={dept} style={itemBadgeStyle}>
                    <span>{dept}</span>
                    <button onClick={() => handleRemoveDept(dept)} style={removeBtnStyle}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Locations Card */}
          <div className="glass-card" style={{ marginTop: '1.5rem' }}>
            <h3 style={sectionHeaderStyle}>📍 Office Locations</h3>
            
            <form onSubmit={handleAddLoc} style={addFormStyle}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Chicago Office, Remote"
                value={newLoc}
                onChange={e => setNewLoc(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.20rem' }}>
                ＋ Add
              </button>
            </form>

            <div style={listContainerStyle}>
              {locations.length === 0 ? (
                <span style={emptyTextStyle}>No locations defined.</span>
              ) : (
                locations.map(loc => (
                  <div key={loc} style={itemBadgeStyle}>
                    <span>{loc}</span>
                    <button onClick={() => handleRemoveLoc(loc)} style={removeBtnStyle}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Shifts */}
        <div style={columnStyle}>
          <div className="glass-card" style={{ height: '100%' }}>
            <h3 style={sectionHeaderStyle}>⏰ Shift Schedules</h3>
            
            {/* Shift creator */}
            <form onSubmit={handleAddShift} style={shiftFormStyle}>
              <div className="form-group">
                <label className="form-label">Shift Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Morning Shift"
                  value={shiftName}
                  onChange={e => setShiftName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={shiftStart}
                    onChange={e => setShiftStart(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={shiftEnd}
                    onChange={e => setShiftEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Grace Period (Minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  value={shiftGrace}
                  onChange={e => setShiftGrace(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                ＋ Add Shift Pattern
              </button>
            </form>

            {/* Shift list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase' }}>
                Active Shifts ({shifts.length})
              </div>
              
              {shifts.length === 0 ? (
                <div style={emptyTextStyle}>No shifts configured yet.</div>
              ) : (
                shifts.map(shift => (
                  <div key={shift.name} style={shiftRowStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>{shift.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        🕒 {shift.start} - {shift.end} (Grace: {shift.gracePeriod}m)
                      </div>
                    </div>
                    <button onClick={() => handleRemoveShift(shift.name)} style={shiftRemoveBtnStyle}>
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Styling tokens
const successBannerStyle = {
  background: 'rgba(16,185,129,0.1)',
  border: '1px solid rgba(16,185,129,0.25)',
  color: '#6ee7b7',
  padding: '0.75rem 1rem',
  borderRadius: '10px',
  fontSize: '0.85rem',
  marginBottom: '1.5rem',
  textAlign: 'center',
};



const columnStyle = {
  display: 'flex',
  flexDirection: 'column',
};

const sectionHeaderStyle = {
  color: '#fff',
  fontSize: '1.05rem',
  fontWeight: '600',
  marginBottom: '1.25rem',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  paddingBottom: '0.5rem',
};

const addFormStyle = {
  display: 'flex',
  gap: '0.75rem',
  marginBottom: '1.25rem',
};

const listContainerStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  padding: '0.5rem 0',
};

const itemBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.4rem 0.75rem',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  fontSize: '0.82rem',
  color: '#fff',
};

const removeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#f87171',
  cursor: 'pointer',
  padding: '0.1rem',
  fontSize: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const emptyTextStyle = {
  color: '#64748b',
  fontSize: '0.82rem',
  fontStyle: 'italic',
};

const shiftFormStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  background: 'rgba(0,0,0,0.15)',
  padding: '1.25rem',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.04)',
};

const shiftRowStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '12px',
  padding: '0.85rem 1rem',
};

const shiftRemoveBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: '0.25rem',
  transition: 'color 0.2s',
  outline: 'none',
  ':hover': {
    color: '#ef4444'
  }
};
