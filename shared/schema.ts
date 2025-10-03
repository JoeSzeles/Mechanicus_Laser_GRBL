import { pgTable, text, integer, timestamp, boolean, serial, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Machine configurations table - Complete with all 42 config variables from config3.py
export const machineConfigs = pgTable("machine_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  
  // Machine Type: 'laser_engraver' (2-axis + laser) or 'cnc_printer' (3-axis)
  machineType: text("machine_type").notNull().default('laser_engraver'),
  
  // Firmware Type: 'grbl', 'marlin', 'smoothie'
  firmwareType: text("firmware_type").notNull().default('grbl'),
  
  // Connection Settings
  serialConnection: text("serial_connection").default('COM4'),
  baud: integer("baud").default(250000),
  
  // G-code Structure
  preamble: text("preamble").default('G1 Z60'),
  postamble: text("postamble").default('(postamble)'),
  shapePreamble: text("shape_preamble").default('G1 Z60'),
  shapePostamble: text("shape_postamble").default('G1 Z60'),
  
  // Machine Behavior
  coordinates: text("coordinates").default('absolute'),
  units: text("units").default('points'),
  autoScale: boolean("auto_scale").default(false),
  optimise: boolean("optimise").default(true),
  
  // Speed Settings
  lineSpeed: integer("line_speed").default(2000),
  curveSpeed: integer("curve_speed").default(2000),
  drawSpeed: integer("draw_speed").default(2000),
  travelSpeed: integer("travel_speed").default(2000),
  feedRate: integer("feed_rate").default(3000),
  
  // Height/Z-Axis Settings (CNC/3D Printer)
  drawHeight: integer("draw_height").default(0),
  travelHeight: integer("travel_height").default(26),
  zTravel: real("z_travel").default(3),
  zDraw: real("z_draw").default(0.0),
  zLift: real("z_lift").default(2),
  zRefill: integer("z_refill").default(20),
  zColor: integer("z_color").default(18),
  zStart: integer("z_start").default(19),
  zCenter: integer("z_center").default(15),
  zEnd: integer("z_end").default(19),
  
  // Laser Settings (Laser Engraver)
  laserPower: integer("laser_power").default(1000),
  
  // 3D Printing Specific
  layerHeight: real("layer_height").default(0.15),
  printAccel: integer("print_accel").default(3000),
  travelAccel: integer("travel_accel").default(2000),
  maxJerk: integer("max_jerk").default(200),
  layers: integer("layers").default(1),
  
  // Workspace/Bed Settings
  bedMaxX: integer("bed_max_x").default(300),
  bedMaxY: integer("bed_max_y").default(300),
  xOffset: integer("x_offset").default(0),
  yOffset: integer("y_offset").default(0),
  scaleF: real("scale_f").default(0.72),
  
  // Origin Point: 'bottom-left', 'bottom-right', 'top-left', 'top-right'
  originPoint: text("origin_point").default('bottom-left'),
  
  // Advanced Settings
  smoothness: real("smoothness").default(0.34),
  connectTolerance: real("connect_tolerance").default(0.001),
  refillPosX: integer("refill_pos_x").default(150),
  refillPosY: integer("refill_pos_y").default(10),
  refillPosZ: integer("refill_pos_z").default(20),
  refillLength: integer("refill_length").default(200),
  refill: boolean("refill").default(false),
  gradientLengthMm: integer("gradient_length_mm").default(8),
  
  // Default profile flag
  isDefault: boolean("is_default").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  

});

// Machine connection status table
export const machineConnections = pgTable("machine_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(), // One connection per user
  profileId: integer("profile_id").references(() => machineConfigs.id),
  isConnected: boolean("is_connected").default(false),
  lastConnectedAt: timestamp("last_connected_at"),
  connectionError: text("connection_error"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  machineConnection: one(machineConnections),
  projects: many(projects),
  preferences: one(userPreferences),
}));

export const machineConfigsRelations = relations(machineConfigs, ({ one }) => ({
  user: one(users, {
    fields: [machineConfigs.userId],
    references: [users.id],
  }),
}));

export const machineConnectionsRelations = relations(machineConnections, ({ one }) => ({
  user: one(users, {
    fields: [machineConnections.userId],
    references: [users.id],
  }),
  profile: one(machineConfigs, {
    fields: [machineConnections.profileId],
    references: [machineConfigs.id],
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
export type MachineConnection = typeof machineConnections.$inferSelect;
export type InsertMachineConnection = typeof machineConnections.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;