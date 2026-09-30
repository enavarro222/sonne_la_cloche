// A virtual GPS track: laps of a circle around a real point, the distance
// derived from the pedaling. Gives the activity a map, and puts everyone of
// the same party at the same place and time.

export interface LatLon {
  lat: number;
  lon: number;
}

/** Metres travelled per crank turn: a kid's bike in a low gear. */
export const METRES_PER_CRANK_TURN = 4;
/** Radius of the virtual track around the chosen point. */
export const TRACK_RADIUS_M = 30;

const EARTH_RADIUS_M = 6_371_000;

/** Metres covered in one second at `cadence` rpm. */
export const metresPerSecond = (cadence: number): number =>
  (Math.max(0, cadence) / 60) * METRES_PER_CRANK_TURN;

/** Where the rider is after `distance` metres on the circle around `center`. */
export function positionOnTrack(center: LatLon, distance: number, radius = TRACK_RADIUS_M): LatLon {
  const angle = distance / radius; // radians along the circle
  const north = radius * Math.cos(angle);
  const east = radius * Math.sin(angle);
  const toDegrees = 180 / Math.PI;
  return {
    lat: center.lat + (north / EARTH_RADIUS_M) * toDegrees,
    lon:
      center.lon + (east / (EARTH_RADIUS_M * Math.cos((center.lat * Math.PI) / 180))) * toDegrees,
  };
}
