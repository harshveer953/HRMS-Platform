import React from 'react';

export default function OrgChart({ employees }) {
  // 1. Group employees by manager
  const managerMap = {};
  const allIds = new Set(employees.map(e => e.id));
  const roots = [];

  employees.forEach(emp => {
    const mgrId = emp.managerId;
    if (!mgrId || !allIds.has(mgrId)) {
      roots.push(emp);
    } else {
      if (!managerMap[mgrId]) {
        managerMap[mgrId] = [];
      }
      managerMap[mgrId].push(emp);
    }
  });

  // Recursive tree node renderer
  function renderNode(emp) {
    const children = managerMap[emp.id] || [];
    const hasChildren = children.length > 0;

    return (
      <div key={emp.id} style={nodeWrapperStyle}>
        {/* Node Card */}
        <div style={cardStyle} className="glass-card">
          <div style={avatarStyle}>
            {emp.name.substring(0, 2).toUpperCase()}
          </div>
          <h4 style={nameStyle}>{emp.name}</h4>
          <div style={desigStyle}>{emp.designation}</div>
          <span style={deptStyle}>{emp.department}</span>
        </div>

        {/* Child level connector lines and sub-tree */}
        {hasChildren && (
          <div style={childrenWrapperStyle}>
            <div style={verticalLineStyle} />
            <div style={rowStyle}>
              {children.map(child => renderNode(child))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (employees.length === 0) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No organizational hierarchy records to display.</div>;
  }

  return (
    <div style={wrapperStyle}>
      <div style={scrollContainerStyle}>
        <div style={treeContainerStyle}>
          {roots.map(root => renderNode(root))}
        </div>
      </div>
    </div>
  );
}

// Custom CSS-in-JS for hierarchy layout mapping
const wrapperStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '16px',
  padding: '2.5rem',
  overflow: 'hidden',
  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
};

const scrollContainerStyle = {
  overflowX: 'auto',
  paddingBottom: '1rem',
  display: 'flex',
  justifyContent: 'center',
};

const treeContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2.5rem',
  minWidth: 'max-content',
};

const nodeWrapperStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
};

const cardStyle = {
  padding: '1.25rem 1.75rem',
  background: 'rgba(30, 41, 59, 0.55)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
  textAlign: 'center',
  minWidth: '220px',
  position: 'relative',
  zIndex: 10,
};

const avatarStyle = {
  width: '45px',
  height: '45px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 0.75rem auto',
  fontWeight: '700',
  fontSize: '0.95rem',
  boxShadow: '0 0 15px rgba(99, 102, 241, 0.25)',
};

const nameStyle = {
  fontSize: '1rem',
  color: '#fff',
  fontWeight: '600',
  marginBottom: '0.25rem',
};

const desigStyle = {
  fontSize: '0.8rem',
  color: '#6366f1',
  fontWeight: '500',
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const deptStyle = {
  fontSize: '0.75rem',
  color: '#94a3b8',
  background: 'rgba(255,255,255,0.04)',
  padding: '0.2rem 0.6rem',
  borderRadius: '20px',
};

const childrenWrapperStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
  width: '100%',
  marginTop: '1.5rem',
};

const verticalLineStyle = {
  position: 'absolute',
  top: '-1.5rem',
  width: '2px',
  height: '1.5rem',
  background: 'rgba(99, 102, 241, 0.25)',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: '2.5rem',
  position: 'relative',
  paddingTop: '1rem',
  borderTop: '2px solid rgba(99, 102, 241, 0.15)',
};
