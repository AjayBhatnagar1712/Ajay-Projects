/**
 * Phase 1 spike — full 4-step Razorpay Route onboarding (throwaway, no DB writes).
 *
 * This is a manual, local-only spike script. It is never imported or run by the app,
 * CI, or any deployed code.
 * It logs full Razorpay API responses, which include stakeholder KYC and bank account
 * details. Run it only against test/sandbox credentials, never live keys.
 * It creates real linked accounts on whatever Razorpay account the credentials belong to.
 *
 * Run:
 *   RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... npx tsx scripts/spike-razorpay-account.ts
 */
import Razorpay from "razorpay";

function log(step: string, data: unknown) {
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
}

function errShape(e: unknown) {
  if (e && typeof e === "object" && "error" in e) {
    return (e as { error: unknown }).error;
  }
  if (e instanceof Error) return { message: e.message };
  return e;
}

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
const suffix = Date.now().toString(36);

const owner = {
  email: `spike.owner.${suffix}@trustkeyper.test`,
  phone: "9876543210",
  reference_id: `tk-spike-${suffix}`,
  legal_business_name: "Rajesh Kumar Rentals",
  customer_facing_business_name: "Rajesh Kumar Rentals",
  contact_name: "Rajesh Kumar",
  beneficiary_name: "Rajesh Kumar",
  pan: "ABCPK1234D",
};

async function main() {
  const summary: Record<string, unknown> = {
    steps: {},
    ids: {},
  };

  // Step 1 — accounts.create (no PAN)
  const step1Request = {
    email: owner.email,
    phone: owner.phone,
    type: "route" as const,
    reference_id: owner.reference_id,
    legal_business_name: owner.legal_business_name,
    customer_facing_business_name: owner.customer_facing_business_name,
    contact_name: owner.contact_name,
    business_type: "individual",
    profile: {
      category: "housing",
      subcategory: "real_estate_agents",
      business_model: "Individual property owner collecting monthly rent",
      addresses: {
        registered: {
          street1: "42 MG Road",
          street2: "Koramangala",
          city: "Bengaluru",
          state: "KARNATAKA",
          postal_code: "560034",
          country: "IN",
        },
      },
    },
  };

  log("STEP 1 REQUEST — accounts.create", step1Request);

  let accountId: string;
  try {
    const account = await razorpay.accounts.create(step1Request);
    accountId = account.id;
    summary.steps = { ...summary.steps as object, step1: "success" };
    summary.ids = { accountId };
    log("STEP 1 RESPONSE — accounts.create", account);
  } catch (e) {
    summary.steps = { ...summary.steps as object, step1: "failed" };
    log("STEP 1 ERROR — accounts.create", errShape(e));
    log("SPIKE SUMMARY", summary);
    process.exit(1);
  }

  // Step 2 — stakeholders.create (personal PAN, 4th char P)
  const step2Request = {
    name: owner.contact_name,
    email: owner.email,
    phone: { primary: owner.phone },
    kyc: { pan: owner.pan },
    relationship: { executive: true },
    addresses: {
      residential: {
        street: "42 MG Road, Koramangala",
        city: "Bengaluru",
        state: "KARNATAKA",
        postal_code: "560034",
        country: "IN",
      },
    },
  };

  log("STEP 2 REQUEST — stakeholders.create", { accountId, ...step2Request });

  let stakeholderId: string | undefined;
  try {
    const stakeholder = await razorpay.stakeholders.create(accountId, step2Request);
    stakeholderId = stakeholder.id;
    summary.steps = { ...summary.steps as object, step2: "success" };
    summary.ids = { ...summary.ids as object, stakeholderId };
    log("STEP 2 RESPONSE — stakeholders.create", stakeholder);
  } catch (e) {
    summary.steps = { ...summary.steps as object, step2: "failed" };
    log("STEP 2 ERROR — stakeholders.create", errShape(e));
  }

  // Step 3 — products.requestProductConfiguration
  const step3Request = { product_name: "route" as const };
  log("STEP 3 REQUEST — products.requestProductConfiguration", { accountId, ...step3Request });

  let productId: string | undefined;
  try {
    const product = await razorpay.products.requestProductConfiguration(accountId, step3Request);
    productId = product.id;
    summary.steps = { ...summary.steps as object, step3: "success" };
    summary.ids = { ...summary.ids as object, productId };
    log("STEP 3 RESPONSE — products.requestProductConfiguration", {
      id: product.id,
      product_name: product.product_name,
      activation_status: product.activation_status,
      requirements: product.requirements,
    });
  } catch (e) {
    summary.steps = { ...summary.steps as object, step3: "failed" };
    log("STEP 3 ERROR — products.requestProductConfiguration", errShape(e));
    log("SPIKE SUMMARY", summary);
    process.exit(1);
  }

  // Step 4 — products.edit (bank + T&C)
  const step4Request = {
    settlements: {
      account_number: "1234567890",
      ifsc_code: "HDFC0000001",
      beneficiary_name: owner.beneficiary_name,
    },
    tnc_accepted: true,
  };

  log("STEP 4 REQUEST — products.edit", { accountId, productId, ...step4Request });

  let activationStatus: string | undefined;
  try {
    const product = await razorpay.products.edit(accountId, productId!, step4Request);
    activationStatus = product.activation_status;
    summary.steps = { ...summary.steps as object, step4: "success" };
    summary.final = {
      activation_status: product.activation_status,
      active_configuration: product.active_configuration,
      requirements: product.requirements,
    };
    log("STEP 4 RESPONSE — products.edit", {
      id: product.id,
      activation_status: product.activation_status,
      active_configuration: product.active_configuration,
      requirements: product.requirements,
    });
  } catch (e) {
    summary.steps = { ...summary.steps as object, step4: "failed" };
    log("STEP 4 ERROR — products.edit", errShape(e));
  }

  summary.activation_status = activationStatus;
  summary.needs_clarification =
    activationStatus === "needs_clarification" ||
    (summary.final as { requirements?: unknown[] } | undefined)?.requirements?.length;

  log("SPIKE SUMMARY", summary);
}

main().catch((e) => {
  log("UNHANDLED ERROR", errShape(e));
  process.exit(1);
});
