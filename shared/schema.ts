import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const signedNftTransactions = pgTable("signed_nft_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  txHash: text("tx_hash").notNull(),
  logIndex: integer("log_index").notNull(),
  sourceChain: integer("source_chain").notNull(),
  bridger: text("bridger").notNull(),
  messageId: text("message_id").notNull(),
  amount: text("amount").notNull(),
  signedAt: bigint("signed_at", { mode: "number" }).notNull().default(sql`extract(epoch from now())::bigint`),
}, (table) => ({
  uniqueBridgeEvent: unique().on(table.txHash, table.logIndex, table.sourceChain),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSignedNftTransactionSchema = createInsertSchema(signedNftTransactions).omit({
  id: true,
  signedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSignedNftTransaction = z.infer<typeof insertSignedNftTransactionSchema>;
export type SignedNftTransaction = typeof signedNftTransactions.$inferSelect;
