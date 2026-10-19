import { describe, expect, it } from "vitest";
import type { BrokerProfile } from "@workspace/api-schemas";
import {
  buildProfileDetailSections,
  formatConsultantRoleLabel,
  REFER_A_FRIEND_MESSAGE,
  TRUSTKEYPER_SHARE_URL,
} from "./profileDisplay";

function profile(overrides: Partial<BrokerProfile> = {}): BrokerProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    name: "Aman Rao",
    age: 34,
    firmName: "Trust Homes",
    employmentType: "full_time",
    businessSinceYear: 2018,
    propertiesHandled: 40,
    dealsWith: ["rent", "other"],
    dealsWithOther: "PG",
    propertyTypes: ["flats", "villas"],
    propertyTypesOther: null,
    region: "Hyderabad",
    pincodes: ["500032", "500081"],
    stepCompleted: 4,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatConsultantRoleLabel", () => {
  it("maps broker (and empty) to Property Consultant", () => {
    expect(formatConsultantRoleLabel("broker")).toBe("Property Consultant");
    expect(formatConsultantRoleLabel(null)).toBe("Property Consultant");
    expect(formatConsultantRoleLabel("")).toBe("Property Consultant");
  });
});

describe("buildProfileDetailSections", () => {
  it("builds labeled sections from a complete profile", () => {
    expect(buildProfileDetailSections(profile())).toEqual([
      {
        title: "About you",
        rows: [
          { label: "Age", value: "34" },
          { label: "Firm name", value: "Trust Homes" },
        ],
      },
      {
        title: "Business",
        rows: [
          { label: "Employment type", value: "Full time" },
          { label: "In business since", value: "2018" },
          { label: "Properties handled", value: "40" },
        ],
      },
      {
        title: "Work",
        rows: [
          { label: "Deals with", value: "Rent, Other (PG)" },
          { label: "Property types", value: "Flats, Villas" },
        ],
      },
      {
        title: "Location",
        rows: [
          { label: "Work locations", value: "Hyderabad" },
          { label: "Pincodes", value: "500032, 500081" },
        ],
      },
    ]);
  });

  it("omits empty optional fields", () => {
    const sections = buildProfileDetailSections(
      profile({
        age: null,
        firmName: "  ",
        employmentType: "",
        businessSinceYear: null,
        propertiesHandled: null,
        dealsWith: [],
        propertyTypes: [],
        region: "",
        pincodes: [],
      }),
    );
    expect(sections).toEqual([]);
  });

  it("shows joined neighbourhood names from region as work locations", () => {
    expect(
      buildProfileDetailSections(
        profile({
          region: "Gachibowli, Madhapur, Financial District",
          pincodes: [],
        }),
      ),
    ).toContainEqual({
      title: "Location",
      rows: [
        {
          label: "Work locations",
          value: "Gachibowli, Madhapur, Financial District",
        },
      ],
    });
  });

  it("shows region without a pincodes row when pincodes are empty", () => {
    const sections = buildProfileDetailSections(
      profile({
        age: null,
        firmName: null,
        employmentType: "",
        businessSinceYear: null,
        propertiesHandled: null,
        dealsWith: [],
        propertyTypes: [],
        region: "Hyderabad",
        pincodes: [],
      }),
    );
    expect(sections).toEqual([
      {
        title: "Location",
        rows: [{ label: "Work locations", value: "Hyderabad" }],
      },
    ]);
  });

  it("shows a stored state as its own editable profile detail", () => {
    const sections = buildProfileDetailSections(
      profile({
        region: "Bengaluru, KARNATAKA",
        pincodes: ["560025"],
      }),
    );
    expect(sections).toContainEqual({
      title: "Location",
      rows: [
        { label: "Work locations", value: "Bengaluru" },
        { label: "State", value: "Karnataka" },
        { label: "Pincodes", value: "560025" },
      ],
    });
  });
});

describe("refer-a-friend share copy", () => {
  it("points at the marketing site (no store listing yet)", () => {
    expect(TRUSTKEYPER_SHARE_URL).toBe("https://trustkeyper.com");
    expect(REFER_A_FRIEND_MESSAGE).toContain("property consultant");
    expect(REFER_A_FRIEND_MESSAGE).toContain(TRUSTKEYPER_SHARE_URL);
  });
});
