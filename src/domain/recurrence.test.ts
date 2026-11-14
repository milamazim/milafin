import { describe, expect, it } from "vitest";

import {
  indexOf,
  isOccurrence,
  isScheduled,
  lastScheduledDate,
  nthDate,
  occurrenceDates,
  scheduledDates,
  validateRule,
  type RecurrenceRule,
} from "./recurrence";

const rule = (r: Partial<RecurrenceRule>): RecurrenceRule => ({
  frequency: "mensal",
  startDate: "2026-01-10",
  endDate: null,
  excludedDates: [],
  ...r,
});

describe("datas agendadas", () => {
  it("mensal no dia de vencimento", () => {
    expect(scheduledDates(rule({}), "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-10",
      "2026-02-10",
      "2026-03-10",
      "2026-04-10",
    ]);
  });

  it("dia 31 ajusta ao fim do mês e volta a 31", () => {
    expect(scheduledDates(rule({ startDate: "2026-01-31" }), "2026-01-01", "2026-05-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("anual em 29/02 cai em 28/02 nos anos não bissextos", () => {
    const r = rule({ frequency: "anual", startDate: "2028-02-29" });
    expect(scheduledDates(r, "2028-01-01", "2032-12-31")).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
      "2031-02-28",
      "2032-02-29",
    ]);
  });

  it("bimestral, trimestral e semestral", () => {
    const year = ["2026-01-01", "2026-12-31"] as const;
    expect(scheduledDates(rule({ frequency: "bimestral" }), ...year)).toHaveLength(6);
    expect(scheduledDates(rule({ frequency: "trimestral" }), ...year)).toEqual([
      "2026-01-10",
      "2026-04-10",
      "2026-07-10",
      "2026-10-10",
    ]);
    expect(scheduledDates(rule({ frequency: "semestral" }), ...year)).toEqual(["2026-01-10", "2026-07-10"]);
  });

  it("semanal atravessando meses e anos", () => {
    const r = rule({ frequency: "semanal", startDate: "2026-12-17" });
    expect(scheduledDates(r, "2026-12-01", "2027-01-15")).toEqual([
      "2026-12-17",
      "2026-12-24",
      "2026-12-31",
      "2027-01-07",
      "2027-01-14",
    ]);
  });

  it("janela no meio da série começa na data certa", () => {
    const r = rule({ startDate: "2020-01-31" });
    expect(scheduledDates(r, "2026-02-01", "2026-03-31")).toEqual(["2026-02-28", "2026-03-31"]);
    expect(scheduledDates(r, "2026-02-28", "2026-02-28")).toEqual(["2026-02-28"]);
    expect(scheduledDates(r, "2026-03-01", "2026-03-30")).toEqual([]);
    const w = rule({ frequency: "semanal", startDate: "2026-01-05" });
    expect(scheduledDates(w, "2026-01-06", "2026-01-19")).toEqual(["2026-01-12", "2026-01-19"]);
  });

  it("respeita início, fim e janela invertida", () => {
    const r = rule({ startDate: "2026-03-10", endDate: "2026-05-10" });
    expect(scheduledDates(r, "2026-01-01", "2026-12-31")).toEqual(["2026-03-10", "2026-04-10", "2026-05-10"]);
    expect(scheduledDates(rule({ endDate: "2026-05-09" }), "2026-04-01", "2026-12-31")).toEqual(["2026-04-10"]);
    expect(scheduledDates(r, "2026-12-31", "2026-01-01")).toEqual([]);
  });

  it("série sem fim aparece em todos os anos futuros", () => {
    expect(scheduledDates(rule({}), "2040-01-01", "2040-12-31")).toHaveLength(12);
  });
});

describe("exclusões e consultas", () => {
  const r = rule({ excludedDates: ["2026-02-10"], endDate: "2026-06-25" });

  it("ocorrências descontam as exclusões", () => {
    expect(occurrenceDates(r, "2026-01-01", "2026-03-31")).toEqual(["2026-01-10", "2026-03-10"]);
  });

  it("isScheduled × isOccurrence", () => {
    expect(isScheduled(r, "2026-02-10")).toBe(true);
    expect(isOccurrence(r, "2026-02-10")).toBe(false);
    expect(isOccurrence(r, "2026-03-10")).toBe(true);
    expect(isScheduled(r, "2026-03-11")).toBe(false);
    expect(isScheduled(r, "2025-12-10")).toBe(false);
    expect(isScheduled(r, "2026-07-10")).toBe(false);
  });

  it("indexOf e nthDate são inversos", () => {
    for (const d of scheduledDates(rule({ startDate: "2026-01-31" }), "2026-01-01", "2028-12-31")) {
      const k = indexOf(rule({ startDate: "2026-01-31" }), d)!;
      expect(nthDate(rule({ startDate: "2026-01-31" }), k)).toBe(d);
    }
    expect(indexOf(r, "2026-03-11")).toBeNull();
  });

  it("última data agendada", () => {
    expect(lastScheduledDate(r)).toBe("2026-06-10");
    expect(lastScheduledDate(rule({ endDate: "2026-06-10" }))).toBe("2026-06-10");
    expect(lastScheduledDate(rule({ endDate: "2026-01-10" }))).toBe("2026-01-10");
    expect(lastScheduledDate(rule({}))).toBeNull();
  });

  it("valida a regra", () => {
    expect(() => validateRule(rule({ endDate: "2025-12-31" }))).toThrow("anterior à inicial");
    expect(() => validateRule(rule({ startDate: "2026-02-30" }))).toThrow("Data inválida");
    expect(() => validateRule(rule({ frequency: "diaria" as never }))).toThrow("Frequência inválida");
    expect(() => validateRule(rule({}))).not.toThrow();
  });
});
