const express = require('express');
const PDFDocument = require('pdfkit');
const { Employee, Attendance, LeaveRequest, ApprovalRequest, LeaveBalance, AuditLog } = require('../models');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const { sendNotification } = require('../utils/notify');
const { jsonToCsv } = require('../utils/csv');
const { runEscalationJob } = require('../utils/escalation');

const router = express.Router();

// 1. Dashboard stats (role-scoped)
router.get('/stats', authenticateToken, async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role;
  const tenantId = req.tenantId;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const responseData = { role };

    const ownAttendance = await Attendance.findOne({ employeeId: userId, date: todayStr, tenantId });
    const ownLeaves = await LeaveRequest.find({ employeeId: userId, tenantId });
    const ownBalances = await LeaveBalance.find({ employeeId: userId, tenantId });

    responseData.ess = {
      todayStatus: ownAttendance ? ownAttendance.status : 'Absent',
      punches: ownAttendance ? ownAttendance.punches : [],
      workHours: ownAttendance ? ownAttendance.workHours : 0,
      pendingLeaves: ownLeaves.filter(l => l.status === 'Pending').length,
      balances: ownBalances.map(b => ({ type: b.leaveTypeName, available: b.available, used: b.used }))
    };

    if (role === 'Reporting Manager' || role === 'HR/Admin') {
      const teamQuery = { tenantId, 'employment.reportingManagerId': userId };
      if (role === 'HR/Admin') delete teamQuery['employment.reportingManagerId'];

      const teamEmployees = await Employee.find(teamQuery);
      const teamIds = teamEmployees.map(e => e._id);
      const pendingApprovals = await ApprovalRequest.countDocuments({ tenantId, approverId: userId, status: 'Pending' });
      const teamAttendance = await Attendance.find({ tenantId, date: todayStr, employeeId: { $in: teamIds } });
      const present = teamAttendance.filter(a => ['Present', 'Late'].includes(a.status)).length;
      const late = teamAttendance.filter(a => a.status === 'Late').length;

      responseData.mss = {
        teamSize: teamEmployees.length,
        pendingApprovalsCount: pendingApprovals,
        attendanceToday: { present, late, absent: Math.max(0, teamEmployees.length - present) }
      };
    }

    if (role === 'HR/Admin' || role === 'Leadership') {
      const totalEmployees = await Employee.countDocuments({ tenantId, 'employment.status': { $ne: 'Exited' } });
      const exitedEmployees = await Employee.countDocuments({ tenantId, 'employment.status': 'Exited' });
      const orgAttendance = await Attendance.find({ tenantId, date: todayStr });
      const orgPresent = orgAttendance.filter(a => ['Present', 'Late'].includes(a.status)).length;

      responseData.admin = {
        totalHeadcount: totalEmployees,
        attritionRate: totalEmployees > 0 ? parseFloat(((exitedEmployees / (totalEmployees + exitedEmployees)) * 100).toFixed(1)) : 0,
        activeAttendanceRate: totalEmployees > 0 ? parseFloat(((orgPresent / totalEmployees) * 100).toFixed(1)) : 0
      };
    }

    res.json(responseData);
  } catch (err) {
    console.error('Fetch dashboard stats error:', err);
    res.status(500).json({ message: 'Server error generating dashboard data' });
  }
});

// 2. Pending approvals
router.get('/approvals/pending', authenticateToken, requireRole(['Reporting Manager', 'HR/Admin']), async (req, res) => {
  try {
    const query = { tenantId: req.tenantId, status: 'Pending' };
    if (req.user.role !== 'HR/Admin') query.approverId = req.user._id;

    const requests = await ApprovalRequest.find(query);
    requests.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const employees = await Employee.find({ tenantId: req.tenantId });
    const populated = requests.map(reqObj => {
      const emp = employees.find(e => e._id === reqObj.employeeId);
      return { ...reqObj, employeeName: emp ? emp.personal.name : 'Unknown', employeeIdCode: emp ? emp.employeeId : '' };
    });

    res.json(populated);
  } catch (err) {
    console.error('Fetch approvals error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. Profile Edit approval action
router.post('/approvals/profile-edit/:id/action', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { action, comment } = req.body;
  const approvalId = req.params.id;

  if (!action || !['Approved', 'Rejected'].includes(action)) {
    return res.status(400).json({ message: 'Action must be Approved or Rejected' });
  }

  try {
    const approval = await ApprovalRequest.findOne({ _id: approvalId, tenantId: req.tenantId });
    if (!approval || approval.requestType !== 'PROFILE_EDIT') return res.status(404).json({ message: 'Profile approval request not found' });
    if (approval.status !== 'Pending') return res.status(400).json({ message: 'This approval request has already been finalized' });

    const employee = await Employee.findById(approval.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (action === 'Approved') {
      const proposedChange = approval.details.proposedChange;
      const updateData = {};
      for (let key in proposedChange) updateData[`bank.${key}`] = proposedChange[key];
      await Employee.updateOne({ _id: approval.employeeId }, { $set: updateData });
      await logAction(req, 'PROFILE_EDIT_APPROVED', { employeeId: approval.employeeId, changes: proposedChange });
    } else {
      await logAction(req, 'PROFILE_EDIT_REJECTED', { employeeId: approval.employeeId });
    }

    await ApprovalRequest.updateOne({ _id: approvalId }, { $set: { status: action, comments: comment || '' } });
    await sendNotification(req.tenantId, approval.employeeId, `Profile Edits ${action}`, `Your request to update bank details was ${action.toLowerCase()} by HR.`, 'STATUS_UPDATE');

    res.json({ message: `Sensitive profile edits ${action.toLowerCase()} successfully` });
  } catch (err) {
    console.error('Profile action error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. Run escalation job manually (HR/Admin)
router.post('/run-escalation', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  try {
    const slaHours = parseInt(req.query.slaHours || '24');
    const result = await runEscalationJob(slaHours);
    await logAction(req, 'ESCALATION_JOB_RUN', { slaHours, escalated: result.escalated.length, errors: result.errors.length });
    res.json({ message: `Escalation job complete. ${result.escalated.length} request(s) escalated.`, ...result });
  } catch (err) {
    console.error('Escalation job error:', err);
    res.status(500).json({ message: 'Internal server error running escalation job' });
  }
});

// 5. Reports download — advanced filters + PDF support
router.get('/reports/download', authenticateToken, requireRole(['HR/Admin', 'Leadership']), async (req, res) => {
  const { type, format = 'csv', from, to, department, location, status } = req.query;
  const tenantId = req.tenantId;

  try {
    let reportData = [];
    let columns = [];
    let reportTitle = 'Report';
    let filename = 'report';

    if (type === 'headcount') {
      reportTitle = 'Headcount Report';
      filename = 'headcount_report';
      let query = { tenantId };
      if (department) query['employment.department'] = department;
      if (location) query['employment.location'] = location;
      if (status) query['employment.status'] = status;

      const employees = await Employee.find(query);
      reportData = employees.map(e => ({
        employeeId: e.employeeId,
        name: e.personal.name,
        department: e.employment.department,
        designation: e.employment.designation,
        status: e.employment.status,
        email: e.email,
        dateOfJoining: e.employment.dateOfJoining
      }));
      columns = [
        { label: 'Employee ID', key: 'employeeId' },
        { label: 'Name', key: 'name' },
        { label: 'Department', key: 'department' },
        { label: 'Designation', key: 'designation' },
        { label: 'Status', key: 'status' },
        { label: 'Email', key: 'email' },
        { label: 'Date of Joining', key: 'dateOfJoining' }
      ];

    } else if (type === 'attendance') {
      reportTitle = 'Attendance Summary Report';
      filename = 'attendance_summary_report';
      let attQuery = { tenantId };
      if (from || to) {
        attQuery.date = {};
        if (from) attQuery.date['$gte'] = from;
        if (to) attQuery.date['$lte'] = to;
      }

      const attendance = await Attendance.find(attQuery);
      const empQuery = { tenantId };
      if (department) empQuery['employment.department'] = department;
      if (location) empQuery['employment.location'] = location;
      const employees = await Employee.find(empQuery);
      const empMap = {};
      employees.forEach(e => { empMap[e._id] = e; });

      reportData = attendance
        .filter(att => empMap[att.employeeId])
        .map(att => {
          const emp = empMap[att.employeeId];
          return {
            date: att.date,
            employeeId: emp.employeeId,
            employeeName: emp.personal.name,
            department: emp.employment.department,
            status: att.status,
            workHours: att.workHours,
            overtimeHours: att.overtimeHours
          };
        });
      columns = [
        { label: 'Date', key: 'date' },
        { label: 'Employee ID', key: 'employeeId' },
        { label: 'Employee Name', key: 'employeeName' },
        { label: 'Department', key: 'department' },
        { label: 'Status', key: 'status' },
        { label: 'Hours Worked', key: 'workHours' },
        { label: 'Overtime Hours', key: 'overtimeHours' }
      ];

    } else if (type === 'leave') {
      reportTitle = 'Leave Balance Report';
      filename = 'leave_balances_report';
      const empQuery = { tenantId };
      if (department) empQuery['employment.department'] = department;
      if (location) empQuery['employment.location'] = location;
      const employees = await Employee.find(empQuery);
      const empMap = {};
      employees.forEach(e => { empMap[e._id] = e; });

      const balances = await LeaveBalance.find({ tenantId });
      reportData = balances
        .filter(b => empMap[b.employeeId])
        .map(b => {
          const emp = empMap[b.employeeId];
          return {
            employeeId: emp.employeeId,
            employeeName: emp.personal.name,
            leaveTypeName: b.leaveTypeName,
            allocated: b.allocated,
            used: b.used,
            pending: b.pending,
            available: b.available
          };
        });
      columns = [
        { label: 'Employee ID', key: 'employeeId' },
        { label: 'Employee Name', key: 'employeeName' },
        { label: 'Leave Type', key: 'leaveTypeName' },
        { label: 'Allocated', key: 'allocated' },
        { label: 'Used', key: 'used' },
        { label: 'Pending', key: 'pending' },
        { label: 'Available', key: 'available' }
      ];

    } else if (type === 'overtime') {
      reportTitle = 'Overtime Report';
      filename = 'overtime_report';
      let attQuery = { tenantId, overtimeHours: { $gt: 0 } };
      if (from || to) {
        attQuery.date = {};
        if (from) attQuery.date['$gte'] = from;
        if (to) attQuery.date['$lte'] = to;
      }

      const attendance = await Attendance.find(attQuery);
      const empQuery = { tenantId };
      if (department) empQuery['employment.department'] = department;
      const employees = await Employee.find(empQuery);
      const empMap = {};
      employees.forEach(e => { empMap[e._id] = e; });

      reportData = attendance
        .filter(att => empMap[att.employeeId])
        .map(att => {
          const emp = empMap[att.employeeId];
          return {
            employeeId: emp.employeeId,
            name: emp.personal.name,
            department: emp.employment.department,
            date: att.date,
            workHours: att.workHours,
            overtimeHours: att.overtimeHours
          };
        });
      columns = [
        { label: 'Employee ID', key: 'employeeId' },
        { label: 'Name', key: 'name' },
        { label: 'Department', key: 'department' },
        { label: 'Date', key: 'date' },
        { label: 'Work Hours', key: 'workHours' },
        { label: 'Overtime Hours', key: 'overtimeHours' }
      ];

    } else {
      return res.status(400).json({ message: 'Invalid report type. Use: headcount, attendance, leave, overtime' });
    }

    // --- PDF FORMAT ---
    if (format === 'pdf') {
      const tenant = await require('../models').Tenant.findById(tenantId);
      const tenantName = tenant ? tenant.name : 'Organization';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(tenantName, { align: 'center' });
      doc.fontSize(13).font('Helvetica').text(reportTitle, { align: 'center' });
      doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1);

      // Table header
      const colWidth = Math.floor((doc.page.width - 80) / columns.length);
      let x = 40;
      let y = doc.y;

      doc.fontSize(8).font('Helvetica-Bold');
      columns.forEach(col => {
        doc.text(col.label, x, y, { width: colWidth, align: 'left' });
        x += colWidth;
      });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.font('Helvetica').fontSize(7);
      reportData.forEach((row, idx) => {
        if (doc.y > doc.page.height - 60) { doc.addPage(); }
        x = 40;
        y = doc.y;
        columns.forEach(col => {
          const val = String(row[col.key] !== undefined ? row[col.key] : '');
          doc.text(val, x, y, { width: colWidth, align: 'left' });
          x += colWidth;
        });
        doc.moveDown(0.4);
      });

      // Footer
      doc.moveDown(1);
      doc.fontSize(7).fillColor('grey').text(`Total records: ${reportData.length} | HRMS Platform`, { align: 'center' });
      doc.end();

    } else {
      // --- CSV FORMAT (default) ---
      // For simple key-based jsonToCsv, flatten reportData first
      const csv = jsonToCsv(reportData, columns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csv);
    }

  } catch (err) {
    console.error('Report export error:', err);
    res.status(500).json({ message: 'Error generating report download' });
  }
});

module.exports = router;
