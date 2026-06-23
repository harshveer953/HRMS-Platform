const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Clean up database files before tests boot to ensure clean state
const dbDir = path.join(process.cwd(), '.database');
if (fs.existsSync(dbDir)) {
  const files = fs.readdirSync(dbDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(dbDir, file));
    }
  }
}

// Set port and env for testing
process.env.PORT = '5002';
process.env.NODE_ENV = 'test';
delete process.env.MONGO_URI; // Force mock DB for tests to run isolated and fast

// Start the Express server
require('../src/server');

const BASE_URL = 'http://localhost:5002/api';

async function runTests() {
  console.log('\n========================================================');
  console.log(' RUNNING INTEGRATION TESTS (TENANT ISOLATION, RBAC, RULES)');
  console.log('========================================================\n');

  let acmeToken = '';
  let betaToken = '';
  let bobId = '';
  let acmeAdminId = '';
  let leaveRequestId = '';
  let approvalRequestId = '';

  try {
    // ----------------------------------------------------
    // Test 1: Register Tenant Acme
    // ----------------------------------------------------
    console.log('Test 1: Registering Tenant Acme...');
    const regAcmeRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Acme Corp',
        domain: 'acme.com',
        adminName: 'Alice HR',
        adminEmail: 'alice@acme.com',
        adminPassword: 'Password123'
      })
    });
    const regAcme = await regAcmeRes.json();
    assert.strictEqual(regAcmeRes.status, 201);
    assert.ok(regAcme.tenantId);
    assert.ok(regAcme.adminId);
    acmeAdminId = regAcme.adminId;
    console.log('✔ Acme registered successfully');

    // ----------------------------------------------------
    // Test 2: Login Tenant Acme Admin
    // ----------------------------------------------------
    console.log('Test 2: Logging in Acme Admin...');
    const loginAcmeRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@acme.com',
        password: 'Password123'
      })
    });
    const loginAcme = await loginAcmeRes.json();
    assert.strictEqual(loginAcmeRes.status, 200);
    assert.ok(loginAcme.token);
    acmeToken = loginAcme.token;
    console.log('✔ Acme Admin logged in');

    // ----------------------------------------------------
    // Test 3: Register Tenant Beta
    // ----------------------------------------------------
    console.log('Test 3: Registering Tenant Beta...');
    const regBetaRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Beta Inc',
        domain: 'beta.com',
        adminName: 'Charlie HR',
        adminEmail: 'charlie@beta.com',
        adminPassword: 'Password123'
      })
    });
    const regBeta = await regBetaRes.json();
    assert.strictEqual(regBetaRes.status, 201);
    console.log('✔ Beta registered successfully');

    // ----------------------------------------------------
    // Test 4: Login Tenant Beta Admin
    // ----------------------------------------------------
    console.log('Test 4: Logging in Beta Admin...');
    const loginBetaRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'charlie@beta.com',
        password: 'Password123'
      })
    });
    const loginBeta = await loginBetaRes.json();
    assert.strictEqual(loginBetaRes.status, 200);
    betaToken = loginBeta.token;
    console.log('✔ Beta Admin logged in');

    // ----------------------------------------------------
    // Test 5: Create Employee Bob under Acme Admin
    // ----------------------------------------------------
    console.log('Test 5: Onboarding Bob under Acme...');
    const addBobRes = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${acmeToken}`
      },
      body: JSON.stringify({
        name: 'Bob Engineer',
        email: 'bob@acme.com',
        password: 'Password123',
        role: 'Employee',
        department: 'Engineering',
        designation: 'Staff Dev',
        location: 'Remote',
        DOJ: '2026-06-01',
        shiftName: 'General Shift',
        reportingManagerId: acmeAdminId // reports to Alice
      })
    });
    const addBob = await addBobRes.json();
    assert.strictEqual(addBobRes.status, 201);
    assert.ok(addBob._id);
    bobId = addBob._id;
    console.log('✔ Bob onboarded. Assigned Employee ID:', addBob.employeeId);

    // ----------------------------------------------------
    // Test 6: Tenant Isolation Check
    // ----------------------------------------------------
    console.log('Test 6: Checking Tenant Isolation (Beta Admin tries to read Bob)...');
    const readBobBetaRes = await fetch(`${BASE_URL}/employees/${bobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${betaToken}`
      }
    });
    // Should return 404 since Bob is isolated in Acme's tenant database
    assert.strictEqual(readBobBetaRes.status, 404);
    console.log('✔ Tenant isolation enforced (Beta Admin cannot access Acme data)');

    // ----------------------------------------------------
    // Test 7: Circular Reporting Prevention
    // ----------------------------------------------------
    console.log('Test 7: Testing circular manager assignment prevention...');
    // Try to update Alice's manager to Bob. Since Bob reports to Alice, this is circular.
    const editAliceRes = await fetch(`${BASE_URL}/employees/${acmeAdminId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${acmeToken}`
      },
      body: JSON.stringify({
        employment: {
          reportingManagerId: bobId // circular!
        }
      })
    });
    const editAlice = await editAliceRes.json();
    assert.strictEqual(editAliceRes.status, 400);
    assert.ok(editAlice.message.includes('Circular hierarchy'));
    console.log('✔ Circular hierarchy blocked successfully');

    // ----------------------------------------------------
    // Test 8: Lockout Trigger Safeguard
    // ----------------------------------------------------
    console.log('Test 8: Testing Account Lockout (5 failed attempts)...');
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bob@acme.com', password: 'WrongPassword' })
      });
    }
    // The 6th attempt should be blocked with 423 Locked status
    const lockRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@acme.com', password: 'Password123' })
    });
    assert.strictEqual(lockRes.status, 423);
    console.log('✔ Account successfully locked after 5 consecutive failures');

    console.log('\n========================================================');
    console.log(' ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:', err);
    process.exit(1);
  }
}

// Wait for server to boot, then run tests
setTimeout(runTests, 1500);
