import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Per-account key/value blobs synced across devices (phone + role + data_key). */
export const userDataTable = pgTable(
  "user_data",
  {
    phone: text("phone").notNull(),
    role: text("role").notNull(),
    dataKey: text("data_key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.phone, table.role, table.dataKey] }),
  }),
);

export type UserDataRow = typeof userDataTable.$inferSelect;
export type InsertUserDataRow = typeof userDataTable.$inferInsert;
