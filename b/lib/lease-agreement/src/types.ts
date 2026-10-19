export type LeasePartyRole = "owner" | "tenant";

export type LeasePartyPdfInput = {
  role: LeasePartyRole;
  title: string | null;
  name: string;
  age: number | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  email: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type LeaseInventoryItemPdfInput = {
  description: string;
  quantity: number;
  sortOrder: number;
};
export type LeaseAgreementPdfInput = {
  executionDate: string;
  effectiveDate: string;
  endDate: string;
  executionCity: string;
  durationMonths: number;
  minStayMonths: number;
  noticePeriodLicenseeMonths: number;
  noticePeriodLicensorMonths: number;
  monthlyRentPaise: number;
  securityDepositPaise: number;
  rentDueDay: number;
  propertyAddress: string;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
  /** 2–5 parties; caller/Zod enforce ≥1 owner + ≥1 tenant. */
  parties: LeasePartyPdfInput[];
  inventoryItems: LeaseInventoryItemPdfInput[];
};

export type LeaseAgreementPdfResult = {
  bytes: Uint8Array;
  pageCount: number;
};
