const jwt = require('jsonwebtoken');
const { AuditLog } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'hrms_super_secret_key_123';

// Main Auth verification middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      _id: decoded._id,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
      employeeId: decoded.employeeId
    };
    req.tenantId = decoded.tenantId;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// Role Authorization middleware creator
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Forbidden: This action requires role of [${allowedRoles.join(', ')}]. Current role: ${req.user.role}` 
      });
    }

    next();
  };
}

// Utility to create an immutable Audit Log entry
async function logAction(req, action, details = {}) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await AuditLog.create({
      tenantId: req.tenantId || details.tenantId || 'SYSTEM',
      userId: req.user ? req.user._id : (details.userId || null),
      userEmail: req.user ? req.user.email : (details.userEmail || 'System/Guest'),
      action,
      ipAddress,
      details
    });
  } catch (err) {
    console.error('Audit Log insertion failed:', err);
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  logAction,
  JWT_SECRET
};
