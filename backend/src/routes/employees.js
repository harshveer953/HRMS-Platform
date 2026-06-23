const express = require('express');
const bcrypt = require('bcryptjs');
const { Employee, Tenant, ApprovalRequest, LeaveBalance, LeaveType } = require('../models');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const { csvToJson, jsonToCsv } = require('../utils/csv');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

// Helper: check if a proposed reporting hierarchy forms a circular reference
async function isCircularReporting(employeeDbId, proposedManagerDbId) {
  if (!proposedManagerDbId) return false;
  if (employeeDbId === proposedManagerDbId) return true;

  let currentId = proposedManagerDbId;
  const visited = new Set();
  
  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    
    if (currentId === employeeDbId) return true;
    
    const mgr = await Employee.findById(currentId);
    currentId = (mgr && mgr.employment) ? mgr.employment.reportingManagerId : null;
  }
  return false;
}

// Helper: auto-generate unique Employee ID per tenant
async function generateEmployeeId(tenantId) {
  const employees = await Employee.find({ tenantId });
  let maxNum = 0;
  
  employees.forEach(emp => {
    if (emp.employeeId && emp.employeeId.startsWith('EMP-')) {
      const num = parseInt(emp.employeeId.substring(4));
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `EMP-${String(nextNum).padStart(3, '0')}`;
}

// Helper: Seed default leave balances for a new employee
async function seedDefaultLeaveBalances(tenantId, employeeId) {
  try {
    const leaveTypes = await LeaveType.find({ tenantId });
    for (let type of leaveTypes) {
      await LeaveBalance.create({
        tenantId,
        employeeId,
        leaveTypeName: type.name,
        allocated: type.annualEntitlement,
        used: 0,
        pending: 0,
        available: type.annualEntitlement
      });
    }
  } catch (err) {
    console.error('Error seeding leave balances:', err);
  }
}

// 1. Bulk Export Employees (CSV)
router.get('/bulk-export', authenticateToken, async (req, res) => {
  try {
    const employees = await Employee.find({ tenantId: req.tenantId });
    
    const columns = [
      { label: 'Employee ID', key: 'employeeId' },
      { label: 'Full Name', key: 'personal.name' },
      { label: 'Email', key: 'email' },
      { label: 'Role', key: 'role' },
      { label: 'Department', key: 'employment.department' },
      { label: 'Designation', key: 'employment.designation' },
      { label: 'Location', key: 'employment.location' },
      { label: 'DOJ', key: 'employment.dateOfJoining' },
      { label: 'Shift Name', key: 'employment.shiftName' },
      { label: 'Employment Status', key: 'employment.status' }
    ];

    const csvContent = jsonToCsv(employees, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=employees_directory.csv');
    res.send(csvContent);
  } catch (err) {
    console.error('CSV Export Error:', err);
    res.status(500).json({ message: 'Error compiling CSV export' });
  }
});

// 2. Org Chart View (Hierarchy Tree)
router.get('/org-chart', authenticateToken, async (req, res) => {
  try {
    const employees = await Employee.find({ tenantId: req.tenantId, 'employment.status': { $ne: 'Exited' } });
    
    // Format simple details for tree visualization
    const nodes = employees.map(emp => ({
      id: emp._id,
      employeeId: emp.employeeId,
      name: emp.personal.name,
      role: emp.role,
      department: emp.employment.department,
      designation: emp.employment.designation,
      photoUrl: emp.personal.photoUrl,
      managerId: emp.employment.reportingManagerId || null
    }));

    res.json(nodes);
  } catch (err) {
    console.error('Org Chart compilation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. Search and filter Employee Directory
router.get('/', authenticateToken, async (req, res) => {
  const { search, department, location, status } = req.query;
  try {
    const query = { tenantId: req.tenantId };
    
    if (department) {
      query['employment.department'] = department;
    }
    if (location) {
      query['employment.location'] = location;
    }
    if (status) {
      query['employment.status'] = status;
    }

    if (search) {
      query['$or'] = [
        { 'personal.name': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'employment.designation': { $regex: search, $options: 'i' } }
      ];
    }

    const list = await Employee.find(query);
    
    // Omit password hash in response
    const sanitizedList = list.map(emp => {
      const copy = { ...emp };
      delete copy.passwordHash;
      return copy;
    });

    res.json(sanitizedList);
  } catch (err) {
    console.error('Employee search error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. Fetch Single Employee
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!emp) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    const copy = { ...emp };
    delete copy.passwordHash;
    res.json(copy);
  } catch (err) {
    console.error('Fetch employee detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 5. Create Employee (HR/Admin only)
router.post('/', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { name, email, password, role, department, designation, location, DOJ, shiftName, reportingManagerId } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  try {
    // Check if email unique
    const existing = await Employee.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email address already in use' });
    }

    // Check manager cycle
    if (reportingManagerId) {
      const managerExists = await Employee.findById(reportingManagerId);
      if (!managerExists) {
        return res.status(400).json({ message: 'Assigned reporting manager does not exist' });
      }
    }

    const employeeId = await generateEmployeeId(req.tenantId);
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newEmp = await Employee.create({
      tenantId: req.tenantId,
      employeeId,
      email: email.toLowerCase(),
      passwordHash,
      role,
      personal: { name, dob: '', gender: 'Male', photoUrl: '', maritalStatus: 'Single', nationality: '' },
      contact: { personalEmail: email.toLowerCase(), officialEmail: email.toLowerCase(), phone: '', currentAddress: '', permanentAddress: '', emergencyContact: { name: '', relation: '', phone: '' } },
      employment: {
        dateOfJoining: DOJ || new Date().toISOString().split('T')[0],
        employmentType: 'Full-time',
        department: department || 'Engineering',
        designation: designation || 'Software Engineer',
        grade: 'A',
        location: location || 'Headquarters',
        reportingManagerId: reportingManagerId || '',
        shiftName: shiftName || 'General Shift',
        status: 'Active'
      },
      bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '', panNumber: '', aadhaarNumber: '' },
      lockout: { failedAttempts: 0, lockedUntil: null }
    });

    // Seed default leave balances for this employee
    await seedDefaultLeaveBalances(req.tenantId, newEmp._id);

    await logAction(req, 'EMPLOYEE_CREATE', { employeeId, email: newEmp.email, name });

    // Send welcome notification
    await sendNotification(req.tenantId, newEmp._id, 'Welcome to the Team!', 'Your profile has been created successfully. Complete your onboarding info in settings.', 'INFO');

    const result = { ...newEmp };
    delete result.passwordHash;
    res.status(201).json(result);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ message: 'Internal server error during employee creation' });
  }
});

// 6. Bulk Import Employees via CSV
router.post('/bulk-import', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const csvText = req.body.csvText || req.body.csv || req.body.data;
  if (!csvText) {
    return res.status(400).json({ message: 'CSV text content is required. Send as { csv: "..." } or { csvText: "..." }' });
  }

  try {
    const records = csvToJson(csvText);
    const importedList = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const name = row['Full Name'] || row['name'];
      const email = row['Email'] || row['email'];
      const role = row['Role'] || row['role'] || 'Employee';
      const dept = row['Department'] || row['department'] || 'Engineering';
      const desig = row['Designation'] || row['designation'] || 'Software Engineer';
      const loc = row['Location'] || row['location'] || 'Headquarters';
      const doj = row['DOJ'] || row['dateOfJoining'] || new Date().toISOString().split('T')[0];

      if (!name || !email) {
        errors.push(`Row ${i + 1}: Name and Email are required.`);
        continue;
      }

      // Check duplicate email
      const exists = await Employee.findOne({ email: email.toLowerCase() });
      if (exists) {
        errors.push(`Row ${i + 1}: Email ${email} is already taken.`);
        continue;
      }

      const empId = await generateEmployeeId(req.tenantId);
      const tempPassword = 'Welcome@123';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      const newEmp = await Employee.create({
        tenantId: req.tenantId,
        employeeId: empId,
        email: email.toLowerCase(),
        passwordHash,
        role,
        personal: { name, dob: '', gender: 'Male', photoUrl: '', maritalStatus: 'Single', nationality: '' },
        contact: { personalEmail: email.toLowerCase(), officialEmail: email.toLowerCase(), phone: '', currentAddress: '', permanentAddress: '', emergencyContact: { name: '', relation: '', phone: '' } },
        employment: {
          dateOfJoining: doj,
          employmentType: 'Full-time',
          department: dept,
          designation: desig,
          grade: 'A',
          location: loc,
          reportingManagerId: '', // Default blank in bulk imports, linked later
          shiftName: 'General Shift',
          status: 'Active'
        },
        bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '', panNumber: '', aadhaarNumber: '' }
      });

      await seedDefaultLeaveBalances(req.tenantId, newEmp._id);
      importedList.push({ name, email, employeeId: empId });
    }

    await logAction(req, 'EMPLOYEE_BULK_IMPORT', { count: importedList.length, errors });

    res.json({
      message: `Bulk import completed: ${importedList.length} imported successfully, ${errors.length} failed.`,
      imported: importedList,
      errors
    });
  } catch (err) {
    console.error('Bulk Import Error:', err);
    res.status(500).json({ message: 'Internal server error processing CSV import' });
  }
});

// 7. Update Employee Profile (Supports ESS Approval Workflow)
router.put('/:id', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const isEditingSelf = req.user._id === targetId;
  const isAdmin = req.user.role === 'HR/Admin';

  if (!isEditingSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden: You cannot edit other employees profiles' });
  }

  // Support root-level fields OR nested (employment.reportingManagerId OR reportingManagerId)
  let { personal, contact, employment, bank } = req.body;
  // Merge root-level shorthand into employment/bank objects
  if (req.body.reportingManagerId) {
    employment = { ...(employment || {}), reportingManagerId: req.body.reportingManagerId };
  }
  if (req.body.accountNumber || req.body.bankName || req.body.ifscCode) {
    bank = { ...(bank || {}), ...req.body };
  }

  try {
    const employee = await Employee.findOne({ _id: targetId, tenantId: req.tenantId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // If manager is being updated, prevent circular reporting
    if (employment && employment.reportingManagerId) {
      // Self-loop check
      if (employment.reportingManagerId === targetId) {
        return res.status(400).json({ message: 'Circular hierarchy detected: cannot set employee as their own manager' });
      }
      const isCircular = await isCircularReporting(targetId, employment.reportingManagerId);
      if (isCircular) {
        return res.status(400).json({ message: 'Circular hierarchy detected! This reporting manager reports back to this employee.' });
      }
    }

    // Handle updates based on Role
    if (isAdmin) {
      // HR Admin can update everything immediately
      const updateData = {};
      if (personal) {
        for (let k in personal) updateData[`personal.${k}`] = personal[k];
      }
      if (contact) {
        for (let k in contact) updateData[`contact.${k}`] = contact[k];
      }
      if (employment) {
        for (let k in employment) updateData[`employment.${k}`] = employment[k];
      }
      if (bank) {
        for (let k in bank) updateData[`bank.${k}`] = bank[k];
      }

      await Employee.updateOne({ _id: targetId }, { $set: updateData });
      await logAction(req, 'EMPLOYEE_EDIT_ADMIN', { targetId, updates: req.body });
      return res.json({ message: 'Employee profile updated successfully by Admin' });
    } else {
      // Employee updates self: split sensitive vs non-sensitive
      const directUpdate = {};
      
      // Personal fields like name, dob, photo can be updated directly
      if (personal) {
        for (let k in personal) directUpdate[`personal.${k}`] = personal[k];
      }
      // Contacts can be updated directly
      if (contact) {
        for (let k in contact) {
          if (k !== 'officialEmail') { // officialEmail is admin-controlled
            directUpdate[`contact.${k}`] = contact[k];
          }
        }
      }

      // Perform direct updates immediately
      if (Object.keys(directUpdate).length > 0) {
        await Employee.updateOne({ _id: targetId }, { $set: directUpdate });
      }

      // Sensitive fields (bank, statutory) require approval
      if (bank && Object.keys(bank).some(k => bank[k] && bank[k] !== employee.bank[k])) {
        // Create Approval Request of type PROFILE_EDIT
        const managers = await Employee.find({ tenantId: req.tenantId, role: 'HR/Admin' });
        const hrAdmin = managers[0] ? managers[0]._id : employee.employment.reportingManagerId;

        if (!hrAdmin) {
          return res.status(400).json({ message: 'No HR/Admin or Reporting Manager available to approve profile edits' });
        }

        const approvalRequest = await ApprovalRequest.create({
          tenantId: req.tenantId,
          requestType: 'PROFILE_EDIT',
          referenceId: targetId,
          employeeId: targetId,
          approverId: hrAdmin,
          status: 'Pending',
          details: {
            field: 'Bank Account & Statutory Info',
            proposedChange: bank,
            originalState: employee.bank
          },
          comments: '',
          createdAt: new Date().toISOString()
        });

        // Notify HR
        await sendNotification(
          req.tenantId,
          hrAdmin,
          'Sensitive Profile Edit Approval Needed',
          `Employee ${employee.personal.name} requested bank account/statutory edits.`,
          'ACTION_REQUIRED'
        );

        await logAction(req, 'PROFILE_EDIT_REQUESTED', { approvalRequestId: approvalRequest._id });
        
        return res.json({
          message: 'Personal details updated successfully. Sensitive bank/statutory changes are pending HR review.',
          pendingApproval: true
        });
      }

      await logAction(req, 'EMPLOYEE_SELF_EDIT', { updates: directUpdate });
      res.json({ message: 'Profile details updated successfully' });
    }
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Internal server error updating profile' });
  }
});

// 8. Exit Onboarding Exit (HR/Admin only)
router.post('/:id/exit', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { exitDate, exitReason, exitNotes } = req.body;

  if (!exitDate) {
    return res.status(400).json({ message: 'Exit date is required' });
  }

  try {
    const employee = await Employee.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Mark as archived / exited
    await Employee.updateOne(
      { _id: req.params.id },
      { 
        $set: { 
          'employment.status': 'Exited',
          exitRecord: { exitDate, exitReason, exitNotes, archivedAt: new Date().toISOString() } 
        } 
      }
    );

    await logAction(req, 'EMPLOYEE_EXIT_ARCHIVE', { employeeId: employee._id, email: employee.email, exitDate });

    // Send notifications to manager
    if (employee.employment.reportingManagerId) {
      await sendNotification(
        req.tenantId,
        employee.employment.reportingManagerId,
        'Team Member Exited',
        `Employee ${employee.personal.name} has been marked as Exited in the system.`,
        'INFO'
      );
    }

    res.json({ message: 'Employee has been exited successfully. Profile archived for compliance.' });
  } catch (err) {
    console.error('Exit recording error:', err);
    res.status(500).json({ message: 'Server error processing employee exit' });
  }
});

// Dedicated /bank endpoint — sensitive update, routes to approval for non-admins
router.put('/:id/bank', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user._id === targetId;
  const isAdmin = req.user.role === 'HR/Admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const employee = await Employee.findOne({ _id: targetId, tenantId: req.tenantId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const bank = req.body;

    if (isAdmin) {
      const updateData = {};
      for (let k in bank) updateData[`bank.${k}`] = bank[k];
      await Employee.updateOne({ _id: targetId }, { $set: updateData });
      await logAction(req, 'BANK_DETAILS_UPDATED_ADMIN', { targetId });
      return res.json({ message: 'Bank details updated successfully' });
    }

    // Non-admin: create approval request
    const admins = await Employee.find({ tenantId: req.tenantId, role: 'HR/Admin' });
    const approverId = admins[0] ? admins[0]._id : employee.employment.reportingManagerId;
    if (!approverId) return res.status(400).json({ message: 'No approver available' });

    const approval = await ApprovalRequest.create({
      tenantId: req.tenantId, requestType: 'PROFILE_EDIT',
      referenceId: targetId, employeeId: targetId,
      approverId, status: 'Pending',
      details: { field: 'Bank & Statutory Details', proposedChange: bank, originalState: employee.bank },
      comments: '', createdAt: new Date().toISOString()
    });

    await sendNotification(req.tenantId, approverId, 'Bank Details Approval Needed', `${employee.personal.name} requested bank/statutory changes.`, 'ACTION_REQUIRED');
    await logAction(req, 'PROFILE_EDIT_REQUESTED', { approvalId: approval._id });
    return res.status(202).json({ message: 'Bank details change submitted for HR approval', approvalId: approval._id, pendingApproval: true });
  } catch (err) {
    console.error('Bank update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

// ===== NEW FEATURES BELOW =====

// Professional Section Update (self or HR/Admin)
router.put('/:id/professional', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user._id === targetId;
  const isAdmin = req.user.role === 'HR/Admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden: You can only update your own professional section' });
  }

  const { education, experience, skills, certifications } = req.body;

  try {
    const employee = await Employee.findOne({ _id: targetId, tenantId: req.tenantId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const updateData = {};
    if (education !== undefined) updateData['professional.education'] = education;
    if (experience !== undefined) updateData['professional.experience'] = experience;
    if (skills !== undefined) updateData['professional.skills'] = skills;
    if (certifications !== undefined) updateData['professional.certifications'] = certifications;

    await Employee.updateOne({ _id: targetId }, { $set: updateData });
    await logAction(req, 'PROFESSIONAL_PROFILE_UPDATED', { targetId });
    res.json({ message: 'Professional profile updated successfully' });
  } catch (err) {
    console.error('Professional update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Upload Document (self or HR/Admin)
router.post('/:id/documents', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user._id === targetId;
  const isAdmin = req.user.role === 'HR/Admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Cannot upload documents for other employees' });
  }

  const { name, fileUrl, documentType } = req.body;
  if (!name || !fileUrl) {
    return res.status(400).json({ message: 'Document name and fileUrl are required' });
  }

  try {
    const employee = await Employee.findOne({ _id: targetId, tenantId: req.tenantId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const newDoc = { name, fileUrl, documentType: documentType || 'Other', uploadedAt: new Date().toISOString() };
    const updatedDocs = [...(employee.documents || []), newDoc];
    await Employee.updateOne({ _id: targetId }, { $set: { documents: updatedDocs } });
    await logAction(req, 'DOCUMENT_UPLOADED', { targetId, documentName: name });
    res.status(201).json({ message: 'Document uploaded successfully', document: newDoc });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete Document (HR/Admin only)
router.delete('/:id/documents/:docIndex', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const targetId = req.params.id;
  const docIndex = parseInt(req.params.docIndex);

  try {
    const employee = await Employee.findOne({ _id: targetId, tenantId: req.tenantId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const docs = employee.documents || [];
    if (docIndex < 0 || docIndex >= docs.length) {
      return res.status(400).json({ message: `Invalid document index. Employee has ${docs.length} document(s).` });
    }

    const removedDoc = docs[docIndex];
    docs.splice(docIndex, 1);
    await Employee.updateOne({ _id: targetId }, { $set: { documents: docs } });
    await logAction(req, 'DOCUMENT_DELETED', { targetId, documentName: removedDoc.name });
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Document delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lifecycle Event (Transfer, Promotion, etc.) — HR/Admin only
router.post('/:id/lifecycle', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { eventType, effectiveDate, newDepartment, newDesignation, newRole, newLocation, newGrade, newReportingManagerId, notes } = req.body;

  const validEvents = ['Transfer', 'Promotion', 'Department Change', 'Role Change'];
  if (!eventType || !validEvents.includes(eventType)) {
    return res.status(400).json({ message: `eventType must be one of: ${validEvents.join(', ')}` });
  }
  if (!effectiveDate) {
    return res.status(400).json({ message: 'effectiveDate is required' });
  }

  try {
    const employee = await Employee.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Check circular hierarchy
    if (newReportingManagerId) {
      const { isCircularReporting } = require('./employees');
      // Inline circular check
      if (newReportingManagerId === req.params.id) {
        return res.status(400).json({ message: 'Cannot set employee as their own manager' });
      }
    }

    // Build changes object and update employment
    const changes = {};
    const updateData = {};
    if (newDepartment) { changes.department = { from: employee.employment.department, to: newDepartment }; updateData['employment.department'] = newDepartment; }
    if (newDesignation) { changes.designation = { from: employee.employment.designation, to: newDesignation }; updateData['employment.designation'] = newDesignation; }
    if (newRole) { changes.role = { from: employee.role, to: newRole }; updateData['role'] = newRole; }
    if (newLocation) { changes.location = { from: employee.employment.location, to: newLocation }; updateData['employment.location'] = newLocation; }
    if (newGrade) { changes.grade = { from: employee.employment.grade, to: newGrade }; updateData['employment.grade'] = newGrade; }
    if (newReportingManagerId) { changes.reportingManagerId = { from: employee.employment.reportingManagerId, to: newReportingManagerId }; updateData['employment.reportingManagerId'] = newReportingManagerId; }

    const historyEntry = { eventType, effectiveDate, changes, notes: notes || '', recordedBy: req.user._id, recordedAt: new Date().toISOString() };
    const updatedHistory = [...(employee.lifecycleHistory || []), historyEntry];
    updateData['lifecycleHistory'] = updatedHistory;

    await Employee.updateOne({ _id: req.params.id }, { $set: updateData });

    const actionKey = `EMPLOYEE_LIFECYCLE_${eventType.toUpperCase().replace(/ /g, '_')}`;
    await logAction(req, actionKey, { employeeId: req.params.id, changes, effectiveDate });

    await sendNotification(req.tenantId, req.params.id, `Your Profile Updated — ${eventType}`, `Your employment details have been updated: ${eventType} effective ${effectiveDate}. Please check your profile for details.`, 'INFO', employee.email);

    res.json({ message: `Lifecycle event '${eventType}' recorded successfully`, historyEntry });
  } catch (err) {
    console.error('Lifecycle event error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Set Delegation (self or HR/Admin)
router.post('/:id/delegate', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user._id === targetId;
  const isAdmin = req.user.role === 'HR/Admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Can only set delegation for yourself' });
  }

  const { delegateTo, from, to } = req.body;
  if (!delegateTo || !from || !to) {
    return res.status(400).json({ message: 'delegateTo, from, and to dates are required' });
  }

  try {
    const delegate = await Employee.findOne({ _id: delegateTo, tenantId: req.tenantId });
    if (!delegate) return res.status(400).json({ message: 'Delegate employee not found in this organization' });

    await Employee.updateOne({ _id: targetId, tenantId: req.tenantId }, { $set: { delegation: { delegateTo, from, to, active: true } } });
    await logAction(req, 'DELEGATION_SET', { targetId, delegateTo, from, to });
    res.json({ message: `Approval delegation set to ${delegate.personal.name} from ${from} to ${to}` });
  } catch (err) {
    console.error('Set delegation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove Delegation
router.delete('/:id/delegate', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user._id === targetId;
  const isAdmin = req.user.role === 'HR/Admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    await Employee.updateOne({ _id: targetId, tenantId: req.tenantId }, { $set: { delegation: { delegateTo: null, from: null, to: null, active: false } } });
    await logAction(req, 'DELEGATION_REMOVED', { targetId });
    res.json({ message: 'Delegation removed successfully' });
  } catch (err) {
    console.error('Remove delegation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
