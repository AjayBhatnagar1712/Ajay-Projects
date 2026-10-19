import { describe, expect, it } from "vitest";
import {
  LeaseAgreementPatchSchema,
  LeasePartiesCompleteSetSchema,
  LeasePartiesReplaceSchema,
  LeasePartyInputSchema,
} from "./leaseAgreementSchemas.js";

type PartyOverride = {
  role?: "owner" | "tenant";
  isPrimary?: boolean;
  phone?: string;
};

let phoneCounter = 0;
function uniquePhone(): string {
  phoneCounter += 1;
  return `98765${String(phoneCounter).padStart(5, "0")}`;
}

function party(overrides: PartyOverride = {}) {
  return {
    role: overrides.role ?? "owner",
    name: "Test Party",
    phone: overrides.phone ?? uniquePhone(),
    isPrimary: overrides.isPrimary ?? false,
  };
}

function parse(parties: Array<ReturnType<typeof party>>) {
  return LeasePartiesReplaceSchema.safeParse({ parties });
}

function parseComplete(parties: Array<ReturnType<typeof party>>) {
  return LeasePartiesCompleteSetSchema.safeParse({ parties });
}

describe("LeasePartiesReplaceSchema — draft party count (1–5)", () => {
  it("accepts a single owner (Owners step before Tenants)", () => {
    const result = parse([party({ role: "owner", isPrimary: true })]);
    expect(result.success).toBe(true);
  });

  it("accepts exactly two parties (one owner, one tenant)", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true }),
      party({ role: "tenant", isPrimary: true }),
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts exactly five parties", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true }),
      party({ role: "owner" }),
      party({ role: "owner" }),
      party({ role: "tenant", isPrimary: true }),
      party({ role: "tenant" }),
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects six parties", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true }),
      party({ role: "owner" }),
      party({ role: "owner" }),
      party({ role: "owner" }),
      party({ role: "tenant", isPrimary: true }),
      party({ role: "tenant" }),
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts owners-only and tenants-only mid-draft", () => {
    expect(
      parse([
        party({ role: "owner", isPrimary: true }),
        party({ role: "owner", isPrimary: false }),
      ]).success,
    ).toBe(true);
    expect(
      parse([
        party({ role: "tenant", isPrimary: true }),
        party({ role: "tenant", isPrimary: false }),
      ]).success,
    ).toBe(true);
  });
});

describe("LeasePartiesCompleteSetSchema — both roles required for review", () => {
  it("rejects owners-only", () => {
    const result = parseComplete([
      party({ role: "owner", isPrimary: true }),
      party({ role: "owner", isPrimary: false }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects tenants-only", () => {
    const result = parseComplete([
      party({ role: "tenant", isPrimary: true }),
      party({ role: "tenant", isPrimary: false }),
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts a mix of owner and tenant", () => {
    const result = parseComplete([
      party({ role: "owner", isPrimary: true }),
      party({ role: "tenant", isPrimary: true }),
    ]);
    expect(result.success).toBe(true);
  });
});

describe("LeasePartiesReplaceSchema — exactly one primary per role", () => {
  it("rejects two primary owners", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true }),
      party({ role: "owner", isPrimary: true }),
      party({ role: "tenant", isPrimary: true }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects zero primary owners", () => {
    const result = parse([
      party({ role: "owner", isPrimary: false }),
      party({ role: "tenant", isPrimary: true }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects two primary tenants", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true }),
      party({ role: "tenant", isPrimary: true }),
      party({ role: "tenant", isPrimary: true }),
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts exactly one primary of each role", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true }),
      party({ role: "owner", isPrimary: false }),
      party({ role: "tenant", isPrimary: true }),
    ]);
    expect(result.success).toBe(true);
  });
});

describe("LeasePartiesReplaceSchema — phone rules", () => {
  it("normalizes phone to E.164 before insert", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "owner",
      name: "Krishna",
      phone: "+91 98765 43210",
      isPrimary: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+919876543210");
    }
  });

  it("accepts a US E.164 number", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "owner",
      name: "NRI Owner",
      phone: "+14155552671",
      isPrimary: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+14155552671");
    }
  });

  it("accepts legacy bare 10-digit India numbers", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "owner",
      name: "Krishna",
      phone: "9876543210",
      isPrimary: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+919876543210");
    }
  });

  it("rejects duplicate phone numbers across the set", () => {
    const result = parse([
      party({ role: "owner", isPrimary: true, phone: "9876500000" }),
      party({ role: "tenant", isPrimary: true, phone: "9876500000" }),
    ]);
    expect(result.success).toBe(false);
  });
});

describe("LeasePartyInputSchema — Aadhaar/PAN independent nullability", () => {
  it("accepts a tenant with Aadhaar but no PAN", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "tenant",
      name: "Tenant",
      phone: "9876543210",
      isPrimary: true,
      aadhaar: "9671 3280 7649",
      pan: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aadhaar).toBe("967132807649");
      expect(result.data.pan).toBeNull();
    }
  });

  it("uppercases and validates PAN format", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "owner",
      name: "Owner",
      phone: "9876543210",
      isPrimary: true,
      pan: "anzpj9269q",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pan).toBe("ANZPJ9269Q");
    }
  });

  it("rejects a malformed Aadhaar", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "owner",
      name: "Owner",
      phone: "9876543210",
      isPrimary: true,
      aadhaar: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects 12 digits that fail Verhoeff checksum", () => {
    const result = LeasePartyInputSchema.safeParse({
      role: "owner",
      name: "Owner",
      phone: "9876543210",
      isPrimary: true,
      aadhaar: "123456789012",
    });
    expect(result.success).toBe(false);
  });
});

describe("LeaseAgreementPatchSchema — date ordering", () => {
  it("rejects endDate on or before effectiveDate", () => {
    const result = LeaseAgreementPatchSchema.safeParse({
      effectiveDate: "2026-07-01",
      endDate: "2026-07-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts endDate after effectiveDate", () => {
    const result = LeaseAgreementPatchSchema.safeParse({
      effectiveDate: "2026-07-01",
      endDate: "2027-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a partial patch with only one date", () => {
    const result = LeaseAgreementPatchSchema.safeParse({ endDate: "2027-06-01" });
    expect(result.success).toBe(true);
  });
});
