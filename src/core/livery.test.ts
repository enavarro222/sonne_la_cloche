import { describe, expect, it } from "vitest";
import { freeLivery, LIVERIES, liveryOf, nextLivery, ORIGINAL_LIVERY } from "./livery";

describe("liveries", () => {
  it("hands out the first colours nobody wears", () => {
    expect(freeLivery([])).toBe(0);
    expect(freeLivery([0, 2, undefined])).toBe(1);
  });

  it("comes round again once every livery is taken", () => {
    const all = LIVERIES.map((_, i) => i);
    expect(freeLivery(all)).toBe(0);
    expect(freeLivery([...all, 0])).toBe(1);
  });

  it("goes to the next colours nobody else wears, round the palette", () => {
    expect(nextLivery(0, [1, 2])).toBe(3);
    expect(nextLivery(LIVERIES.length - 1, [0])).toBe(1);
    expect(nextLivery(undefined, [])).toBe(0);
  });

  it("keeps the colours when every other livery is worn", () => {
    const others = LIVERIES.map((_, i) => i).filter((i) => i !== 5);
    expect(nextLivery(5, others)).toBe(5);
  });

  it("dresses a player without colours as in the original drawing", () => {
    expect(liveryOf({})).toBe(ORIGINAL_LIVERY);
    expect(liveryOf({ livery: 99 })).toBe(ORIGINAL_LIVERY);
    expect(liveryOf({ livery: 1 })).toBe(LIVERIES[1]);
  });
});
