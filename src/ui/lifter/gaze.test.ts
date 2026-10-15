import { describe, expect, it } from "vitest";
import { GAZE, gazeOf, gazeToward, STARE_SEC } from "./gaze";

const at = (timeLeft: number, more: { alarmed?: boolean; fleeing?: boolean } = {}) =>
  gazeOf({ timeLeft, eventAt: 8, alarmed: false, fleeing: false, ...more });

describe("gazeOf", () => {
  it("looks at the player, then stares at the seconds just before they come", () => {
    expect(at(8 + STARE_SEC + 0.5)).toBe(GAZE.player);
    expect(at(8 + STARE_SEC - 0.1)).toBe(GAZE.timer);
    expect(at(8.01)).toBe(GAZE.timer);
  });

  it("goes round cyclist, timer, cyclist, player", () => {
    // Backwards from the stare: player 2.5 s, cyclist 1.5 s, timer 1 s, cyclist 2 s, timer 1 s.
    const before = (sec: number) => at(8 + STARE_SEC + sec);
    expect(before(3)).toBe(GAZE.cyclist);
    expect(before(4.5)).toBe(GAZE.timer);
    expect(before(6)).toBe(GAZE.cyclist);
    expect(before(7.5)).toBe(GAZE.timer);
    // And again.
    expect(before(8 + 1)).toBe(GAZE.player);
  });

  it("keeps his eyes on the seconds once they come", () => {
    expect(at(6, { alarmed: true })).toBe(GAZE.timer);
    expect(at(3, { fleeing: true })).toBe(GAZE.timerBack);
    // No panic: he has stepped aside, the seconds on his right.
    expect(at(4)).toBe(GAZE.timerRight);
  });
});

describe("gazeToward", () => {
  it("points from his eyes to the seconds", () => {
    expect(gazeToward({ x: 100, y: 100 }, { x: 100, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(gazeToward({ x: 100, y: 100 }, { x: 0, y: 100 })).toEqual({ x: -1, y: 0 });
    expect(gazeToward({ x: 100, y: 100 }, { x: 100.5, y: 100 })).toBeNull();
  });
});
