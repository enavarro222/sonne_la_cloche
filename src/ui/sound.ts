// Tiny synthesized sound effects. Without audio the game stays playable.

let context: AudioContext | null = null;

function unlockAudio(): void {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") context.resume().catch(() => undefined);
  } catch {
    context = null;
  }
}

// Only these count as a user activation for audio; for touch, pointerdown
// does not (HTML spec), which is why it is not in the list.
const GESTURES = ["pointerup", "touchend", "click", "keydown"] as const;

/**
 * Browsers (Android Chrome especially) keep audio suspended until a user
 * gesture. Keeps trying on every gesture until the audio actually runs.
 */
export function installAudioUnlock(): void {
  const onGesture = () => {
    unlockAudio();
    if (context?.state !== "running") return;
    for (const type of GESTURES) removeEventListener(type, onGesture, true);
  };
  for (const type of GESTURES) addEventListener(type, onGesture, true);
}

function beep(frequency: number, durationMs = 160, delayMs = 0): void {
  if (!context) return;
  const start = context.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.12, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

/** A bell: a few inharmonic partials with a long decay. */
function ding(): void {
  if (!context) return;
  const start = context.currentTime;
  for (const [ratio, level, decay] of [
    [1, 0.25, 1.6],
    [2.76, 0.12, 0.9],
    [5.4, 0.06, 0.5],
  ] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880 * ratio;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + decay);
  }
}

export const sounds = {
  countdown: () => {
    beep(440);
  },
  go: () => {
    beep(880, 400);
  },
  tick: () => {
    beep(660, 90);
  },
  bell: ding,
  fanfare: () => {
    [523, 659, 784, 1046].forEach((frequency, i) => {
      beep(frequency, 200, i * 130);
    });
  },
};
