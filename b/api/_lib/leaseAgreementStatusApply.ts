/**
 * Shared DB apply path for lease-agreement status transitions.
 *
 * Used by:
 *   - POST /api/v1/lease-agreements/:id/status
 *   - POST /api/v1/lease-agreements/:id/review/send (draft → in_review only)
 *
 * Behavior for the HTTP status endpoint must stay identical to PR #179:
 * same ownership lock, same draft→in_review party load, same validation,
 * same UPDATE, same 404/400 outcomes. Callers own BEGIN/COMMIT/ROLLBACK.
 */
import type { PoolClient } from "pg";
import type {
  LeaseAgreementStatus,
  LeaseAgreementStatusUpdate,
} from "./leaseAgreementSchemas.js";
import { validateLeaseAgreementStatusTransition } from "./leaseAgreementStatus.js";

export type StatusTransitionAgreementRow = {
  id: string;
  created_by_user_id: string;
  renewed_from_agreement_id: string | null;
  status: string;
  execution_date: string | null;
  effective_date: string | null;
  end_date: string | null;
  execution_city: string | null;
  duration_months: number | null;
  min_stay_months: number | null;
  notice_period_licensee_months: number | null;
  notice_period_licensor_months: number | null;
  monthly_rent_paise: number | null;
  security_deposit_paise: number | null;
  rent_due_day: number | null;
  brokerage_fee_paise: number | null;
  maintenance_included: boolean;
  monthly_maintenance_paise: number | null;
  property_address: string | null;
  area_sqft: string | null;
  facing: string | null;
  car_parking_count: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  signed_at: Date | string | null;
  has_signed_pdf: boolean;
};

type StatusTransitionPartyRow = {
  role: string;
  name: string;
  phone: string;
  title: string | null;
  age: number | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  email: string | null;
  is_primary: boolean;
  sort_order: number;
  approval_status: string;
};

export type ApplyLeaseAgreementStatusTransitionResult =
  | {
      ok: true;
      agreement: StatusTransitionAgreementRow;
      fromStatus: string;
      placeholderGate: boolean;
    }
  | { ok: false; status: 404 | 400; error: string };

const AGREEMENT_COLUMNS = `
  id,
  created_by_user_id,
  renewed_from_agreement_id,
  status,
  to_char(execution_date, 'YYYY-MM-DD') AS execution_date,
  to_char(effective_date, 'YYYY-MM-DD') AS effective_date,
  to_char(end_date, 'YYYY-MM-DD') AS end_date,
  execution_city,
  duration_months,
  min_stay_months,
  notice_period_licensee_months,
  notice_period_licensor_months,
  monthly_rent_paise,
  security_deposit_paise,
  rent_due_day,
  brokerage_fee_paise,
  maintenance_included,
  monthly_maintenance_paise,
  property_address,
  area_sqft,
  facing,
  car_parking_count,
  created_at,
  updated_at,
  signed_at,
  (signed_pdf_pathname IS NOT NULL) AS has_signed_pdf
`;

async function selectPartiesForUpdate(
  client: PoolClient,
  agreementId: string,
): Promise<StatusTransitionPartyRow[]> {
  const result = await client.query<StatusTransitionPartyRow>(
    `SELECT role, name, phone, title, age, address,
            aadhaar, pan, email, is_primary, sort_order, approval_status
     FROM public.agreement_parties
     WHERE agreement_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [agreementId],
  );
  return result.rows;
}

/**
 * Apply a guarded status transition inside an open transaction.
 * Does not BEGIN/COMMIT/ROLLBACK — the caller owns the transaction lifecycle.
 */
export async function applyLeaseAgreementStatusTransition(
  client: PoolClient,
  params: {
    id: string;
    userId: string;
    nextStatus: LeaseAgreementStatusUpdate["status"];
    /**
     * When provided, skip the ownership SELECT FOR UPDATE and reuse this row
     * (caller must already hold FOR UPDATE on the agreement).
     */
    existing?: StatusTransitionAgreementRow;
  },
): Promise<ApplyLeaseAgreementStatusTransitionResult> {
  const { id, userId, nextStatus } = params;

  let existing = params.existing;
  if (!existing) {
    const owned = await client.query<StatusTransitionAgreementRow>(
      `SELECT ${AGREEMENT_COLUMNS}
       FROM public.lease_agreements
       WHERE id = $1 AND created_by_user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [id, userId],
    );
    existing = owned.rows[0];
  }

  if (!existing) {
    return { ok: false, status: 404, error: "Lease agreement not found" };
  }

  const needsParties =
    (existing.status === "draft" && nextStatus === "in_review") ||
    (existing.status === "in_review" && nextStatus === "esign_sent");
  const parties = needsParties ? await selectPartiesForUpdate(client, id) : [];

  const transition = validateLeaseAgreementStatusTransition({
    currentStatus: existing.status as LeaseAgreementStatus,
    nextStatus,
    agreement: {
      executionDate: existing.execution_date,
      effectiveDate: existing.effective_date,
      endDate: existing.end_date,
      executionCity: existing.execution_city,
      durationMonths: existing.duration_months,
      minStayMonths: existing.min_stay_months,
      noticePeriodLicenseeMonths: existing.notice_period_licensee_months,
      noticePeriodLicensorMonths: existing.notice_period_licensor_months,
      monthlyRentPaise: existing.monthly_rent_paise,
      securityDepositPaise: existing.security_deposit_paise,
      rentDueDay: existing.rent_due_day,
      propertyAddress: existing.property_address,
      areaSqft: existing.area_sqft === null ? null : Number(existing.area_sqft),
      facing: existing.facing,
      carParkingCount: existing.car_parking_count,
    },
    parties: parties.map((party) => ({
      // Runtime value is unchanged from PR #179; DB CHECK constrains role.
      role: party.role as "owner" | "tenant",
      name: party.name,
      phone: party.phone,
      title: party.title,
      age: party.age,
      address: party.address,
      aadhaar: party.aadhaar,
      pan: party.pan,
      email: party.email,
      isPrimary: party.is_primary,
      sortOrder: party.sort_order,
      approvalStatus:
        party.approval_status === "approved" ||
        party.approval_status === "changes_requested" ||
        party.approval_status === "withdrawn"
          ? party.approval_status
          : "pending",
    })),
  });

  if (!transition.ok) {
    return { ok: false, status: 400, error: transition.error };
  }

  const updated = await client.query<StatusTransitionAgreementRow>(
    `UPDATE public.lease_agreements
     SET status = $3, updated_at = now()
     WHERE id = $1 AND created_by_user_id = $2
     RETURNING ${AGREEMENT_COLUMNS}`,
    [id, userId, nextStatus],
  );
  const row = updated.rows[0];
  if (!row) {
    return { ok: false, status: 404, error: "Lease agreement not found" };
  }

  return {
    ok: true,
    agreement: row,
    fromStatus: existing.status,
    placeholderGate: transition.placeholderGate,
  };
}

export { AGREEMENT_COLUMNS as STATUS_TRANSITION_AGREEMENT_COLUMNS };
