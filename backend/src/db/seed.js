const bcrypt = require('bcryptjs');
const { Tenant, Employee, LeaveType, LeaveBalance, Attendance } = require('../models');

async function seedDatabase() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    const tenantCount = await Tenant.countDocuments();
    if (tenantCount > 0) {
      console.log('Database already has data. Skipping automatic seeding.');
      return;
    }

    console.log('========================================================');
    console.log(' SEEDING TEST DATA FOR MULTI-TENANT HRMS DEMO');
    console.log('========================================================');

    // 1. Create password hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123', salt);

    // 2. Create Tenant Acme Corp
    const acmeTenant = await Tenant.create({
      name: 'Acme Corp',
      domain: 'acme.com',
      mfaEnabled: false,
      passwordPolicy: { minLength: 8, requireSpecial: false, requireNumbers: false },
      settings: {
        departments: ['Engineering', 'HR', 'Product', 'Sales', 'Marketing', 'Finance'],
        locations: ['Headquarters', 'Remote'],
        shifts: [
          { name: 'General Shift', start: '09:00', end: '18:00', gracePeriod: 15 }
        ]
      }
    });

    // 3. Create Tenant Beta Inc
    const betaTenant = await Tenant.create({
      name: 'Beta Inc',
      domain: 'beta.com',
      mfaEnabled: false,
      passwordPolicy: { minLength: 8, requireSpecial: false, requireNumbers: false },
      settings: {
        departments: ['Engineering', 'HR', 'Sales', 'Operations'],
        locations: ['London Office', 'Remote'],
        shifts: [
          { name: 'General Shift', start: '09:00', end: '18:00', gracePeriod: 15 }
        ]
      }
    });

    console.log('✔ Created Tenants: Acme Corp & Beta Inc');

    // 4. Create Seed Leave Types for both tenants
    const leaveTypesData = [
      { name: 'Casual Leave', annualEntitlement: 12, accrualRules: 'Monthly', carryForwardLimit: 5, maxConsecutiveDays: 5 },
      { name: 'Sick Leave', annualEntitlement: 12, accrualRules: 'Monthly', carryForwardLimit: 5, maxConsecutiveDays: 3 },
      { name: 'Earned Leave', annualEntitlement: 18, accrualRules: 'Yearly', carryForwardLimit: 15, maxConsecutiveDays: 10 },
      { name: 'Loss of Pay (LOP)', annualEntitlement: 365, accrualRules: 'Monthly', carryForwardLimit: 0, maxConsecutiveDays: 365 }
    ];

    for (let t of leaveTypesData) {
      await LeaveType.create({ tenantId: acmeTenant._id, ...t });
      await LeaveType.create({ tenantId: betaTenant._id, ...t });
    }
    console.log('✔ Seeded Leave Types configurations');

    // 5. Create Acme HR Admin: Alice
    const alice = await Employee.create({
      tenantId: acmeTenant._id,
      employeeId: 'EMP-001',
      email: 'alice@acme.com',
      passwordHash,
      role: 'HR/Admin',
      personal: { name: 'Alice Smith', dob: '1990-05-15', gender: 'Female', photoUrl: '', maritalStatus: 'Married', nationality: 'American' },
      contact: { personalEmail: 'alice@acme.com', officialEmail: 'alice@acme.com', phone: '+1-555-101-2001', currentAddress: '123 HQ Street, San Francisco', permanentAddress: '123 HQ Street, San Francisco', emergencyContact: { name: 'Bob Smith', relation: 'Spouse', phone: '+1-555-101-2002' } },
      employment: { dateOfJoining: '2025-01-10', employmentType: 'Full-time', department: 'HR', designation: 'HR Director', grade: 'A', location: 'Headquarters', reportingManagerId: '', shiftName: 'General Shift', status: 'Active' },
      bank: { accountName: 'Alice Smith', accountNumber: '111122223333', bankName: 'Chase Bank', ifscCode: 'CHAS001', panNumber: 'AP12345', aadhaarNumber: '1111-2222-3333' }
    });

    // 6. Create Acme Employee: Bob (Reports to Alice)
    const bob = await Employee.create({
      tenantId: acmeTenant._id,
      employeeId: 'EMP-002',
      email: 'bob@acme.com',
      passwordHash,
      role: 'Employee',
      personal: { name: 'Bob Engineer', dob: '1992-11-20', gender: 'Male', photoUrl: '', maritalStatus: 'Single', nationality: 'American' },
      contact: { personalEmail: 'bob@acme.com', officialEmail: 'bob@acme.com', phone: '+1-555-202-3001', currentAddress: '456 Remote Lane, Austin', permanentAddress: '456 Remote Lane, Austin', emergencyContact: { name: 'Alice Smith', relation: 'Manager', phone: '+1-555-101-2001' } },
      employment: { dateOfJoining: '2025-03-01', employmentType: 'Full-time', department: 'Engineering', designation: 'Software Engineer', grade: 'B', location: 'Remote', reportingManagerId: alice._id, shiftName: 'General Shift', status: 'Active' },
      bank: { accountName: 'Bob Engineer', accountNumber: '444455556666', bankName: 'Wells Fargo', ifscCode: 'WELS002', panNumber: 'BO98765', aadhaarNumber: '4444-5555-6666' }
    });

    // 7. Create Beta HR Admin: Charlie
    const charlie = await Employee.create({
      tenantId: betaTenant._id,
      employeeId: 'EMP-001',
      email: 'charlie@beta.com',
      passwordHash,
      role: 'HR/Admin',
      personal: { name: 'Charlie Green', dob: '1988-08-08', gender: 'Male', photoUrl: '', maritalStatus: 'Single', nationality: 'British' },
      contact: { personalEmail: 'charlie@beta.com', officialEmail: 'charlie@beta.com', phone: '+44-20-7946-0192', currentAddress: '10 London Wall, London', permanentAddress: '10 London Wall, London', emergencyContact: { name: 'Emma Green', relation: 'Sister', phone: '+44-20-7946-0193' } },
      employment: { dateOfJoining: '2025-02-15', employmentType: 'Full-time', department: 'HR', designation: 'People Ops Manager', grade: 'A', location: 'London Office', reportingManagerId: '', shiftName: 'General Shift', status: 'Active' },
      bank: { accountName: 'Charlie Green', accountNumber: '777788889999', bankName: 'Barclays', ifscCode: 'BARC003', panNumber: 'CH55443', aadhaarNumber: '7777-8888-9999' }
    });

    console.log('✔ Created Employees: Alice (Acme HR), Bob (Acme Employee), Charlie (Beta HR)');

    // 8. Seed Leave Balances for seeded profiles
    const allEmployees = [alice, bob, charlie];
    const acmeLeaveTypes = await LeaveType.find({ tenantId: acmeTenant._id });
    const betaLeaveTypes = await LeaveType.find({ tenantId: betaTenant._id });

    for (let emp of allEmployees) {
      const types = emp.tenantId === acmeTenant._id ? acmeLeaveTypes : betaLeaveTypes;
      for (let t of types) {
        await LeaveBalance.create({
          tenantId: emp.tenantId,
          employeeId: emp._id,
          leaveTypeName: t.name,
          allocated: t.annualEntitlement,
          used: 0,
          pending: 0,
          available: t.annualEntitlement
        });
      }
    }
    console.log('✔ Allocated initial Leave Balances');

    // 9. Seed some historical attendance punches for Bob (Acme)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Bob punched in at 09:05 AM and out at 06:10 PM yesterday (Present)
    await Attendance.create({
      tenantId: acmeTenant._id,
      employeeId: bob._id,
      date: yesterdayStr,
      punches: [
        { type: 'IN', time: `${yesterdayStr}T09:05:00.000Z`, location: { lat: 37.7749, lng: -122.4194 }, ipAddress: '192.168.1.50' },
        { type: 'OUT', time: `${yesterdayStr}T18:10:00.000Z`, location: { lat: 37.7749, lng: -122.4194 }, ipAddress: '192.168.1.50' }
      ],
      status: 'Present',
      workHours: 9.08,
      overtimeHours: 0.08
    });

    console.log('✔ Seeded historical timesheet records for Bob');
    console.log('========================================================');
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

module.exports = seedDatabase;
