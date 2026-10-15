/** Where the pole bearer looks, as a unit vector (y down) from his head. */
export interface Gaze {
  x: number;
  y: number;
}

export const GAZE = {
  /** At whoever is pedaling, in front of the screen. */
  player: { x: 0, y: 0 },
  /** At the cyclist, on the track to his left. */
  cyclist: { x: -0.9, y: -0.44 },
  /** At the seconds, coming down the column he stands in. */
  timer: { x: 0, y: -1 },
  /** Stepped aside under the track, he has the seconds up on his right. */
  timerRight: { x: 0.5, y: -0.87 },
  /** Run off to the right, he has them on his left, about level with his head. */
  timerBack: { x: -0.93, y: -0.37 },
} satisfies Record<string, Gaze>;

/**
 * While he holds the track, he keeps an eye on everything, in turn (s). The
 * round ends on the player: then his eyes jump to the seconds coming.
 */
const ROUND: readonly [Gaze, number][] = [
  [GAZE.timer, 1],
  [GAZE.cyclist, 2],
  [GAZE.timer, 1],
  [GAZE.cyclist, 1.5],
  [GAZE.player, 2.5],
];
const ROUND_SEC = ROUND.reduce((sum, [, sec]) => sum + sec, 0);

/** He stares at the seconds this long before they come for him (s). */
export const STARE_SEC = 1.5;

interface Moment {
  /** Seconds left in the ride. */
  timeLeft: number;
  /** Seconds left when the seconds come for him: he panics, or steps aside. */
  eventAt: number;
  alarmed: boolean;
  fleeing: boolean;
}

/** The gazes at the seconds: worth replacing with where they really are. */
export const AT_TIMER: ReadonlySet<Gaze> = new Set([GAZE.timer, GAZE.timerRight, GAZE.timerBack]);

/** From `from` toward `to` (screen px), as a gaze; null when they are one. */
export function gazeToward(from: Gaze, to: Gaze): Gaze | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length < 1 ? null : { x: dx / length, y: dy / length };
}

export function gazeOf({ timeLeft, eventAt, alarmed, fleeing }: Moment): Gaze {
  if (fleeing) return GAZE.timerBack;
  if (alarmed) return GAZE.timer;
  // Past the event without panic: he has stepped aside.
  if (timeLeft <= eventAt) return GAZE.timerRight;
  // Just before, he sees them coming.
  if (timeLeft <= eventAt + STARE_SEC) return GAZE.timer;
  // Counting down from the event, so that every ride ends its round the same way.
  let t = (timeLeft - eventAt - STARE_SEC) % ROUND_SEC;
  for (const [gaze, sec] of ROUND.toReversed()) {
    if (t < sec) return gaze;
    t -= sec;
  }
  return GAZE.player;
}
