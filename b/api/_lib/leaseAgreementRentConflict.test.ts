import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";

const state = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => ({ query: state.query }),
}));
import { hasRenewalRentConflict } from "./leaseAgreementRentConflict.js";

describe("renewal rent month conflicts", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = new PGlite();
    state.query.mockImplementation((sql, params) => db.query(sql, params));
    await db.exec(`CREATE TABLE lease_agreements (
      id text PRIMARY KEY, renewed_from_agreement_id text, status text,
      effective_date date, end_date date
    );
    INSERT INTO lease_agreements VALUES
      ('original', NULL, 'signed', '2025-09-01', '2026-09-15'),
      ('renewal', 'original', 'signed', '2026-09-16', '2027-09-15');`);
  });
  afterEach(async () => {
    await db.close();
    vi.clearAllMocks();
  });

  it("allows disjoint portions of the same month", async () => {
    expect(await hasRenewalRentConflict("original", "2026-09")).toBe(false);
    expect(await hasRenewalRentConflict("renewal", "2026-09")).toBe(false);
  });

  it("blocks even a single day billed by both signed agreements", async () => {
    await db.exec(
      "UPDATE lease_agreements SET effective_date = '2026-09-15' WHERE id = 'renewal'",
    );
    expect(await hasRenewalRentConflict("original", "2026-09")).toBe(true);
    expect(await hasRenewalRentConflict("renewal", "2026-09")).toBe(true);
  });

  it("does not block adjacent months or unfinished renewals", async () => {
    expect(await hasRenewalRentConflict("original", "2026-08")).toBe(false);
    expect(await hasRenewalRentConflict("renewal", "2026-10")).toBe(false);
    await db.exec(
      "UPDATE lease_agreements SET status = 'draft' WHERE id = 'renewal'",
    );
    expect(await hasRenewalRentConflict("original", "2026-09")).toBe(false);
  });

  it("ignores an unrelated property lease", async () => {
    await db.exec(
      "UPDATE lease_agreements SET renewed_from_agreement_id = NULL WHERE id = 'renewal'",
    );
    expect(await hasRenewalRentConflict("original", "2026-09")).toBe(false);
  });

  it("detects sibling and multigeneration conflicts and terminates cycles", async () => {
    await db.exec(`INSERT INTO lease_agreements VALUES
      ('sibling', 'original', 'signed', '2026-10-01', '2027-09-30'),
      ('grandchild', 'sibling', 'signed', '2026-10-15', '2027-10-14');`);
    expect(await hasRenewalRentConflict("renewal", "2026-10")).toBe(true);
    expect(await hasRenewalRentConflict("grandchild", "2026-10")).toBe(true);
    await db.exec(
      "UPDATE lease_agreements SET renewed_from_agreement_id = 'grandchild' WHERE id = 'original'",
    );
    expect(await hasRenewalRentConflict("renewal", "2026-10")).toBe(true);
  });

  it("rejects an invalid month without a database query", async () => {
    state.query.mockClear();
    expect(await hasRenewalRentConflict("original", "2026-13")).toBe(true);
    expect(state.query).not.toHaveBeenCalled();
  });
});
