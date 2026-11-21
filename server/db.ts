import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import pg from "pg";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let db: ReturnType<typeof drizzleNeon> | null = null;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL not set");
    }
    // Neon's serverless driver speaks WebSockets to Neon's proxy and cannot reach a
    // plain Postgres server. A self-hosted database on the same machine uses node-postgres.
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
    db = isLocal
      ? (drizzlePg(new pg.Pool({ connectionString: url }), { schema }) as unknown as ReturnType<typeof drizzleNeon>)
      : drizzleNeon(new NeonPool({ connectionString: url }), { schema });
  }
  return db;
}
