import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: text("github_id").notNull().unique(),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  githubId: text("github_id").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  private: boolean("private").notNull().default(false),
  defaultBranch: text("default_branch").notNull().default("main"),
  lastSyncAt: timestamp("last_sync_at"),
});

export const fileOperations = pgTable("file_operations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  repositoryId: integer("repository_id").notNull(),
  operation: text("operation").notNull(), // 'upload', 'delete', 'create_folder'
  filePath: text("file_path").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed'
  metadata: jsonb("metadata"), // Additional operation details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  lastSyncAt: true,
});

export const insertFileOperationSchema = createInsertSchema(fileOperations).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type FileOperation = typeof fileOperations.$inferSelect;
export type InsertFileOperation = z.infer<typeof insertFileOperationSchema>;

// GitHub API response types
export const githubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  default_branch: z.string(),
  clone_url: z.string(),
  ssh_url: z.string(),
});

export const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().nullable(),
  avatar_url: z.string(),
});

export const githubFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  type: z.enum(["file", "dir"]),
  download_url: z.string().nullable(),
});

export const githubBranchSchema = z.object({
  name: z.string(),
  commit: z.object({
    sha: z.string(),
  }),
});

export type GitHubRepository = z.infer<typeof githubRepositorySchema>;
export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubFile = z.infer<typeof githubFileSchema>;
export type GitHubBranch = z.infer<typeof githubBranchSchema>;
