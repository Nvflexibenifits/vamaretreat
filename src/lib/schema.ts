import { pgTable, text, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("User", {
  id: text("id").primaryKey(),
  clerkId: text("clerkId").unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email").notNull(),
  color: text("color").notNull(),
  active: boolean("active").notNull(),
  password: text("password"),
});

export type User = typeof users.$inferSelect;
