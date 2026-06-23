const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Clean DB
const dbDir = path.join(process.cwd(), '.database');
if (fs.existsSync(dbDir)) {
  fs.readdirSync(dbDir).forEach(f => { if (f.endsWith('.json')) fs.unlinkSync(path.join(dbDir, f)); });
}

process.env.PORT = '5004';
process.env.NODE_ENV = 'test';
delete process.env.MONGO_URI;

require('../src/server');

const BASE = 'http://localhost:5004/api';

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(url);
    const opts = {
      host: u.hostname, port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { console.log(`✔ ${name}`); pass++; }
  else { console.log(`✗ ${name} ${extra}`); fail++; }
}

async function run() {
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n========================================================');
  console.log(' NEW FEATURES INTEGRATION TESTS');
  console.log('========================================================\n');

  // Setup: register + login
  await request('POST', BASE + '/auth/register', { companyName: 'FeatureCo', domain: 'featureco', adminName: 'Admin', adminEmail: 'admin@featureco.com', adminPassword: 'Admin@123' });
  const login = await request('POST', BASE + '/auth/login', { email: 'admin@featureco.com', password: 'Admin@123' });
  const token = login.body.token;
  const refreshToken = login.body.refreshToken;

  // 1. Refresh token
  const ref = await request('POST', BASE + '/auth/refresh', { refreshToken });
  check('Refresh token returns new access + refresh token', ref.status === 200 && !!ref.body.token && !!ref.body.refreshToken);

  // 2. Login returns refreshToken
  check('Login response includes refreshToken', !!refreshToken);

  // 3. Forgot password
  const forgot = await request('POST', BASE + '/auth/forgot-password', { email: 'admin@featureco.com' });
  check('Forgot password — OTP sent (no leak)', forgot.status === 200 && !forgot.body.otp);

  // 4. Forgot password unknown email — same message (no enumeration)
  const forgotUnknown = await request('POST', BASE + '/auth/forgot-password', { email: 'nobody@nowhere.com' });
  check('Forgot password — unknown email same response (no enumeration)', forgotUnknown.status === 200);

  // 5. Reset password with wrong OTP
  const resetWrong = await request('POST', BASE + '/auth/reset-password', { email: 'admin@featureco.com', otp: '000000', newPassword: 'NewPass@1' });
  check('Reset password — wrong OTP rejected', resetWrong.status === 400);

  // 6. Holiday create
  const holCreate = await request('POST', BASE + '/holidays', { name: 'Diwali', date: '2025-10-20', type: 'National' }, token);
  check('Holiday created (National)', holCreate.status === 201, JSON.stringify(holCreate.body));

  // 7. Holiday duplicate blocked
  const holDup = await request('POST', BASE + '/holidays', { name: 'Diwali 2', date: '2025-10-20', type: 'National' }, token);
  check('Holiday duplicate date+location blocked', holDup.status === 400);

  // 8. Holiday fetch
  const holGet = await request('GET', BASE + '/holidays', null, token);
  check('Holidays list returned', holGet.status === 200 && holGet.body.length >= 1);

  // 9. Holiday delete
  const holId = holCreate.body.holiday._id;
  const holDel = await request('DELETE', BASE + '/holidays/' + holId, null, token);
  check('Holiday deleted', holDel.status === 200);

  // 10. Half-day leave
  const halfLeave = await request('POST', BASE + '/leave/apply', { leaveTypeName: 'Casual Leave', startDate: '2025-12-01', endDate: '2025-12-01', reason: 'Half day', halfDay: true, halfDaySlot: 'First Half' }, token);
  check('Half-day leave applied (duration=0.5)', halfLeave.status === 201 && halfLeave.body.leaveRequest && halfLeave.body.leaveRequest.duration === 0.5, JSON.stringify(halfLeave.body));

  // 11. Half-day validation: start != end blocked
  const halfInvalid = await request('POST', BASE + '/leave/apply', { leaveTypeName: 'Sick Leave', startDate: '2025-12-01', endDate: '2025-12-02', halfDay: true }, token);
  check('Half-day with different start/end blocked', halfInvalid.status === 400);

  // 12. Notification prefs GET
  const prefs = await request('GET', BASE + '/notifications/prefs', null, token);
  check('Notification prefs fetched', prefs.status === 200 && prefs.body.inApp === true);

  // 13. Notification prefs update
  const prefsUpd = await request('PUT', BASE + '/notifications/prefs', { email: false, leaveUpdates: false }, token);
  check('Notification prefs updated', prefsUpd.status === 200 && prefsUpd.body.prefs.email === false);

  // 14. systemAlerts cannot be disabled
  const prefsBlock = await request('PUT', BASE + '/notifications/prefs', { systemAlerts: false }, token);
  check('systemAlerts cannot be disabled', prefsBlock.status === 400);

  // 15. Create employee for sub-tests
  const empCreate = await request('POST', BASE + '/employees', { name: 'Test Employee', email: 'emp@featureco.com', password: 'Emp@1234', role: 'Employee' }, token);
  const empId = empCreate.body._id;
  check('Employee created for sub-tests', !!empId);

  // 16. Professional section update
  const profUpd = await request('PUT', BASE + '/employees/' + empId + '/professional', { skills: ['React', 'Node.js'], education: [{ degree: 'B.Tech', year: 2020 }] }, token);
  check('Professional section updated', profUpd.status === 200, JSON.stringify(profUpd.body));

  // 17. Document upload
  const docUp = await request('POST', BASE + '/employees/' + empId + '/documents', { name: 'Offer Letter', fileUrl: 'https://example.com/offer.pdf', documentType: 'Offer Letter' }, token);
  check('Document uploaded', docUp.status === 201, JSON.stringify(docUp.body));

  // 18. Document delete
  const docDel = await request('DELETE', BASE + '/employees/' + empId + '/documents/0', null, token);
  check('Document deleted', docDel.status === 200, JSON.stringify(docDel.body));

  // 19. Lifecycle event — Promotion
  const lifecycle = await request('POST', BASE + '/employees/' + empId + '/lifecycle', { eventType: 'Promotion', effectiveDate: '2025-10-01', newDesignation: 'Senior Engineer', newGrade: 'B', notes: 'Perf-based' }, token);
  check('Lifecycle Promotion recorded', lifecycle.status === 200, JSON.stringify(lifecycle.body));

  // 20. Lifecycle event — Transfer
  const transfer = await request('POST', BASE + '/employees/' + empId + '/lifecycle', { eventType: 'Transfer', effectiveDate: '2025-11-01', newLocation: 'London Office' }, token);
  check('Lifecycle Transfer recorded', transfer.status === 200);

  // 21. Delegation set
  const delSet = await request('POST', BASE + '/employees/' + empId + '/delegate', { delegateTo: empId, from: '2025-10-01', to: '2025-10-31' }, token);
  check('Delegation set', delSet.status === 200, JSON.stringify(delSet.body));

  // 22. Delegation remove
  const delRem = await request('DELETE', BASE + '/employees/' + empId + '/delegate', null, token);
  check('Delegation removed', delRem.status === 200);

  // 23. Escalation job trigger
  const esc = await request('POST', BASE + '/dashboard/run-escalation', {}, token);
  check('Escalation job triggered', esc.status === 200, JSON.stringify(esc.body));

  // 24. Reports — headcount CSV
  const hcCsv = await request('GET', BASE + '/dashboard/reports/download?type=headcount&format=csv', null, token);
  check('Headcount CSV report', hcCsv.status === 200);

  // 25. Reports — headcount PDF
  const hcPdf = await request('GET', BASE + '/dashboard/reports/download?type=headcount&format=pdf', null, token);
  check('Headcount PDF report', hcPdf.status === 200);

  // 26. Reports — overtime CSV
  const otCsv = await request('GET', BASE + '/dashboard/reports/download?type=overtime&format=csv', null, token);
  check('Overtime report CSV', otCsv.status === 200);

  // 27. Reports — with filters
  const filtered = await request('GET', BASE + '/dashboard/reports/download?type=headcount&department=HR&status=Active&format=csv', null, token);
  check('Headcount with department+status filters', filtered.status === 200);

  // 28. Reports — leave with date range
  const leaveRep = await request('GET', BASE + '/dashboard/reports/download?type=leave&from=2025-01-01&to=2025-12-31&format=csv', null, token);
  check('Leave report with date range', leaveRep.status === 200);

  // Summary
  console.log(`\n========================================================`);
  console.log(` RESULTS: ${pass} passed, ${fail} failed`);
  console.log(`========================================================\n`);

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
