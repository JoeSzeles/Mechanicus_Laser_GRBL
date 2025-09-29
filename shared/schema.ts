import { pgTable, text, integer, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Machine configurations table
export const machineConfigs = pgTable("machine_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  comPort: text("com_port"),
  baudRate: integer("baud_rate").default(115200),
  bedSizeX: integer("bed_size_x").default(300),
  bedSizeY: integer("bed_size_y").default(300),
  travelSpeed: integer("travel_speed").default(3000),
  drawSpeed: integer("draw_speed").default(2000),
  laserPower: integer("laser_power").default(1000),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User projects/drawings table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  svgData: text("svg_data"), // Store SVG as text
  fabricData: text("fabric_data"), // Store Fabric.js canvas data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User preferences table
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  theme: text("theme").default("dark"),
  gridSize: integer("grid_size").default(5),
  snapEnabled: boolean("snap_enabled").default(true),
  showRulers: boolean("show_rulers").default(true),
  showGrid: boolean("show_grid").default(true),
  defaultMachineConfig: integer("default_machine_config").references(() => machineConfigs.id),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  machineConfigs: many(machineConfigs),
  projects: many(projects),
  preferences: one(userPreferences),
}));

export const machineConfigsRelations = relations(machineConfigs, ({ one }) => ({
  user: one(users, {
    fields: [machineConfigs.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
  defaultMachine: one(machineConfigs, {
    fields: [userPreferences.defaultMachineConfig],
    references: [machineConfigs.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MachineConfig = typeof machineConfigs.$inferSelect;
export type InsertMachineConfig = typeof machineConfigs.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;