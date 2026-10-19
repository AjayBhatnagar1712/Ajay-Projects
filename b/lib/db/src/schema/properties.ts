import { bigint, boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const propertiesTable = pgTable("properties", {
  id: text("id").primaryKey(),
  accountPhone: text("account_phone").notNull(),
  accountRole: text("account_role").notNull(),
  nickname: text("nickname"),
  address: text("address").notNull().default(""),
  area: text("area").notNull().default(""),
  city: text("city").notNull().default(""),
  pincode: text("pincode").notNull().default(""),
  country: text("country").notNull().default(""),
  ownerName: text("owner_name").notNull().default(""),
  ownerContact: text("owner_contact").notNull().default(""),
  propertyType: text("property_type").notNull().default(""),
  propertyTypeOther: text("property_type_other"),
  unitSize: text("unit_size").notNull().default(""),
  unitSizeOther: text("unit_size_other"),
  furnishing: text("furnishing").notNull().default(""),
  builtUpArea: text("built_up_area").notNull().default(""),
  builtUpUnits: text("built_up_units").notNull().default(""),
  totalFloors: text("total_floors").notNull().default(""),
  bedrooms: text("bedrooms").notNull().default(""),
  bathrooms: text("bathrooms").notNull().default(""),
  balconies: text("balconies").notNull().default(""),
  floorLevel: text("floor_level").notNull().default(""),
  mainDoorDirection: text("main_door_direction").notNull().default(""),
  amenities: jsonb("amenities").notNull().default([]),
  tenantsPreferred: jsonb("tenants_preferred").notNull().default([]),
  rentNegotiable: boolean("rent_negotiable").notNull().default(false),
  maintenanceIncluded: boolean("maintenance_included").notNull().default(false),
  monthlyRentPaise: bigint("monthly_rent_paise", { mode: "number" }),
  monthlyMaintenancePaise: bigint("monthly_maintenance_paise", { mode: "number" }),
  securityDepositPaise: bigint("security_deposit_paise", { mode: "number" }),
  availableFrom: text("available_from").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  uploadedBy: text("uploaded_by"),
  imagesUrls: jsonb("images_urls"),
  imagesLegacy: jsonb("images_legacy"),
  listingDetails: jsonb("listing_details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const propertyCoOwnersTable = pgTable("property_co_owners", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => propertiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  contact: text("contact").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type PropertiesRow = typeof propertiesTable.$inferSelect;
export type InsertPropertiesRow = typeof propertiesTable.$inferInsert;
export type PropertyCoOwnersRow = typeof propertyCoOwnersTable.$inferSelect;
export type InsertPropertyCoOwnersRow = typeof propertyCoOwnersTable.$inferInsert;
