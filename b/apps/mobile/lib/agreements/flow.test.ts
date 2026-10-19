import { describe, expect, it } from "vitest";
import type { LeaseAgreementDetail } from "../api/client";
import {
  agreementStatusLabel,
  agreementStatusSegment,
  allPartiesApproved,
  derivePersonRecords,
  derivePropertyRecords,
  defaultNewParties,
  emptyParty,
  formatAgreementDate,
  formatAgreementMoney,
  inferAgreementCreationStep,
  needsReviewResend,
  paiseToRupees,
  PartyCreationSchema,
  partyChangesComment,
  partyHasConfirmedShare,
  partyReviewHeadline,
  partyReviewLinkNote,
  partyReviewSendActionTitle,
  partyReviewStatusIcon,
  partyRoleLabel,
  resolveReviewLinkStatus,
  primaryByRole,
  createRolePartySchema,
  reviewProgressFromCounts,
  reviewProgressLabel,
  rupeesToPaise,
  TermsStepSchema,
} from "./flow";

function detail(
  overrides: Partial<LeaseAgreementDetail> = {},
): LeaseAgreementDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdByUserId: "22222222-2222-4222-8222-222222222222",
    status: "draft",
    executionDate: null,
    effectiveDate: null,
    endDate: null,
    executionCity: null,
    durationMonths: null,
    minStayMonths: null,
    noticePeriodLicenseeMonths: null,
    noticePeriodLicensorMonths: null,
    monthlyRentPaise: null,
    securityDepositPaise: null,
    rentDueDay: null,
    maintenanceIncluded: false,
    monthlyMaintenancePaise: null,
    propertyAddress: null,
    areaSqft: null,
    facing: null,
    carParkingCount: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    parties: [],
    inventory: [],
    ...overrides,
  };
}

describe("agreement creation flow", () => {
  function completeParty(
    role: "owner" | "tenant",
    phone: string,
  ): LeaseAgreementDetail["parties"][number] {
    return {
      id: role,
      role,
      name: role === "owner" ? "Owner One" : "Tenant One",
      phone,
      title: "Mr.",
      age: 36,
      address: "1 Main Road",
      aadhaar: "967132807649",
      pan: null,
      email: `${role}@example.com`,
      isPrimary: true,
      sortOrder: role === "owner" ? 0 : 1,
      approvalStatus: "pending",
      reviewComment: null,
      reviewedAt: null,
      hasReviewToken: false,
      reviewLinkStatus: "none",
      reviewSharedAt: null,
      hasBeenShared: false,
    };
  }

  it("resumes at property when address is absent", () => {
    expect(inferAgreementCreationStep(detail())).toBe(1);
  });

  it("resumes at owners after property is saved", () => {
    expect(inferAgreementCreationStep(detail({ propertyAddress: "1 Main Road" }))).toBe(2);
  });

  it("resumes at tenants when owners are complete but tenants are missing", () => {
    expect(
      inferAgreementCreationStep(
        detail({
          propertyAddress: "1 Main Road",
          parties: [completeParty("owner", "9876543210")],
        }),
      ),
    ).toBe(3);
  });

  it("resumes at owners when saved owner lacks KYC completeness", () => {
    expect(
      inferAgreementCreationStep(
        detail({
          propertyAddress: "1 Main Road",
          parties: [
            {
              ...completeParty("owner", "9876543210"),
              aadhaar: null,
              email: null,
            },
          ],
        }),
      ),
    ).toBe(2);
  });

  it("resumes at inventory after both roles are complete", () => {
    expect(
      inferAgreementCreationStep(
        detail({
          propertyAddress: "1 Main Road",
          parties: [
            completeParty("owner", "9876543210"),
            completeParty("tenant", "9876543211"),
          ],
        }),
      ),
    ).toBe(4);
  });

  it("resumes at terms once any term has been saved", () => {
    expect(
      inferAgreementCreationStep(
        detail({
          propertyAddress: "1 Main Road",
          executionDate: "2026-07-26",
          parties: [
            completeParty("owner", "9876543210"),
            completeParty("tenant", "9876543211"),
          ],
        }),
      ),
    ).toBe(5);
  });

  it("resumes at terms once inventory contains an item", () => {
    expect(
      inferAgreementCreationStep(
        detail({
          propertyAddress: "1 Main Road",
          parties: [
            completeParty("owner", "9876543210"),
            completeParty("tenant", "9876543211"),
          ],
          inventory: [{ id: "item", description: "Chimney", quantity: 1, sortOrder: 0 }],
        }),
      ),
    ).toBe(5);
  });
});

describe("money conversion", () => {
  it("converts rupees to paise without floating-point multiplication", () => {
    expect(rupeesToPaise("60000")).toBe(6_000_000);
    expect(rupeesToPaise("123.45")).toBe(12_345);
  });

  it("converts paise back to editable rupees", () => {
    expect(paiseToRupees(6_000_000)).toBe("60000");
    expect(paiseToRupees(12_345)).toBe("123.45");
    expect(paiseToRupees(null)).toBe("");
  });
});

describe("agreement status segments", () => {
  it("maps in_review and esign_sent into the sent bucket", () => {
    expect(agreementStatusSegment("in_review")).toBe("sent");
    expect(agreementStatusSegment("esign_sent")).toBe("sent");
  });

  it("keeps signed in the signed bucket", () => {
    expect(agreementStatusSegment("signed")).toBe("signed");
  });

  it("falls back to draft for draft agreements", () => {
    expect(agreementStatusSegment("draft")).toBe("draft");
  });
});

describe("agreement status labels", () => {
  it("labels draft, in review, sent for signing, and signed", () => {
    expect(agreementStatusLabel("draft")).toBe("Draft");
    expect(agreementStatusLabel("in_review")).toBe("In review");
    expect(agreementStatusLabel("esign_sent")).toBe("Sent for signing");
    expect(agreementStatusLabel("signed")).toBe("Signed");
  });
});

describe("review progress helpers", () => {
  const pending = {
    id: "p1",
    name: "Owner",
    role: "owner" as const,
    approvalStatus: "pending" as const,
    reviewComment: null,
    reviewedAt: null,
    hasReviewToken: true,
    reviewLinkStatus: "active" as const,
    reviewSharedAt: "2026-07-30T09:00:00.000Z",
    hasBeenShared: true,
  };
  const approved = {
    id: "p2",
    name: "Tenant",
    role: "tenant" as const,
    approvalStatus: "approved" as const,
    reviewComment: null,
    reviewedAt: "2026-07-30T10:00:00.000Z",
    hasReviewToken: true,
    reviewLinkStatus: "active" as const,
    reviewSharedAt: "2026-07-30T09:00:00.000Z",
    hasBeenShared: true,
  };
  const changes = {
    id: "p3",
    name: "Co-owner",
    role: "owner" as const,
    approvalStatus: "changes_requested" as const,
    reviewComment: "Lower the rent",
    reviewedAt: "2026-07-30T11:00:00.000Z",
    hasReviewToken: true,
    reviewLinkStatus: "active" as const,
    reviewSharedAt: "2026-07-30T09:00:00.000Z",
    hasBeenShared: true,
  };
  const withdrawn = {
    ...approved,
    id: "p8",
    approvalStatus: "withdrawn" as const,
  };
  const neverSent = {
    ...pending,
    id: "p5",
    hasReviewToken: false,
    reviewLinkStatus: "none" as const,
    reviewSharedAt: null,
    hasBeenShared: false,
  };
  const expiredLink = {
    ...pending,
    id: "p6",
    hasReviewToken: false,
    reviewLinkStatus: "expired" as const,
    reviewSharedAt: null,
    hasBeenShared: false,
  };
  const notYetShared = {
    ...pending,
    id: "p7",
    hasReviewToken: true,
    reviewLinkStatus: "active" as const,
    reviewSharedAt: null,
    hasBeenShared: false,
  };

  it("summarizes approved counts for list rows", () => {
    expect(reviewProgressLabel([pending, approved])).toBe("1 of 2 approved");
    expect(reviewProgressLabel([approved, withdrawn])).toBe("1 of 2 approved");
    expect(reviewProgressLabel([approved, { ...approved, id: "p4" }])).toBe("2 of 2 approved");
  });

  it("builds list progress from list-endpoint summary counts", () => {
    expect(reviewProgressFromCounts(2, 1)).toBe("1 of 2 approved");
    expect(reviewProgressFromCounts(0, 0)).toBeNull();
    expect(reviewProgressFromCounts(undefined, undefined)).toBeNull();
  });

  it("detects when every party has approved", () => {
    expect(allPartiesApproved([approved, { ...approved, id: "p4" }])).toBe(true);
    expect(allPartiesApproved([approved, pending])).toBe(false);
    expect(allPartiesApproved([approved, withdrawn])).toBe(false);
    expect(allPartiesApproved([])).toBe(false);
  });

  it("flags in_review agreements with no live review links as needing resend", () => {
    expect(needsReviewResend("in_review", [{ hasReviewToken: false }, { hasReviewToken: false }])).toBe(
      true,
    );
    expect(needsReviewResend("in_review", [pending, approved])).toBe(false);
    expect(needsReviewResend("draft", [{ hasReviewToken: false }])).toBe(false);
    expect(needsReviewResend("in_review", [])).toBe(false);
  });

  it("builds party review headlines with dates", () => {
    expect(partyReviewHeadline(pending)).toBe("Waiting for response");
    expect(partyReviewHeadline(neverSent)).toBe("Review link not sent");
    expect(partyReviewHeadline(notYetShared)).toBe("Not yet shared");
    expect(partyReviewHeadline(expiredLink)).toBe("Review link expired");
    expect(partyReviewHeadline(approved)).toBe("Approved · 30 Jul 2026");
    expect(partyReviewHeadline(changes)).toBe("Requested changes · 30 Jul 2026");
    expect(partyReviewHeadline(withdrawn)).toBe("Withdrew approval · 30 Jul 2026");
  });

  it("does not pair waiting copy with a no-link note", () => {
    expect(partyReviewLinkNote(pending)).toBeNull();
    expect(partyReviewLinkNote(neverSent)).toBeNull();
    expect(partyReviewLinkNote(expiredLink)).toBeNull();
    expect(partyReviewLinkNote(approved)).toBeNull();
    expect(
      partyReviewLinkNote({
        ...approved,
        hasReviewToken: false,
        reviewLinkStatus: "none",
      }),
    ).toBe(
      "Their review link is no longer active. Resend a link if they need to change their response.",
    );
  });

  it("treats a missing reviewLinkStatus plus no live token as never-sent", () => {
    const stalePayload = {
      ...pending,
      hasReviewToken: false,
      reviewLinkStatus: undefined,
    };
    expect(resolveReviewLinkStatus(stalePayload)).toBe("none");
    expect(partyReviewHeadline(stalePayload)).toBe("Review link not sent");
    expect(partyReviewStatusIcon(stalePayload)).toBe("link-off");
    expect(partyReviewSendActionTitle(stalePayload)).toBe("Send link");
    expect(partyReviewLinkNote(stalePayload)).toBeNull();
  });

  it("keeps waiting when a live token exists even if reviewLinkStatus is omitted", () => {
    const staleLive = { ...pending, reviewLinkStatus: undefined };
    expect(resolveReviewLinkStatus(staleLive)).toBe("active");
    expect(partyReviewHeadline(staleLive)).toBe("Waiting for response");
  });

  it("shows not yet shared when token is live but share is unconfirmed", () => {
    const mintedUnshared = {
      ...pending,
      hasBeenShared: false,
      reviewSharedAt: null,
      reviewLinkStatus: undefined as undefined,
    };
    expect(partyReviewHeadline(mintedUnshared)).toBe("Not yet shared");
  });

  it("picks status icons and send vs resend action labels", () => {
    expect(partyReviewStatusIcon(pending)).toBe("clock-outline");
    expect(partyReviewStatusIcon(notYetShared)).toBe("share-variant-outline");
    expect(partyReviewStatusIcon(approved)).toBe("check-circle");
    expect(partyReviewStatusIcon(changes)).toBe("alert-circle-outline");
    expect(partyReviewStatusIcon(withdrawn)).toBe("close-circle-outline");
    expect(partyReviewStatusIcon(neverSent)).toBe("link-off");
    expect(partyReviewStatusIcon(expiredLink)).toBe("clock-alert-outline");
    expect(partyReviewSendActionTitle(neverSent)).toBe("Send link");
    expect(partyReviewSendActionTitle(pending)).toBe("Resend link");
    expect(partyReviewSendActionTitle(expiredLink)).toBe("Resend link");
  });

  it("detects minted-but-unshared parties awaiting confirmation", () => {
    expect(partyHasConfirmedShare(notYetShared)).toBe(false);
    expect(partyHasConfirmedShare(pending)).toBe(true);
    expect(partyHasConfirmedShare({ hasBeenShared: true, reviewSharedAt: null })).toBe(true);
  });

  it("shows phone-discuss copy when changes were requested without a comment", () => {
    expect(partyChangesComment(changes)).toBe("Lower the rent");
    expect(
      partyChangesComment({
        ...changes,
        reviewComment: "  ",
      }),
    ).toBe("They asked to discuss this by phone.");
    expect(partyChangesComment(pending)).toBeNull();
  });

  it("formats money and roles for the detail screen", () => {
    expect(formatAgreementMoney(6_000_000)).toBe("Rs.60000");
    expect(formatAgreementMoney(null)).toBe("Not set");
    expect(partyRoleLabel("owner")).toBe("Owner");
    expect(partyRoleLabel("tenant")).toBe("Tenant");
  });

  it("keeps contract dates literal and formats review instants in India", () => {
    expect(formatAgreementDate("2026-09-12")).toBe("12 Sept 2026");
    expect(formatAgreementDate("2026-09-11T20:16:59.636Z")).toBe(
      "12 Sept 2026",
    );
  });
});

describe("terms validation", () => {
  const validTerms = {
    executionDate: "2026-08-13",
    effectiveDate: "2026-08-14",
    endDate: "2027-08-12",
    executionCity: "Hyderabad",
    durationMonths: "11",
    minStayMonths: "0",
    noticePeriodLicenseeMonths: "0",
    noticePeriodLicensorMonths: "0",
    monthlyRentRupees: "60000",
    securityDepositRupees: "120000",
    brokerageFeeRupees: "",
    maintenanceIncluded: true,
    monthlyMaintenanceRupees: "3000",
    rentDueDay: "5",
  };

  it("rejects end date on or before effective date", () => {
    const result = TermsStepSchema.safeParse({
      ...validTerms,
      effectiveDate: "2026-07-01",
      endDate: "2026-07-01",
      durationMonths: "11",
      maintenanceIncluded: false,
      monthlyMaintenanceRupees: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects the 17-day Finish repro with a min-duration message", () => {
    const result = TermsStepSchema.safeParse({
      ...validTerms,
      executionDate: "2026-08-13",
      effectiveDate: "2026-08-14",
      endDate: "2026-08-31",
      durationMonths: "0",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.flatten().fieldErrors;
    expect(fields.durationMonths).toEqual([
      "Agreement must be at least one month",
    ]);
    expect(fields.endDate).toEqual([
      "Agreement must be at least one month",
    ]);
  });

  it("accepts an 11-month 29-day span", () => {
    const result = TermsStepSchema.safeParse(validTerms);
    expect(result.success).toBe(true);
  });

  it("accepts an exact one-month span", () => {
    const result = TermsStepSchema.safeParse({
      ...validTerms,
      effectiveDate: "2026-08-14",
      endDate: "2026-09-14",
      durationMonths: "1",
    });
    expect(result.success).toBe(true);
  });

  it("uses cannot-be-empty for blank money, not the rupees format message", () => {
    const result = TermsStepSchema.safeParse({
      ...validTerms,
      monthlyRentRupees: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.monthlyRentRupees).toEqual([
      "Monthly rent cannot be empty",
    ]);
  });
});

describe("record derivation", () => {
  it("deduplicates properties by normalized address", () => {
    const records = derivePropertyRecords([
      detail({ propertyAddress: "1 Main Road" }),
      detail({ id: "other", propertyAddress: "  1 MAIN ROAD  " }),
    ]);
    expect(records).toHaveLength(1);
  });

  it("deduplicates people by phone", () => {
    const party = {
      id: "owner",
      role: "owner" as const,
      name: "Owner",
      phone: "9876543210",
      title: null,
      age: null,
      address: null,
      aadhaar: null,
      pan: null,
      email: null,
      isPrimary: true,
      sortOrder: 0,
      approvalStatus: "pending" as const,
      reviewComment: null,
      reviewedAt: null,
      hasReviewToken: false,
      reviewLinkStatus: "none" as const,
      reviewSharedAt: null,
      hasBeenShared: false,
    };
    expect(
      derivePersonRecords(
        [detail({ parties: [party] }), detail({ id: "other", parties: [party] })],
        "owner",
      ),
    ).toHaveLength(1);
  });
});

describe("primaryByRole / parties PUT payload", () => {
  function filled(
    role: "owner" | "tenant",
    phone: string,
    isPrimary: boolean,
  ) {
    return {
      ...emptyParty(role, isPrimary),
      title: "Mr.",
      name: role === "owner" ? "Owner One" : "Tenant One",
      age: 36,
      address: "1 Main Road",
      aadhaar: "967132807649",
      email: `${role}@example.com`,
      phone,
    };
  }

  it("defaultNewParties sets isPrimary true on first owner and first tenant", () => {
    const parties = defaultNewParties();
    expect(parties.map((party) => ({ role: party.role, isPrimary: party.isPrimary }))).toEqual([
      { role: "owner", isPrimary: true },
      { role: "tenant", isPrimary: true },
    ]);
  });

  it("BUG regression: empty rows with isPrimary false fail Zod (old form defaults)", () => {
    // This is exactly what PartiesForm used to validate on Next before primaryByRole ran.
    const brokenFormState = {
      parties: [emptyParty("owner", false), emptyParty("tenant", false)].map((party, index) => ({
        ...party,
        title: "Mr.",
        name: index === 0 ? "Owner" : "Tenant",
        age: 36,
        address: "1 Main Road",
        aadhaar: "967132807649",
        email: `${party.role}@example.com`,
        phone: index === 0 ? "9876543210" : "9876543211",
      })),
    };
    const result = PartyCreationSchema.safeParse(brokenFormState);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("primary owner"))).toBe(
        true,
      );
    }
  });

  it("1-owner-1-tenant PUT body has isPrimary true exactly once per role", () => {
    // Simulates the payload PartiesForm sends to replaceLeaseAgreementParties.
    const formValues = [
      filled("owner", "9876543210", false), // even if UI forgot the flag…
      filled("tenant", "9876543211", false),
    ];
    const partiesPayload = primaryByRole(formValues);
    const snapshot = partiesPayload.map((party) => ({
      role: party.role,
      isPrimary: party.isPrimary,
      sortOrder: party.sortOrder,
      name: party.name,
      phone: party.phone,
    }));
    expect(snapshot).toEqual([
      {
        role: "owner",
        isPrimary: true,
        sortOrder: 0,
        name: "Owner One",
        phone: "9876543210",
      },
      {
        role: "tenant",
        isPrimary: true,
        sortOrder: 1,
        name: "Tenant One",
        phone: "9876543211",
      },
    ]);
    expect(PartyCreationSchema.safeParse({ parties: partiesPayload }).success).toBe(true);
  });

  it("second owner stays non-primary; first owner remains the only primary", () => {
    const partiesPayload = primaryByRole([
      filled("owner", "9876543210", true),
      filled("tenant", "9876543211", true),
      filled("owner", "9876543212", true), // wrongly marked primary — corrected by stamp
    ]);
    const owners = partiesPayload.filter((party) => party.role === "owner");
    expect(owners.map((party) => party.isPrimary)).toEqual([true, false]);
    expect(partiesPayload.filter((party) => party.role === "tenant").map((p) => p.isPrimary)).toEqual([
      true,
    ]);
    expect(PartyCreationSchema.safeParse({ parties: partiesPayload }).success).toBe(true);
  });

  it("removing the primary owner promotes the next owner", () => {
    const afterRemove = primaryByRole([
      filled("owner", "9876543212", false),
      filled("tenant", "9876543211", true),
    ]);
    expect(afterRemove.map((party) => ({ role: party.role, isPrimary: party.isPrimary }))).toEqual([
      { role: "owner", isPrimary: true },
      { role: "tenant", isPrimary: true },
    ]);
  });

  it("requires Aadhaar Number and rejects non-12-digit values", () => {
    const missing = PartyCreationSchema.safeParse({
      parties: [
        { ...filled("owner", "9876543210", true), aadhaar: null },
        filled("tenant", "9876543211", true),
      ],
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(
        missing.error.issues.some((issue) =>
          issue.message.includes("Aadhaar Number is required"),
        ),
      ).toBe(true);
    }

    const short = PartyCreationSchema.safeParse({
      parties: [
        { ...filled("owner", "9876543210", true), aadhaar: "12345678901" },
        filled("tenant", "9876543211", true),
      ],
    });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(
        short.error.issues.some(
          (issue) =>
            issue.message.includes("12 digits") ||
            issue.message.includes("Aadhaar Number must be exactly 12 digits"),
        ),
      ).toBe(true);
    }
  });

  it("createRolePartySchema rejects out-of-range age with product copy", () => {
    const schema = createRolePartySchema("tenant");
    const result = schema.safeParse({
      parties: [{ ...filled("tenant", "9876543211", true), age: 3000 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === "Please enter a correct age.",
        ),
      ).toBe(true);
    }
  });

  it("createRolePartySchema on Next still reports every empty required field", () => {
    const schema = createRolePartySchema("owner");
    const result = schema.safeParse({
      parties: [emptyParty("owner", true)],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toEqual(
        expect.arrayContaining([
          "Name is required",
          "Title is required",
          "Age is required",
          "Current address is required",
          "Aadhaar Number is required",
          "Email Address is required",
        ]),
      );
      // PAN stays optional — no blank PAN issue.
      expect(messages.some((message) => /pan/i.test(message))).toBe(false);
    }
  });

  it("createRolePartySchema does not throw on incomplete phone (Zod aborted transform)", () => {
    const schema = createRolePartySchema("owner");
    // Mid-edit provisional E.164 fails phoneSchema transform; Zod still runs
    // superRefine with party.phone = { status: "aborted" }. Must not throw.
    const result = schema.safeParse({
      parties: [
        {
          ...filled("owner", "9876543210", true),
          phone: "+91987",
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("phone"),
        ),
      ).toBe(true);
    }
  });
});
