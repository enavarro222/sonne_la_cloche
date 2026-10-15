import { describe, expect, it } from "vitest";
import {
  canStart,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  normalizeName,
  parseRoster,
  validateName,
} from "./players";

describe("players", () => {
  it("normalizes names", () => {
    expect(normalizeName("  Léa \t Marie ")).toBe("Léa Marie");
    expect(normalizeName("x".repeat(30))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("validates names", () => {
    const roster = [{ id: "1", name: "Léa" }];
    expect(validateName("", roster)).toBe("empty");
    expect(validateName("léa", roster)).toBe("duplicate");
    expect(validateName("Tom", roster)).toBeNull();
  });

  it("takes a full party at most", () => {
    const full = Array.from({ length: MAX_PLAYERS }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    expect(validateName("Zoé", full.slice(1))).toBeNull();
    expect(validateName("Zoé", full)).toBe("full");
    // A stored roster too.
    expect(parseRoster([...full, { id: "zoe", name: "Zoé" }])).toHaveLength(MAX_PLAYERS);
  });

  it("needs two players to start", () => {
    expect(canStart([{ id: "1", name: "A" }])).toBe(false);
    expect(
      canStart([
        { id: "1", name: "A" },
        { id: "2", name: "B" },
      ]),
    ).toBe(true);
  });

  it("parses a stored roster, dropping invalid entries", () => {
    expect(parseRoster("nope")).toEqual([]);
    expect(
      parseRoster([
        { id: "1", name: "Léa" },
        { id: "2", name: "" },
        { id: "3", name: "LÉA" },
        { id: "1", name: "Tom" },
        { id: 4, name: "Sam" },
        null,
        { id: "5", name: " Zoé " },
      ]),
    ).toEqual([
      { id: "1", name: "Léa", livery: 0 },
      { id: "5", name: "Zoé", livery: 1 },
    ]);
  });

  it("keeps each stored player's colours, unless already taken or unknown", () => {
    expect(
      parseRoster([
        { id: "1", name: "Léa", livery: 4 },
        { id: "2", name: "Tom", livery: 4 },
        { id: "3", name: "Zoé", livery: 99 },
        { id: "4", name: "Sam", livery: 6 },
      ]).map((p) => p.livery),
    ).toEqual([4, 0, 1, 6]);
  });
});
