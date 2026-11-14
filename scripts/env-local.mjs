// Gera .env.local a partir do Supabase local (`supabase status`).
// Uso: npm run env:local  (o Supabase local precisa estar no ar: npm run db:start)
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

let status;
try {
  const out = execSync("npx supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  status = JSON.parse(out.slice(out.indexOf("{")));
} catch (err) {
  console.error(
    "Não foi possível ler o status do Supabase local. Ele está rodando? (npm run db:start)\n",
    err.stderr?.toString() ?? err.message,
  );
  process.exit(1);
}

const pick = (...names) => names.map((n) => status[n]).find(Boolean);

const values = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  DATABASE_URL: pick("DB_URL"),
};

const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(
    `Variáveis não encontradas no status: ${missing.join(", ")}\nChaves disponíveis: ${Object.keys(status).join(", ")}`,
  );
  process.exit(1);
}

const file = ".env.local";
const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
for (const [key, value] of Object.entries(values)) {
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
}
writeFileSync(file, lines.filter((l, i, a) => l || i < a.length - 1).join("\n") + "\n");
console.log(`${file} atualizado com: ${Object.keys(values).join(", ")}`);
