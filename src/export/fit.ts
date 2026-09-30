// FIT activity file for one player: one lap per ride, a record per second
// with cadence, power and distance, the timer paused between rides. The
// sub-sport tells Strava what it is: a virtual ride when there is a virtual
// GPS track (kept out of segments and leaderboards), an indoor ride without.

import { FitWriter } from "@markw65/fit-file-writer";
import type { RideSample } from "../core/ride";
import { type LatLon, metresPerSecond, positionOnTrack } from "./virtualTrack";

/** One ride of a player, as recorded by the game. */
export interface ExportRide {
  /** Start of the ride, in milliseconds since the epoch. */
  startedAt: number;
  samples: readonly RideSample[];
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const stats = (samples: readonly RideSample[], pick: (s: RideSample) => number) => ({
  avg: samples.length ? samples.reduce((sum, s) => sum + pick(s), 0) / samples.length : 0,
  max: samples.reduce((max, s) => Math.max(max, pick(s)), 0),
});

export function buildFit(rides: readonly ExportRide[], center?: LatLon): Uint8Array<ArrayBuffer> {
  const ordered = [...rides].sort((a, b) => a.startedAt - b.startedAt);
  const all = ordered.flatMap((r) => r.samples);
  // A game ride is virtual, with or without a map.
  const sub_sport = "virtual_activity";
  const fit = new FitWriter();
  const at = (ms: number) => fit.time(new Date(ms));
  const first = ordered[0]?.startedAt ?? 0;
  const lastRide = ordered.at(-1);
  const end = lastRide ? lastRide.startedAt + lastRide.samples.length * 1000 : first;

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
  for (const [index, ride] of ordered.entries()) {
    const rideEnd = ride.startedAt + ride.samples.length * 1000;
    const lapStart = distance;
    fit.writeMessage("event", {
      timestamp: at(ride.startedAt),
      event: "timer",
      event_type: "start",
    });
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
    record(ride.startedAt, 0, 0, 0);
    for (const sample of ride.samples) {
      const speed = metresPerSecond(sample.cadence);
      distance += speed;
      record(ride.startedAt + sample.second * 1000, sample.cadence, sample.power, speed);
    }
    fit.writeMessage("event", { timestamp: at(rideEnd), event: "timer", event_type: "stop_all" });
    record(rideEnd + 1000, 0, 0, 0, index === ordered.length - 1);

    const cadence = stats(ride.samples, (s) => s.cadence);
    const power = stats(ride.samples, (s) => s.power);
    fit.writeMessage(
      "lap",
      {
        timestamp: at(rideEnd),
        start_time: at(ride.startedAt),
        total_elapsed_time: ride.samples.length,
        total_timer_time: ride.samples.length,
        total_distance: distance - lapStart,
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
      index === ordered.length - 1,
    );
  }

  const cadence = stats(all, (s) => s.cadence);
  const power = stats(all, (s) => s.power);
  fit.writeMessage(
    "session",
    {
      timestamp: at(end),
      start_time: at(first),
      total_elapsed_time: (end - first) / 1000,
      total_timer_time: all.length,
      total_distance: distance,
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
      timestamp: at(end),
      total_timer_time: all.length,
      num_sessions: 1,
      type: "manual",
      event: "activity",
      event_type: "stop",
      local_timestamp: at(end) - new Date(end).getTimezoneOffset() * 60,
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
