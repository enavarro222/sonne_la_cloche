import { describe, expect, it } from "vitest";
import { CRANK_STOPPED_AFTER_MS, ReadingTracker, STALE_AFTER_MS } from "./ble/readingTracker";
import { DEMO_CADENCE, DemoSensor } from "./demo/demoSensor";

describe("ReadingTracker", () => {
  it("keeps the latest cadence and power", () => {
    const tracker = new ReadingTracker();
    tracker.update({ cadence: 90, power: 100 }, 0);
    tracker.update({ power: 120 }, 100);
    expect(tracker.read(100)).toEqual({ cadence: 90, power: 120 });
  });

  it("derives cadence from successive crank samples", () => {
    const tracker = new ReadingTracker();
    tracker.update({ crank: { revolutions: 0, eventTime: 0 } }, 0);
    expect(tracker.read(0).cadence).toBe(0);
    tracker.update({ crank: { revolutions: 1, eventTime: 1024 } }, 1000);
    expect(tracker.read(1000).cadence).toBe(60);
  });

  it("drops to zero when notifications stop", () => {
    const tracker = new ReadingTracker();
    tracker.update({ cadence: 90, power: 100 }, 0);
    expect(tracker.read(STALE_AFTER_MS)).toEqual({ cadence: 90, power: 100 });
    expect(tracker.read(STALE_AFTER_MS + 1)).toEqual({ cadence: 0, power: 0 });
  });

  it("drops crank cadence to zero once revolutions stop", () => {
    const tracker = new ReadingTracker();
    tracker.update({ crank: { revolutions: 0, eventTime: 0 } }, 0);
    tracker.update({ crank: { revolutions: 1, eventTime: 1024 } }, 1000);
    // The sensor keeps repeating the same sample every second.
    tracker.update({ crank: { revolutions: 1, eventTime: 1024 } }, 2000);
    expect(tracker.read(2000).cadence).toBeGreaterThan(0);
    tracker.update({ crank: { revolutions: 1, eventTime: 1024 } }, 3000);
    expect(tracker.read(1000 + CRANK_STOPPED_AFTER_MS + 1).cadence).toBe(0);
  });

  it("forgets everything on reset, including the previous crank sample", () => {
    const tracker = new ReadingTracker();
    tracker.update({ crank: { revolutions: 0, eventTime: 0 } }, 0);
    tracker.reset();
    tracker.update({ crank: { revolutions: 100, eventTime: 1024 } }, 10);
    expect(tracker.read(10).cadence).toBe(0);
  });
});

describe("DemoSensor", () => {
  const readAfter = (sensor: DemoSensor, ms: number, step = 16) => {
    let reading = sensor.read(0);
    for (let t = step; t <= ms; t += step) reading = sensor.read(t);
    return reading;
  };

  it("reaches pedaling speed within about a second while pressed", () => {
    const sensor = new DemoSensor();
    sensor.press();
    expect(readAfter(sensor, 1000).cadence).toBeGreaterThan(DEMO_CADENCE * 0.99);
  });

  it("slows down once released", () => {
    const sensor = new DemoSensor();
    sensor.press();
    readAfter(sensor, 1000);
    sensor.release();
    expect(sensor.read(2000).cadence).toBeLessThan(1);
  });

  it("restarts from zero after reset but stays pressed", () => {
    const sensor = new DemoSensor();
    sensor.press();
    readAfter(sensor, 1000);
    sensor.reset();
    expect(sensor.read(5000).cadence).toBe(0);
    expect(sensor.read(6000).cadence).toBeGreaterThan(DEMO_CADENCE * 0.99);
  });

  it("does not depend on the frame rate", () => {
    const a = new DemoSensor();
    const b = new DemoSensor();
    a.press();
    b.press();
    expect(readAfter(a, 480, 16).cadence).toBeCloseTo(readAfter(b, 480, 48).cadence, 5);
  });
});
