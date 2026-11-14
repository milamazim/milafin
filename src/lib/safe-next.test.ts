import { describe, expect, it } from "vitest";

import { HOME, safeNext } from "./safe-next";

describe("safeNext", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/categorias")).toBe("/categorias");
    expect(safeNext("/dashboard?ano=2026")).toBe("/dashboard?ano=2026");
  });

  it("a raiz vai para a tela inicial", () => {
    expect(safeNext("/")).toBe(HOME);
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", null, undefined])(
    "recusa %s",
    (v) => {
      expect(safeNext(v)).toBe(HOME);
    },
  );
});
