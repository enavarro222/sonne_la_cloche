import { describe, expect, it } from "vitest";
import { advanceCrank, kneePosition, pedalPosition } from "./geometry";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("advanceCrank", () => {
  it("turns at the cadence: 60 rpm is one turn per second", () => {
    let angle = 0;
    for (let i = 0; i < 4; i++) angle = advanceCrank(angle, 60, 0.125);
    expect(angle).toBeCloseTo(Math.PI);
  });

  it("stays within one turn", () => {
    const angle = advanceCrank(6, 120, 0.2);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  });

  it("does not move when stopped, and ignores bad input", () => {
    expect(advanceCrank(1, 0, 0.1)).toBe(1);
    expect(advanceCrank(1, Number.NaN, 0.1)).toBe(1);
    expect(advanceCrank(1, -30, 0.1)).toBe(1);
    expect(advanceCrank(1, 60, -1)).toBe(1);
  });

  it("caps long frames like the ride does", () => {
    // 60 rpm over a 10 s gap counts as 0.25 s only: a quarter turn.
    expect(advanceCrank(0, 60, 10)).toBeCloseTo(Math.PI / 2);
  });
});

describe("pedalPosition", () => {
  it("puts the pedal on the crank circle", () => {
    const p = pedalPosition({ x: 10, y: 10 }, 5, Math.PI / 2);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(15);
  });
});

describe("kneePosition", () => {
  const hip = { x: 0, y: 0 };

  it("keeps the thigh and shin lengths", () => {
    for (let a = 0; a < 2 * Math.PI; a += 0.3) {
      const foot = pedalPosition({ x: 9, y: 32 }, 9, a);
      const knee = kneePosition(hip, foot, 22, 22);
      expect(dist(hip, knee)).toBeCloseTo(22);
      expect(dist(knee, foot)).toBeCloseTo(22);
    }
  });

  it("bends the knee forward", () => {
    const knee = kneePosition(hip, { x: 0, y: 30 }, 22, 22);
    expect(knee.x).toBeGreaterThan(0);
  });

  it("stretches the leg towards a foot out of reach", () => {
    const knee = kneePosition(hip, { x: 0, y: 100 }, 22, 22);
    expect(knee.x).toBeCloseTo(0, 3);
    expect(knee.y).toBeCloseTo(22, 3);
  });
});
