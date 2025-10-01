import { users, projects, machineConfigs, machineConnections, userPreferences, type User, type InsertUser, type Project, type InsertProject, type MachineConfig, type InsertMachineConfig, type MachineConnection, type InsertMachineConnection, type UserPreferences, type InsertUserPreferences } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Project methods
  getUserProjects(userId: number): Promise<Project[]>;
  getProject(id: number, userId: number): Promise<Project | undefined>;
  createProject(insertProject: InsertProject): Promise<Project>;
  updateProject(id: number, userId: number, data: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: number, userId: number): Promise<boolean>;
  
  // Machine config methods
  getUserMachineConfigs(userId: number): Promise<MachineConfig[]>;
  getMachineConfig(id: number, userId: number): Promise<MachineConfig | undefined>;
  getDefaultMachineConfig(userId: number): Promise<MachineConfig | undefined>;
  createMachineConfig(insertConfig: InsertMachineConfig): Promise<MachineConfig>;
  updateMachineConfig(id: number, userId: number, data: Partial<MachineConfig>): Promise<MachineConfig | undefined>;
  setDefaultMachineConfig(id: number, userId: number): Promise<MachineConfig | undefined>;
  deleteMachineConfig(id: number, userId: number): Promise<boolean>;
  
  // Machine connection methods
  getMachineConnection(userId: number): Promise<MachineConnection | undefined>;
  upsertMachineConnection(userId: number, data: Partial<InsertMachineConnection>): Promise<MachineConnection>;
  
  // User preferences methods
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  createUserPreferences(insertPrefs: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: number, data: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Project methods
  async getUserProjects(userId: number): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(id: number, userId: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(id: number, userId: number, data: Partial<Project>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Machine config methods
  async getUserMachineConfigs(userId: number): Promise<MachineConfig[]> {
    return await db.select().from(machineConfigs).where(eq(machineConfigs.userId, userId));
  }

  async getMachineConfig(id: number, userId: number): Promise<MachineConfig | undefined> {
    const [config] = await db.select().from(machineConfigs).where(and(eq(machineConfigs.id, id), eq(machineConfigs.userId, userId)));
    return config || undefined;
  }

  async createMachineConfig(insertConfig: InsertMachineConfig): Promise<MachineConfig> {
    const [config] = await db
      .insert(machineConfigs)
      .values(insertConfig)
      .returning();
    return config;
  }

  async updateMachineConfig(id: number, userId: number, data: Partial<MachineConfig>): Promise<MachineConfig | undefined> {
    const [config] = await db
      .update(machineConfigs)
      .set(data)
      .where(and(eq(machineConfigs.id, id), eq(machineConfigs.userId, userId)))
      .returning();
    return config || undefined;
  }

  async deleteMachineConfig(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(machineConfigs)
      .where(and(eq(machineConfigs.id, id), eq(machineConfigs.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getDefaultMachineConfig(userId: number): Promise<MachineConfig | undefined> {
    const [config] = await db
      .select()
      .from(machineConfigs)
      .where(and(eq(machineConfigs.userId, userId), eq(machineConfigs.isDefault, true)));
    return config || undefined;
  }

  async setDefaultMachineConfig(id: number, userId: number): Promise<MachineConfig | undefined> {
    // First, unset all other defaults for this user
    await db
      .update(machineConfigs)
      .set({ isDefault: false })
      .where(eq(machineConfigs.userId, userId));
    
    // Then set this one as default
    const [config] = await db
      .update(machineConfigs)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(machineConfigs.id, id), eq(machineConfigs.userId, userId)))
      .returning();
    return config || undefined;
  }

  // Machine connection methods
  async getMachineConnection(userId: number): Promise<MachineConnection | undefined> {
    const [connection] = await db
      .select()
      .from(machineConnections)
      .where(eq(machineConnections.userId, userId));
    return connection || undefined;
  }

  async upsertMachineConnection(userId: number, data: Partial<InsertMachineConnection>): Promise<MachineConnection> {
    const existing = await this.getMachineConnection(userId);
    
    if (existing) {
      const [updated] = await db
        .update(machineConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(machineConnections.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(machineConnections)
        .values({ userId, ...data } as InsertMachineConnection)
        .returning();
      return created;
    }
  }

  // User preferences methods
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs || undefined;
  }

  async createUserPreferences(insertPrefs: InsertUserPreferences): Promise<UserPreferences> {
    const [prefs] = await db
      .insert(userPreferences)
      .values(insertPrefs)
      .returning();
    return prefs;
  }

  async updateUserPreferences(userId: number, data: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    const [prefs] = await db
      .update(userPreferences)
      .set(data)
      .where(eq(userPreferences.userId, userId))
      .returning();
    return prefs || undefined;
  }
}

export const storage = new DatabaseStorage();