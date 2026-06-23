const express = require('express');
const { Holiday } = require('../models');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');

const router = express.Router();

// GET /api/holidays — fetch all holidays for tenant (optional ?location= filter)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = { tenantId: req.tenantId };
    if (req.query.location) {
      // return holidays for all locations + specified location
      query['$or'] = [{ location: '' }, { location: req.query.location }];
    }
    const holidays = await Holiday.find(query);
    holidays.sort((a, b) => a.date.localeCompare(b.date));
    res.json(holidays);
  } catch (err) {
    console.error('Fetch holidays error:', err);
    res.status(500).json({ message: 'Internal server error fetching holidays' });
  }
});

// POST /api/holidays — HR/Admin create holiday
router.post('/', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  const { name, date, location = '', type = 'National' } = req.body;

  if (!name || !date) {
    return res.status(400).json({ message: 'Holiday name and date are required' });
  }
  if (!['National', 'Regional', 'Optional'].includes(type)) {
    return res.status(400).json({ message: 'Type must be National, Regional, or Optional' });
  }

  try {
    // Duplicate check: same date + same location
    const existing = await Holiday.findOne({ tenantId: req.tenantId, date, location });
    if (existing) {
      return res.status(400).json({ message: `A holiday already exists on ${date} for location "${location || 'All'}"` });
    }

    const holiday = await Holiday.create({ tenantId: req.tenantId, name, date, location, type });
    await logAction(req, 'HOLIDAY_CREATED', { holidayId: holiday._id, name, date });
    res.status(201).json({ message: 'Holiday created successfully', holiday });
  } catch (err) {
    console.error('Create holiday error:', err);
    res.status(500).json({ message: 'Internal server error creating holiday' });
  }
});

// DELETE /api/holidays/:id — HR/Admin delete holiday
router.delete('/:id', authenticateToken, requireRole(['HR/Admin']), async (req, res) => {
  try {
    const holiday = await Holiday.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }
    await Holiday.deleteOne({ _id: req.params.id });
    await logAction(req, 'HOLIDAY_DELETED', { holidayId: req.params.id, name: holiday.name });
    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    console.error('Delete holiday error:', err);
    res.status(500).json({ message: 'Internal server error deleting holiday' });
  }
});

module.exports = router;
