const express = require('express');
const { Notification, Employee } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 1. Fetch all notifications for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const list = await Notification.find({ employeeId: req.user._id, tenantId: req.tenantId });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(list);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. Mark notification(s) as read
router.post('/read', authenticateToken, async (req, res) => {
  const { id } = req.body;
  try {
    const query = { employeeId: req.user._id, tenantId: req.tenantId };
    if (id) query._id = id;
    await Notification.updateMany(query, { $set: { isRead: true } });
    res.json({ message: 'Notifications marked as read successfully' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Server error updating read statuses' });
  }
});

// 3. Get notification preferences
router.get('/prefs', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user._id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const prefs = employee.notificationPrefs || {
      email: true, inApp: true, leaveUpdates: true, attendanceAlerts: true, systemAlerts: true
    };
    res.json(prefs);
  } catch (err) {
    console.error('Get prefs error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. Update notification preferences
router.put('/prefs', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user._id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const current = employee.notificationPrefs || { email: true, inApp: true, leaveUpdates: true, attendanceAlerts: true, systemAlerts: true };
    const updates = req.body;

    // systemAlerts cannot be disabled — security notifications always on
    if (updates.systemAlerts === false) {
      return res.status(400).json({ message: 'System alerts (security notifications) cannot be disabled' });
    }

    const newPrefs = { ...current, ...updates, systemAlerts: true }; // enforce systemAlerts always true

    await Employee.updateOne({ _id: req.user._id }, { $set: { notificationPrefs: newPrefs } });
    res.json({ message: 'Notification preferences updated successfully', prefs: newPrefs });
  } catch (err) {
    console.error('Update prefs error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
