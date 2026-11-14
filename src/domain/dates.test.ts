import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  diffDays,
  isValidISODate,
  month0Of,
  monthIndex,
  monthRange,
  parseISO,
  toISO,
  yearRange,
} from "./dates";

describe("datas ISO", () => {
  it("valida datas reais", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-29", "2026-13-01", "2026-04-31", "2026-1-01", "", null, 20260101]) {
      expect(isValidISODate(bad)).toBe(false);
    }
    expect(() => parseISO("2026-02-30")).toThrow("Data inválida");
  });

  it("dias no mês, inclusive bissexto", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("soma dias atravessando mês e ano, sem efeito de fuso/horário de verão", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-01-01", "2027-01-01")).toBe(365);
    expect(diffDays("2026-03-10", "2026-03-03")).toBe(-7);
    // Brasil já teve horário de verão em outubro/fevereiro: não pode afetar
    expect(addDays("2018-11-03", 1)).toBe("2018-11-04");
  });

  it("soma meses ajustando ao fim do mês sem perder o dia de vencimento", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsClamped("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-02-28", 1, 31)).toBe("2026-03-31");
  });

  it("índices e intervalos", () => {
    expect(monthIndex("2026-01-15")).toBe(2026 * 12);
    expect(month0Of("2026-12-01")).toBe(11);
    expect(toISO(2026, 3, 5)).toBe("2026-03-05");
    expect(yearRange(2026)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(monthRange(2028, 1)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
