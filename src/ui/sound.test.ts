import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An AudioContext as Android Chrome hands it out: suspended, and resuming
 * only when the browser agrees (`willResume`).
 */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static willResume = true;
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = {};
  started = 0;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume() {
    if (FakeAudioContext.willResume) this.state = "running";
    return Promise.resolve();
  }
  createOscillator() {
    return {
      type: "",
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: () => {
        this.started++;
      },
      stop: () => undefined,
    };
  }
  createGain() {
    const gain = {
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: (node: unknown) => node,
    };
    return gain;
  }
}

/** A fresh copy of the module: it keeps its audio context between calls. */
const loadSound = async () => import("./sound");

const tap = () => {
  dispatchEvent(new Event("pointerup"));
};

describe("sound", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeAudioContext.instances = [];
    FakeAudioContext.willResume = true;
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays silent until a gesture unlocks the audio, then plays", async () => {
    const { installAudioUnlock, sounds } = await loadSound();
    installAudioUnlock();
    sounds.bell();
    expect(FakeAudioContext.instances).toHaveLength(0);

    tap();
    sounds.bell();
    expect(FakeAudioContext.instances[0]?.state).toBe("running");
    expect(FakeAudioContext.instances[0]?.started).toBeGreaterThan(0);
  });

  it("keeps trying on each gesture while the browser holds the audio back", async () => {
    const { installAudioUnlock } = await loadSound();
    installAudioUnlock();
    FakeAudioContext.willResume = false;
    tap();
    const context = FakeAudioContext.instances[0];
    expect(context?.state).toBe("suspended");

    FakeAudioContext.willResume = true;
    dispatchEvent(new KeyboardEvent("keydown"));
    expect(context?.state).toBe("running");
    // One context for the whole game, not one per gesture.
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("stops listening to gestures once the audio runs", async () => {
    const { installAudioUnlock } = await loadSound();
    const removed = vi.spyOn(window, "removeEventListener");
    installAudioUnlock();
    tap();
    expect(removed.mock.calls.map(([type]) => type).sort()).toEqual(
      ["click", "keydown", "pointerup", "touchend"].sort(),
    );
    removed.mockRestore();
  });

  it("leaves the game playable when the browser has no audio", async () => {
    vi.stubGlobal("AudioContext", function NoAudio() {
      throw new Error("No audio device");
    });
    const { installAudioUnlock, sounds } = await loadSound();
    installAudioUnlock();
    expect(tap).not.toThrow();
    expect(() => {
      sounds.countdown();
      sounds.go();
      sounds.tick();
      sounds.bell();
      sounds.fanfare();
    }).not.toThrow();
  });
});
