/**
 * Full E2E onboarding against staging + Razorpay test:
 *   account create (handlePaymentOnboardRequest helpers)
 *   → stakeholder / product / bank (executePaymentOnboardComplete)
 *
 * Uses a never-used phone (confirmed against payment_recipient_config).
 * Subcategory is space_rental via buildRazorpayAccountPayload (PR #130).
 *
 * Run:
 *   DATABASE_URL=<staging-jvup…> RAZORPAY_KEY_ID=<test> RAZORPAY_KEY_SECRET=<test> \
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec tsx scripts/test-onboard-e2e-fresh.ts
 */
const CANDIDATE_PHONES = [
  "9000000024",
  "9000000025",
  "9000000030",
  "9000000031",
  "9000000032",
];
const TEST_ROLE = "owner" as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

function assertStagingDatabase(url: string): void {
  if (!url.includes("jvupbmmzyxizjwjjfrac")) {
    console.error("Refusing to run: DATABASE_URL is not staging (jvupbmmzyxizjwjjfrac)");
    process.exit(1);
  }
}

/** Shape: {roleChar}{phone10}{9 random base36} — exactly 20 chars. */
function assertReferenceIdShape(id: string, phone: string, role: string): void {
  const phone10 = phone.replace(/\D/g, "").slice(-10);
  const roleChar =
    role === "owner" ? "o" : role === "tenant" ? "t" : role === "broker" ? "b" : null;
  if (!roleChar || phone10.length !== 10) {
    console.error("Cannot assert reference_id shape: bad phone/role", { phone, role });
    process.exit(1);
  }
  const expectedPrefix = `${roleChar}${phone10}`;
  if (
    id.length !== 20 ||
    !id.startsWith(expectedPrefix) ||
    !/^[otb]\d{10}[0-9a-z]{9}$/.test(id)
  ) {
    console.error(
      `REFERENCE_ID shape invalid (want ${expectedPrefix} + 9 base36, len 20):`,
      id,
    );
    process.exit(1);
  }
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("RAZORPAY_KEY_ID");
  requireEnv("RAZORPAY_KEY_SECRET");
  assertStagingDatabase(databaseUrl);

  const onboard = await import("../api/_lib/paymentOnboardHandler.ts");
  const { getRazorpayClient } = await import("../api/_lib/razorpayClient.ts");
  const { getPool } = await import("../api/_lib/vercelSyncDb.ts");

  const {
    buildRazorpayAccountPayload,
    executePaymentOnboardComplete,
    getRecipientConfig,
    razorpayReferenceId,
    upsertRecipientAccount,
  } = onboard;

  let testPhone: string | null = null;
  for (const phone of CANDIDATE_PHONES) {
    const existing = await getPool().query(
      `SELECT phone FROM payment_recipient_config WHERE phone = $1 LIMIT 1`,
      [phone],
    );
    if (existing.rows.length === 0) {
      testPhone = phone;
      break;
    }
  }
  if (!testPhone) {
    console.error("No unused candidate phone found in", CANDIDATE_PHONES);
    process.exit(1);
  }

  const stamp = Date.now();
  const email = `e2e-owner-${stamp}@trustkeyper.test`;
  // Razorpay rejects names that look like abbreviations / contain digits (e.g. "E2E").
  const legalName = "Test Owner Alpha";
  const referenceId = razorpayReferenceId(testPhone, TEST_ROLE);
  assertReferenceIdShape(referenceId, testPhone, TEST_ROLE);

  console.log("=== test-onboard-e2e-fresh ===");
  console.log("DATABASE_URL:", maskDatabaseUrl(databaseUrl));
  console.log("TEST_PHONE:", testPhone);
  console.log("TEST_ROLE:", TEST_ROLE);
  console.log("TEST_EMAIL:", email);
  console.log("REFERENCE_ID:", referenceId);

  // --- Step 1: account create (same helpers as handlePaymentOnboardRequest) ---
  console.log("\n--- Step 1: account create ---");
  const before = await getRecipientConfig(testPhone, TEST_ROLE);
  if (before?.razorpay_linked_account_id) {
    console.error("Phone unexpectedly already has a linked account:", before);
    process.exit(1);
  }

  const accountBody: onboard.PaymentOnboardBody = {
    phone: testPhone,
    role: TEST_ROLE,
    legalName,
    email,
    registeredAddress: {
      street1: "12 Residency Road",
      street2: "Ashok Nagar",
      city: "Bengaluru",
      state: "KARNATAKA",
      postalCode: "560025",
      country: "IN",
    },
  };

  const payload = buildRazorpayAccountPayload(accountBody, referenceId);
  console.log("profile.subcategory:", payload.profile.subcategory);
  if (payload.profile.subcategory !== "space_rental") {
    console.error("Expected space_rental subcategory");
    process.exit(1);
  }

  const account = await getRazorpayClient().accounts.create(payload);
  console.log("acc_id:", account.id);

  await upsertRecipientAccount({
    phone: testPhone,
    role: TEST_ROLE,
    accountId: account.id,
    referenceId,
  });

  // --- Steps 2-4: stakeholder + product + bank/TnC ---
  console.log("\n--- Steps 2-4: executePaymentOnboardComplete ---");
  const completeBody: onboard.PaymentOnboardCompleteBody = {
    phone: testPhone,
    role: TEST_ROLE,
    stakeholderName: legalName,
    stakeholderEmail: email,
    pan: "ABCPK9876E",
    residentialAddress: {
      street: "12 Residency Road, Ashok Nagar",
      city: "Bengaluru",
      state: "KARNATAKA",
      postalCode: "560025",
      country: "IN",
    },
    // Must match the real test account holder — Razorpay KYC rejects mismatched names.
    bankAccountNumber: "50100314400251",
    bankIfsc: "HDFC0000065",
    bankBeneficiaryName: "Sumit Mandal",
    tncAccepted: true,
  };

  const result = await executePaymentOnboardComplete(completeBody);
  console.log("complete result:", JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error("E2E FAILED at complete step");
    process.exitCode = 1;
    await getPool().end();
    return;
  }

  const product = await getRazorpayClient().products.fetch(result.accountId, result.productId);
  console.log("\n--- Razorpay product (immediate after edit) ---");
  console.log(
    JSON.stringify(
      {
        activation_status: product.activation_status,
        requirements: product.requirements,
        tnc: product.tnc,
        id: product.id,
        product_name: product.product_name,
      },
      null,
      2,
    ),
  );

  // Razorpay may activate asynchronously after products.edit — poll briefly.
  let finalProduct = product;
  for (let i = 0; i < 6; i += 1) {
    if (finalProduct.activation_status === "activated") break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    finalProduct = await getRazorpayClient().products.fetch(result.accountId, result.productId);
    console.log(`poll ${i + 1}: activation_status=${finalProduct.activation_status}`);
  }

  console.log("\n--- Final Razorpay product (after poll) ---");
  console.log(
    JSON.stringify(
      {
        activation_status: finalProduct.activation_status,
        requirements: finalProduct.requirements,
        tnc: finalProduct.tnc,
        id: finalProduct.id,
        product_name: finalProduct.product_name,
      },
      null,
      2,
    ),
  );

  // Mirror into DB the way status endpoint / webhooks do.
  const { syncRecipientValidationFromRazorpay } = await import(
    "../api/_lib/razorpayRouteHelpers.ts"
  );
  const synced = await syncRecipientValidationFromRazorpay({
    linkedAccountId: result.accountId,
    productId: result.productId,
    currentValidationStatus: result.validationStatus,
  });
  console.log("syncRecipientValidationFromRazorpay:", synced);

  const configRow = await getPool().query(
    `SELECT phone, role, razorpay_linked_account_id, razorpay_stakeholder_id,
            razorpay_product_id, validation_status, activated_at
     FROM payment_recipient_config
     WHERE phone = $1 AND role = $2`,
    [testPhone, TEST_ROLE],
  );
  console.log("\n--- Final payment_recipient_config ---");
  console.log(JSON.stringify(configRow.rows[0], null, 2));

  console.log("\n=== SUMMARY ===");
  console.log("phone:", testPhone);
  console.log("accountId:", result.accountId);
  console.log("productId:", result.productId);
  console.log("db validationStatus (after sync):", configRow.rows[0]?.validation_status);
  console.log("razorpay activation_status:", finalProduct.activation_status);
  console.log("razorpay requirements:", JSON.stringify(finalProduct.requirements));

  await getPool().end();
}

main().catch((err) => {
  console.error("test-onboard-e2e-fresh failed:", err);
  process.exit(1);
});
