const express = require('express');
const { Tenant, Employee } = require('../models');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');

const router = express.Router();

// 1. Org Chart — returns all active employees formatted for hierarchy rendering
router.get('/chart', authenticateToken, async (req, res) => {
  try {
    const employees = await Employee.find({
      tenantId: req.tenantId,
      'employment.status': { $ne: 'Exited' }
    });

    // Map to flat org-chart node format
    const nodes = employees.map(emp => ({
      id: emp._id,
      name: emp.personal.name,
      designation: emp.employment.designation || 'Employee',
      department: emp.employment.department || '',
      managerId: emp.employment.reportingManagerId || null,
      employeeId: emp.employeeId,
      role: emp.role
    }));

    res.json(nodes);
  } catch (err) {
    console.error('Fetch org chart error:', err);
    res.status(500).json({ message: 'Error generating org chart data' });
  }
});

// 2. Fetch Tenant settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant settings not found' });
    }
    res.json(tenant.settings);
  } catch (err) {
    console.error('Fetch settings error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. Update Tenant settings (HR/Admin Only)
router.put('/settings', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { departments, locations, shifts } = req.body;

  if (!departments && !locations && !shifts) {
    return res.status(400).json({ message: 'No settings data provided for update' });
  }

  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const updatedSettings = {
      departments: departments || tenant.settings.departments,
      locations: locations || tenant.settings.locations,
      shifts: shifts || tenant.settings.shifts
    };

    await Tenant.updateOne(
      { _id: req.tenantId },
      { $set: { settings: updatedSettings } }
    );

    await logAction(req, 'UPDATE_ORG_SETTINGS', {
      before: tenant.settings,
      after: updatedSettings
    });

    res.json({ message: 'Organization settings updated successfully', settings: updatedSettings });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ message: 'Server error updating organization configurations' });
  }
});

module.exports = router;
