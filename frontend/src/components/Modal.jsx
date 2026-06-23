import React, { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  // Listen for Escape key to close modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} className="animate-fade-in">
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>{title}</h3>
          <button style={closeBtnStyle} onClick={onClose}>&times;</button>
        </div>
        
        {/* Content */}
        <div style={contentStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Inline Styles for custom premium visual appeal
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(5, 8, 16, 0.75)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
};

const modalStyle = {
  background: 'rgba(18, 24, 38, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '20px',
  width: '100%',
  maxWidth: '560px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15)',
  overflow: 'hidden',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.5rem 2rem',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};

const titleStyle = {
  fontSize: '1.25rem',
  fontWeight: '600',
  color: '#fff',
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  fontSize: '1.75rem',
  cursor: 'pointer',
  padding: '0 0.5rem',
  lineHeight: 1,
  transition: 'color 0.2s',
  outline: 'none',
};

const contentStyle = {
  padding: '2rem',
  overflowY: 'auto',
  flex: 1,
};
