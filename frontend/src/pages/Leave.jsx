import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Leave() {
  const { user, apiCall } = useAuth();
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [leaveTypeName, setLeaveTypeName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [halfDaySlot, setHalfDaySlot] = useState('First Half');
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  async function fetchData() {
    try {
      const [balRes, reqRes, typeRes] = await Promise.all([
        apiCall('/leave/balances'),
        apiCall('/leave/my-requests'),
        apiCall('/leave/types'),
      ]);
      if (balRes.ok) setBalances(await balRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());
      if (typeRes.ok) {
        const types = await typeRes.json();
        setLeaveTypes(types);
        if (types.length > 0 && !leaveTypeName) setLeaveTypeName(types[0].name);
      }
    } catch (err) { console.error(err); }
  }

  useEffect(() => { setLoading(true); fetchData().finally(() => setLoading(false)); }, []);

  async function handleApply(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    if (halfDay && startDate !== endDate) {
      setMsg({ text: 'Half-day: start and end date must be same', type: 'error' });
      return;
    }
    setApplying(true);
    try {
      const res = await apiCall('/leave/apply', {
        method: 'POST',
        body: { leaveTypeName, startDate, endDate, reason, halfDay, halfDaySlot: halfDay ? halfDaySlot : null }
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `Leave applied! Duration: ${data.leaveRequest.duration} day(s). Sent to manager for approval.`, type: 'success' });
        setStartDate(''); setEndDate(''); setReason(''); setHalfDay(false);
        fetchData();
      } else {
        setMsg({ text: data.message || 'Failed to apply', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'Network error', type: 'error' });
    } finally { setApplying(false); }
  }

  async function handleCancel(id) {
    if (!confirm('Cancel this leave request? Balance will be restored.')) return;
    const res = await apiCall(`/leave/requests/${id}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) { setMsg({ text: 'Leave cancelled. Balance restored.', type: 'success' }); fetchData(); }
    else setMsg({ text: data.message, type: 'error' });
  }

  const statusColor = { Approved: '#10b981', Pending: '#f59e0b', Rejected: '#ef4444', Withdrawn: '#64748b' };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading leave data...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Leave & Time-Off</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Apply for leave, track balances, view history.</p>
        </div>
      </header>

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {balances.map(b => (
          <div key={b._id} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>{b.leaveTypeName}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{b.available}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>days available</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Allocated: {b.allocated}</span>
              <span>Used: {b.used}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="responsive-grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }}>
        {/* Apply Form */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>🌴 Apply for Leave</h3>
          {msg.text && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {msg.text}
            </div>
          )}
          <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Leave Type</label>
              <select className="form-select" value={leaveTypeName} onChange={e => setLeaveTypeName(e.target.value)}>
                {leaveTypes.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
              </select>
            </div>

            {/* Half-day toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.12)' }}>
              <input type="checkbox" id="halfDay" checked={halfDay} onChange={e => setHalfDay(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="halfDay" style={{ color: '#c4c9d4', fontSize: '0.9rem', cursor: 'pointer' }}>Half-day leave</label>
              {halfDay && (
                <select className="form-select" style={{ marginLeft: 'auto', width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} value={halfDaySlot} onChange={e => setHalfDaySlot(e.target.value)}>
                  <option>First Half</option>
                  <option>Second Half</option>
                </select>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" required value={startDate} onChange={e => { setStartDate(e.target.value); if (halfDay) setEndDate(e.target.value); }} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" required value={endDate} disabled={halfDay} onChange={e => setEndDate(e.target.value)} style={halfDay ? { opacity: 0.5 } : {}} />
              </div>
            </div>

            {halfDay && startDate && (
              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.82rem', textAlign: 'center' }}>
                Half-day on {startDate} ({halfDaySlot}) — 0.5 day deducted
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea className="form-textarea" style={{ height: '80px' }} required placeholder="Brief reason for leave..." value={reason} onChange={e => setReason(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary" disabled={applying || !startDate || !endDate}>
              {applying ? 'Submitting...' : 'Submit Leave Application'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>📅 My Applications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '520px', overflowY: 'auto' }}>
            {requests.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No leave requests yet.</p>
            ) : (
              [...requests].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(req => (
                <div key={req._id} style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{req.leaveTypeName}{req.halfDay ? ' (Half-day)' : ''}</strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px', background: `${statusColor[req.status]}20`, color: statusColor[req.status] }}>{req.status}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {req.startDate} → {req.endDate} · <strong>{req.duration} day(s)</strong>
                    {req.halfDaySlot && ` · ${req.halfDaySlot}`}
                  </div>
                  {req.reason && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem', fontStyle: 'italic' }}>"{req.reason}"</div>}
                  {['Pending', 'Approved'].includes(req.status) && (
                    <button onClick={() => handleCancel(req._id)} style={{ marginTop: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', borderRadius: '6px', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                      Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
