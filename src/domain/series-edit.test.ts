import { describe, expect, it } from "vitest";

import { buildOccurrences, type RecurrenceRow, type TransactionRow } from "./occurrences";
import {
  DEFAULT_EDIT_SCOPE,
  planDeleteOccurrence,
  planEditOccurrence,
  planMarkPaidBefore,
  type EditScope,
  type OccurrenceEdit,
} from "./series-edit";
import { applyOps, seqId, type MemoryDb } from "./testing/apply-ops";

/* Aluguel: R$ 2.800 todo dia 10, desde jan/2026, sem fim; março excluído. */
const aluguel = (r: Partial<RecurrenceRow> = {}): RecurrenceRow => ({
  id: "r1",
  categoryId: "aluguel",
  amountCents: 280000,
  note: null,
  frequency: "mensal",
  startDate: "2026-01-10",
  endDate: null,
  excludedDates: ["2026-03-10"],
  ...r,
});

const override = (o: Partial<TransactionRow>): TransactionRow => ({
  id: "o1",
  categoryId: "aluguel",
  amountCents: 280000,
  date: "2026-02-10",
  paid: true,
  note: null,
  recurrenceId: "r1",
  recurrenceDate: "2026-02-10",
  ...o,
});

const edit = (e: Partial<OccurrenceEdit> = {}): OccurrenceEdit => ({
  categoryId: "aluguel",
  amountCents: 300000,
  date: "2026-05-10",
  paid: false,
  note: null,
  ...e,
});

/** Aplica a edição e devolve as ocorrências resultantes de 2026 como [data, valor, pago]. */
function runEdit(db: MemoryDb, recurrenceDate: string, e: OccurrenceEdit, scope: EditScope, seriesId = "r1") {
  const series = db.recurrences.find((r) => r.id === seriesId)!;
  const ops = planEditOccurrence({
    series,
    overrides: db.transactions.filter((t) => t.recurrenceId === seriesId),
    recurrenceDate,
    edit: e,
    scope,
    newId: seqId("rNovo"),
  });
  const after = applyOps(db, ops);
  return { ops, after, view: view(after) };
}

function runDelete(db: MemoryDb, recurrenceDate: string, scope: EditScope) {
  const series = db.recurrences.find((r) => r.id === "r1")!;
  const ops = planDeleteOccurrence({
    series,
    overrides: db.transactions.filter((t) => t.recurrenceId === "r1"),
    recurrenceDate,
    scope,
  });
  const after = applyOps(db, ops);
  return { ops, after, view: view(after) };
}

const view = (db: MemoryDb, from = "2026-01-01", to = "2026-08-31") =>
  buildOccurrences({ ...db, from, to }).map((o) => [o.date, o.amountCents / 100, o.paid] as const);

const base = (): MemoryDb => ({ recurrences: [aluguel()], transactions: [] });

describe("editar ocorrência: só este (padrão)", () => {
  it("o padrão é 'este'", () => expect(DEFAULT_EDIT_SCOPE).toBe("este"));

  it("muda só aquele mês e não toca na série", () => {
    const { ops, view: v } = runEdit(base(), "2026-05-10", edit({ amountCents: 310000, paid: true }), "este");
    expect(ops.map((o) => o.type)).toEqual(["upsertOverride"]);
    expect(v).toEqual([
      ["2026-01-10", 2800, false],
      ["2026-02-10", 2800, false],
      ["2026-04-10", 2800, false],
      ["2026-05-10", 3100, true],
      ["2026-06-10", 2800, false],
      ["2026-07-10", 2800, false],
      ["2026-08-10", 2800, false],
    ]);
  });

  it("marcar como pago sem mudar valor também é uma substituição", () => {
    const { view: v } = runEdit(base(), "2026-01-10", edit({ amountCents: 280000, date: "2026-01-10", paid: true }), "este");
    expect(v[0]).toEqual(["2026-01-10", 2800, true]);
  });

  it("editar de novo a mesma ocorrência atualiza a substituição existente", () => {
    const db = { ...base(), transactions: [override({})] };
    const { after } = runEdit(db, "2026-02-10", edit({ amountCents: 290000, date: "2026-02-12", paid: true }), "este");
    expect(after.transactions).toHaveLength(1);
    expect(after.transactions[0]).toMatchObject({ id: "o1", amountCents: 290000, date: "2026-02-12" });
  });

  it("recusa ocorrência excluída/inexistente e valor inválido", () => {
    expect(() => runEdit(base(), "2026-03-10", edit(), "este")).toThrow("não existe mais");
    expect(() => runEdit(base(), "2026-03-11", edit(), "este")).toThrow("não existe mais");
    expect(() => runEdit(base(), "2026-04-10", edit({ amountCents: 0 }), "este")).toThrow("maior que zero");
    expect(() => runEdit(base(), "2026-04-10", edit({ amountCents: 10.5 }), "este")).toThrow("maior que zero");
    expect(() => runEdit(base(), "2026-04-10", edit({ date: "2026-02-30" }), "este")).toThrow("Data inválida");
  });
});

describe("editar ocorrência: deste em diante (reajuste)", () => {
  it("divide a série: passado intacto, novo valor daqui pra frente", () => {
    const { after, view: v } = runEdit(base(), "2026-05-10", edit({ amountCents: 300000 }), "deste-em-diante");
    expect(v).toEqual([
      ["2026-01-10", 2800, false],
      ["2026-02-10", 2800, false],
      ["2026-04-10", 2800, false],
      ["2026-05-10", 3000, false],
      ["2026-06-10", 3000, false],
      ["2026-07-10", 3000, false],
      ["2026-08-10", 3000, false],
    ]);
    expect(after.recurrences.find((r) => r.id === "r1")).toMatchObject({ endDate: "2026-05-09", excludedDates: ["2026-03-10"] });
    expect(after.recurrences.find((r) => r.id === "rNovo1")).toMatchObject({ startDate: "2026-05-10", endDate: null });
  });

  it("substituições futuras passam para a série nova; as passadas ficam", () => {
    const db: MemoryDb = {
      ...base(),
      transactions: [
        override({ id: "passada", recurrenceDate: "2026-02-10", date: "2026-02-10", amountCents: 250000 }),
        override({ id: "futura", recurrenceDate: "2026-07-10", date: "2026-07-10", amountCents: 999900 }),
      ],
    };
    const { after, view: v } = runEdit(db, "2026-05-10", edit({ amountCents: 300000 }), "deste-em-diante");
    expect(after.transactions.find((t) => t.id === "passada")!.recurrenceId).toBe("r1");
    expect(after.transactions.find((t) => t.id === "futura")!.recurrenceId).toBe("rNovo1");
    expect(v).toContainEqual(["2026-07-10", 9999, true]);
    expect(v).toContainEqual(["2026-02-10", 2500, true]);
  });

  it("mudando o dia, substituição futura sem data correspondente vira avulso (nada se perde)", () => {
    const db: MemoryDb = { ...base(), transactions: [override({ id: "futura", recurrenceDate: "2026-07-10", date: "2026-07-10" })] };
    const { after, view: v } = runEdit(db, "2026-05-10", edit({ date: "2026-05-15" }), "deste-em-diante");
    expect(after.transactions.find((t) => t.id === "futura")).toMatchObject({ recurrenceId: null, recurrenceDate: null });
    expect(v.filter(([d]) => d.startsWith("2026-07"))).toEqual([
      ["2026-07-10", 2800, true],
      ["2026-07-15", 3000, false],
    ]);
  });

  it("muda a frequência a partir daqui", () => {
    const { view: v } = runEdit(base(), "2026-05-10", edit({ frequency: "bimestral" }), "deste-em-diante");
    expect(v.map(([d]) => d)).toEqual(["2026-01-10", "2026-02-10", "2026-04-10", "2026-05-10", "2026-07-10"]);
  });

  it("na primeira ocorrência substitui a série inteira (antiga é apagada)", () => {
    const { ops, after } = runEdit(base(), "2026-01-10", edit({ date: "2026-01-10" }), "deste-em-diante");
    expect(ops.at(-1)).toEqual({ type: "deleteRecurrence", id: "r1" });
    expect(after.recurrences.map((r) => r.id)).toEqual(["rNovo1"]);
  });

  it("reaponta substituições ANTES de apagar a série antiga (senão o cascade as apagaria)", () => {
    const db: MemoryDb = { ...base(), transactions: [override({ id: "futura", recurrenceDate: "2026-04-10", date: "2026-04-10" })] };
    const { after } = runEdit(db, "2026-01-10", edit({ date: "2026-01-10" }), "deste-em-diante");
    expect(after.transactions.map((t) => [t.id, t.recurrenceId])).toEqual([["futura", "rNovo1"]]);
  });

  it("exclusões futuras compatíveis vão para a série nova", () => {
    const db: MemoryDb = { recurrences: [aluguel({ excludedDates: ["2026-03-10", "2026-07-10"] })], transactions: [] };
    const { after } = runEdit(db, "2026-05-10", edit(), "deste-em-diante");
    expect(after.recurrences.find((r) => r.id === "rNovo1")!.excludedDates).toEqual(["2026-07-10"]);
    expect(after.recurrences.find((r) => r.id === "r1")!.excludedDates).toEqual(["2026-03-10"]);
  });

  it("série com fim: a nova herda o fim", () => {
    const db: MemoryDb = { recurrences: [aluguel({ endDate: "2026-07-31" })], transactions: [] };
    const { after, view: v } = runEdit(db, "2026-05-10", edit(), "deste-em-diante");
    expect(after.recurrences.find((r) => r.id === "rNovo1")!.endDate).toBe("2026-07-31");
    expect(v.at(-1)).toEqual(["2026-07-10", 3000, false]);
  });

  it("pago vale para a ocorrência editada da série nova", () => {
    const db = { ...base(), transactions: [override({ id: "atual", recurrenceDate: "2026-05-10", date: "2026-05-10" })] };
    const { after, view: v } = runEdit(db, "2026-05-10", edit({ paid: true }), "deste-em-diante");
    expect(v).toContainEqual(["2026-05-10", 3000, true]);
    expect(v).toContainEqual(["2026-06-10", 3000, false]);
    expect(after.transactions.some((t) => t.id === "atual")).toBe(false);
  });

  it("não deixa a nova data passar para antes da ocorrência anterior", () => {
    expect(() => runEdit(base(), "2026-05-10", edit({ date: "2026-04-10" }), "deste-em-diante")).toThrow("depois da ocorrência anterior");
  });
});

describe("editar ocorrência: toda a série", () => {
  it("mesma data: muda valor de todas, inclusive passadas, mas preserva substituições", () => {
    const db = { ...base(), transactions: [override({ id: "fev", amountCents: 250000 })] };
    const { view: v } = runEdit(db, "2026-05-10", edit({ date: "2026-05-10" }), "toda");
    expect(v).toEqual([
      ["2026-01-10", 3000, false],
      ["2026-02-10", 2500, true],
      ["2026-04-10", 3000, false],
      ["2026-05-10", 3000, false],
      ["2026-06-10", 3000, false],
      ["2026-07-10", 3000, false],
      ["2026-08-10", 3000, false],
    ]);
  });

  it("desmarcar pago remove a substituição daquela ocorrência", () => {
    const db = { ...base(), transactions: [override({ id: "mai", recurrenceDate: "2026-05-10", date: "2026-05-10" })] };
    const { after } = runEdit(db, "2026-05-10", edit({ date: "2026-05-10", paid: false }), "toda");
    expect(after.transactions).toEqual([]);
  });

  it("mudar a data move o vencimento de toda a série, com exclusões, fim e substituições", () => {
    const db: MemoryDb = {
      recurrences: [aluguel({ endDate: "2026-07-20" })],
      transactions: [
        override({ id: "fev", recurrenceDate: "2026-02-10", date: "2026-02-10", amountCents: 250000 }),
        override({ id: "abr-movida", recurrenceDate: "2026-04-10", date: "2026-04-02" }),
      ],
    };
    const { after, view: v } = runEdit(db, "2026-05-10", edit({ date: "2026-05-15" }), "toda");
    expect(after.recurrences[0]).toMatchObject({
      startDate: "2026-01-15",
      endDate: "2026-07-15",
      excludedDates: ["2026-03-15"],
    });
    expect(v).toEqual([
      ["2026-01-15", 3000, false],
      ["2026-02-15", 2500, true], // acompanhou o novo dia
      ["2026-04-02", 2800, true], // tinha sido movida à mão: fica onde está
      ["2026-05-15", 3000, false],
      ["2026-06-15", 3000, false],
      ["2026-07-15", 3000, false],
    ]);
  });

  it("adiantar ou atrasar a série semanal não colide na chave única", () => {
    const semanal = aluguel({ frequency: "semanal", startDate: "2026-01-05", excludedDates: [] });
    const db: MemoryDb = {
      recurrences: [semanal],
      transactions: [
        override({ id: "a", recurrenceDate: "2026-01-12", date: "2026-01-12" }),
        override({ id: "b", recurrenceDate: "2026-01-19", date: "2026-01-19" }),
        override({ id: "c", recurrenceDate: "2026-01-26", date: "2026-01-26" }),
      ],
    };
    // +7 dias: a k-ésima vai para a data da (k+1)-ésima antiga
    expect(() => runEdit(db, "2026-01-05", edit({ date: "2026-01-12" }), "toda")).not.toThrow();
    expect(() => runEdit(db, "2026-01-12", edit({ date: "2026-01-05" }), "toda")).not.toThrow();
    const { after } = runEdit(db, "2026-01-05", edit({ date: "2026-01-12" }), "toda");
    expect(after.transactions.map((t) => [t.id, t.recurrenceDate]).sort()).toEqual([
      ["a", "2026-01-19"],
      ["b", "2026-01-26"],
      ["c", "2026-02-02"],
    ]);
  });

  it("recusa mudar frequência em 'toda' e dia inexistente no 1º mês", () => {
    expect(() => runEdit(base(), "2026-05-10", edit({ frequency: "anual" }), "toda")).toThrow("deste em diante");
    const fev = { recurrences: [aluguel({ startDate: "2026-02-10", excludedDates: [] })], transactions: [] };
    expect(() => runEdit(fev, "2026-05-10", edit({ date: "2026-05-31" }), "toda")).toThrow("primeiro mês");
  });
});

describe("marcar anteriores a hoje como pagas", () => {
  const run = (db: MemoryDb, before: string) => {
    const ops = planMarkPaidBefore({ series: db.recurrences[0], overrides: db.transactions, before });
    const after = applyOps(db, ops);
    return { ops, after, view: view(after) };
  };

  it("marca as calculadas antes de hoje, sem tocar em hoje, no futuro e nas exclusões", () => {
    const { view: v } = run(base(), "2026-05-10");
    expect(v).toEqual([
      ["2026-01-10", 2800, true],
      ["2026-02-10", 2800, true],
      // março excluído continua fora
      ["2026-04-10", 2800, true],
      ["2026-05-10", 2800, false], // hoje: não é "anterior"
      ["2026-06-10", 2800, false],
      ["2026-07-10", 2800, false],
      ["2026-08-10", 2800, false],
    ]);
  });

  it("ocorrência editada não paga só ganha o pago (valor mantido); a já paga não muda", () => {
    const db: MemoryDb = {
      ...base(),
      transactions: [
        override({ id: "fev", amountCents: 310000, paid: false }),
        override({ id: "jan", recurrenceDate: "2026-01-10", date: "2026-01-10", paid: true }),
      ],
    };
    const { ops, view: v } = run(db, "2026-03-01");
    expect(ops).toEqual([{ type: "updateTransaction", id: "fev", patch: { paid: true } }]);
    expect(v.slice(0, 2)).toEqual([
      ["2026-01-10", 2800, true],
      ["2026-02-10", 3100, true],
    ]);
  });

  it("respeita ocorrências movidas: para o futuro não marca; para o passado marca", () => {
    const db: MemoryDb = {
      ...base(),
      transactions: [
        override({ id: "abr-futuro", recurrenceDate: "2026-04-10", date: "2026-06-01", paid: false }),
        override({ id: "jun-passado", recurrenceDate: "2026-06-10", date: "2026-04-20", paid: false }),
      ],
    };
    const { after } = run(db, "2026-05-01");
    expect(after.transactions.find((t) => t.id === "abr-futuro")!.paid).toBe(false);
    expect(after.transactions.find((t) => t.id === "jun-passado")!.paid).toBe(true);
    // abril não ganha uma segunda linha (já tem substituição)
    expect(after.transactions.filter((t) => t.recurrenceDate === "2026-04-10")).toHaveLength(1);
  });

  it("série que ainda não começou ou já tudo pago: nada a fazer", () => {
    expect(run(base(), "2026-01-10").ops).toEqual([]);
    const { after } = run(base(), "2026-03-01");
    expect(planMarkPaidBefore({ series: after.recurrences[0], overrides: after.transactions, before: "2026-03-01" })).toEqual([]);
  });

  it("série com fim: não passa do fim", () => {
    const db: MemoryDb = { recurrences: [aluguel({ endDate: "2026-02-28", excludedDates: [] })], transactions: [] };
    expect(run(db, "2026-12-01").ops).toHaveLength(2);
  });
});

describe("simulador de banco (sanidade do teste)", () => {
  it("acusa colisão na chave única quando a ordem está errada", () => {
    const db: MemoryDb = {
      recurrences: [aluguel()],
      transactions: [override({ id: "a" }), override({ id: "b", recurrenceDate: "2026-04-10", date: "2026-04-10" })],
    };
    expect(() =>
      applyOps(db, [{ type: "updateTransaction", id: "a", patch: { recurrenceDate: "2026-04-10" } }]),
    ).toThrow("chave única");
  });

  it("acusa série com fim antes do início", () => {
    expect(() => applyOps(base(), [{ type: "updateRecurrence", id: "r1", patch: { endDate: "2025-01-01" } }])).toThrow(
      "fim antes do início",
    );
  });
});

describe("excluir ocorrência", () => {
  it("só este: vira exclusão e apaga a substituição dela", () => {
    const db = { ...base(), transactions: [override({ id: "mai", recurrenceDate: "2026-05-10", date: "2026-05-10" })] };
    const { after, view: v } = runDelete(db, "2026-05-10", "este");
    expect(after.recurrences[0].excludedDates).toEqual(["2026-03-10", "2026-05-10"]);
    expect(after.transactions).toEqual([]);
    expect(v.map(([d]) => d)).not.toContain("2026-05-10");
  });

  it("deste em diante: a série termina antes e substituições futuras somem", () => {
    const db = {
      recurrences: [aluguel({ excludedDates: ["2026-03-10", "2026-07-10"] })],
      transactions: [override({ id: "fev" }), override({ id: "jun", recurrenceDate: "2026-06-10", date: "2026-06-10" })],
    };
    const { after, view: v } = runDelete(db, "2026-05-10", "deste-em-diante");
    expect(after.recurrences[0]).toMatchObject({ endDate: "2026-05-09", excludedDates: ["2026-03-10"] });
    expect(after.transactions.map((t) => t.id)).toEqual(["fev"]);
    expect(v.map(([d]) => d)).toEqual(["2026-01-10", "2026-02-10", "2026-04-10"]);
    expect(view(after, "2030-01-01", "2030-12-31")).toEqual([]);
  });

  it("deste em diante na primeira ocorrência = apagar a série", () => {
    expect(runDelete(base(), "2026-01-10", "deste-em-diante").ops).toEqual([{ type: "deleteRecurrence", id: "r1" }]);
  });

  it("toda: apaga a série e (cascade) as substituições", () => {
    const db = { ...base(), transactions: [override({})] };
    const { after } = runDelete(db, "2026-05-10", "toda");
    expect(after).toEqual({ recurrences: [], transactions: [] });
  });

  it("não exclui ocorrência que não existe", () => {
    expect(() => runDelete(base(), "2026-03-10", "este")).toThrow("não existe mais");
  });
});
