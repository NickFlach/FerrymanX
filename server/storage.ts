import { type User, type InsertUser, type SignedNftTransaction, type InsertSignedNftTransaction, users, signedNftTransactions } from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  checkNftTransactionSigned(txHash: string, logIndex: number, sourceChain: number): Promise<boolean>;
  recordNftTransactionSigned(transaction: InsertSignedNftTransaction): Promise<SignedNftTransaction>;
}

export class PostgresStorage implements IStorage {
  private db;

  constructor() {
    this.db = getDb();
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async checkNftTransactionSigned(txHash: string, logIndex: number, sourceChain: number): Promise<boolean> {
    const result = await this.db
      .select()
      .from(signedNftTransactions)
      .where(
        and(
          eq(signedNftTransactions.txHash, txHash),
          eq(signedNftTransactions.logIndex, logIndex),
          eq(signedNftTransactions.sourceChain, sourceChain)
        )
      );
    return result.length > 0;
  }

  async recordNftTransactionSigned(transaction: InsertSignedNftTransaction): Promise<SignedNftTransaction> {
    const result = await this.db
      .insert(signedNftTransactions)
      .values(transaction)
      .returning();
    return result[0];
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private signedNftTransactions: Map<string, SignedNftTransaction>;

  constructor() {
    this.users = new Map();
    this.signedNftTransactions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async checkNftTransactionSigned(txHash: string, logIndex: number, sourceChain: number): Promise<boolean> {
    const key = `${txHash}-${logIndex}-${sourceChain}`;
    return this.signedNftTransactions.has(key);
  }

  async recordNftTransactionSigned(transaction: InsertSignedNftTransaction): Promise<SignedNftTransaction> {
    const id = randomUUID();
    const signedAt = Math.floor(Date.now() / 1000);
    const record: SignedNftTransaction = { ...transaction, id, signedAt };
    const key = `${transaction.txHash}-${transaction.logIndex}-${transaction.sourceChain}`;
    this.signedNftTransactions.set(key, record);
    return record;
  }
}

let storageInstance: IStorage | null = null;

export const storage = (() => {
  if (!storageInstance) {
    try {
      if (process.env.DATABASE_URL) {
        storageInstance = new PostgresStorage();
        console.log("Using PostgreSQL storage");
      } else {
        storageInstance = new MemStorage();
        console.log("Using in-memory storage (DATABASE_URL not set)");
      }
    } catch (error) {
      console.warn("Failed to initialize PostgreSQL storage, falling back to in-memory:", error);
      storageInstance = new MemStorage();
    }
  }
  return storageInstance;
})();
