import { users, projects, machineConfigs, userPreferences, type User, type InsertUser, type Project, type InsertProject, type MachineConfig, type InsertMachineConfig, type UserPreferences, type InsertUserPreferences } from "@shared/schema";
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
  createMachineConfig(insertConfig: InsertMachineConfig): Promise<MachineConfig>;
  updateMachineConfig(id: number, userId: number, data: Partial<MachineConfig>): Promise<MachineConfig | undefined>;
  deleteMachineConfig(id: number, userId: number): Promise<boolean>;
  
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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
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