require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const seedDatabase = require('./db/seed');
const db = require('./db/db');

// Route imports
const { router: authRouter } = require('./routes/auth');
const orgRouter = require('./routes/org');
const employeesRouter = require('./routes/employees');
const attendanceRouter = require('./routes/attendance');
const leaveRouter = require('./routes/leave');
const dashboardRouter = require('./routes/dashboard');
const notificationsRouter = require('./routes/notifications');
const holidaysRouter = require('./routes/holidays');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/org', orgRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/holidays', holidaysRouter);

// Root and API status routes
app.get('/', (req, res) => {
  res.json({ message: 'HRMS API Backend Server is running successfully!' });
});
app.get('/api', (req, res) => {
  res.json({ message: 'HRMS API Backend Server is running successfully!' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: 'An internal server error occurred', error: process.env.NODE_ENV === 'development' ? err.message : {} });
});

async function startServer() {
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(` HRMS API Backend Server is running on port ${PORT}`);
    console.log(` Database Mode: ${db.isMock ? 'Local JSON File Document Store (.database/)' : 'MongoDB (Mongoose)'}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`========================================================`);
  });
}
startServer();
