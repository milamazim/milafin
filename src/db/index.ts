import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida. Rode `npm run env:local`.");

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

function createPool() {
  const pool = new Pool({
    connectionString: url,
    // Em produção (pooler do Supabase) a conexão é criptografada. O certificado do
    // pooler é emitido pela CA do próprio Supabase, fora da lista do Node.
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
    // Fecha conexões ociosas rápido: a Vercel congela/reaproveita a instância
    // da função, e uma conexão "esquecida" aberta pode ficar meio-morta.
    idleTimeoutMillis: 5_000,
    // Nunca esperar para sempre: melhor um erro do que uma página travada.
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });
  // Mantém a instância viva até as conexões ociosas serem fechadas (Fluid compute).
  attachDatabasePool(pool);
  return pool;
}

// Reaproveita o pool entre recarregamentos do `next dev` (HMR).
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
