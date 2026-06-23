import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Directory() {
  const { user, apiCall } = useAuth();
  const isAdmin = user?.role === 'HR/Admin';
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [loc, setLoc] = useState('');
  const [status, setStatus] = useState('Active');
  const [selected, setSelected] = useState(null);

  // Lifecycle modal
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [lcType, setLcType] = useState('Promotion');
  const [lcDate, setLcDate] = useState('');
  const [lcDesig, setLcDesig] = useState('');
  const [lcDept, setLcDept] = useState('');
  const [lcLoc, setLcLoc] = useState('');
  const [lcNotes, setLcNotes] = useState('');
  const [lcMsg, setLcMsg] = useState('');

  // Exit modal
  const [showExit, setShowExit] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [exitReason, setExitReason] = useState('');

  // Create employee
  const [showCreate, setShowCreate] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', email: '', password: 'Welcome@123', role: 'Employee', department: '', designation: '', location: '' });
  const [createMsg, setCreateMsg] = useState('');

  async function fetchEmployees() {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (dept) params.append('department', dept);
    if (loc) params.append('location', loc);
    if (status) params.append('status', status);
    const res = await apiCall(`/employees?${params}`);
    if (res.ok) setEmployees(await res.json());
  }

  useEffect(() => { setLoading(true); fetchEmployees().finally(() => setLoading(false)); }, [search, dept, loc, status]);

  async function handleCreate(e) {
    e.preventDefault();
    const res = await apiCall('/employees', { method: 'POST', body: newEmp });
    const d = await res.json();
    if (res.ok) { setCreateMsg('Employee created!'); setNewEmp({ name: '', email: '', password: 'Welcome@123', role: 'Employee', department: '', designation: '', location: '' }); fetchEmployees(); }
    else setCreateMsg(d.message || 'Error creating employee');
  }

  async function handleLifecycle(e) {
    e.preventDefault();
    const res = await apiCall(`/employees/${selected._id}/lifecycle`, {
      method: 'POST',
      body: { eventType: lcType, effectiveDate: lcDate, newDesignation: lcDesig || undefined, newDepartment: lcDept || undefined, newLocation: lcLoc || undefined, notes: lcNotes }
    });
    const d = await res.json();
    if (res.ok) { setLcMsg('Event recorded!'); fetchEmployees(); setTimeout(() => { setShowLifecycle(false); setLcMsg(''); }, 1500); }
    else setLcMsg(d.message || 'Error');
  }

  async function handleExit(e) {
    e.preventDefault();
    const res = await apiCall(`/employees/${selected._id}/exit`, { method: 'POST', body: { exitDate, exitReason } });
    if (res.ok) { setShowExit(false); fetchEmployees(); alert('Employee exited successfully'); }
  }

  async function exportCSV() {
    const res = await apiCall('/employees/bulk-export');
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'employees.csv'; a.click(); a.remove();
    }
  }

  const depts = [...new Set(employees.map(e => e.employment?.department).filter(Boolean))];
  const locs = [...new Set(employees.map(e => e.employment?.location).filter(Boolean))];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading directory...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Employee Directory</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>{employees.length} employees found</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={exportCSV} className="btn btn-secondary">📥 Export CSV</button>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Add Employee</button>
          </div>
        )}
      </header>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 2, minWidth: '180px', marginBottom: 0 }}>
          <label className="form-label">Search</label>
          <input className="form-input" placeholder="Name, email, ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: 0 }}>
          <label className="form-label">Department</label>
          <select className="form-select" value={dept} onChange={e => setDept(e.target.value)}>
            <option value="">All</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: 0 }}>
          <label className="form-label">Location</label>
          <select className="form-select" value={loc} onChange={e => setLoc(e.target.value)}>
            <option value="">All</option>
            {locs.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '110px', marginBottom: 0 }}>
          <label className="form-label">Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="Active">Active</option>
            <option value="Exited">Exited</option>
          </select>
        </div>
      </div>

      {/* Employee Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {employees.map(emp => (
          <div key={emp._id} className="glass-card" style={{ padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.2s', border: selected?._id === emp._id ? '1px solid rgba(99,102,241,0.4)' : undefined }} onClick={() => setSelected(selected?._id === emp._id ? null : emp)}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: '#fff', flexShrink: 0 }}>
                {(emp.personal?.name || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.personal?.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{emp.employment?.designation || emp.role}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{emp.employment?.department} · {emp.employeeId}</div>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: '20px', background: emp.employment?.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: emp.employment?.status === 'Active' ? '#10b981' : '#f87171', flexShrink: 0 }}>
                {emp.employment?.status || 'Active'}
              </span>
            </div>

            {selected?._id === emp._id && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
                  <span>📧 {emp.email}</span>
                  <span>📍 {emp.employment?.location || '—'}</span>
                  <span>📅 Joined {emp.employment?.dateOfJoining || '—'}</span>
                  {(emp.professional?.skills || []).length > 0 && <span>🎯 {emp.professional.skills.slice(0, 3).join(', ')}</span>}
                </div>
                {isAdmin && emp.employment?.status !== 'Exited' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={e => { e.stopPropagation(); setShowLifecycle(true); }} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>Lifecycle Event</button>
                    <button onClick={e => { e.stopPropagation(); setShowExit(true); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>Exit Employee</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Employee Modal */}
      {showCreate && isAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3>Add New Employee</h3>
              <button onClick={() => { setShowCreate(false); setCreateMsg(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>
            {createMsg && <div style={{ marginBottom: '1rem', padding: '0.65rem', borderRadius: '8px', background: createMsg.includes('created') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: createMsg.includes('created') ? '#34d399' : '#f87171', fontSize: '0.85rem' }}>{createMsg}</div>}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[['Full Name','name','text',true],['Email','email','email',true],['Password','password','password',true],['Department','department','text',false],['Designation','designation','text',false],['Location','location','text',false]].map(([label,key,type,req]) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type} required={req} value={newEmp[key]} onChange={e => setNewEmp(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={newEmp.role} onChange={e => setNewEmp(p => ({ ...p, role: e.target.value }))}>
                  <option>Employee</option>
                  <option>Reporting Manager</option>
                  <option>HR/Admin</option>
                  <option>Leadership</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Create Employee</button>
            </form>
          </div>
        </div>
      )}

      {/* Lifecycle Modal */}
      {showLifecycle && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3>Lifecycle Event — {selected.personal?.name}</h3>
              <button onClick={() => setShowLifecycle(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>
            {lcMsg && <div style={{ marginBottom: '1rem', color: lcMsg.includes('!') ? '#34d399' : '#f87171', fontSize: '0.85rem' }}>{lcMsg}</div>}
            <form onSubmit={handleLifecycle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Event Type</label>
                <select className="form-select" value={lcType} onChange={e => setLcType(e.target.value)}>
                  {['Promotion','Transfer','Department Change','Role Change'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Effective Date</label><input type="date" className="form-input" required value={lcDate} onChange={e => setLcDate(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">New Designation (optional)</label><input className="form-input" value={lcDesig} onChange={e => setLcDesig(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">New Department (optional)</label><input className="form-input" value={lcDept} onChange={e => setLcDept(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">New Location (optional)</label><input className="form-input" value={lcLoc} onChange={e => setLcLoc(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={lcNotes} onChange={e => setLcNotes(e.target.value)} /></div>
              <button type="submit" className="btn btn-primary">Record Event</button>
            </form>
          </div>
        </div>
      )}

      {/* Exit Modal */}
      {showExit && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3>Exit Employee — {selected.personal?.name}</h3>
              <button onClick={() => setShowExit(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>
            <form onSubmit={handleExit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Exit Date</label><input type="date" className="form-input" required value={exitDate} onChange={e => setExitDate(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Reason</label><textarea className="form-textarea" style={{ height: '80px' }} required value={exitReason} onChange={e => setExitReason(e.target.value)} /></div>
              <button type="submit" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: '10px', padding: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Confirm Exit</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
