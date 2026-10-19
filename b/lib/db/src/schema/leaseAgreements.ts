import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  type AnyPgColumn,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Mobile lease agreement parent.
 * Distinct from public.agreements (web blob-mirror).
 *
 * App-enforced (Zod / API — not DB): signer count 2–5; ≥1 owner + ≥1 tenant.
 * Commercial / property columns nullable until the creation flow fills them.
 */
export const leaseAgreementsTable = pgTable("lease_agreements", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdByUserId: uuid("created_by_user_id").notNull(),
  renewedFromAgreementId: uuid("renewed_from_agreement_id").references(
    (): AnyPgColumn => leaseAgreementsTable.id,
    { onDelete: "set null" },
  ),
  status: text("status").notNull().default("draft"),
  executionDate: date("execution_date"),
  effectiveDate: date("effective_date"),
  endDate: date("end_date"),
  executionCity: text("execution_city"),
  durationMonths: integer("duration_months"),
  minStayMonths: integer("min_stay_months"),
  noticePeriodLicenseeMonths: integer("notice_period_licensee_months"),
  noticePeriodLicensorMonths: integer("notice_period_licensor_months"),
  monthlyRentPaise: integer("monthly_rent_paise"),
  securityDepositPaise: integer("security_deposit_paise"),
  rentDueDay: integer("rent_due_day"),
  /** Broker-negotiated brokerage in paise; nullable until set. Shown to tenant after signing. */
  brokerageFeePaise: integer("brokerage_fee_paise"),
  /** When true, maintenance is included in rent. */
  maintenanceIncluded: boolean("maintenance_included").notNull().default(false),
  /** Monthly maintenance in paise when not included; null when included. */
  monthlyMaintenancePaise: integer("monthly_maintenance_paise"),
  propertyAddress: text("property_address"),
  areaSqft: numeric("area_sqft"),
  facing: text("facing"),
  carParkingCount: integer("car_parking_count"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  /** Private Vercel Blob pathname for the uploaded signed PDF. Never expose to clients. */
  signedPdfPathname: text("signed_pdf_pathname"),
  signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
  signedUploadedByPhone: text("signed_uploaded_by_phone"),
  signingNotifiedAt: timestamp("signing_notified_at", { withTimezone: true, mode: "date" }),
});

/**
 * Structured signatories for a lease_agreements row.
 * App-enforced: 2–5 parties total; ≥1 owner + ≥1 tenant; phone normalized to E.164 before insert.
 * Phone is for contact / future Leegality invitees; document text uses title/name/age/address/aadhaar/pan; signatures use name + email.
 */
export const agreementPartiesTable = pgTable("agreement_parties", {
  id: uuid("id").defaultRandom().primaryKey(),
  agreementId: uuid("agreement_id")
    .notNull()
    .references(() => leaseAgreementsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  name: text("name").notNull(),
  /** E.164, e.g. +919876543210. */
  phone: text("phone").notNull(),
  title: text("title"),
  age: integer("age"),
  address: text("address"),
  aadhaar: text("aadhaar"),
  pan: text("pan"),
  email: text("email"),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  reviewToken: text("review_token"),
  reviewTokenExpiresAt: timestamp("review_token_expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  /** Set when the broker confirms the review link was shared (iOS Share or attestation). */
  reviewSharedAt: timestamp("review_shared_at", {
    withTimezone: true,
    mode: "date",
  }),
  approvalStatus: text("approval_status").notNull().default("pending"),
  reviewComment: text("review_comment"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

/**
 * Flat Annexure-1 fixtures & fittings (description + quantity).
 */
export const agreementInventoryItemsTable = pgTable("agreement_inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  agreementId: uuid("agreement_id")
    .notNull()
    .references(() => leaseAgreementsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  /** Positive count; default 1 for legacy rows. */
  quantity: integer("quantity").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type LeaseAgreementsRow = typeof leaseAgreementsTable.$inferSelect;
export type InsertLeaseAgreementsRow = typeof leaseAgreementsTable.$inferInsert;
export type AgreementPartiesRow = typeof agreementPartiesTable.$inferSelect;
export type InsertAgreementPartiesRow = typeof agreementPartiesTable.$inferInsert;
export type AgreementInventoryItemsRow = typeof agreementInventoryItemsTable.$inferSelect;
export type InsertAgreementInventoryItemsRow = typeof agreementInventoryItemsTable.$inferInsert;
