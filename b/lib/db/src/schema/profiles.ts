import { pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

export const profilesTable = pgTable(
  "profiles",
  {
    phone: text("phone").notNull(),
    role: text("role").notNull(),
    name: text("name").notNull().default(""),
    email: text("email").notNull().default(""),
    firm: text("firm").notNull().default(""),
    propertyCount: text("property_count"),
    propertyIntent: text("property_intent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.phone, table.role] }),
  }),
);

export const paymentAccountsTable = pgTable(
  "payment_accounts",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull(),
    role: text("role").notNull(),
    bankHolderName: text("bank_holder_name").notNull().default(""),
    bankName: text("bank_name").notNull().default(""),
    bankAccountNumber: text("bank_account_number").notNull().default(""),
    bankIfsc: text("bank_ifsc").notNull().default(""),
    upiId: text("upi_id").notNull().default(""),
    upiQrUrl: text("upi_qr_url"),
    aadhaarUrl: text("aadhaar_url"),
    panUrl: text("pan_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    phoneRoleUnique: unique("payment_accounts_phone_role_unique").on(table.phone, table.role),
  }),
);

export type ProfilesRow = typeof profilesTable.$inferSelect;
export type InsertProfilesRow = typeof profilesTable.$inferInsert;
export type PaymentAccountsRow = typeof paymentAccountsTable.$inferSelect;
export type InsertPaymentAccountsRow = typeof paymentAccountsTable.$inferInsert;
