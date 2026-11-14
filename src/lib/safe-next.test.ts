import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/lancamentos")).toBe("/lancamentos");
    expect(safeNext("/dashboard?ano=2026")).toBe("/dashboard?ano=2026");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", null, undefined])(
    "recusa %s",
    (v) => {
      expect(safeNext(v)).toBe("/");
    },
  );
});
