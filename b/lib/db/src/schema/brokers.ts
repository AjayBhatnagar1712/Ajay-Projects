import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Broker onboarding / profile row (one per auth.users id).
 * FK to auth.users lives in SQL migration only — auth schema is not in Drizzle.
 */
export const brokersTable = pgTable("brokers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  name: text("name").notNull().default(""),
  age: integer("age"),
  firmName: text("firm_name"),
  employmentType: text("employment_type").notNull().default(""),
  businessSinceYear: integer("business_since_year"),
  propertiesHandled: integer("properties_handled"),
  dealsWith: text("deals_with").array().notNull().default([]),
  dealsWithOther: text("deals_with_other"),
  propertyTypes: text("property_types").array().notNull().default([]),
  propertyTypesOther: text("property_types_other"),
  region: text("region").notNull().default(""),
  pincodes: text("pincodes").array().notNull().default([]),
  stepCompleted: integer("step_completed").notNull().default(0),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
    mode: "date",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type BrokersRow = typeof brokersTable.$inferSelect;
export type InsertBrokersRow = typeof brokersTable.$inferInsert;
