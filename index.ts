import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const userRoleEnum = pgEnum("user_role", ["customer", "owner", "admin"]);
export const equipmentStatusEnum = pgEnum("equipment_status", [
  "ready",
  "on_job",
  "service_due",
  "maintenance",
  "offline",
]);
export const pricingUnitEnum = pgEnum("pricing_unit", [
  "hour",
  "foot",
  "km",
  "survey",
  "project",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "mobilizing",
  "on_site",
  "in_progress",
  "completed",
  "cancelled",
]);
export const walletTxnTypeEnum = pgEnum("wallet_transaction_type", [
  "upi_deposit",
  "bank_withdrawal",
  "safety_deposit_lock",
  "safety_deposit_release",
  "penalty_debit",
  "owner_payout",
  "platform_fee",
]);
export const walletTxnStatusEnum = pgEnum("wallet_transaction_status", [
  "pending",
  "posted",
  "failed",
  "reversed",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: userRoleEnum("role").notNull(),
    fullName: text("full_name").notNull(),
    workspaceName: text("workspace_name").notNull(),
    phone: text("phone"),
    email: text("email").notNull(),
    serviceArea: text("service_area"),
    isVerified: boolean("is_verified").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

export const walletsTable = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    upiId: text("upi_id").notNull(),
    bankName: text("bank_name").notNull(),
    availableBalancePaise: integer("available_balance_paise")
      .default(0)
      .notNull(),
    lockedBalancePaise: integer("locked_balance_paise").default(0).notNull(),
    penaltyDebitsPaise: integer("penalty_debits_paise").default(0).notNull(),
    ...timestamps,
  },
  (table) => ({
    userIdx: uniqueIndex("wallets_user_id_idx").on(table.userId),
    upiIdx: index("wallets_upi_id_idx").on(table.upiId),
  }),
);

export const walletTransactionsTable = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => walletsTable.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookingsTable.id, {
      onDelete: "set null",
    }),
    type: walletTxnTypeEnum("type").notNull(),
    status: walletTxnStatusEnum("status").default("posted").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    note: text("note"),
    reference: text("reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    walletIdx: index("wallet_transactions_wallet_id_idx").on(table.walletId),
    bookingIdx: index("wallet_transactions_booking_id_idx").on(table.bookingId),
  }),
);

export const equipmentTable = pgTable(
  "equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sector: text("sector").notNull(),
    category: text("category").notNull(),
    registrationNumber: text("registration_number"),
    capacity: text("capacity"),
    status: equipmentStatusEnum("status").default("ready").notNull(),
    pricingUnit: pricingUnitEnum("pricing_unit").notNull(),
    baseRatePaise: integer("base_rate_paise").notNull(),
    fuelPercent: integer("fuel_percent").default(0).notNull(),
    engineHours: integer("engine_hours").default(0).notNull(),
    telematicsId: text("telematics_id").notNull(),
    currentAddress: text("current_address"),
    currentLat: numeric("current_lat", { precision: 10, scale: 7 }),
    currentLng: numeric("current_lng", { precision: 10, scale: 7 }),
    imageUrl: text("image_url"),
    specs: jsonb("specs").$type<string[]>().default([]).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    ownerIdx: index("equipment_owner_id_idx").on(table.ownerId),
    categoryIdx: index("equipment_category_idx").on(table.category),
    statusIdx: index("equipment_status_idx").on(table.status),
    telematicsIdx: uniqueIndex("equipment_telematics_id_idx").on(
      table.telematicsId,
    ),
  }),
);

export const borewellCasingOptionsTable = pgTable("borewell_casing_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  detail: text("detail"),
  ratePaisePerFoot: integer("rate_paise_per_foot").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const borewellTerrainRatesTable = pgTable("borewell_terrain_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  terrainName: text("terrain_name").notNull(),
  rigMethod: text("rig_method").notNull(),
  ratePaisePerFoot: integer("rate_paise_per_foot").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const bookingsTable = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicCode: text("public_code").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipmentTable.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").default("pending").notNull(),
    serviceType: text("service_type"),
    billingUnit: pricingUnitEnum("billing_unit").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }),
    unitRatePaise: integer("unit_rate_paise"),
    requestedDate: timestamp("requested_date", { withTimezone: true }).notNull(),
    shiftLabel: text("shift_label"),
    startTime: text("start_time"),
    jobAddress: text("job_address").notNull(),
    jobLat: numeric("job_lat", { precision: 10, scale: 7 }).notNull(),
    jobLng: numeric("job_lng", { precision: 10, scale: 7 }).notNull(),
    pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }),
    pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }),
    routeKm: numeric("route_km", { precision: 10, scale: 2 }),
    instructions: text(),
    materialType: text("material_type"),
    stoneSizeMm: integer("stone_size_mm"),
    casingOptionId: uuid("casing_option_id").references(
      () => borewellCasingOptionsTable.id,
      { onDelete: "set null" },
    ),
    casingDepthFeet: integer("casing_depth_feet"),
    terrainRateId: uuid("terrain_rate_id").references(
      () => borewellTerrainRatesTable.id,
      { onDelete: "set null" },
    ),
    baseCostPaise: integer("base_cost_paise").notNull(),
    platformFeePaise: integer("platform_fee_paise").notNull(),
    totalCostPaise: integer("total_cost_paise").notNull(),
    ownerEarningsPaise: integer("owner_earnings_paise").notNull(),
    walletHoldPaise: integer("wallet_hold_paise").default(0).notNull(),
    penaltyAmountPaise: integer("penalty_amount_paise").default(0).notNull(),
    cancellationLocked: boolean("cancellation_locked").default(false).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    publicCodeIdx: uniqueIndex("bookings_public_code_idx").on(table.publicCode),
    customerIdx: index("bookings_customer_id_idx").on(table.customerId),
    ownerIdx: index("bookings_owner_id_idx").on(table.ownerId),
    equipmentIdx: index("bookings_equipment_id_idx").on(table.equipmentId),
    statusIdx: index("bookings_status_idx").on(table.status),
  }),
);

export const equipmentLocationsTable = pgTable(
  "equipment_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipmentTable.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookingsTable.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    source: text("source").default("prototype").notNull(),
  },
  (table) => ({
    equipmentRecordedIdx: index("equipment_locations_equipment_recorded_idx").on(
      table.equipmentId,
      table.recordedAt,
    ),
    bookingIdx: index("equipment_locations_booking_id_idx").on(table.bookingId),
  }),
);

export const reviewsTable = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipmentTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    text: text("text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bookingIdx: uniqueIndex("reviews_booking_id_idx").on(table.bookingId),
    equipmentIdx: index("reviews_equipment_id_idx").on(table.equipmentId),
  }),
);

export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    bookingId: uuid("booking_id").references(() => bookingsTable.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    actorIdx: index("audit_events_actor_id_idx").on(table.actorId),
    bookingIdx: index("audit_events_booking_id_idx").on(table.bookingId),
    eventTypeIdx: index("audit_events_event_type_idx").on(table.eventType),
  }),
);

export const usersRelations = relations(usersTable, ({ many, one }) => ({
  wallet: one(walletsTable),
  equipment: many(equipmentTable),
  customerBookings: many(bookingsTable, { relationName: "customerBookings" }),
  ownerBookings: many(bookingsTable, { relationName: "ownerBookings" }),
}));

export const walletsRelations = relations(walletsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [walletsTable.userId],
    references: [usersTable.id],
  }),
  transactions: many(walletTransactionsTable),
}));

export const equipmentRelations = relations(equipmentTable, ({ one, many }) => ({
  owner: one(usersTable, {
    fields: [equipmentTable.ownerId],
    references: [usersTable.id],
  }),
  bookings: many(bookingsTable),
  locations: many(equipmentLocationsTable),
}));

export const bookingsRelations = relations(bookingsTable, ({ one, many }) => ({
  customer: one(usersTable, {
    fields: [bookingsTable.customerId],
    references: [usersTable.id],
    relationName: "customerBookings",
  }),
  owner: one(usersTable, {
    fields: [bookingsTable.ownerId],
    references: [usersTable.id],
    relationName: "ownerBookings",
  }),
  equipment: one(equipmentTable, {
    fields: [bookingsTable.equipmentId],
    references: [equipmentTable.id],
  }),
  casingOption: one(borewellCasingOptionsTable, {
    fields: [bookingsTable.casingOptionId],
    references: [borewellCasingOptionsTable.id],
  }),
  terrainRate: one(borewellTerrainRatesTable, {
    fields: [bookingsTable.terrainRateId],
    references: [borewellTerrainRatesTable.id],
  }),
  walletTransactions: many(walletTransactionsTable),
  locations: many(equipmentLocationsTable),
  review: one(reviewsTable),
}));

export const walletTransactionsRelations = relations(
  walletTransactionsTable,
  ({ one }) => ({
    wallet: one(walletsTable, {
      fields: [walletTransactionsTable.walletId],
      references: [walletsTable.id],
    }),
    booking: one(bookingsTable, {
      fields: [walletTransactionsTable.bookingId],
      references: [bookingsTable.id],
    }),
  }),
);

export const equipmentLocationsRelations = relations(
  equipmentLocationsTable,
  ({ one }) => ({
    equipment: one(equipmentTable, {
      fields: [equipmentLocationsTable.equipmentId],
      references: [equipmentTable.id],
    }),
    booking: one(bookingsTable, {
      fields: [equipmentLocationsTable.bookingId],
      references: [bookingsTable.id],
    }),
  }),
);

export const reviewsRelations = relations(reviewsTable, ({ one }) => ({
  booking: one(bookingsTable, {
    fields: [reviewsTable.bookingId],
    references: [bookingsTable.id],
  }),
  reviewer: one(usersTable, {
    fields: [reviewsTable.reviewerId],
    references: [usersTable.id],
  }),
  equipment: one(equipmentTable, {
    fields: [reviewsTable.equipmentId],
    references: [equipmentTable.id],
  }),
}));

export const insertUserSchema = createInsertSchema(usersTable);
export const selectUserSchema = createSelectSchema(usersTable);
export const insertWalletSchema = createInsertSchema(walletsTable);
export const selectWalletSchema = createSelectSchema(walletsTable);
export const insertWalletTransactionSchema = createInsertSchema(
  walletTransactionsTable,
);
export const selectWalletTransactionSchema = createSelectSchema(
  walletTransactionsTable,
);
export const insertEquipmentSchema = createInsertSchema(equipmentTable);
export const selectEquipmentSchema = createSelectSchema(equipmentTable);
export const insertBookingSchema = createInsertSchema(bookingsTable);
export const selectBookingSchema = createSelectSchema(bookingsTable);
export const insertEquipmentLocationSchema = createInsertSchema(
  equipmentLocationsTable,
);
export const selectEquipmentLocationSchema = createSelectSchema(
  equipmentLocationsTable,
);
export const insertReviewSchema = createInsertSchema(reviewsTable);
export const selectReviewSchema = createSelectSchema(reviewsTable);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type Wallet = typeof walletsTable.$inferSelect;
export type InsertWallet = typeof walletsTable.$inferInsert;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactionsTable.$inferInsert;
export type Equipment = typeof equipmentTable.$inferSelect;
export type InsertEquipment = typeof equipmentTable.$inferInsert;
export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = typeof bookingsTable.$inferInsert;
export type EquipmentLocation = typeof equipmentLocationsTable.$inferSelect;
export type InsertEquipmentLocation = typeof equipmentLocationsTable.$inferInsert;
export type Review = typeof reviewsTable.$inferSelect;
export type InsertReview = typeof reviewsTable.$inferInsert;
