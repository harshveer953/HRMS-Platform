const express = require('express');
const { Attendance, Employee, ApprovalRequest, Tenant } = require('../models');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getShiftConfig(tenant, shiftName) {
  const shifts = (tenant && tenant.settings && tenant.settings.shifts) || [];
  const shift = shifts.find(s => s.name === shiftName) || { start: '09:00', end: '18:00', gracePeriod: 15 };
  const [startH, startM] = shift.start.split(':').map(Number);
  const [endH, endM] = shift.end.split(':').map(Number);
  return {
    startMinutes: startH * 60 + startM,
    endMinutes: endH * 60 + endM,
    gracePeriod: shift.gracePeriod || 15,
    standardHours: 9
  };
}

// 1. Punch IN/OUT
router.post('/punch', authenticateToken, async (req, res) => {
  const { type, location, timeStr } = req.body;
  if (!type || !['IN', 'OUT'].includes(type)) {
    return res.status(400).json({ message: 'Punch type must be IN or OUT' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentTime = timeStr || new Date().toISOString();
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const employee = await Employee.findById(req.user._id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const tenant = await Tenant.findById(req.tenantId);
    const shiftName = employee.employment.shiftName || 'General Shift';
    const shiftConfig = getShiftConfig(tenant, shiftName);

    // IP restriction check (if tenant has allowedIPs configured)
    const allowedIPs = tenant && tenant.settings && tenant.settings.allowedIPs;
    if (allowedIPs && allowedIPs.length > 0) {
      const clientIP = ipAddress.replace('::ffff:', '');
      if (!allowedIPs.includes(clientIP)) {
        return res.status(403).json({ message: `Punch blocked: Your IP (${clientIP}) is not in the allowed list.` });
      }
    }

    // GPS geofencing check
    const geofenceEnabled = tenant && tenant.settings && tenant.settings.geofenceEnabled;
    if (geofenceEnabled && location && tenant.settings.officeLocation) {
      const { lat, lng, radius } = tenant.settings.officeLocation;
      const dist = calculateDistance(location.lat, location.lng, lat, lng);
      if (dist > (radius || 200)) {
        return res.status(400).json({ message: `Punch blocked: You are ${Math.round(dist)}m away. Allowed radius: ${radius || 200}m.` });
      }
    }

    let record = await Attendance.findOne({ employeeId: employee._id, date: todayStr, tenantId: req.tenantId });
    if (!record) {
      if (type === 'OUT') return res.status(400).json({ message: 'Must punch IN first before punching OUT' });
      record = await Attendance.create({ tenantId: req.tenantId, employeeId: employee._id, date: todayStr, punches: [], status: 'Absent', workHours: 0, overtimeHours: 0 });
    }

    const lastPunch = record.punches[record.punches.length - 1];
    if (lastPunch && lastPunch.type === type) {
      return res.status(400).json({ message: `Already punched ${type}. Duplicate punch blocked.` });
    }

    const newPunch = { type, time: currentTime, location: location || { lat: 0, lng: 0 }, ipAddress };
    const punches = [...record.punches, newPunch];

    let status = record.status;
    let workHours = record.workHours;
    let overtimeHours = record.overtimeHours;

    if (type === 'IN') {
      const punchDate = new Date(currentTime);
      const inMinutes = punchDate.getHours() * 60 + punchDate.getMinutes();
      status = inMinutes > (shiftConfig.startMinutes + shiftConfig.gracePeriod) ? 'Late' : 'Present';
    } else {
      const lastIn = punches.slice().reverse().find(p => p.type === 'IN');
      if (lastIn) {
        const diffHours = (new Date(currentTime) - new Date(lastIn.time)) / (1000 * 60 * 60);
        workHours = parseFloat((record.workHours + diffHours).toFixed(2));
        if (workHours >= shiftConfig.standardHours) {
          status = status === 'Late' ? 'Late' : 'Present';
          overtimeHours = workHours > shiftConfig.standardHours ? parseFloat((workHours - shiftConfig.standardHours).toFixed(2)) : 0;
        } else if (workHours >= 4) {
          status = 'Half-day';
          overtimeHours = 0;
        } else {
          status = 'Absent';
          overtimeHours = 0;
        }
      }
    }

    await Attendance.updateOne({ _id: record._id }, { $set: { punches, status, workHours, overtimeHours } });
    await logAction(req, `ATTENDANCE_PUNCH_${type}`, { date: todayStr, punchTime: currentTime });

    res.json({ message: `Punched ${type} successfully`, punches, status, workHours, overtimeHours });
  } catch (err) {
    console.error('Punch error:', err);
    res.status(500).json({ message: 'Internal server error during punch' });
  }
});

// 2. Today's status
router.get('/today', authenticateToken, async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    const record = await Attendance.findOne({ employeeId: req.user._id, date: todayStr, tenantId: req.tenantId });
    res.json(record || { date: todayStr, punches: [], status: 'Absent', workHours: 0, overtimeHours: 0 });
  } catch (err) {
    console.error('Today attendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. My attendance for a specific date (fixes test: /attendance/my-attendance?date=)
router.get('/my-attendance', authenticateToken, async (req, res) => {
  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const record = await Attendance.findOne({ employeeId: req.user._id, date: dateStr, tenantId: req.tenantId });
    res.json(record || { date: dateStr, punches: [], status: 'Absent', workHours: 0, overtimeHours: 0 });
  } catch (err) {
    console.error('My attendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. Personal history
router.get('/my-history', authenticateToken, async (req, res) => {
  try {
    const records = await Attendance.find({ employeeId: req.user._id, tenantId: req.tenantId });
    records.sort((a, b) => a.date.localeCompare(b.date));
    res.json(records);
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 5. Team attendance
router.get('/team', authenticateToken, requireRole(['Reporting Manager', 'HR/Admin']), async (req, res) => {
  const queryDate = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const query = { tenantId: req.tenantId };
    if (req.user.role !== 'HR/Admin') query['employment.reportingManagerId'] = req.user._id;
    const team = await Employee.find(query);
    const teamIds = team.map(t => t._id);
    const attendanceRecords = await Attendance.find({ tenantId: req.tenantId, date: queryDate, employeeId: { $in: teamIds } });
    const report = team.map(emp => {
      const record = attendanceRecords.find(r => r.employeeId === emp._id);
      return {
        employeeId: emp._id, empIdCode: emp.employeeId,
        name: emp.personal.name, department: emp.employment.department,
        designation: emp.employment.designation,
        attendance: record || { date: queryDate, punches: [], status: 'Absent', workHours: 0, overtimeHours: 0 }
      };
    });
    res.json(report);
  } catch (err) {
    console.error('Team attendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 6. Monthly muster
router.get('/muster', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const queryMonth = req.query.month || new Date().toISOString().substring(0, 7);
  try {
    const employees = await Employee.find({ tenantId: req.tenantId });
    const attendanceRecords = await Attendance.find({ tenantId: req.tenantId, date: { $regex: `^${queryMonth}` } });
    const muster = employees.map(emp => ({
      id: emp._id, employeeId: emp.employeeId, name: emp.personal.name,
      department: emp.employment.department, designation: emp.employment.designation,
      attendance: attendanceRecords.filter(r => r.employeeId === emp._id)
    }));
    res.json(muster);
  } catch (err) {
    console.error('Muster error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 7. Regularization request
router.post('/regularize', authenticateToken, async (req, res) => {
  const { date, punchInCorrection, punchOutCorrection, reason } = req.body;
  if (!date || !reason) return res.status(400).json({ message: 'Date and reason are required' });

  try {
    const employee = await Employee.findById(req.user._id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    let managerId = employee.employment.reportingManagerId;
    if (!managerId) {
      // Self-approve for HR/Admin
      if (employee.role === 'HR/Admin') managerId = employee._id;
      else return res.status(400).json({ message: 'No reporting manager assigned. Contact HR.' });
    }

    let record = await Attendance.findOne({ employeeId: employee._id, date, tenantId: req.tenantId });
    if (!record) {
      record = await Attendance.create({ tenantId: req.tenantId, employeeId: employee._id, date, punches: [], status: 'Absent', workHours: 0, overtimeHours: 0 });
    }

    if (record.regularization && record.regularization.requested && record.regularization.status === 'Pending') {
      return res.status(400).json({ message: 'A regularization request is already pending for this date.' });
    }

    await Attendance.updateOne({ _id: record._id }, {
      $set: { regularization: { requested: true, status: 'Pending', reason, punchInCorrection: punchInCorrection || '', punchOutCorrection: punchOutCorrection || '', managerComment: '' } }
    });

    const approval = await ApprovalRequest.create({
      tenantId: req.tenantId, requestType: 'REGULARIZATION', referenceId: record._id,
      employeeId: employee._id, approverId: managerId, status: 'Pending',
      details: { date, reason, punchInCorrection: punchInCorrection || 'None', punchOutCorrection: punchOutCorrection || 'None' },
      comments: '', createdAt: new Date().toISOString()
    });

    await sendNotification(req.tenantId, managerId, 'Attendance Regularization Request', `${employee.personal.name} requested correction for ${date}.`, 'ACTION_REQUIRED');
    await logAction(req, 'ATTENDANCE_REGULARIZATION_REQUESTED', { date, approvalId: approval._id });
    res.json({ message: 'Regularization request submitted successfully', approvalId: approval._id });
  } catch (err) {
    console.error('Regularization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 8. Approve/Reject regularization
router.post('/regularize/:approvalId/action', authenticateToken, requireRole(['Reporting Manager', 'HR/Admin']), async (req, res) => {
  const { action, comment } = req.body;
  if (!action || !['Approved', 'Rejected'].includes(action)) {
    return res.status(400).json({ message: 'Action must be Approved or Rejected' });
  }
  try {
    const approval = await ApprovalRequest.findOne({ _id: req.params.approvalId, tenantId: req.tenantId });
    if (!approval) return res.status(404).json({ message: 'Approval not found' });
    if (approval.status !== 'Pending') return res.status(400).json({ message: 'Already processed' });
    if (approval.approverId !== req.user._id && req.user.role !== 'HR/Admin') {
      return res.status(403).json({ message: 'Forbidden: Not your approval' });
    }

    const attRecord = await Attendance.findById(approval.referenceId);
    if (!attRecord) return res.status(404).json({ message: 'Attendance record not found' });

    if (action === 'Approved') {
      const mockPunches = [];
      const dateStr = attRecord.date;
      if (attRecord.regularization.punchInCorrection) {
        mockPunches.push({ type: 'IN', time: `${dateStr}T${attRecord.regularization.punchInCorrection}:00.000Z`, location: { lat: 0, lng: 0 }, ipAddress: 'REGULARIZED' });
      }
      if (attRecord.regularization.punchOutCorrection) {
        mockPunches.push({ type: 'OUT', time: `${dateStr}T${attRecord.regularization.punchOutCorrection}:00.000Z`, location: { lat: 0, lng: 0 }, ipAddress: 'REGULARIZED' });
      }
      let workHours = 8;
      let overtimeHours = 0;
      if (attRecord.regularization.punchInCorrection && attRecord.regularization.punchOutCorrection) {
        const tIn = new Date(`${dateStr}T${attRecord.regularization.punchInCorrection}:00.000Z`);
        const tOut = new Date(`${dateStr}T${attRecord.regularization.punchOutCorrection}:00.000Z`);
        workHours = parseFloat(((tOut - tIn) / (1000 * 60 * 60)).toFixed(2));
        if (workHours > 9) overtimeHours = parseFloat((workHours - 9).toFixed(2));
      }
      await Attendance.updateOne({ _id: attRecord._id }, { $set: { punches: mockPunches, status: 'Present', workHours, overtimeHours, 'regularization.status': 'Approved', 'regularization.managerComment': comment || '' } });
    } else {
      await Attendance.updateOne({ _id: attRecord._id }, { $set: { 'regularization.status': 'Rejected', 'regularization.managerComment': comment || '' } });
    }

    await ApprovalRequest.updateOne({ _id: req.params.approvalId }, { $set: { status: action, comments: comment || '' } });
    await sendNotification(req.tenantId, approval.employeeId, `Regularization ${action}`, `Your correction request for ${approval.details.date} was ${action.toLowerCase()}.`, 'STATUS_UPDATE');
    await logAction(req, `ATTENDANCE_REGULARIZATION_${action.toUpperCase()}`, { attendanceId: attRecord._id });
    res.json({ message: `Regularization ${action.toLowerCase()} successfully` });
  } catch (err) {
    console.error('Regularization action error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 9. Shift configuration (HR/Admin)
router.get('/shifts', authenticateToken, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    res.json(tenant ? (tenant.settings.shifts || []) : []);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/shifts', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { shifts } = req.body;
  if (!Array.isArray(shifts)) return res.status(400).json({ message: 'shifts must be an array' });
  try {
    await Tenant.updateOne({ _id: req.tenantId }, { $set: { 'settings.shifts': shifts } });
    await logAction(req, 'SHIFTS_UPDATED', { count: shifts.length });
    res.json({ message: 'Shifts updated successfully', shifts });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
