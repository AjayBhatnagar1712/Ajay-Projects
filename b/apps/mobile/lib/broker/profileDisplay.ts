import type { BrokerProfile } from "@workspace/api-schemas";
import {
  findIndianStateInRegion,
  formatIndianState,
  regionWithoutIndianState,
} from "./workLocationState";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
};

const DEAL_LABELS: Record<string, string> = {
  rent: "Rent",
  sale: "Sale",
  maintenance: "Maintenance",
  other: "Other",
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  flats: "Flats",
  independent_house: "Independent house",
  community_flats: "Community flats",
  villas: "Villas",
  commercial: "Commercial",
  other: "Other",
};

/** UI label for the signed-in consultant role (copy only — storage stays `broker`). */
export function formatConsultantRoleLabel(
  role: string | null | undefined,
): string {
  if (role == null || role.trim().length === 0 || role === "broker") {
    return "Property Consultant";
  }
  return role;
}

function labelList(
  values: readonly string[],
  labels: Record<string, string>,
  otherText: string | null | undefined,
): string | null {
  if (values.length === 0) return null;
  const parts = values.map((value) => {
    if (value === "other") {
      const trimmed = otherText?.trim() ?? "";
      return trimmed.length > 0
        ? `Other (${trimmed})`
        : (labels.other ?? "Other");
    }
    return labels[value] ?? value;
  });
  return parts.join(", ");
}

export type ProfileDetailRow = {
  label: string;
  value: string;
};

export type ProfileDetailSection = {
  title: string;
  rows: ProfileDetailRow[];
};

/**
 * Build labeled profile sections from onboarding fields.
 * Omits empty/null values so the UI stays sparse when data is missing.
 */
export function buildProfileDetailSections(
  profile: BrokerProfile,
): ProfileDetailSection[] {
  const about: ProfileDetailRow[] = [];
  if (profile.age != null) {
    about.push({ label: "Age", value: String(profile.age) });
  }
  const firm = profile.firmName?.trim() ?? "";
  if (firm.length > 0) {
    about.push({ label: "Firm name", value: firm });
  }

  const business: ProfileDetailRow[] = [];
  const employment = EMPLOYMENT_LABELS[profile.employmentType];
  if (employment) {
    business.push({ label: "Employment type", value: employment });
  }
  if (profile.businessSinceYear != null) {
    business.push({
      label: "In business since",
      value: String(profile.businessSinceYear),
    });
  }
  if (profile.propertiesHandled != null) {
    business.push({
      label: "Properties handled",
      value: String(profile.propertiesHandled),
    });
  }

  const work: ProfileDetailRow[] = [];
  const deals = labelList(
    profile.dealsWith,
    DEAL_LABELS,
    profile.dealsWithOther,
  );
  if (deals) work.push({ label: "Deals with", value: deals });
  const types = labelList(
    profile.propertyTypes,
    PROPERTY_TYPE_LABELS,
    profile.propertyTypesOther,
  );
  if (types) work.push({ label: "Property types", value: types });

  const location: ProfileDetailRow[] = [];
  const region = profile.region.trim();
  if (region.length > 0) {
    const state = findIndianStateInRegion(region);
    const workLocations = regionWithoutIndianState(region);
    if (workLocations.length > 0) {
      location.push({ label: "Work locations", value: workLocations });
    }
    if (state) {
      location.push({ label: "State", value: formatIndianState(state) });
    }
  }
  if (profile.pincodes.length > 0) {
    location.push({ label: "Pincodes", value: profile.pincodes.join(", ") });
  }

  const sections: ProfileDetailSection[] = [];
  if (about.length > 0) sections.push({ title: "About you", rows: about });
  if (business.length > 0) sections.push({ title: "Business", rows: business });
  if (work.length > 0) sections.push({ title: "Work", rows: work });
  if (location.length > 0) sections.push({ title: "Location", rows: location });
  return sections;
}

/**
 * Marketing site — no Play Store / App Store listing exists yet
 * (see docs/open-items.md launch readiness).
 */
export const TRUSTKEYPER_SHARE_URL = "https://trustkeyper.com";

export const REFER_A_FRIEND_MESSAGE = [
  "I'm using TrustKeyper to create lease agreements for my clients.",
  "Know another property consultant? Share TrustKeyper with them:",
  TRUSTKEYPER_SHARE_URL,
].join("\n");
