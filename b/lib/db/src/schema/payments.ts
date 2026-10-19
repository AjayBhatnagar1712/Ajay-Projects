import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties.js";

export const paymentRecipientConfigTable = pgTable(
  "payment_recipient_config",
  {
    phone: text("phone").notNull(),
    role: text("role").notNull(),
    razorpayLinkedAccountId: text("razorpay_linked_account_id"),
    razorpayProductId: text("razorpay_product_id"),
    razorpayStakeholderId: text("razorpay_stakeholder_id"),
    razorpayReferenceId: text("razorpay_reference_id"),
    commissionRateBps: integer("commission_rate_bps").notNull().default(0),
    validationStatus: text("validation_status").notNull().default("pending"),
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.phone, table.role] }),
  }),
);

export const paymentRecipientKycTable = pgTable(
  "payment_recipient_kyc",
  {
    phone: text("phone").notNull(),
    role: text("role").notNull(),
    legalName: text("legal_name").notNull(),
    email: text("email").notNull(),
    pan: text("pan").notNull(),
    registeredAddress: jsonb("registered_address").notNull(),
    businessCategory: text("business_category").notNull(),
    businessSubcategory: text("business_subcategory").notNull(),
    businessType: text("business_type").notNull(),
    bankAccountNumber: text("bank_account_number"),
    bankIfsc: text("bank_ifsc"),
    bankHolderName: text("bank_holder_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.phone, table.role] }),
  }),
);

export const rentPaymentsTable = pgTable(
  "rent_payments",
  {
    id: text("id").primaryKey(),
    /** Soft ref: web `agreements.id` or mobile `lease_agreements.id` (no FK — dual table). */
    agreementId: text("agreement_id"),
    propertyId: text("property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
    ownerPhone: text("owner_phone").notNull(),
    tenantPhone: text("tenant_phone").notNull(),
    rentPeriod: text("rent_period"),
    paymentType: text("payment_type").notNull().default("rent"),
    brokerPhone: text("broker_phone"),
    payeeRole: text("payee_role"),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    commissionPaise: bigint("commission_paise", { mode: "number" }).notNull().default(0),
    ownerSettlementPaise: bigint("owner_settlement_paise", { mode: "number" }),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    razorpayTransferIds: jsonb("razorpay_transfer_ids"),
    paymentMethod: text("payment_method"),
    initiatedBy: text("initiated_by"),
    payerPhone: text("payer_phone"),
    status: text("status").notNull().default("created"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    settledAt: timestamp("settled_at", { withTimezone: true, mode: "date" }),
    transferFailedAt: timestamp("transfer_failed_at", { withTimezone: true, mode: "date" }),
    lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    rentPeriodUniq: uniqueIndex("rent_payments_rent_period_uniq")
      .on(table.agreementId, table.rentPeriod)
      .where(sql`${table.paymentType} = 'rent'`),
    brokerageUniq: uniqueIndex("rent_payments_brokerage_uniq")
      .on(table.agreementId, table.paymentType)
      .where(sql`${table.paymentType} IN ('brokerage_tenant', 'brokerage_owner')`),
  }),
);

export const rentPaymentTransfersTable = pgTable("rent_payment_transfers", {
  id: text("id").primaryKey(),
  rentPaymentId: text("rent_payment_id")
    .notNull()
    .references(() => rentPaymentsTable.id, { onDelete: "cascade" }),
  recipientPhone: text("recipient_phone").notNull(),
  recipientName: text("recipient_name").notNull().default(""),
  recipientRole: text("recipient_role"),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  razorpayTransferId: text("razorpay_transfer_id"),
  razorpayFundAccountId: text("razorpay_fund_account_id"),
  status: text("status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const razorpayWebhookEventsTable = pgTable("razorpay_webhook_events", {
  id: text("id").primaryKey(),
  razorpayEventId: text("razorpay_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  signatureValid: boolean("signature_valid").notNull().default(false),
  processingStatus: text("processing_status").notNull().default("received"),
  processingError: text("processing_error"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayTransferId: text("razorpay_transfer_id"),
  rentPaymentId: text("rent_payment_id").references(() => rentPaymentsTable.id, { onDelete: "set null" }),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type PaymentRecipientConfigRow = typeof paymentRecipientConfigTable.$inferSelect;
export type InsertPaymentRecipientConfigRow = typeof paymentRecipientConfigTable.$inferInsert;
export type PaymentRecipientKycRow = typeof paymentRecipientKycTable.$inferSelect;
export type InsertPaymentRecipientKycRow = typeof paymentRecipientKycTable.$inferInsert;
export type RentPaymentsRow = typeof rentPaymentsTable.$inferSelect;
export type InsertRentPaymentsRow = typeof rentPaymentsTable.$inferInsert;
export type RentPaymentTransfersRow = typeof rentPaymentTransfersTable.$inferSelect;
export type InsertRentPaymentTransfersRow = typeof rentPaymentTransfersTable.$inferInsert;
export type RazorpayWebhookEventsRow = typeof razorpayWebhookEventsTable.$inferSelect;
export type InsertRazorpayWebhookEventsRow = typeof razorpayWebhookEventsTable.$inferInsert;
