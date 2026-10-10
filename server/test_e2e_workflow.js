// server/test_e2e_workflow.js
// Automated End-to-End Verification Test for DwellBase One-Time Landlord Payment & Super Admin Architecture

const BASE_URL = "http://localhost:4000";

async function runTests() {
  console.log("==================================================================");
  console.log("  DwellBase E2E Verification & Business Model Integrity Suite   ");
  console.log("==================================================================");
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log("\n[1] Testing Health Endpoint...");
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === "ok", "Server health check returns ok");

    // 2. Public settings endpoint
    console.log("\n[2] Testing Public Settings (Zero Leak of Sensitive Data)...");
    const pubRes = await fetch(`${BASE_URL}/api/auth/public-settings`);
    const pubData = await pubRes.json();
    assert(pubRes.status === 200 && pubData.one_time_fee !== undefined, "Public settings endpoint returns configured one-time fee");
    assert(pubData.password === undefined && pubData.jwt_secret === undefined, "Public settings does not leak credentials");

    // 3. Unauthorized access to Super Admin API blocked
    console.log("\n[3] Testing Super Admin API Protection (Zero Trust)...");
    const unauthStats = await fetch(`${BASE_URL}/api/superadmin/stats`);
    assert(unauthStats.status === 401 || unauthStats.status === 403, "Public request to /api/superadmin/stats rejected with 401/403");

    const unauthLandlords = await fetch(`${BASE_URL}/api/superadmin/landlords`);
    assert(unauthLandlords.status === 401 || unauthLandlords.status === 403, "Public request to /api/superadmin/landlords rejected");

    // 4. Super Admin Login
    console.log("\n[4] Testing Super Admin Authentication...");
    const loginRes = await fetch(`${BASE_URL}/api/auth/superadmin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@dwellbase.com", password: "SuperAdmin@1234" }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && !!loginData.token, "Super Admin login succeeds with valid token");
    const superAdminToken = loginData.token;

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    };

    // 5. Super Admin Stats from real DB records
    console.log("\n[5] Testing Super Admin Stats...");
    const statsRes = await fetch(`${BASE_URL}/api/superadmin/stats`, { headers: authHeaders });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200, "Super Admin stats endpoint succeeds");
    assert(typeof statsData.totalApprovedCollections === "number", "Approved collections is a valid numeric calculation");

    // 6. Super Admin Landlord Creation (Manual Offline Registration)
    console.log("\n[6] Testing Landlord Creation (Manual Super Admin Creation)...");
    const testEmail = `landlord_${Date.now()}@dwellbasetest.com`;
    const createRes = await fetch(`${BASE_URL}/api/superadmin/landlords`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fullName: "Kofi Test Landlord",
        email: testEmail,
        phone: "+233 24 555 0199",
        propertyName: "Kofi Heights",
        propertyAddress: "Airport Residential Area, Accra",
        oneTimeFee: 500,
        paymentReceived: false, // Save as Pending Payment
        notes: "Test landlord created during E2E suite",
      }),
    });
    const createData = await createRes.json();
    if (createRes.status !== 201) console.log("createRes error:", createRes.status, createData);
    assert(createRes.status === 201, "Landlord account created successfully");
    assert(createData.landlord && createData.landlord.account_status === "Pending Payment", "Account initial status is Pending Payment");
    assert(createData.landlord.is_paid === false, "Landlord is_paid is false before payment");
    const landlordId = createData.landlord.id;

    // 7. Duplicate prevention
    console.log("\n[7] Testing Duplicate Account Prevention...");
    const dupRes = await fetch(`${BASE_URL}/api/superadmin/landlords`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fullName: "Kofi Duplicate",
        email: testEmail, // Same email
        oneTimeFee: 500,
      }),
    });
    assert(dupRes.status === 409 || dupRes.status === 400, "Duplicate landlord email rejected with HTTP 409/400");

    // 8. Record One-Time Direct Mobile Money Payment
    console.log("\n[8] Testing One-Time Direct Mobile Money Payment Recording...");
    const momoPaymentRes = await fetch(`${BASE_URL}/api/superadmin/payments`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        landlordId,
        amount: 500,
        paymentMethod: "direct_momo",
        dateReceived: new Date().toISOString().split("T")[0],
        externalReference: "MOMO-TEST-998822",
        receiptNumber: "RCP-TEST-001",
        notes: "Direct MTN Mobile Money transfer verified by Super Admin",
        autoApprove: false, // Record as Pending Verification first
      }),
    });
    const momoPaymentData = await momoPaymentRes.json();
    assert(momoPaymentRes.status === 201, "One-time MoMo payment recorded");
    assert(momoPaymentData.payment.status === "pending_verification", "Payment status is pending_verification");
    const paymentRecordId = momoPaymentData.payment.id;

    // 9. Payment Approval & Automatic Account Activation
    console.log("\n[9] Testing Payment Approval & Account Activation...");
    const approveRes = await fetch(`${BASE_URL}/api/superadmin/payments/${paymentRecordId}/approve`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ notes: "Payment verified from MTN statement" }),
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200, "Payment approved successfully");
    assert(approveData.payment.status === "approved", "Payment status updated to approved");
    assert(approveData.landlord.account_status === "Active", "Landlord account activated to Active");
    assert(approveData.landlord.is_paid === true, "Landlord marked as paid (is_paid = true)");

    // 10. Generate Single-Use Activation Token & Test Landlord Password Setup
    console.log("\n[10] Testing Single-Use Activation Token & Password Creation...");
    const resetRes = await fetch(`${BASE_URL}/api/superadmin/landlords/${landlordId}/reset-access`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ notes: "Issuing activation link for landlord onboarding" }),
    });
    const resetData = await resetRes.json();
    assert(resetRes.status === 200 && !!resetData.token, "Single-use activation token generated");
    const activationToken = resetData.token;

    // Verify token endpoint
    const verifyTokenRes = await fetch(`${BASE_URL}/api/auth/verify-activation-token?token=${encodeURIComponent(activationToken)}`);
    const verifyTokenData = await verifyTokenRes.json();
    assert(verifyTokenRes.status === 200 && verifyTokenData.valid === true, "Activation token is verified valid");

    // Complete activation with landlord's chosen password
    const landlordPassword = "LandlordSecurePass@2026";
    const completeRes = await fetch(`${BASE_URL}/api/auth/complete-activation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: activationToken, password: landlordPassword }),
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200 && completeData.success === true, "Landlord password set and activation completed");

    // Test token cannot be reused (Single-use security)
    const reuseRes = await fetch(`${BASE_URL}/api/auth/verify-activation-token?token=${encodeURIComponent(activationToken)}`);
    const reuseData = await reuseRes.json();
    assert(reuseRes.status === 400 || reuseData.valid === false, "Activation token cannot be reused after completion");

    // 11. Landlord Login with newly set password
    console.log("\n[11] Testing Landlord Authentication & Workspace Access...");
    const landlordLoginRes = await fetch(`${BASE_URL}/api/auth/landlord/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: landlordPassword }),
    });
    const landlordLoginData = await landlordLoginRes.json();
    assert(landlordLoginRes.status === 200 && !!landlordLoginData.token, "Landlord logs in successfully with permanent workspace token");
    const landlordAuthToken = landlordLoginData.token;

    const landlordHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${landlordAuthToken}`,
    };

    // 12. Landlord Workspace Data Isolation (Fresh Workspace)
    console.log("\n[12] Testing Landlord Workspace Data Isolation...");
    const landlordRoomsRes = await fetch(`${BASE_URL}/api/rooms`, { headers: landlordHeaders });
    const landlordRoomsData = await landlordRoomsRes.json();
    assert(Array.isArray(landlordRoomsData) && landlordRoomsData.length === 0, "New landlord workspace starts with 0 rooms (completely isolated)");

    // Landlord creates room
    const createRoomRes = await fetch(`${BASE_URL}/api/rooms`, {
      method: "POST",
      headers: landlordHeaders,
      body: JSON.stringify({ monthlyRent: 450 }),
    });
    assert(createRoomRes.status === 201, "Landlord creates ROOM 1 (R1)");

    // Landlord cannot access Super Admin API
    const landlordHackingSuperAdmin = await fetch(`${BASE_URL}/api/superadmin/landlords`, { headers: landlordHeaders });
    assert(landlordHackingSuperAdmin.status === 403, "Landlord forbidden from accessing Super Admin API (HTTP 403)");

    // 13. Suspension and Reactivation (No New Payment Guarantee)
    console.log("\n[13] Testing Administrative Suspension & Free Reactivation...");
    const suspendRes = await fetch(`${BASE_URL}/api/superadmin/landlords/${landlordId}/suspend`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ reason: "Security review hold", notes: "Audit check" }),
    });
    const suspendData = await suspendRes.json();
    assert(suspendRes.status === 200 && suspendData.landlord.account_status === "Suspended", "Account suspended with recorded reason");

    // Suspended landlord cannot login
    const suspendedLoginRes = await fetch(`${BASE_URL}/api/auth/landlord/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: landlordPassword }),
    });
    assert(suspendedLoginRes.status === 403, "Suspended landlord login rejected with HTTP 403");

    // Reactivate without any payment demand
    const reactivateRes = await fetch(`${BASE_URL}/api/superadmin/landlords/${landlordId}/reactivate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ notes: "Security review completed; access restored" }),
    });
    const reactivateData = await reactivateRes.json();
    assert(reactivateRes.status === 200 && reactivateData.landlord.account_status === "Active", "Account reactivated to Active without fee");

    // Landlord can log in again
    const reactivatedLoginRes = await fetch(`${BASE_URL}/api/auth/landlord/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: landlordPassword }),
    });
    assert(reactivatedLoginRes.status === 200, "Reactivated landlord logs in immediately");

    // 14. Audit Trail Verification
    console.log("\n[14] Testing Platform Audit Trail...");
    const auditRes = await fetch(`${BASE_URL}/api/superadmin/audit-logs`, { headers: authHeaders });
    const auditLogs = await auditRes.json();
    assert(Array.isArray(auditLogs) && auditLogs.length > 0, "Audit logs recorded all administrative actions");
    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes("CREATE_LANDLORD"), "Audit trail recorded CREATE_LANDLORD");
    assert(actions.includes("APPROVE_PAYMENT"), "Audit trail recorded APPROVE_PAYMENT");
    assert(actions.includes("SUSPEND_ACCOUNT"), "Audit trail recorded SUSPEND_ACCOUNT");
    assert(actions.includes("REACTIVATE_ACCOUNT"), "Audit trail recorded REACTIVATE_ACCOUNT");

    // 15. Testing Cash Payment Recording & Rejection Flow
    console.log("\n[15] Testing Cash Payment Recording & Rejection Flow...");
    const testEmail2 = `landlord_cash_${Date.now()}@dwellbasetest.com`;
    const createCashRes = await fetch(`${BASE_URL}/api/superadmin/landlords`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fullName: "Ama Cash Landlord",
        email: testEmail2,
        phone: "+233 24 555 8899",
        propertyName: "Ama Residence",
        oneTimeFee: 500,
        paymentReceived: true,
        paymentMethod: "cash",
        dateReceived: new Date().toISOString().split("T")[0],
        receiptNumber: "RCP-CASH-771",
        autoApprove: false, // Save as pending verification
        notes: "Cash payment received for verification test",
      }),
    });
    const createCashData = await createCashRes.json();
    assert(createCashRes.status === 201, "Landlord with pending cash payment created");
    const cashLandlordId = createCashData.landlord.id;
    const cashPaymentId = createCashData.payment.id;

    // Reject payment with required reason
    const rejectRes = await fetch(`${BASE_URL}/api/superadmin/payments/${cashPaymentId}/reject`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ reason: "Counterfeit notes detected during physical inspection" }),
    });
    const rejectData = await rejectRes.json();
    assert(rejectRes.status === 200 && rejectData.payment.status === "rejected", "Payment rejected with recorded reason");

    // Rejected payment keeps account unactivated
    const cashLandlordCheck = await fetch(`${BASE_URL}/api/superadmin/landlords/${cashLandlordId}`, { headers: authHeaders });
    const cashLandlordCheckData = await cashLandlordCheck.json();
    assert(cashLandlordCheckData.landlord.account_status === "Pending Payment" && !cashLandlordCheckData.landlord.is_paid, "Rejected payment leaves landlord unactivated");

    // 16. Platform Settings Configuration
    console.log("\n[16] Testing Platform Settings Update...");
    const settingsUpdateRes = await fetch(`${BASE_URL}/api/superadmin/settings`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        one_time_fee: "550.00",
        contact_phone: "+233 24 100 2000",
        contact_instructions: "Contact platform owner for immediate one-time onboarding.",
      }),
    });
    const settingsUpdateData = await settingsUpdateRes.json();
    assert(settingsUpdateRes.status === 200, "Settings updated successfully");
    assert(settingsUpdateData.settings.one_time_fee === "550.00", "Configured fee persisted to database");

    console.log("\n==================================================================");
    console.log(`  E2E Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================================");
  } catch (err) {
    console.error("Test execution error:", err);
  }
}

runTests();
