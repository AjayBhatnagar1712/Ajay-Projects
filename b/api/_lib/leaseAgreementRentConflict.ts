import { getPool } from "./vercelSyncDb.js";
import { parseRentPeriod } from "./leaseAgreementPayability.js";

export async function hasRenewalRentConflict(
  agreementId: string,
  rentPeriod: string,
): Promise<boolean> {
  const period = parseRentPeriod(rentPeriod);
  if (!period) return true;

  // Follow both directions so siblings and later renewals share the same guard.
  // UNION also makes malformed cyclic links terminate.
  const result = await getPool().query<{ conflict: boolean }>(
    `WITH RECURSIVE family AS (
       SELECT id, renewed_from_agreement_id
       FROM public.lease_agreements WHERE id = $1
       UNION
       SELECT a.id, a.renewed_from_agreement_id
       FROM public.lease_agreements a
       INNER JOIN family f ON a.id = f.renewed_from_agreement_id
         OR a.renewed_from_agreement_id = f.id
     )
     SELECT EXISTS (
       SELECT 1 FROM family f
       INNER JOIN public.lease_agreements a ON a.id = f.id
       INNER JOIN public.lease_agreements current ON current.id = $1
       WHERE a.id <> $1 AND a.status = 'signed'
         AND GREATEST(a.effective_date, current.effective_date, $2::date)
             <= LEAST(a.end_date, current.end_date, $3::date)
         AND a.effective_date <= a.end_date
     ) AS conflict`,
    [
      agreementId,
      period.start.toISOString().slice(0, 10),
      period.end.toISOString().slice(0, 10),
    ],
  );
  return result.rows[0]?.conflict ?? true;
}
