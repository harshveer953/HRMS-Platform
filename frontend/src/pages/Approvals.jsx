import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const TYPE_ICONS = { LEAVE: '🌴', REGULARIZATION: '⏰', PROFILE_EDIT: '👤' };
const TYPE_LABELS = { LEAVE: 'Leave Request', REGULARIZATION: 'Attendance Correction', PROFILE_EDIT: 'Profile Edit' };

export default function Approvals() {
  const { user, apiCall } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [comments, setComments] = useState({});
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState('');

  async function fetchApprovals() {
    const res = await apiCall('/dashboard/approvals/pending');
    if (res.ok) setApprovals(await res.json());
  }

  useEffect(() => { setLoading(true); fetchApprovals().finally(() => setLoading(false)); }, []);

  async function handleAction(approval, action) {
    setActing(approval._id + action);
    const comment = comments[approval._id] || '';

    let endpoint = '';
    if (approval.requestType === 'LEAVE') endpoint = `/leave/requests/${approval._id}/action`;
    else if (approval.requestType === 'REGULARIZATION') endpoint = `/attendance/regularize/${approval._id}/action`;
    else if (approval.requestType === 'PROFILE_EDIT') endpoint = `/dashboard/approvals/profile-edit/${approval._id}/action`;

    const res = await apiCall(endpoint, { method: 'POST', body: { action, comment } });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message || `${action} successfully`);
      setComments(c => { const n = { ...c }; delete n[approval._id]; return n; });
      fetchApprovals();
    } else {
      setMsg(data.message || 'Action failed');
    }
    setActing('');
    setTimeout(() => setMsg(''), 4000);
  }

  async function runEscalation() {
    const res = await apiCall('/dashboard/run-escalation', { method: 'POST' });
    const data = await res.json();
    setMsg(data.message || 'Escalation complete');
    fetchApprovals();
    setTimeout(() => setMsg(''), 4000);
  }

  const filtered = approvals.filter(a => filter === 'all' || a.requestType === filter);

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading approvals...</div>;

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Approvals Panel</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
            {approvals.length} pending request{approvals.length !== 1 ? 's' : ''} awaiting your action
          </p>
        </div>
        {user?.role === 'HR/Admin' && (
          <button onClick={runEscalation} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            ⚡ Run SLA Escalation
          </button>
        )}
      </header>

      {msg && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', background: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? '#f87171' : '#34d399', border: '1px solid rgba(255,255,255,0.06)' }}>
          {msg}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'LEAVE', 'REGULARIZATION', 'PROFILE_EDIT'].map(f => {
          const count = f === 'all' ? approvals.length : approvals.filter(a => a.requestType === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? 'rgba(99,102,241,0.15)' : 'none',
              border: filter === f ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.06)',
              color: filter === f ? '#fff' : '#94a3b8',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem'
            }}>
              {f === 'all' ? 'All' : TYPE_LABELS[f]} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <p>No pending approvals. You're all caught up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map(approval => (
            <div key={approval._id} className="glass-card">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{TYPE_ICONS[approval.requestType]}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{TYPE_LABELS[approval.requestType]}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {approval.employeeName || approval.employeeId} · {approval.employeeIdCode}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    PENDING
                  </span>
                  {approval.createdAt && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                      {new Date(approval.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.83rem', color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {approval.requestType === 'LEAVE' && <>
                  <span><strong style={{ color: '#fff' }}>Type:</strong> {approval.details?.leaveTypeName}</span>
                  <span><strong style={{ color: '#fff' }}>From:</strong> {approval.details?.startDate}</span>
                  <span><strong style={{ color: '#fff' }}>To:</strong> {approval.details?.endDate}</span>
                  <span><strong style={{ color: '#fff' }}>Days:</strong> {approval.details?.duration}</span>
                  {approval.details?.halfDay && <span><strong style={{ color: '#818cf8' }}>Half-day</strong> ({approval.details?.halfDaySlot})</span>}
                  {approval.details?.reason && <span><strong style={{ color: '#fff' }}>Reason:</strong> {approval.details?.reason}</span>}
                </>}
                {approval.requestType === 'REGULARIZATION' && <>
                  <span><strong style={{ color: '#fff' }}>Date:</strong> {approval.details?.date}</span>
                  <span><strong style={{ color: '#fff' }}>In:</strong> {approval.details?.punchInCorrection}</span>
                  <span><strong style={{ color: '#fff' }}>Out:</strong> {approval.details?.punchOutCorrection}</span>
                  <span><strong style={{ color: '#fff' }}>Reason:</strong> {approval.details?.reason}</span>
                </>}
                {approval.requestType === 'PROFILE_EDIT' && <>
                  <span><strong style={{ color: '#fff' }}>Field:</strong> {approval.details?.field}</span>
                  <span><strong style={{ color: '#fff' }}>Changes:</strong> {JSON.stringify(approval.details?.proposedChange)}</span>
                </>}
              </div>

              {/* Multi-level chain indicator */}
              {approval.approvalChain && approval.approvalChain.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                  {approval.approvalChain.map((c, i) => (
                    <React.Fragment key={i}>
                      <div style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: c.status === 'Approved' ? 'rgba(16,185,129,0.15)' : c.level === approval.currentLevel ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: c.status === 'Approved' ? '#10b981' : c.level === approval.currentLevel ? '#f59e0b' : '#64748b' }}>
                        L{c.level}: {c.status}
                      </div>
                      {i < approval.approvalChain.length - 1 && <span style={{ color: '#64748b' }}>→</span>}
                    </React.Fragment>
                  ))}
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Current: Level {approval.currentLevel}</span>
                </div>
              )}

              {/* Comment + Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.85rem' }}
                    placeholder="Add comment (optional)..."
                    value={comments[approval._id] || ''}
                    onChange={e => setComments(c => ({ ...c, [approval._id]: e.target.value }))}
                  />
                </div>
                <button
                  onClick={() => handleAction(approval, 'Approved')}
                  disabled={!!acting}
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', borderRadius: '8px', padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  {acting === approval._id + 'Approved' ? 'Processing...' : '✓ Approve'}
                </button>
                <button
                  onClick={() => handleAction(approval, 'Rejected')}
                  disabled={!!acting}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: '8px', padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  {acting === approval._id + 'Rejected' ? 'Processing...' : '✗ Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
