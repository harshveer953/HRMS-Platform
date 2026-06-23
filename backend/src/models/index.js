const db = require('../db/db');

const TenantSchema = {
  name: { type: String, required: true },
  domain: { type: String, required: true },
  mfaEnabled: { type: Boolean, default: false },
  passwordPolicy: {
    minLength: { type: Number, default: 8 },
    requireSpecial: { type: Boolean, default: false },
    requireNumbers: { type: Boolean, default: false }
  },
  settings: {
    departments: { type: Array, default: ['Engineering', 'HR', 'Product', 'Sales', 'Marketing', 'Finance'] },
    locations: { type: Array, default: ['Headquarters', 'Remote', 'London Office', 'New York Office'] },
    shifts: {
      type: Array,
      default: [
        { name: 'General Shift', start: '09:00', end: '18:00', gracePeriod: 15 },
        { name: 'Night Shift', start: '22:00', end: '06:00', gracePeriod: 15 }
      ]
    }
  }
};

const EmployeeSchema = {
  tenantId: { type: String, required: true },
  employeeId: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'Employee' },
  personal: {
    name: { type: String, required: true },
    dob: { type: String },
    gender: { type: String },
    photoUrl: { type: String },
    maritalStatus: { type: String },
    nationality: { type: String }
  },
  contact: {
    personalEmail: { type: String },
    officialEmail: { type: String },
    phone: { type: String },
    currentAddress: { type: String },
    permanentAddress: { type: String },
    emergencyContact: { name: { type: String }, relation: { type: String }, phone: { type: String } }
  },
  employment: {
    dateOfJoining: { type: String },
    employmentType: { type: String, default: 'Full-time' },
    department: { type: String },
    designation: { type: String },
    grade: { type: String },
    location: { type: String },
    reportingManagerId: { type: String },
    shiftName: { type: String, default: 'General Shift' },
    status: { type: String, default: 'Active' }
  },
  bank: {
    accountName: { type: String },
    accountNumber: { type: String },
    bankName: { type: String },
    ifscCode: { type: String },
    panNumber: { type: String },
    aadhaarNumber: { type: String }
  },
  professional: {
    education: { type: Array, default: [] },
    experience: { type: Array, default: [] },
    skills: { type: Array, default: [] },
    certifications: { type: Array, default: [] }
  },
  documents: { type: Array, default: [] },
  lockout: {
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: String }
  },
  // NEW: Password reset OTP
  resetOtp: { type: String, default: null },
  resetOtpExpiry: { type: String, default: null },
  // NEW: Delegation
  delegation: {
    delegateTo: { type: String, default: null },
    from: { type: String, default: null },
    to: { type: String, default: null },
    active: { type: Boolean, default: false }
  },
  // NEW: Notification Preferences
  notificationPrefs: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    leaveUpdates: { type: Boolean, default: true },
    attendanceAlerts: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true }
  },
  // NEW: Lifecycle history
  lifecycleHistory: { type: Array, default: [] }
};

const AttendanceSchema = {
  tenantId: { type: String, required: true },
  employeeId: { type: String, required: true },
  date: { type: String, required: true },
  punches: { type: Array, default: [] },
  status: { type: String, default: 'Absent' },
  workHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  regularization: {
    requested: { type: Boolean, default: false },
    status: { type: String },
    reason: { type: String },
    punchInCorrection: { type: String },
    punchOutCorrection: { type: String },
    managerComment: { type: String }
  }
};

const LeaveTypeSchema = {
  tenantId: { type: String, required: true },
  name: { type: String, required: true },
  annualEntitlement: { type: Number, default: 12 },
  accrualRules: { type: String, default: 'Monthly' },
  carryForwardLimit: { type: Number, default: 5 },
  maxConsecutiveDays: { type: Number, default: 10 }
};

const LeaveBalanceSchema = {
  tenantId: { type: String, required: true },
  employeeId: { type: String, required: true },
  leaveTypeName: { type: String, required: true },
  allocated: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  pending: { type: Number, default: 0 },
  available: { type: Number, default: 0 }
};

const LeaveRequestSchema = {
  tenantId: { type: String, required: true },
  employeeId: { type: String, required: true },
  leaveTypeName: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  duration: { type: Number, required: true },
  reason: { type: String },
  status: { type: String, default: 'Pending' },
  approvals: { type: Array, default: [] },
  // NEW: Half day support
  halfDay: { type: Boolean, default: false },
  halfDaySlot: { type: String, default: null }
};

const ApprovalRequestSchema = {
  tenantId: { type: String, required: true },
  requestType: { type: String, required: true },
  referenceId: { type: String, required: true },
  employeeId: { type: String, required: true },
  approverId: { type: String, required: true },
  status: { type: String, default: 'Pending' },
  details: { type: Object, default: {} },
  comments: { type: String },
  createdAt: { type: String },
  // NEW: Multi-level approval chain
  approvalChain: { type: Array, default: [] },
  currentLevel: { type: Number, default: 1 }
};

const AuditLogSchema = {
  tenantId: { type: String, required: true },
  userId: { type: String },
  userEmail: { type: String },
  action: { type: String, required: true },
  ipAddress: { type: String },
  details: { type: Object, default: {} }
};

const NotificationSchema = {
  tenantId: { type: String, required: true },
  employeeId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'INFO' },
  isRead: { type: Boolean, default: false }
};

// NEW: Holiday Schema
const HolidaySchema = {
  tenantId: { type: String, required: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  location: { type: String, default: '' },
  type: { type: String, default: 'National' }
};

const Tenant = db.model('Tenant', TenantSchema);
const Employee = db.model('Employee', EmployeeSchema);
const Attendance = db.model('Attendance', AttendanceSchema);
const LeaveType = db.model('LeaveType', LeaveTypeSchema);
const LeaveBalance = db.model('LeaveBalance', LeaveBalanceSchema);
const LeaveRequest = db.model('LeaveRequest', LeaveRequestSchema);
const ApprovalRequest = db.model('ApprovalRequest', ApprovalRequestSchema);
const AuditLog = db.model('AuditLog', AuditLogSchema);
const Notification = db.model('Notification', NotificationSchema);
const Holiday = db.model('Holiday', HolidaySchema);

module.exports = {
  Tenant, Employee, Attendance, LeaveType, LeaveBalance,
  LeaveRequest, ApprovalRequest, AuditLog, Notification, Holiday
};
