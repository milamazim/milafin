"use client";

import { DownloadIcon, FileSpreadsheetIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAction } from "@/components/use-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseBackup, type Backup, type RestoreMode } from "@/lib/backup";
import { cn } from "@/lib/utils";

import { deleteAllData, restoreBackup } from "./actions";

type Status = { categories: number; recurrences: number; transactions: number };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export function DataManager({ status, years, thisYear }: { status: Status; years: number[]; thisYear: number }) {
  const empty = status.categories + status.recurrences + status.transactions === 0;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>O que está guardado na sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Categorias", status.categories],
                ["Séries", status.recurrences],
                ["Lançamentos", status.transactions],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold">{n.toLocaleString("pt-BR")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            “Lançamentos” conta os avulsos e as ocorrências de séries editadas ou marcadas como pagas. As demais ocorrências são
            calculadas a partir das séries.
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Backup completo (.json)</CardTitle>
          <CardDescription>
            Categorias, séries e lançamentos, para guardar uma cópia ou levar seus dados para outra conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/dados/backup" download className={cn(buttonVariants(), empty && "pointer-events-none opacity-50")} aria-disabled={empty}>
            <DownloadIcon /> Baixar backup
          </a>
        </CardContent>
      </Card>

      <RestoreCard />

      <CsvCard years={years} thisYear={thisYear} />

      <DeleteAllCard disabled={empty} />
    </div>
  );
}

/* ------------------------------------------------------------- restaurar */

function RestoreCard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ ok: true; backup: Backup } | { ok: false; error: string } | null>(null);
  const [mode, setMode] = useState<RestoreMode>("mesclar");
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending, exec } = useAction();

  async function choose(f: File | null) {
    setFile(f);
    setPreview(f ? parseBackup(await f.text()) : null);
  }

  // arquivo escolhido antes da hidratação (rede lenta): o onChange não rodou
  useEffect(() => {
    const f = inputRef.current?.files?.[0];
    if (f) void choose(f);
  }, []);

  async function restore() {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    let summary = "";
    const ok = await exec(async () => {
      const r = await restoreBackup(fd);
      if (r.ok) {
        const { inserted: i, skipped: s } = r.data;
        const total = i.categories + i.recurrences + i.transactions;
        const skip = s.categories + s.recurrences + s.transactions;
        summary =
          total === 0
            ? "Nada novo: tudo do arquivo já estava na sua conta."
            : `Restaurado: ${plural(i.categories, "categoria", "categorias")}, ${plural(i.recurrences, "série", "séries")} e ${plural(i.transactions, "lançamento", "lançamentos")}.` +
              (skip ? ` ${skip} já existiam e foram mantidos.` : "");
      }
      return r;
    });
    setConfirm(false);
    if (ok) {
      toast.success(summary);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const b = preview?.ok ? preview.backup : null;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Restaurar backup</CardTitle>
        <CardDescription>Use um arquivo .json baixado aqui.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="backup-file">Arquivo</Label>
          <Input
            id="backup-file"
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
        </div>

        {preview && !preview.ok && (
          <p role="alert" className="text-sm text-destructive">
            {preview.error}
          </p>
        )}

        {b && (
          <>
            <p className="rounded-md bg-muted p-3 text-sm">
              Backup de {fmtDateTime(b.exportedAt)}: {plural(b.data.categories.length, "categoria", "categorias")},{" "}
              {plural(b.data.recurrences.length, "série", "séries")} e{" "}
              {plural(b.data.transactions.length, "lançamento", "lançamentos")}.
            </p>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as RestoreMode)}>
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="mesclar" className="mt-0.5" />
                <span>
                  Mesclar com os dados atuais
                  <span className="block text-xs text-muted-foreground">
                    Acrescenta o que falta. Nada é apagado nem duplicado; categorias com o mesmo nome são juntadas.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="substituir" className="mt-0.5" />
                <span>
                  Substituir tudo
                  <span className="block text-xs text-muted-foreground">
                    Apaga todos os dados atuais e deixa a conta igual ao backup.
                  </span>
                </span>
              </label>
            </RadioGroup>
            <Button disabled={pending} onClick={() => (mode === "substituir" ? setConfirm(true) : restore())} className="w-fit">
              <UploadIcon /> {pending ? "Restaurando…" : "Restaurar"}
            </Button>
          </>
        )}

        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Substituir todos os dados?</AlertDialogTitle>
              <AlertDialogDescription>
                Tudo o que está na sua conta hoje será apagado e trocado pelo conteúdo do backup. Se quiser, baixe antes uma cópia
                dos dados atuais.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <a href="/dados/backup" download className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
              <DownloadIcon /> Baixar cópia dos dados atuais
            </a>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending} onClick={restore}>
                Substituir tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------- CSV */

function CsvCard({ years, thisYear }: { years: number[]; thisYear: number }) {
  const [year, setYear] = useState(thisYear);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Exportar para Excel (CSV)</CardTitle>
        <CardDescription>
          Um arquivo por ano, com cada lançamento numa linha (séries já expandidas). Abre direto no Excel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="csv-year">Ano</Label>
          <NativeSelect id="csv-year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <NativeSelectOption key={y} value={y}>
                {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <a href={`/dados/csv?ano=${year}`} download className={buttonVariants({ variant: "outline" })}>
          <FileSpreadsheetIcon /> Baixar CSV de {year}
        </a>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------- apagar tudo */

function DeleteAllCard({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { pending, exec } = useAction();

  return (
    <Card className="min-w-0 border-destructive/30">
      <CardHeader>
        <CardTitle>Apagar todos os dados</CardTitle>
        <CardDescription>Remove categorias, séries e lançamentos. Sua conta e seu login continuam.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" disabled={disabled} onClick={() => setOpen(true)}>
          <Trash2Icon /> Apagar todos os dados
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setText("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso não pode ser desfeito. Baixe um backup antes se quiser guardar uma cópia. Para confirmar, digite APAGAR.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <a href="/dados/backup" download className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
              <DownloadIcon /> Baixar backup antes
            </a>
            <Input aria-label="Digite APAGAR para confirmar" value={text} onChange={(e) => setText(e.target.value)} placeholder="APAGAR" />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending || text.trim().toUpperCase() !== "APAGAR"}
                onClick={async () => {
                  if (await exec(() => deleteAllData({ confirm: text }), { success: "Todos os dados foram apagados." })) {
                    setOpen(false);
                    setText("");
                  }
                }}
              >
                Apagar tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
