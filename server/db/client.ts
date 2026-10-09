import "server-only"

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { getEnv } from "@/server/env"

import * as schema from "./schema"

export type Db = NodePgDatabase<typeof schema>

// One pool per process, created on first use (never at import, so builds need
// no database). Kept on globalThis so dev hot reloads don't leak pools.
const store = globalThis as unknown as { mkPool?: Pool; mkDb?: Db }

export function getDb(): Db {
  if (store.mkDb) return store.mkDb
  const pool =
    store.mkPool ??
    new Pool({ connectionString: getEnv().DATABASE_URL, max: 10 })
  // Idle-client errors (e.g. DB restart) must not crash the process.
  if (!store.mkPool) {
    pool.on("error", (error) => console.error("[db] idle client error", error))
  }
  store.mkPool = pool
  store.mkDb = drizzle({ client: pool, schema, casing: "snake_case" })
  return store.mkDb
}

export async function closeDb() {
  try {
    await store.mkPool?.end()
  } finally {
    store.mkPool = undefined
    store.mkDb = undefined
  }
}
