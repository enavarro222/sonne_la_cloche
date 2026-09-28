// Geometry of the cyclist drawing (SVG units, bike facing right, y down).

export interface Point {
  x: number;
  y: number;
}

const TURN = 2 * Math.PI;

/** Longest time step taken into account, like the ride itself (backgrounded tab). */
const MAX_STEP_SEC = 0.25;

/** Crank angle after `dtSec` at `cadence` rpm, in radians within [0, 2π). */
export function advanceCrank(angle: number, cadence: number, dtSec: number): number {
  const rpm = Number.isFinite(cadence) ? Math.max(0, cadence) : 0;
  const dt = Math.min(Math.max(0, dtSec), MAX_STEP_SEC);
  const next = (angle + (rpm / 60) * TURN * dt) % TURN;
  return next < 0 ? next + TURN : next;
}

export const pedalPosition = (center: Point, crankLength: number, angle: number): Point => ({
  x: center.x + crankLength * Math.cos(angle),
  y: center.y + crankLength * Math.sin(angle),
});

/**
 * Knee position for a leg going from `hip` to `foot` (two-bone inverse
 * kinematics). Of the two solutions the knee points forward, like a rider's.
 * When the foot is out of reach the leg is stretched straight towards it.
 */
export function kneePosition(hip: Point, foot: Point, thigh: number, shin: number): Point {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: hip.x + thigh, y: hip.y };
  const reach = Math.min(distance, thigh + shin - 1e-9);
  // Distance from the hip, along hip→foot, of the knee's projection.
  const along = (thigh * thigh - shin * shin + reach * reach) / (2 * reach);
  const across = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  const ux = dx / distance;
  const uy = dy / distance;
  const base = { x: hip.x + ux * along, y: hip.y + uy * along };
  // Perpendicular pointing forward (+x) for a foot below the hip.
  return { x: base.x + uy * across, y: base.y - ux * across };
}
