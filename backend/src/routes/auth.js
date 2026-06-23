const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Tenant, Employee, AuditLog } = require('../models');
const { authenticateToken, requireRole, logAction, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'hrms_refresh_secret';

// Helper: validate password against tenant policy
function validatePasswordPolicy(password, policy) {
  if (!policy) return { valid: true };
  if (policy.minLength && password.length < policy.minLength) {
    return { valid: false, message: `Password must be at least ${policy.minLength} characters long` };
  }
  if (policy.requireNumbers && !/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (policy.requireSpecial && !/[!@#$%^&*]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }
  return { valid: true };
}

// 1. Tenant & Admin Registration
router.post('/register', async (req, res) => {
  const { companyName, domain, adminName, adminEmail, adminPassword } = req.body;

  if (!companyName || !domain || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({ message: 'All registration fields are required' });
  }

  try {
    const existingTenant = await Tenant.findOne({ domain: domain.toLowerCase() });
    if (existingTenant) {
      return res.status(400).json({ message: 'A company with this domain name is already registered' });
    }

    const existingUser = await Employee.findOne({ email: adminEmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'An employee with this email already exists' });
    }

    const tenant = await Tenant.create({
      name: companyName,
      domain: domain.toLowerCase(),
      mfaEnabled: false,
      passwordPolicy: { minLength: 8, requireSpecial: false, requireNumbers: false },
      settings: {
        departments: ['Engineering', 'HR', 'Product', 'Sales', 'Marketing', 'Finance'],
        locations: ['Headquarters', 'Remote'],
        shifts: [{ name: 'General Shift', start: '09:00', end: '18:00', gracePeriod: 15 }]
      }
    });

    // Validate password policy
    const policyCheck = validatePasswordPolicy(adminPassword, tenant.passwordPolicy);
    if (!policyCheck.valid) {
      return res.status(400).json({ message: policyCheck.message });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const adminEmployee = await Employee.create({
      tenantId: tenant._id,
      employeeId: 'EMP-001',
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'HR/Admin',
      personal: { name: adminName, dob: '', gender: 'Other', photoUrl: '', maritalStatus: 'Single', nationality: '' },
      contact: { personalEmail: adminEmail.toLowerCase(), officialEmail: adminEmail.toLowerCase(), phone: '', currentAddress: '', permanentAddress: '', emergencyContact: { name: '', relation: '', phone: '' } },
      employment: { dateOfJoining: new Date().toISOString().split('T')[0], employmentType: 'Full-time', department: 'HR', designation: 'HR Administrator', grade: 'A', location: 'Headquarters', reportingManagerId: '', shiftName: 'General Shift', status: 'Active' },
      bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '', panNumber: '', aadhaarNumber: '' },
      lockout: { failedAttempts: 0, lockedUntil: null }
    });

    await logAction(
      { tenantId: tenant._id, user: { _id: adminEmployee._id, email: adminEmployee.email }, headers: req.headers, socket: req.socket },
      'TENANT_REGISTRATION',
      { companyName, domain, adminEmail }
    );

    res.status(201).json({
      message: 'Tenant and administrator account registered successfully',
      tenantId: tenant._id,
      adminId: adminEmployee._id
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

// 2. Login with lockout + refresh token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const employee = await Employee.findOne({ email: email.toLowerCase() });
    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (employee.lockout && employee.lockout.lockedUntil) {
      const lockTime = new Date(employee.lockout.lockedUntil);
      if (lockTime > new Date()) {
        const remainingMinutes = Math.ceil((lockTime - new Date()) / 60000);
        return res.status(423).json({ message: `Account is temporarily locked. Please try again in ${remainingMinutes} minutes.` });
      }
    }

    const isMatch = await bcrypt.compare(password, employee.passwordHash);

    if (!isMatch) {
      let attempts = (employee.lockout ? employee.lockout.failedAttempts : 0) + 1;
      let lockedUntil = null;

      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        attempts = 0;
      }

      await Employee.updateOne({ _id: employee._id }, { $set: { 'lockout.failedAttempts': attempts, 'lockout.lockedUntil': lockedUntil } });
      await logAction({ tenantId: employee.tenantId, user: null, headers: req.headers, socket: req.socket }, 'LOGIN_FAILURE', { email: email.toLowerCase(), lockedOut: !!lockedUntil });

      if (lockedUntil) {
        return res.status(423).json({ message: 'Account locked due to 5 consecutive failures. Please try again in 15 minutes.' });
      }
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await Employee.updateOne({ _id: employee._id }, { $set: { 'lockout.failedAttempts': 0, 'lockout.lockedUntil': null } });

    const tenant = await Tenant.findById(employee.tenantId);

    const token = jwt.sign(
      { _id: employee._id, email: employee.email, role: employee.role, tenantId: employee.tenantId, employeeId: employee.employeeId },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
      { _id: employee._id, tenantId: employee.tenantId },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await logAction({ tenantId: employee.tenantId, user: { _id: employee._id, email: employee.email }, headers: req.headers, socket: req.socket }, 'LOGIN_SUCCESS', { name: employee.personal.name });

    res.json({
      token,
      refreshToken,
      user: { _id: employee._id, employeeId: employee.employeeId, email: employee.email, role: employee.role, name: employee.personal.name, photoUrl: employee.personal.photoUrl },
      tenant: { id: tenant._id, name: tenant.name, domain: tenant.domain, settings: tenant.settings }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

// 3. Refresh Token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const employee = await Employee.findById(decoded._id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const newToken = jwt.sign(
      { _id: employee._id, email: employee.email, role: employee.role, tenantId: employee.tenantId, employeeId: employee.employeeId },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const newRefreshToken = jwt.sign(
      { _id: employee._id, tenantId: employee.tenantId },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

// 4. Forgot Password — generate OTP
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const employee = await Employee.findOne({ email: email.toLowerCase() });
    // Always return same message to prevent user enumeration
    if (!employee) {
      return res.json({ message: 'OTP sent to registered email if it exists in our system' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await Employee.updateOne({ _id: employee._id }, { $set: { resetOtp: otp, resetOtpExpiry: expiry } });

    // Log OTP to email outbox (mock)
    console.log(`\n========= [PASSWORD RESET OTP] =========`);
    console.log(`To: ${employee.email}`);
    console.log(`OTP: ${otp} (valid 15 minutes)`);
    console.log(`=========================================\n`);

    await logAction(
      { tenantId: employee.tenantId, user: { _id: employee._id, email: employee.email }, headers: req.headers, socket: req.socket },
      'PASSWORD_RESET_REQUESTED',
      { email: employee.email }
    );

    res.json({ message: 'OTP sent to registered email if it exists in our system' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5. Reset Password using OTP
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' });
  }

  try {
    const employee = await Employee.findOne({ email: email.toLowerCase() });
    if (!employee) {
      return res.status(400).json({ message: 'Invalid OTP or email' });
    }

    if (!employee.resetOtp || employee.resetOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (!employee.resetOtpExpiry || new Date(employee.resetOtpExpiry) < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Validate password policy
    const tenant = await Tenant.findById(employee.tenantId);
    const policyCheck = validatePasswordPolicy(newPassword, tenant ? tenant.passwordPolicy : null);
    if (!policyCheck.valid) {
      return res.status(400).json({ message: policyCheck.message });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await Employee.updateOne(
      { _id: employee._id },
      { $set: { passwordHash, resetOtp: null, resetOtpExpiry: null, 'lockout.failedAttempts': 0, 'lockout.lockedUntil': null } }
    );

    await logAction(
      { tenantId: employee.tenantId, user: { _id: employee._id, email: employee.email }, headers: req.headers, socket: req.socket },
      'PASSWORD_RESET_SUCCESS',
      { email: employee.email }
    );

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 6. Me endpoint
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user._id);
    if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

    const tenant = await Tenant.findById(req.tenantId);

    res.json({
      user: { _id: employee._id, employeeId: employee.employeeId, email: employee.email, role: employee.role, name: employee.personal?.name || '', photoUrl: employee.personal?.photoUrl || '' },
      tenant: { id: tenant._id, name: tenant.name, domain: tenant.domain, settings: tenant.settings }
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ message: 'Server error fetching profile details' });
  }
});

// 7. Audit Logs (Admin only)
router.get('/audit-logs', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  try {
    const logs = await AuditLog.find({ tenantId: req.tenantId });
    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(logs);
  } catch (err) {
    console.error('Fetch logs error:', err);
    res.status(500).json({ message: 'Server error retrieving tenant logs' });
  }
});

module.exports = { router, validatePasswordPolicy };
