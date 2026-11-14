import { describe, expect, it } from "vitest";

import { centsToInput, formatBRL, parseBRL } from "./money";

describe("parseBRL", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["R$ 50", 5000],
    ["r$50,5", 5050],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["10.123", 1012300],
    ["0,10", 10],
    ["  7 ", 700],
    ["0", 0],
  ])("%s → %i centavos", (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });

  it.each(["", "   ", "abc", "1,234,56", "12,345", "-10", "1.23.4", "10.1234", null, undefined])(
    "rejeita %s",
    (input) => {
      expect(parseBRL(input)).toBeNull();
    },
  );

  it("não sofre erro de ponto flutuante", () => {
    expect(parseBRL("0,1")! + parseBRL("0,2")!).toBe(parseBRL("0,3"));
  });
});

describe("formatBRL / centsToInput", () => {
  it("formata em reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(centsToInput(5)).toBe("0,05");
  });

  it("ida e volta preserva o valor", () => {
    for (const c of [1, 99, 100, 123456, 999999999]) {
      expect(parseBRL(centsToInput(c))).toBe(c);
    }
  });
});
