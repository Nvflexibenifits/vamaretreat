import { pgTable, text, boolean, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";

// Every synced table also carries an updated_at column maintained by database
// triggers (drizzle/0001_delta_sync.sql). It is deliberately left out of these
// definitions so whole-row selects keep working on a database that has not
// run that migration yet; /api/app/changes filters on it with raw SQL.

export const users = pgTable("User", {
  id: text("id").primaryKey(),
  clerkId: text("clerkId").unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email").notNull(),
  color: text("color").notNull(),
  active: boolean("active").notNull(),
  password: text("password"),
  plainPassword: text("plainPassword"),
});

export type User = typeof users.$inferSelect;

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const b2bBookings = pgTable("b2b_bookings", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const roomInventory = pgTable("room_inventory", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const venueBlocks = pgTable("venue_blocks", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const bulkRoomBlocks = pgTable("bulk_room_blocks", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const specialDays = pgTable("special_days", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const creditNotes = pgTable("credit_notes", {
  code: text("code").primaryKey(),
  data: jsonb("data").notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

// Rows deleted from any synced table, so delta polls can drop them client-side.
export const syncDeletions = pgTable(
  "sync_deletions",
  {
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tableName, t.rowId] })]
);
