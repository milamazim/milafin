import { requireUser } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";
import { todayISO } from "@/lib/format";
import { exportAll } from "@/server/queries";

/** Download do backup completo (.json) do usuário logado. */
export async function GET() {
  const user = await requireUser();
  const backup = buildBackup(await exportAll(user.id));
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="milafin-backup-${todayISO()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
