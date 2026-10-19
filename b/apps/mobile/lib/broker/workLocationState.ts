const INDIAN_STATES: readonly string[] = [
  "ANDHRA PRADESH",
  "ARUNACHAL PRADESH",
  "ASSAM",
  "BIHAR",
  "CHHATTISGARH",
  "GOA",
  "GUJARAT",
  "HARYANA",
  "HIMACHAL PRADESH",
  "JHARKHAND",
  "KARNATAKA",
  "KERALA",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "MANIPUR",
  "MEGHALAYA",
  "MIZORAM",
  "NAGALAND",
  "ODISHA",
  "PUNJAB",
  "RAJASTHAN",
  "SIKKIM",
  "TAMIL NADU",
  "TELANGANA",
  "TRIPURA",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "WEST BENGAL",
  "ANDAMAN AND NICOBAR ISLANDS",
  "CHANDIGARH",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DELHI",
  "JAMMU AND KASHMIR",
  "LADAKH",
  "LAKSHADWEEP",
  "PUDUCHERRY",
];

const STATE_SET = new Set(INDIAN_STATES);

/** Common city / locality tokens → state name. */
const CITY_TO_STATE: Record<string, string> = {
  hyderabad: "TELANGANA",
  secunderabad: "TELANGANA",
  bengaluru: "KARNATAKA",
  bangalore: "KARNATAKA",
  mysuru: "KARNATAKA",
  mysore: "KARNATAKA",
  mumbai: "MAHARASHTRA",
  pune: "MAHARASHTRA",
  nagpur: "MAHARASHTRA",
  "navi mumbai": "MAHARASHTRA",
  delhi: "DELHI",
  "new delhi": "DELHI",
  gurgaon: "HARYANA",
  gurugram: "HARYANA",
  noida: "UTTAR PRADESH",
  chennai: "TAMIL NADU",
  coimbatore: "TAMIL NADU",
  kolkata: "WEST BENGAL",
  ahmedabad: "GUJARAT",
  surat: "GUJARAT",
  jaipur: "RAJASTHAN",
  kochi: "KERALA",
  thiruvananthapuram: "KERALA",
  chandigarh: "CHANDIGARH",
  lucknow: "UTTAR PRADESH",
  indore: "MADHYA PRADESH",
  bhopal: "MADHYA PRADESH",
  visakhapatnam: "ANDHRA PRADESH",
  vijayawada: "ANDHRA PRADESH",
};

function normalizedValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeIndianState(value: string): string | null {
  const normalized = normalizedValue(value);
  return STATE_SET.has(normalized) ? normalized : null;
}

export function findIndianStateInRegion(region: string): string | null {
  const upper = normalizedValue(region);
  const sorted = [...INDIAN_STATES].sort((a, b) => b.length - a.length);
  for (const state of sorted) {
    if (upper.includes(state)) return state;
  }
  return null;
}

export function deriveIndianState(region: string): string | null {
  const explicitState = findIndianStateInRegion(region);
  if (explicitState) return explicitState;

  const lower = region.toLowerCase();
  const cities = Object.keys(CITY_TO_STATE).sort((a, b) => b.length - a.length);
  for (const city of cities) {
    if (lower.includes(city)) return CITY_TO_STATE[city] ?? null;
  }
  return null;
}

export function regionWithoutIndianState(region: string): string {
  return region
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && normalizeIndianState(part) == null)
    .join(", ");
}

export function regionWithIndianState(region: string, state: string): string {
  const normalizedState = normalizeIndianState(state);
  if (!normalizedState) return region.trim();

  const parts = region
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hasIndia = parts.some((part) => normalizedValue(part) === "INDIA");
  const locationParts = parts.filter(
    (part) =>
      normalizedValue(part) !== "INDIA" && normalizeIndianState(part) == null,
  );

  return [...locationParts, normalizedState, ...(hasIndia ? ["India"] : [])].join(
    ", ",
  );
}

export function formatIndianState(state: string): string {
  return state
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}
