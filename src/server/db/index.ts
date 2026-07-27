import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Shared singleton DB instance.
 *
 * Production (Turso): reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from env.
 * Dev (local SQLite): falls back to a local file when those env vars are absent.
 */
export function createDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    const client = createClient({ url, authToken });
    return drizzle(client, { schema });
  }

  // Local dev fallback
  const client = createClient({ url: "file:./local.db" });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Lazily initialised singleton. */
let _db: ReturnType<typeof createDb> | null = null;

export function getDb(): Db {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export { schema };
