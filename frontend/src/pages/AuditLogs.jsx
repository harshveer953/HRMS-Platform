import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuditLogs() {
  const { apiCall } = useAuth();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await apiCall('/auth/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  function toggleRow(rowId) {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  }

  if (loading) {
    return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem' }}>Loading immutable audit logs...</div>;
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Compliance Audit Trail</h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Immutable logs of sensitive actions, authentications, and policy adjustments.</p>
        </div>
      </header>

      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem' }}>🛡️ Tenant Activity Log</h3>
        
        <div className="table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator Email</th>
                <th>Action Code</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No system events logged in this tenant workspace.</td>
                </tr>
              ) : (
                logs.map(log => {
                  const isExpanded = expandedRow === log._id;
                  const dateStr = new Date(log.createdAt).toLocaleString();
                  
                  return (
                    <React.Fragment key={log._id}>
                      <tr onClick={() => toggleRow(log._id)} style={{ cursor: 'pointer' }}>
                        <td>{dateStr}</td>
                        <td><strong>{log.userEmail}</strong></td>
                        <td>
                          <span className={`badge ${badgeStyle(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td><code>{log.ipAddress}</code></td>
                        <td style={{ color: '#6366f1' }}>
                          {isExpanded ? '▼ Collapse' : '▶ Expand'}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="5" style={expandedCellDetailStyle}>
                            <div className="animate-fade-in" style={detailBoxStyle}>
                              <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>Event Metadata Details:</div>
                              <pre style={preCodeStyle}>{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helpers for badges styling
function badgeStyle(action) {
  if (action.includes('SUCCESS') || action.includes('CREATE')) return 'badge-success';
  if (action.includes('FAILURE') || action.includes('REJECTED')) return 'badge-danger';
  if (action.includes('REQUESTED') || action.includes('EDIT')) return 'badge-warning';
  return 'badge-info';
}

// Styles
const expandedCellDetailStyle = {
  background: 'rgba(0,0,0,0.25)',
  padding: '1.25rem 2rem',
};

const detailBoxStyle = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '10px',
  padding: '1rem',
};

const preCodeStyle = {
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  color: '#a855f7',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
};
