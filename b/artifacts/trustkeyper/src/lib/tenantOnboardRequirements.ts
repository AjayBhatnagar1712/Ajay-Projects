export const MOVE_IN_TIMELINES = [
  "Immediately",
  "Within 15 Days",
  "Within 1 Month",
  "Flexible",
] as const;

export type MoveInTimeline = (typeof MOVE_IN_TIMELINES)[number];

export const OCCUPANCY_TYPES = [
  "Bachelor",
  "Family",
  "Couple",
  "Working Professionals",
  "Students",
  "Other",
] as const;

export type OnboardOccupancyType = (typeof OCCUPANCY_TYPES)[number];

export const FOOD_PREFERENCES = ["Vegetarian", "Non Vegetarian", "Any"] as const;

export type OnboardFoodPreference = (typeof FOOD_PREFERENCES)[number];

export const SHARING_PREFERENCES = [
  "Single Occupancy",
  "Double Sharing",
  "Triple Sharing",
  "No Preference",
] as const;

export type OnboardSharingPreference = (typeof SHARING_PREFERENCES)[number];

export const ONBOARD_PROPERTY_TYPES = [
  "Apartment",
  "Independent House",
  "Villa",
  "Studio",
  "PG",
  "Shared Accommodation",
  "Other",
] as const;

export type OnboardPropertyType = (typeof ONBOARD_PROPERTY_TYPES)[number];

export const BACHELOR_GENDERS = ["Male", "Female"] as const;

export type BachelorGender = (typeof BACHELOR_GENDERS)[number];

export const ROOMMATE_GENDERS = ["Male", "Female", "Anyone"] as const;

export type RoommateGender = (typeof ROOMMATE_GENDERS)[number];

export type TenantOnboardL1Draft = {
  linkedinUrl: string;
  moveInTimeline: MoveInTimeline | "";
  occupancyType: OnboardOccupancyType | "";
  occupancyOther: string;
  bachelorGender: BachelorGender | "";
  foodPreference: OnboardFoodPreference | "";
};

export type TenantOnboardL2Draft = {
  city: string;
  localities: string[];
  sharingPreference: OnboardSharingPreference | "";
  roommateGender: RoommateGender | "";
  propertyType: OnboardPropertyType | "";
  propertyTypeOther: string;
};

export function requiresBachelorGender(occupancyType: string): boolean {
  return occupancyType === "Bachelor";
}

export function requiresOccupancyOther(occupancyType: string): boolean {
  return occupancyType === "Other";
}

export function requiresRoommateGender(sharing: string): boolean {
  return sharing === "Double Sharing" || sharing === "Triple Sharing";
}

export function requiresPropertyTypeOther(propertyType: string): boolean {
  return propertyType === "Other";
}

export function validateTenantOnboardL1(draft: TenantOnboardL1Draft): string | null {
  if (!draft.linkedinUrl.trim()) return "LinkedIn profile is required";
  if (!draft.moveInTimeline) return "Move-in timeline is required";
  if (!draft.occupancyType) return "Occupancy type is required";
  if (requiresOccupancyOther(draft.occupancyType) && !draft.occupancyOther.trim()) {
    return "Please describe who will be staying";
  }
  if (requiresBachelorGender(draft.occupancyType) && !draft.bachelorGender) {
    return "Gender is required for bachelors";
  }
  if (!draft.foodPreference) return "Food preference is required";
  return null;
}

export function validateTenantOnboardL2(draft: TenantOnboardL2Draft): string | null {
  if (draft.localities.length === 0) return "Select at least one preferred locality";
  if (!draft.sharingPreference) return "Sharing preference is required";
  if (requiresRoommateGender(draft.sharingPreference) && !draft.roommateGender) {
    return "Preferred roommate gender is required";
  }
  if (!draft.propertyType) return "Property type is required";
  if (requiresPropertyTypeOther(draft.propertyType) && !draft.propertyTypeOther.trim()) {
    return "Please specify the property type";
  }
  return null;
}

export function formatMoveInDisplay(value?: string): string {
  if (!value) return "—";
  if (MOVE_IN_TIMELINES.includes(value as MoveInTimeline)) return value;
  try {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch {
    /* not a date */
  }
  return value;
}

export function formatPropertyTypeDisplay(
  propertyType?: string,
  propertyTypeOther?: string,
): string {
  if (!propertyType) return "—";
  if (propertyType === "Other" && propertyTypeOther?.trim()) {
    return propertyTypeOther.trim();
  }
  return propertyType;
}

export function formatOccupancyDisplay(who?: string, whoOther?: string): string {
  if (!who) return "—";
  if (who === "Other" && whoOther?.trim()) return whoOther.trim();
  return who;
}
