/**
 * Conexión única a PostgreSQL.
 * En desarrollo, Next.js recarga módulos constantemente; guardamos el pool en
 * "globalThis" para no abrir una conexión nueva en cada recarga.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalParaDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalParaDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalParaDb.pgPool = pool;

export const db = drizzle(pool, { schema });

/** Tipo de una transacción (útil para servicios que reciben "tx"). */
export type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];
