import { bigint, boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties.js";

export const propertyInquiriesTable = pgTable("property_inquiries", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  propertyId: text("property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
  propertyLabel: text("property_label").notNull().default(""),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  who: text("who"),
  food: text("food"),
  linkedinUrl: text("linkedin_url"),
  status: text("status").notNull().default("open"),
  leadStatus: text("lead_status"),
  source: text("source"),
  sharedBy: text("shared_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const propertyInvitesTable = pgTable("property_invites", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  propertyId: text("property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
  propertyLabel: text("property_label").notNull().default(""),
  inquiryId: text("inquiry_id").references(() => propertyInquiriesTable.id, { onDelete: "set null" }),
  invitationId: text("invitation_id"),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  who: text("who"),
  food: text("food"),
  linkedinUrl: text("linkedin_url"),
  monthlyRentPaise: bigint("monthly_rent_paise", { mode: "number" }),
  maintenanceIncluded: boolean("maintenance_included").notNull().default(false),
  monthlyMaintenancePaise: bigint("monthly_maintenance_paise", { mode: "number" }),
  securityDepositPaise: bigint("security_deposit_paise", { mode: "number" }),
  startDate: text("start_date").notNull().default(""),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "date" }),
});

export const maintenanceTicketsTable = pgTable("maintenance_tickets", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  propertyId: text("property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("Pending"),
  priority: text("priority"),
  raisedBy: text("raised_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  label: text("label").notNull().default(""),
  fileName: text("file_name").notNull().default(""),
  fileSize: bigint("file_size", { mode: "number" }),
  fileUrl: text("file_url").notNull().default(""),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const brokerOnboardInvitesTable = pgTable("broker_onboard_invites", {
  id: text("id").primaryKey(),
  brokerPhone: text("broker_phone").notNull(),
  tenantPhone: text("tenant_phone").notNull(),
  tenantName: text("tenant_name").notNull().default(""),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type PropertyInquiriesRow = typeof propertyInquiriesTable.$inferSelect;
export type InsertPropertyInquiriesRow = typeof propertyInquiriesTable.$inferInsert;
export type PropertyInvitesRow = typeof propertyInvitesTable.$inferSelect;
export type InsertPropertyInvitesRow = typeof propertyInvitesTable.$inferInsert;
export type MaintenanceTicketsRow = typeof maintenanceTicketsTable.$inferSelect;
export type InsertMaintenanceTicketsRow = typeof maintenanceTicketsTable.$inferInsert;
export type DocumentsRow = typeof documentsTable.$inferSelect;
export type InsertDocumentsRow = typeof documentsTable.$inferInsert;
export type BrokerOnboardInvitesRow = typeof brokerOnboardInvitesTable.$inferSelect;
export type InsertBrokerOnboardInvitesRow = typeof brokerOnboardInvitesTable.$inferInsert;
