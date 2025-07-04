import { 
  users, repositories, fileOperations,
  type User, type InsertUser,
  type Repository, type InsertRepository,
  type FileOperation, type InsertFileOperation
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserToken(id: number, accessToken: string): Promise<User | undefined>;

  // Repository operations
  getUserRepositories(userId: number): Promise<Repository[]>;
  createRepository(repository: InsertRepository): Promise<Repository>;
  getRepository(id: number): Promise<Repository | undefined>;
  updateRepositorySync(id: number): Promise<Repository | undefined>;

  // File operations
  createFileOperation(operation: InsertFileOperation): Promise<FileOperation>;
  getUserFileOperations(userId: number, limit?: number): Promise<FileOperation[]>;
  updateFileOperationStatus(id: number, status: string): Promise<FileOperation | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private repositories: Map<number, Repository>;
  private fileOperations: Map<number, FileOperation>;
  private currentUserId: number;
  private currentRepoId: number;
  private currentOpId: number;

  constructor() {
    this.users = new Map();
    this.repositories = new Map();
    this.fileOperations = new Map();
    this.currentUserId = 1;
    this.currentRepoId = 1;
    this.currentOpId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.githubId === githubId
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser,
      email: insertUser.email || null,
      avatarUrl: insertUser.avatarUrl || null,
      id, 
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserToken(id: number, accessToken: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = { ...user, accessToken };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async getUserRepositories(userId: number): Promise<Repository[]> {
    return Array.from(this.repositories.values()).filter(
      (repo) => repo.userId === userId
    );
  }

  async createRepository(insertRepository: InsertRepository): Promise<Repository> {
    const id = this.currentRepoId++;
    const repository: Repository = { 
      ...insertRepository,
      private: insertRepository.private ?? false,
      defaultBranch: insertRepository.defaultBranch ?? "main",
      id,
      lastSyncAt: null
    };
    this.repositories.set(id, repository);
    return repository;
  }

  async getRepository(id: number): Promise<Repository | undefined> {
    return this.repositories.get(id);
  }

  async updateRepositorySync(id: number): Promise<Repository | undefined> {
    const repo = this.repositories.get(id);
    if (repo) {
      const updatedRepo = { ...repo, lastSyncAt: new Date() };
      this.repositories.set(id, updatedRepo);
      return updatedRepo;
    }
    return undefined;
  }

  async createFileOperation(insertOperation: InsertFileOperation): Promise<FileOperation> {
    const id = this.currentOpId++;
    const operation: FileOperation = { 
      ...insertOperation,
      status: insertOperation.status ?? "pending",
      metadata: insertOperation.metadata ?? null,
      id,
      createdAt: new Date()
    };
    this.fileOperations.set(id, operation);
    return operation;
  }

  async getUserFileOperations(userId: number, limit = 10): Promise<FileOperation[]> {
    return Array.from(this.fileOperations.values())
      .filter((op) => op.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateFileOperationStatus(id: number, status: string): Promise<FileOperation | undefined> {
    const operation = this.fileOperations.get(id);
    if (operation) {
      const updatedOperation = { ...operation, status };
      this.fileOperations.set(id, updatedOperation);
      return updatedOperation;
    }
    return undefined;
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.githubId, githubId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        email: insertUser.email || null,
        avatarUrl: insertUser.avatarUrl || null,
      })
      .returning();
    return user;
  }

  async updateUserToken(id: number, accessToken: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ accessToken })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUserRepositories(userId: number): Promise<Repository[]> {
    return await db.select().from(repositories).where(eq(repositories.userId, userId));
  }

  async createRepository(insertRepository: InsertRepository): Promise<Repository> {
    const [repository] = await db
      .insert(repositories)
      .values({
        ...insertRepository,
        private: insertRepository.private ?? false,
        defaultBranch: insertRepository.defaultBranch ?? "main",
      })
      .returning();
    return repository;
  }

  async getRepository(id: number): Promise<Repository | undefined> {
    const [repository] = await db.select().from(repositories).where(eq(repositories.id, id));
    return repository || undefined;
  }

  async updateRepositorySync(id: number): Promise<Repository | undefined> {
    const [repository] = await db
      .update(repositories)
      .set({ lastSyncAt: new Date() })
      .where(eq(repositories.id, id))
      .returning();
    return repository || undefined;
  }

  async createFileOperation(insertOperation: InsertFileOperation): Promise<FileOperation> {
    const [operation] = await db
      .insert(fileOperations)
      .values({
        ...insertOperation,
        status: insertOperation.status ?? "pending",
        metadata: insertOperation.metadata ?? null,
      })
      .returning();
    return operation;
  }

  async getUserFileOperations(userId: number, limit = 10): Promise<FileOperation[]> {
    return await db
      .select()
      .from(fileOperations)
      .where(eq(fileOperations.userId, userId))
      .orderBy(desc(fileOperations.createdAt))
      .limit(limit);
  }

  async updateFileOperationStatus(id: number, status: string): Promise<FileOperation | undefined> {
    const [operation] = await db
      .update(fileOperations)
      .set({ status })
      .where(eq(fileOperations.id, id))
      .returning();
    return operation || undefined;
  }
}

export const storage = new DatabaseStorage();
