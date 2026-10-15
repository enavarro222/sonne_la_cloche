// FIT activity file for one player: one lap per ride, a record per second
// with cadence, power, distance and altitude. The sub-sport makes it a
// virtual ride, kept out of segments and leaderboards.
//
// Strava tells the waits between rides from the ride only by the position
// standing still: it ignores the timer's pauses and zero speeds (checked by
// hand on Strava). With a virtual GPS track, the rides keep their real time
// and the rests between them show; without one, they follow one another, a
// second apart, or the waits would count as moving time and drag the
// average speed down.

import { FitWriter } from "@markw65/fit-file-writer";
import type { RideSample } from "../core/ride";
import { type LatLon, metresPerSecond, positionOnTrack } from "./virtualTrack";

/** One ride of a player, as recorded by the game. */
export interface ExportRide {
  /** Start of the ride, in milliseconds since the epoch. */
  startedAt: number;
  /** The slope ridden, in percent, for samples that do not carry theirs. */
  gradePct?: number;
  /** The ride's score, in metres: the distance it covers in the file. */
  metres?: number;
  samples: readonly RideSample[];
}

/**
 * Each second's speed, m/s: the one recorded (older links: from the pedal
 * turns), brought to the ride's score so the file covers the same distance
 * as the game counted.
 */
export function rideSpeeds(ride: ExportRide): number[] {
  const recorded = ride.samples.map((s) => s.speed ?? 0);
  const raw = recorded.some((v) => v > 0)
    ? recorded
    : ride.samples.map((s) => metresPerSecond(s.cadence));
  const total = raw.reduce((sum, v) => sum + v, 0);
  const scale = ride.metres !== undefined && total > 0 ? ride.metres / total : 1;
  return raw.map((v) => v * scale);
}

/** Altitude at the start, m: any will do, the track is virtual. */
const START_ALTITUDE = 100;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const stats = (samples: readonly RideSample[], pick: (s: RideSample) => number) => ({
  avg: samples.length ? samples.reduce((sum, s) => sum + pick(s), 0) / samples.length : 0,
  max: samples.reduce((max, s) => Math.max(max, pick(s)), 0),
});

/** Average and top speed over the seconds ridden, m/s. */
const speeds = (values: readonly number[]) => {
  const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  const max = values.reduce((top, v) => Math.max(top, v), 0);
  return { avg_speed: avg, max_speed: max, enhanced_avg_speed: avg, enhanced_max_speed: max };
};

export function buildFit(rides: readonly ExportRide[], center?: LatLon): Uint8Array<ArrayBuffer> {
  const ordered = [...rides].sort((a, b) => a.startedAt - b.startedAt);
  const all = ordered.flatMap((r) => r.samples);
  const rideSpeedsOf = ordered.map(rideSpeeds);
  // A game ride is virtual, with or without a map.
  const sub_sport = "virtual_activity";
  const fit = new FitWriter();
  const at = (ms: number) => fit.time(new Date(ms));
  const first = ordered[0]?.startedAt ?? 0;
  // Without a track, back to back, a second apart: each ride starts where the
  // last one stopped.
  let next = first;
  const starts = ordered.map((ride) => {
    const start = center ? ride.startedAt : next;
    next += (ride.samples.length + 1) * 1000;
    return start;
  });
  const end = (starts.at(-1) ?? first) + (ordered.at(-1)?.samples.length ?? 0) * 1000;

  fit.writeMessage(
    "file_id",
    {
      type: "activity",
      manufacturer: "development",
      product: 0,
      serial_number: 1,
      time_created: at(first),
      product_name: "Sonne la cloche",
    },
    null,
    true,
  );

  // Garmin devices also write this message; some importers read the
  // activity type here rather than in the session.
  fit.writeMessage("sport", { sport: "cycling", sub_sport, name: "Sonne la cloche" }, null, true);

  let distance = 0;
  let altitude = START_ALTITUDE;
  let ascent = 0;
  for (const [index, ride] of ordered.entries()) {
    const startedAt = starts[index] ?? first;
    const rideEnd = startedAt + ride.samples.length * 1000;
    const lapStart = distance;
    const lapAscent = ascent;
    // Back to back, the timer runs on; with real times, it stops between rides.
    if (index === 0 || center) {
      fit.writeMessage("event", { timestamp: at(startedAt), event: "timer", event_type: "start" });
    }
    const record = (ms: number, cadence: number, power: number, speed: number, lastUse = false) => {
      const position = center && positionOnTrack(center, distance);
      fit.writeMessage(
        "record",
        {
          timestamp: at(ms),
          cadence: Math.min(254, Math.round(cadence)),
          power: Math.round(power),
          distance,
          speed,
          altitude,
          enhanced_altitude: altitude,
          ...(position && {
            position_lat: fit.latlng(toRadians(position.lat)),
            position_long: fit.latlng(toRadians(position.lon)),
          }),
        },
        null,
        lastUse,
      );
    };

    // Standing still at the start and end of each ride: the curves stay at
    // zero during the waits instead of joining the rides with a slope.
    record(startedAt, 0, 0, 0);
    const last = index === ordered.length - 1;
    const perSecond = rideSpeedsOf[index] ?? [];
    for (const [i, sample] of ride.samples.entries()) {
      const speed = perSecond[i] ?? 0;
      distance += speed;
      // Along the slope: the climb is the distance times the grade.
      const climb = (speed * (sample.gradePct ?? ride.gradePct ?? 0)) / 100;
      altitude += climb;
      ascent += Math.max(0, climb);
      record(startedAt + sample.second * 1000, sample.cadence, sample.power, speed);
    }
    // Standing still for a second after the ride (back to back: the next
    // one starts there).
    if (last || center) {
      fit.writeMessage("event", { timestamp: at(rideEnd), event: "timer", event_type: "stop_all" });
      record(rideEnd + 1000, 0, 0, 0, last);
    }

    const cadence = stats(ride.samples, (s) => s.cadence);
    const power = stats(ride.samples, (s) => s.power);
    fit.writeMessage(
      "lap",
      {
        timestamp: at(rideEnd),
        start_time: at(startedAt),
        total_elapsed_time: ride.samples.length,
        total_timer_time: ride.samples.length,
        total_moving_time: ride.samples.length,
        total_distance: distance - lapStart,
        total_ascent: Math.round(ascent - lapAscent),
        ...speeds(perSecond),
        avg_cadence: Math.round(cadence.avg),
        max_cadence: Math.round(cadence.max),
        avg_power: Math.round(power.avg),
        max_power: Math.round(power.max),
        sport: "cycling",
        sub_sport,
        event: "lap",
        event_type: "stop",
      },
      null,
      last,
    );
  }

  const cadence = stats(all, (s) => s.cadence);
  const power = stats(all, (s) => s.power);
  // The session closes on the last record: the standstill after the last ride.
  const finish = end + 1000;
  fit.writeMessage(
    "session",
    {
      timestamp: at(finish),
      start_time: at(first),
      total_elapsed_time: (end - first) / 1000,
      total_timer_time: all.length,
      total_moving_time: all.length,
      total_distance: distance,
      total_ascent: Math.round(ascent),
      ...speeds(rideSpeedsOf.flat()),
      avg_cadence: Math.round(cadence.avg),
      max_cadence: Math.round(cadence.max),
      avg_power: Math.round(power.avg),
      max_power: Math.round(power.max),
      num_laps: ordered.length,
      first_lap_index: 0,
      sport: "cycling",
      sub_sport,
      event: "session",
      event_type: "stop",
      trigger: "activity_end",
    },
    null,
    true,
  );
  fit.writeMessage(
    "activity",
    {
      timestamp: at(finish),
      total_timer_time: all.length,
      num_sessions: 1,
      type: "manual",
      event: "activity",
      event_type: "stop",
      local_timestamp: at(finish) - new Date(finish).getTimezoneOffset() * 60,
    },
    null,
    true,
  );

  // A copy: the writer's buffer may be larger than the file itself.
  const data = fit.finish();
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return bytes;
}
