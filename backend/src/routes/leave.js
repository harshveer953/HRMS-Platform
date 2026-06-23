const express = require('express');
const { LeaveRequest, LeaveBalance, LeaveType, Attendance, Employee, ApprovalRequest, Holiday } = require('../models');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

// Helper: Get all dates between two strings (inclusive)
function getDatesInRange(startDateStr, endDateStr) {
  const dates = [];
  let current = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (current > end) return [];
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Helper: Get working days excluding weekends and holidays
function getWorkingDays(startDate, endDate, holidayDates = []) {
  const allDates = getDatesInRange(startDate, endDate);
  return allDates.filter(dateStr => {
    const d = new Date(dateStr);
    const day = d.getDay();
    if (day === 0 || day === 6) return false; // Sunday=0, Saturday=6
    if (holidayDates.includes(dateStr)) return false;
    return true;
  }).length;
}

// Helper: Resolve effective approver (check delegation)
async function resolveApprover(managerId, tenantId) {
  if (!managerId) return managerId;
  const manager = await Employee.findById(managerId);
  if (!manager || !manager.delegation || !manager.delegation.active) return managerId;

  const today = new Date().toISOString().split('T')[0];
  const { delegateTo, from, to } = manager.delegation;
  if (delegateTo && from && to && today >= from && today <= to) {
    // Verify delegate exists in same tenant
    const delegate = await Employee.findOne({ _id: delegateTo, tenantId });
    if (delegate) return delegateTo;
  }
  return managerId;
}

// 1. Fetch Leave Types
router.get('/types', authenticateToken, async (req, res) => {
  try {
    let types = await LeaveType.find({ tenantId: req.tenantId });
    if (types.length === 0) {
      const defaults = [
        { name: 'Casual Leave', annualEntitlement: 12, accrualRules: 'Monthly', carryForwardLimit: 5, maxConsecutiveDays: 5 },
        { name: 'Sick Leave', annualEntitlement: 12, accrualRules: 'Monthly', carryForwardLimit: 5, maxConsecutiveDays: 3 },
        { name: 'Earned Leave', annualEntitlement: 18, accrualRules: 'Yearly', carryForwardLimit: 15, maxConsecutiveDays: 10 },
        { name: 'Loss of Pay (LOP)', annualEntitlement: 365, accrualRules: 'Monthly', carryForwardLimit: 0, maxConsecutiveDays: 365 }
      ];
      for (let def of defaults) {
        await LeaveType.create({ tenantId: req.tenantId, ...def });
      }
      types = await LeaveType.find({ tenantId: req.tenantId });
    }
    res.json(types);
  } catch (err) {
    console.error('Fetch leave types error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. Fetch Leave Balances
router.get('/balances', authenticateToken, async (req, res) => {
  const targetEmployeeId = req.query.employeeId || req.user._id;
  try {
    let balances = await LeaveBalance.find({ employeeId: targetEmployeeId, tenantId: req.tenantId });
    if (balances.length === 0) {
      const types = await LeaveType.find({ tenantId: req.tenantId });
      for (let t of types) {
        await LeaveBalance.create({ tenantId: req.tenantId, employeeId: targetEmployeeId, leaveTypeName: t.name, allocated: t.annualEntitlement, used: 0, pending: 0, available: t.annualEntitlement });
      }
      balances = await LeaveBalance.find({ employeeId: targetEmployeeId, tenantId: req.tenantId });
    }
    res.json(balances);
  } catch (err) {
    console.error('Fetch leave balances error:', err);
    res.status(500).json({ message: 'Server error retrieving leave balances' });
  }
});

// 3. Apply for Leave (with half-day, working days, multi-level approval)
router.post('/apply', authenticateToken, async (req, res) => {
  const { leaveTypeName, startDate, endDate, reason, halfDay = false, halfDaySlot = null } = req.body;

  if (!leaveTypeName || !startDate || !endDate) {
    return res.status(400).json({ message: 'Leave type, start date, and end date are required' });
  }

  // Half-day validation
  if (halfDay && startDate !== endDate) {
    return res.status(400).json({ message: 'Half day leave must have the same start and end date' });
  }

  try {
    const employee = await Employee.findById(req.user._id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Fetch holidays for working day calculation
    const allHolidays = await Holiday.find({ tenantId: req.tenantId });
    const holidayDates = allHolidays.map(h => h.date);

    // Calculate duration
    let duration;
    if (halfDay) {
      duration = 0.5;
    } else {
      duration = getWorkingDays(startDate, endDate, holidayDates);
      if (duration === 0) {
        return res.status(400).json({ message: 'Selected date range contains no working days (all weekends/holidays)' });
      }
    }

    // Resolve approver with delegation
    let managerId = employee.employment.reportingManagerId;
    if (!managerId) {
      if (employee.role === 'HR/Admin') {
        managerId = employee._id;
      } else {
        return res.status(400).json({ message: 'No reporting manager assigned. Please contact HR.' });
      }
    }
    const effectiveApproverId = await resolveApprover(managerId, req.tenantId);

    // Overlap check
    const existingRequests = await LeaveRequest.find({ employeeId: employee._id, tenantId: req.tenantId, status: { $in: ['Pending', 'Approved'] } });
    const requestedDates = getDatesInRange(startDate, endDate);
    for (let reqObj of existingRequests) {
      const existingDates = getDatesInRange(reqObj.startDate, reqObj.endDate);
      if (requestedDates.some(d => existingDates.includes(d))) {
        return res.status(400).json({ message: `Overlapping leave: You already have a request from ${reqObj.startDate} to ${reqObj.endDate} (${reqObj.status})` });
      }
    }

    // Balance check
    let balance = await LeaveBalance.findOne({ employeeId: employee._id, leaveTypeName, tenantId: req.tenantId });
    if (!balance) {
      const typeDef = await LeaveType.findOne({ tenantId: req.tenantId, name: leaveTypeName });
      balance = await LeaveBalance.create({ tenantId: req.tenantId, employeeId: employee._id, leaveTypeName, allocated: typeDef ? typeDef.annualEntitlement : 12, used: 0, pending: 0, available: typeDef ? typeDef.annualEntitlement : 12 });
    }

    if (leaveTypeName !== 'Loss of Pay (LOP)' && balance.available < duration) {
      return res.status(400).json({ message: `Insufficient balance. Requested: ${duration} days. Available: ${balance.available} days.` });
    }

    // Create Leave Request
    const leaveRequest = await LeaveRequest.create({
      tenantId: req.tenantId, employeeId: employee._id, leaveTypeName,
      startDate, endDate, duration, reason, status: 'Pending', approvals: [],
      halfDay, halfDaySlot
    });

    // Update balance
    await LeaveBalance.updateOne({ _id: balance._id }, { $set: { pending: balance.pending + duration, available: balance.available - duration } });

    // Build multi-level approval chain
    const approvalChain = [{ approverId: effectiveApproverId, level: 1, status: 'Pending', comment: null, updatedAt: null }];
    
    // Level 2: HR/Admin required if duration > 5 days (always add, even if same person — PRD requirement)
    if (duration > 5) {
      const hrAdmins = await Employee.find({ tenantId: req.tenantId, role: 'HR/Admin' });
      const hrAdminId = hrAdmins.length > 0 ? hrAdmins[0]._id : effectiveApproverId;
      // Always push level 2 for long leaves (even if same approver — ensures chain is visible)
      approvalChain.push({ approverId: hrAdminId, level: 2, status: 'Pending', comment: null, updatedAt: null });
    }

    const approval = await ApprovalRequest.create({
      tenantId: req.tenantId, requestType: 'LEAVE', referenceId: leaveRequest._id,
      employeeId: employee._id, approverId: effectiveApproverId, status: 'Pending',
      details: { leaveTypeName, startDate, endDate, duration, reason, halfDay, halfDaySlot },
      comments: '', createdAt: new Date().toISOString(),
      approvalChain, currentLevel: 1
    });

    await sendNotification(req.tenantId, effectiveApproverId, 'New Leave Request', `${employee.personal.name} requested ${duration} day(s) of ${leaveTypeName} from ${startDate} to ${endDate}.`, 'ACTION_REQUIRED', null, 'leaveUpdates');
    await logAction(req, 'LEAVE_APPLY', { leaveRequestId: leaveRequest._id, duration, halfDay });

    res.status(201).json({ message: 'Leave request applied successfully', leaveRequest, approvalId: approval._id });
  } catch (err) {
    console.error('Apply leave error:', err);
    res.status(500).json({ message: 'Internal server error processing leave application' });
  }
});

// 4. My leave requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const list = await LeaveRequest.find({ employeeId: req.user._id, tenantId: req.tenantId });
    list.sort((a, b) => b.startDate.localeCompare(a.startDate));
    res.json(list);
  } catch (err) {
    console.error('Fetch leave history error:', err);
    res.status(500).json({ message: 'Server error retrieving leave logs' });
  }
});

// 5. Approve / Reject Leave (multi-level)
router.post('/requests/:approvalId/action', authenticateToken, requireRole(['Reporting Manager', 'HR/Admin']), async (req, res) => {
  const { action, comment } = req.body;
  const approvalId = req.params.approvalId;

  if (!action || !['Approved', 'Rejected'].includes(action)) {
    return res.status(400).json({ message: 'Action must be Approved or Rejected' });
  }

  try {
    const approval = await ApprovalRequest.findOne({ _id: approvalId, tenantId: req.tenantId });
    if (!approval) return res.status(404).json({ message: 'Approval request not found' });
    if (approval.status !== 'Pending') return res.status(400).json({ message: 'Approval request has already been completed' });

    // Multi-level: check if current user is the approver for current level
    const chain = approval.approvalChain || [];
    const currentLevelEntry = chain.find(c => c.level === (approval.currentLevel || 1));

    const isCurrentApprover = currentLevelEntry && currentLevelEntry.approverId === req.user._id;
    const isAdminOverride = req.user.role === 'HR/Admin';

    if (!isCurrentApprover && !isAdminOverride) {
      return res.status(403).json({ message: `Forbidden: This request is pending Level ${approval.currentLevel || 1} approval. You are not the assigned approver.` });
    }

    const leaveRequest = await LeaveRequest.findById(approval.referenceId);
    if (!leaveRequest) return res.status(404).json({ message: 'Associated Leave Request not found' });

    const duration = leaveRequest.duration;
    const balance = await LeaveBalance.findOne({ employeeId: leaveRequest.employeeId, leaveTypeName: leaveRequest.leaveTypeName, tenantId: req.tenantId });

    if (action === 'Rejected') {
      // Reject immediately at any level
      await LeaveRequest.updateOne({ _id: leaveRequest._id }, { $set: { status: 'Rejected', approvals: [{ approverId: req.user._id, status: 'Rejected', comment, updatedAt: new Date().toISOString() }] } });
      if (balance) {
        await LeaveBalance.updateOne({ _id: balance._id }, { $set: { pending: Math.max(0, balance.pending - duration), available: balance.available + duration } });
      }
      await ApprovalRequest.updateOne({ _id: approvalId }, { $set: { status: 'Rejected', comments: comment || '' } });
      await sendNotification(req.tenantId, leaveRequest.employeeId, 'Leave Request Rejected', `Your leave request for ${duration} day(s) of ${leaveRequest.leaveTypeName} was rejected.`, 'STATUS_UPDATE', null, 'leaveUpdates');
    } else {
      // Approved at current level
      if (chain.length > 0) {
        // Update current level in chain
        const updatedChain = chain.map(c => {
          if (c.level === (approval.currentLevel || 1)) {
            return { ...c, status: 'Approved', comment, updatedAt: new Date().toISOString() };
          }
          return c;
        });

        const nextLevel = (approval.currentLevel || 1) + 1;
        const nextEntry = updatedChain.find(c => c.level === nextLevel);

        if (nextEntry) {
          // Advance to next level
          await ApprovalRequest.updateOne({ _id: approvalId }, { $set: { approvalChain: updatedChain, currentLevel: nextLevel, approverId: nextEntry.approverId } });
          await sendNotification(req.tenantId, nextEntry.approverId, 'Leave Request — Level 2 Approval Needed', `A leave request from ${leaveRequest.employeeId} for ${duration} day(s) of ${leaveRequest.leaveTypeName} needs your approval (Level 2).`, 'ACTION_REQUIRED', null, 'leaveUpdates');
          return res.json({ message: 'Level 1 approved. Request forwarded to Level 2 approver.' });
        }
        // Final level approved
        await ApprovalRequest.updateOne({ _id: approvalId }, { $set: { status: 'Approved', approvalChain: updatedChain, comments: comment || '' } });
      } else {
        await ApprovalRequest.updateOne({ _id: approvalId }, { $set: { status: 'Approved', comments: comment || '' } });
      }

      // Finalize leave
      await LeaveRequest.updateOne({ _id: leaveRequest._id }, { $set: { status: 'Approved', approvals: [{ approverId: req.user._id, status: 'Approved', comment, updatedAt: new Date().toISOString() }] } });

      if (balance) {
        await LeaveBalance.updateOne({ _id: balance._id }, { $set: { pending: Math.max(0, balance.pending - duration), used: balance.used + duration } });
      }

      // Attendance coupling
      const dates = getDatesInRange(leaveRequest.startDate, leaveRequest.endDate);
      const isLop = leaveRequest.leaveTypeName === 'Loss of Pay (LOP)';
      const attStatus = isLop ? 'Absent' : 'On Leave';
      for (let dateStr of dates) {
        let attRecord = await Attendance.findOne({ employeeId: leaveRequest.employeeId, date: dateStr, tenantId: req.tenantId });
        if (!attRecord) {
          await Attendance.create({ tenantId: req.tenantId, employeeId: leaveRequest.employeeId, date: dateStr, punches: [], status: attStatus, workHours: 0, overtimeHours: 0 });
        } else {
          await Attendance.updateOne({ _id: attRecord._id }, { $set: { status: attStatus } });
        }
      }
      await sendNotification(req.tenantId, leaveRequest.employeeId, 'Leave Request Approved', `Your leave for ${duration} day(s) of ${leaveRequest.leaveTypeName} has been approved.`, 'STATUS_UPDATE', null, 'leaveUpdates');
    }

    await logAction(req, `LEAVE_REQUEST_${action.toUpperCase()}`, { leaveRequestId: leaveRequest._id });
    res.json({ message: `Leave request ${action.toLowerCase()} successfully` });
  } catch (err) {
    console.error('Leave action error:', err);
    res.status(500).json({ message: 'Internal server error processing leave action' });
  }
});

// 6. Cancel / Withdraw leave
router.post('/requests/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findOne({ _id: req.params.id, employeeId: req.user._id, tenantId: req.tenantId });
    if (!leaveRequest) return res.status(404).json({ message: 'Leave request not found' });
    if (['Rejected', 'Withdrawn'].includes(leaveRequest.status)) {
      return res.status(400).json({ message: 'Leave request is already rejected or withdrawn' });
    }

    const duration = leaveRequest.duration;
    const balance = await LeaveBalance.findOne({ employeeId: leaveRequest.employeeId, leaveTypeName: leaveRequest.leaveTypeName, tenantId: req.tenantId });

    if (leaveRequest.status === 'Pending') {
      if (balance) await LeaveBalance.updateOne({ _id: balance._id }, { $set: { pending: Math.max(0, balance.pending - duration), available: balance.available + duration } });
      await LeaveRequest.updateOne({ _id: leaveRequest._id }, { $set: { status: 'Withdrawn' } });
      await ApprovalRequest.updateMany({ referenceId: leaveRequest._id, requestType: 'LEAVE', status: 'Pending' }, { $set: { status: 'Rejected', comments: 'Withdrawn by employee' } });
    } else if (leaveRequest.status === 'Approved') {
      if (balance) await LeaveBalance.updateOne({ _id: balance._id }, { $set: { used: Math.max(0, balance.used - duration), available: balance.available + duration } });
      await LeaveRequest.updateOne({ _id: leaveRequest._id }, { $set: { status: 'Withdrawn' } });
      const dates = getDatesInRange(leaveRequest.startDate, leaveRequest.endDate);
      for (let dateStr of dates) {
        const att = await Attendance.findOne({ employeeId: leaveRequest.employeeId, date: dateStr });
        if (att) await Attendance.updateOne({ _id: att._id }, { $set: { status: att.punches.length > 0 ? 'Present' : 'Absent' } });
      }
    }

    const managers = await Employee.find({ tenantId: req.tenantId, role: 'HR/Admin' });
    const notifier = managers[0] ? managers[0]._id : req.user._id;
    await sendNotification(req.tenantId, notifier, 'Leave Request Withdrawn', `Employee ${req.user.email} cancelled their leave request.`, 'INFO');
    await logAction(req, 'LEAVE_WITHDRAWN', { leaveRequestId: leaveRequest._id });

    res.json({ message: 'Leave request withdrawn successfully' });
  } catch (err) {
    console.error('Cancel leave error:', err);
    res.status(500).json({ message: 'Internal server error withdrawing leave' });
  }
});

module.exports = router;
