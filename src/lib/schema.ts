import { pgTable, text, boolean, jsonb } from "drizzle-orm/pg-core";

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
