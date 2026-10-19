import { bigint, boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties.js";

export const tenantsTable = pgTable("tenants", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  who: text("who"),
  food: text("food"),
  city: text("city"),
  localities: jsonb("localities"),
  propertyType: text("property_type"),
  sharing: text("sharing"),
  roommate: jsonb("roommate"),
  identify: jsonb("identify"),
  occupancyFrom: text("occupancy_from"),
  aadhaarUrl: text("aadhaar_url"),
  panUrl: text("pan_url"),
  status: text("status").notNull().default("Lead Added"),
  invitationSent: boolean("invitation_sent").notNull().default(false),
  detailsComplete: boolean("details_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const agreementsTable = pgTable("agreements", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  propertyId: text("property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
  propertyTitle: text("property_title").notNull().default(""),
  ownerName: text("owner_name").notNull().default(""),
  ownerContact: text("owner_contact").notNull().default(""),
  tenantId: text("tenant_id").references(() => tenantsTable.id, { onDelete: "set null" }),
  tenantName: text("tenant_name").notNull().default(""),
  tenantContact: text("tenant_contact").notNull().default(""),
  tenantAadhaar: text("tenant_aadhaar"),
  tenantPan: text("tenant_pan"),
  coTenantName: text("co_tenant_name"),
  coTenantContact: text("co_tenant_contact"),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date"),
  monthlyRentPaise: bigint("monthly_rent_paise", { mode: "number" }),
  securityDepositPaise: bigint("security_deposit_paise", { mode: "number" }),
  lockInPeriod: text("lock_in_period").notNull().default(""),
  noticePeriod: text("notice_period").notNull().default(""),
  rentDueDay: text("rent_due_day").notNull().default(""),
  maintenanceChargesPaise: bigint("maintenance_charges_paise", { mode: "number" }),
  maintenanceIncluded: boolean("maintenance_included").notNull().default(false),
  brokerageAmountPaise: bigint("brokerage_amount_paise", { mode: "number" }),
  brokeragePaidBy: text("brokerage_paid_by").notNull().default(""),
  brokerageMode: text("brokerage_mode").notNull().default(""),
  rentSplitMode: text("rent_split_mode"),
  rentSplits: jsonb("rent_splits"),
  agreementText: text("agreement_text"),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const agreementDocumentsTable = pgTable("agreement_documents", {
  id: text("id").primaryKey(),
  agreementId: text("agreement_id")
    .notNull()
    .references(() => agreementsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  fileUrl: text("file_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type TenantsRow = typeof tenantsTable.$inferSelect;
export type InsertTenantsRow = typeof tenantsTable.$inferInsert;
export type AgreementsRow = typeof agreementsTable.$inferSelect;
export type InsertAgreementsRow = typeof agreementsTable.$inferInsert;
export type AgreementDocumentsRow = typeof agreementDocumentsTable.$inferSelect;
export type InsertAgreementDocumentsRow = typeof agreementDocumentsTable.$inferInsert;
