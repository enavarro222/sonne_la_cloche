import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ControlPoint,
  DEFAULT_RANGE,
  encodeSetResistance,
  FtmsControl,
  OP_REQUEST_CONTROL,
  OP_SET_RESISTANCE,
  OP_START,
  parseControlResponse,
  parseResistanceRange,
  RESPONSE_TIMEOUT_MS,
  RESULT_CONTROL_NOT_PERMITTED,
  RESULT_SUCCESS,
  resistanceLevel,
  supportsResistance,
} from "./ftmsControl";

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe("FTMS encoding", () => {
  it("reads whether the resistance can be set", () => {
    // Elite Suito: target settings 0x0000200C (resistance, power, simulation).
    expect(supportsResistance(view(0, 0, 0, 0, 0x0c, 0x20, 0, 0))).toBe(true);
    expect(supportsResistance(view(0, 0, 0, 0, 0x08, 0, 0, 0))).toBe(false);
    expect(supportsResistance(view(0, 0))).toBe(false);
  });

  it("reads the supported resistance range", () => {
    expect(parseResistanceRange(view(0, 0, 200, 0, 1, 0))).toEqual(DEFAULT_RANGE);
    expect(parseResistanceRange(view(0, 0, 0, 0, 1, 0))).toBeNull();
    expect(parseResistanceRange(view(0, 0))).toBeNull();
  });

  it("maps the settings onto the Suito values tested with a child", () => {
    expect(resistanceLevel("light", DEFAULT_RANGE)).toBe(0);
    expect(resistanceLevel("normal", DEFAULT_RANGE)).toBe(10);
    expect(resistanceLevel("hard", DEFAULT_RANGE)).toBe(25);
    expect(resistanceLevel("megaHard", DEFAULT_RANGE)).toBe(50);
  });

  it("follows other ranges, their step, and stays a byte", () => {
    expect(resistanceLevel("hard", { min: 10, max: 90, increment: 4 })).toBe(22);
    expect(resistanceLevel("hard", { min: 0, max: 4000, increment: 1 })).toBe(255);
  });

  it("encodes the command and decodes the answer", () => {
    expect([...encodeSetResistance(25)]).toEqual([OP_SET_RESISTANCE, 25]);
    expect(parseControlResponse(view(0x80, 0x04, 0x01))).toEqual({
      opCode: OP_SET_RESISTANCE,
      result: RESULT_SUCCESS,
    });
    expect(parseControlResponse(view(0x12, 0x04, 0x01))).toBeNull();
  });
});

/** A trainer's control point answering each op code as told. */
function fakeControlPoint(answers: Partial<Record<number, number | "silent">> = {}) {
  let listener: (() => void) | null = null;
  const written: number[][] = [];
  const point: ControlPoint & { value?: DataView } = {
    writeValueWithResponse: vi.fn((value: BufferSource) => {
      const bytes = [...new Uint8Array(value as ArrayBuffer)];
      written.push(bytes);
      const opCode = bytes[0] ?? -1;
      const answer = answers[opCode] ?? RESULT_SUCCESS;
      if (answer !== "silent") {
        setTimeout(() => {
          point.value = view(0x80, opCode, answer);
          listener?.();
        }, 5);
      }
      return Promise.resolve();
    }),
    addEventListener: (_type, fn) => {
      listener = fn;
    },
  };
  return { point, written };
}

describe("FtmsControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes control once, then sets the resistance", async () => {
    const { point, written } = fakeControlPoint();
    const control = new FtmsControl(point, DEFAULT_RANGE);
    expect(await control.setResistance("hard")).toBe(true);
    expect(await control.setResistance("light")).toBe(true);
    expect(written).toEqual([
      [OP_REQUEST_CONTROL],
      [OP_START],
      [OP_SET_RESISTANCE, 25],
      [OP_SET_RESISTANCE, 0],
    ]);
  });

  it("still works when the trainer refuses the start command", async () => {
    const { point } = fakeControlPoint({ [OP_START]: 0x02 });
    expect(await new FtmsControl(point, DEFAULT_RANGE).setResistance("normal")).toBe(true);
  });

  it("gives up when control is refused", async () => {
    const { point, written } = fakeControlPoint({
      [OP_REQUEST_CONTROL]: RESULT_CONTROL_NOT_PERMITTED,
    });
    expect(await new FtmsControl(point, DEFAULT_RANGE).setResistance("normal")).toBe(false);
    expect(written).toEqual([[OP_REQUEST_CONTROL]]);
  });

  it("takes control back when another app took it meanwhile", async () => {
    const answers: Partial<Record<number, number>> = {};
    const { point, written } = fakeControlPoint(answers);
    const control = new FtmsControl(point, DEFAULT_RANGE);
    await control.setResistance("normal");
    answers[OP_SET_RESISTANCE] = RESULT_CONTROL_NOT_PERMITTED;
    const retried = control.setResistance("hard");
    // After the control request succeeds again, the resistance is accepted.
    setTimeout(() => {
      answers[OP_SET_RESISTANCE] = RESULT_SUCCESS;
    }, 7);
    expect(await retried).toBe(true);
    expect(written.slice(3)).toEqual([
      [OP_SET_RESISTANCE, 25],
      [OP_REQUEST_CONTROL],
      [OP_START],
      [OP_SET_RESISTANCE, 25],
    ]);
  });

  it("does not hang when the trainer never answers", async () => {
    vi.useFakeTimers();
    const { point } = fakeControlPoint({ [OP_REQUEST_CONTROL]: "silent" });
    const result = new FtmsControl(point, DEFAULT_RANGE).setResistance("normal");
    await vi.advanceTimersByTimeAsync(RESPONSE_TIMEOUT_MS + 1);
    expect(await result).toBe(false);
  });

  it("never rejects, even if the write fails", async () => {
    const { point } = fakeControlPoint();
    point.writeValueWithResponse = vi.fn(() => Promise.reject(new Error("GATT error")));
    expect(await new FtmsControl(point, DEFAULT_RANGE).setResistance("normal")).toBe(false);
  });

  it("sends one command at a time", async () => {
    const { point, written } = fakeControlPoint();
    const control = new FtmsControl(point, DEFAULT_RANGE);
    const both = await Promise.all([control.setResistance("hard"), control.setResistance("light")]);
    expect(both).toEqual([true, true]);
    expect(written.at(-2)).toEqual([OP_SET_RESISTANCE, 25]);
    expect(written.at(-1)).toEqual([OP_SET_RESISTANCE, 0]);
  });
});
