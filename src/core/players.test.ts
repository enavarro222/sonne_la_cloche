import { describe, expect, it } from "vitest";
import { canStart, MAX_NAME_LENGTH, normalizeName, parseRoster, validateName } from "./players";

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
      { id: "1", name: "Léa" },
      { id: "5", name: "Zoé" },
    ]);
  });
});
