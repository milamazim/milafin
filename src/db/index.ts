import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida. Rode `npm run env:local`.");

// Reaproveita a conexão entre recarregamentos do `next dev` (HMR).
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// `prepare: false` é exigido pelo pooler do Supabase em modo transaction (Vercel).
const client = globalForDb.pgClient ?? postgres(url, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
