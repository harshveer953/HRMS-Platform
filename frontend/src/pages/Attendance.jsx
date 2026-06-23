import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { Present: '#10b981', Late: '#f59e0b', 'Half-day': '#f59e0b', Absent: '#ef4444', 'On Leave': '#6366f1', 'Week Off': '#64748b' };

export default function Attendance() {
  const { user, apiCall } = useAuth();
  const isAdminOrMgr = user?.role === 'HR/Admin' || user?.role === 'Reporting Manager';
  const isAdmin = user?.role === 'HR/Admin';

  const [activeTab, setActiveTab] = useState('today');
  const [todayRec, setTodayRec] = useState(null);
  const [history, setHistory] = useState([]);
  const [teamAtt, setTeamAtt] = useState([]);
  const [muster, setMuster] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState('');

  // Regularization
  const [regDate, setRegDate] = useState('');
  const [regIn, setRegIn] = useState('');
  const [regOut, setRegOut] = useState('');
  const [regReason, setRegReason] = useState('');
  const [regMsg, setRegMsg] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);

  // Muster/Team filters
  const [teamDate, setTeamDate] = useState(new Date().toISOString().split('T')[0]);
  const [musterMonth, setMusterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Shift management
  const [editShifts, setEditShifts] = useState(false);
  const [shiftDraft, setShiftDraft] = useState([]);

  const today = new Date().toISOString().split('T')[0];

  async function fetchAll() {
    setLoading(true);
    try {
      const [todayRes, histRes] = await Promise.all([
        apiCall('/attendance/today'),
        apiCall('/attendance/my-history'),
      ]);
      if (todayRes.ok) setTodayRec(await todayRes.json());
      if (histRes.ok) setHistory(await histRes.json());

      if (isAdminOrMgr) {
        const [teamRes, shiftRes] = await Promise.all([
          apiCall(`/attendance/team?date=${teamDate}`),
          apiCall('/attendance/shifts'),
        ]);
        if (teamRes.ok) setTeamAtt(await teamRes.json());
        if (shiftRes.ok) { const s = await shiftRes.json(); setShifts(s); setShiftDraft(JSON.parse(JSON.stringify(s))); }
      }
      if (isAdmin) {
        const musterRes = await apiCall(`/attendance/muster?month=${musterMonth}`);
        if (musterRes.ok) setMuster(await musterRes.json());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (activeTab === 'team' && isAdminOrMgr) {
      apiCall(`/attendance/team?date=${teamDate}`).then(r => r.ok && r.json().then(setTeamAtt));
    }
    if (activeTab === 'muster' && isAdmin) {
      apiCall(`/attendance/muster?month=${musterMonth}`).then(r => r.ok && r.json().then(setMuster));
    }
  }, [teamDate, musterMonth, activeTab]);

  async function doPunch(type) {
    setPunching(true); setPunchMsg('');
    const doReq = async (location) => {
      const res = await apiCall('/attendance/punch', { method: 'POST', body: { type, location } });
      const d = await res.json();
      setPunchMsg(res.ok ? d.message : (d.message || 'Punch failed'));
      if (res.ok) fetchAll();
      setPunching(false);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => doReq({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => doReq({ lat: 0, lng: 0 }),
        { timeout: 5000 }
      );
    } else doReq({ lat: 0, lng: 0 });
  }

  async function submitRegularization(e) {
    e.preventDefault();
    setSubmitting(true); setRegMsg({ text: '', type: '' });
    const res = await apiCall('/attendance/regularize', {
      method: 'POST',
      body: { date: regDate, punchInCorrection: regIn, punchOutCorrection: regOut, reason: regReason }
    });
    const d = await res.json();
    if (res.ok) { setRegMsg({ text: 'Regularization submitted! Awaiting manager approval.', type: 'success' }); setRegDate(''); setRegIn(''); setRegOut(''); setRegReason(''); }
    else setRegMsg({ text: d.message || 'Error', type: 'error' });
    setSubmitting(false);
  }

  async function saveShifts() {
    const res = await apiCall('/attendance/shifts', { method: 'PUT', body: { shifts: shiftDraft } });
    if (res.ok) { setShifts(shiftDraft); setEditShifts(false); alert('Shifts saved!'); }
  }

  const hasIn = todayRec?.punches?.some(p => p.type === 'IN');
  const hasOut = todayRec?.punches?.slice().reverse().find(p => p.type === 'IN') &&
    todayRec?.punches?.slice().reverse()[0]?.type === 'OUT';
  const lastIn = todayRec?.punches?.slice().reverse().find(p => p.type === 'IN');
  const lastOut = todayRec?.punches?.slice().reverse().find(p => p.type === 'OUT');

  const TABS = [
    { id: 'today', label: '📍 Today' },
    { id: 'history', label: '📅 My History' },
    { id: 'regularize', label: '✏️ Regularize' },
    ...(isAdminOrMgr ? [{ id: 'team', label: '👥 Team View' }] : []),
    ...(isAdmin ? [{ id: 'muster', label: '📋 Muster Register' }, { id: 'shifts', label: '⚙️ Shift Config' }] : []),
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading attendance...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Track punches, view history, raise corrections.</p>
        </div>
      </header>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab === t.id ? 'rgba(99,102,241,0.15)' : 'none',
            border: activeTab === t.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: activeTab === t.id ? '#fff' : '#94a3b8',
            padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem'
          }}>{t.label}</button>
        ))}
      </div>

      {/* TODAY TAB */}
      {activeTab === 'today' && (
        <div className="responsive-grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem' }}>Today — {today}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: STATUS_COLORS[todayRec?.status] || '#64748b', flexShrink: 0, boxShadow: `0 0 10px ${STATUS_COLORS[todayRec?.status] || '#64748b'}` }} />
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>{todayRec?.status || 'Not Punched'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Punch In', value: lastIn ? new Date(lastIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
                { label: 'Punch Out', value: lastOut ? new Date(lastOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
                { label: 'Work Hours', value: todayRec?.workHours ? `${todayRec.workHours}h` : '—' },
                { label: 'Overtime', value: todayRec?.overtimeHours > 0 ? `${todayRec.overtimeHours}h` : '—' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {punchMsg && (
              <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.83rem', background: punchMsg.includes('failed') || punchMsg.includes('error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: punchMsg.includes('failed') || punchMsg.includes('error') ? '#f87171' : '#34d399' }}>
                {punchMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => doPunch('IN')} disabled={punching || (hasIn && !hasOut)} className="btn btn-primary" style={{ flex: 1, opacity: (hasIn && !hasOut) ? 0.5 : 1 }}>
                {punching ? '...' : '🟢 Punch IN'}
              </button>
              <button onClick={() => doPunch('OUT')} disabled={punching || !hasIn || hasOut} style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: '10px', padding: '0.75rem', cursor: (!hasIn || hasOut) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (!hasIn || hasOut) ? 0.5 : 1 }}>
                {punching ? '...' : '🔴 Punch OUT'}
              </button>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>Punch Log</h3>
            {(!todayRec?.punches || todayRec.punches.length === 0) ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No punches recorded today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {todayRec.punches.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: p.type === 'IN' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)', color: p.type === 'IN' ? '#10b981' : '#f87171' }}>{p.type}</span>
                      <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {p.location?.lat !== 0 ? `📍 ${p.location.lat?.toFixed(4)}, ${p.location.lng?.toFixed(4)}` : 'No GPS'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>My Attendance History</h3>
          {history.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>No attendance records yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Date', 'Status', 'Punch In', 'Punch Out', 'Hours', 'OT'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map(rec => {
                    const pIn = rec.punches?.find(p => p.type === 'IN');
                    const pOut = rec.punches?.slice().reverse().find(p => p.type === 'OUT');
                    return (
                      <tr key={rec._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{rec.date}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '20px', background: `${STATUS_COLORS[rec.status] || '#64748b'}20`, color: STATUS_COLORS[rec.status] || '#64748b' }}>{rec.status}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{pIn ? new Date(pIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{pOut ? new Date(pOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{rec.workHours > 0 ? `${rec.workHours}h` : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: rec.overtimeHours > 0 ? '#f59e0b' : '#64748b' }}>{rec.overtimeHours > 0 ? `+${rec.overtimeHours}h` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REGULARIZE TAB */}
      {activeTab === 'regularize' && (
        <div className="responsive-grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem' }}>✏️ Request Attendance Correction</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Missed a punch or incorrect timing? Submit a correction request for manager approval.
            </p>
            {regMsg.text && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.83rem', background: regMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: regMsg.type === 'success' ? '#34d399' : '#f87171' }}>
                {regMsg.text}
              </div>
            )}
            <form onSubmit={submitRegularization} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Date to Correct</label>
                <input type="date" className="form-input" required value={regDate} onChange={e => setRegDate(e.target.value)} max={today} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Correct Punch In</label>
                  <input type="time" className="form-input" value={regIn} onChange={e => setRegIn(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correct Punch Out</label>
                  <input type="time" className="form-input" value={regOut} onChange={e => setRegOut(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-textarea" style={{ height: '80px' }} required placeholder="Explain why correction is needed..." value={regReason} onChange={e => setRegReason(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Correction Request'}</button>
            </form>
          </div>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>Recent Regularizations</h3>
            {history.filter(r => r.regularization?.requested).length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No correction requests yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {history.filter(r => r.regularization?.requested).reverse().slice(0, 8).map(rec => (
                  <div key={rec._id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{rec.date}</strong>
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: rec.regularization.status === 'Approved' ? 'rgba(16,185,129,0.15)' : rec.regularization.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: rec.regularization.status === 'Approved' ? '#10b981' : rec.regularization.status === 'Rejected' ? '#f87171' : '#f59e0b' }}>{rec.regularization.status}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{rec.regularization.reason}</div>
                    {rec.regularization.managerComment && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', fontStyle: 'italic' }}>Manager: "{rec.regularization.managerComment}"</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEAM VIEW TAB */}
      {activeTab === 'team' && isAdminOrMgr && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>Team Attendance</h3>
            <input type="date" className="form-input" style={{ width: 'auto' }} value={teamDate} onChange={e => setTeamDate(e.target.value)} />
          </div>
          {teamAtt.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No team records for this date.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Employee', 'Department', 'Status', 'In', 'Out', 'Hours', 'OT'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamAtt.map(row => {
                    const pIn = row.attendance?.punches?.find(p => p.type === 'IN');
                    const pOut = row.attendance?.punches?.slice().reverse().find(p => p.type === 'OUT');
                    return (
                      <tr key={row.employeeId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{row.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.empIdCode}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>{row.department || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '20px', background: `${STATUS_COLORS[row.attendance?.status] || '#64748b'}20`, color: STATUS_COLORS[row.attendance?.status] || '#64748b' }}>
                            {row.attendance?.status || 'Absent'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{pIn ? new Date(pIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{pOut ? new Date(pOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{row.attendance?.workHours > 0 ? `${row.attendance.workHours}h` : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: row.attendance?.overtimeHours > 0 ? '#f59e0b' : '#64748b' }}>{row.attendance?.overtimeHours > 0 ? `+${row.attendance.overtimeHours}h` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MUSTER REGISTER TAB */}
      {activeTab === 'muster' && isAdmin && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>Monthly Muster Register</h3>
            <input type="month" className="form-input" style={{ width: 'auto' }} value={musterMonth} onChange={e => setMusterMonth(e.target.value)} />
          </div>
          {muster.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No records for this month.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'left', position: 'sticky', left: 0, background: '#0f1420' }}>Employee</th>
                    <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>P</th>
                    <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>L</th>
                    <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>A</th>
                    <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>OT hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {muster.map(emp => {
                    const recs = emp.attendance || [];
                    const present = recs.filter(r => r.status === 'Present').length;
                    const late = recs.filter(r => r.status === 'Late').length;
                    const absent = recs.filter(r => r.status === 'Absent').length;
                    const ot = recs.reduce((s, r) => s + (r.overtimeHours || 0), 0);
                    return (
                      <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.65rem 0.75rem', position: 'sticky', left: 0, background: '#0f1420' }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{emp.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{emp.employeeId}</div>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{present + late}</td>
                        <td style={{ padding: '0.65rem', textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>{late}</td>
                        <td style={{ padding: '0.65rem', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{absent}</td>
                        <td style={{ padding: '0.65rem', textAlign: 'center', color: ot > 0 ? '#f59e0b' : '#64748b' }}>{ot.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SHIFT CONFIG TAB */}
      {activeTab === 'shifts' && isAdmin && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>⚙️ Shift Configuration</h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {editShifts ? (
                <>
                  <button onClick={() => { setShiftDraft(JSON.parse(JSON.stringify(shifts))); setEditShifts(false); }} className="btn btn-secondary">Cancel</button>
                  <button onClick={saveShifts} className="btn btn-primary">Save Shifts</button>
                </>
              ) : (
                <button onClick={() => setEditShifts(true)} className="btn btn-secondary">Edit Shifts</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {shiftDraft.map((shift, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'center', padding: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Shift Name</label>
                  <input className="form-input" style={{ fontSize: '0.85rem' }} disabled={!editShifts} value={shift.name} onChange={e => { const d = [...shiftDraft]; d[i] = { ...d[i], name: e.target.value }; setShiftDraft(d); }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Start</label>
                  <input type="time" className="form-input" disabled={!editShifts} value={shift.start} onChange={e => { const d = [...shiftDraft]; d[i] = { ...d[i], start: e.target.value }; setShiftDraft(d); }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>End</label>
                  <input type="time" className="form-input" disabled={!editShifts} value={shift.end} onChange={e => { const d = [...shiftDraft]; d[i] = { ...d[i], end: e.target.value }; setShiftDraft(d); }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Grace (min)</label>
                  <input type="number" className="form-input" disabled={!editShifts} value={shift.gracePeriod} onChange={e => { const d = [...shiftDraft]; d[i] = { ...d[i], gracePeriod: parseInt(e.target.value) }; setShiftDraft(d); }} />
                </div>
                {editShifts && (
                  <button onClick={() => setShiftDraft(shiftDraft.filter((_, idx) => idx !== i))} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer' }}>🗑</button>
                )}
              </div>
            ))}
            {editShifts && (
              <button onClick={() => setShiftDraft([...shiftDraft, { name: 'New Shift', start: '09:00', end: '18:00', gracePeriod: 15 }])} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>+ Add Shift</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
