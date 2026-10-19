# Handicap mode: each player on their own slope

Status: implemented. Grades and feel still to be checked on a real trainer.

## Settings and default

Two choices in ⚙:

| What counts        | Scores                     | Needs                     |
| ------------------ | -------------------------- | ------------------------- |
| Distance (default) | metres from measured power | a power meter             |
| Leg speed          | metres from pedal turns    | any sensor (CSC included) |

| Slope                    | Grade                                   |
| ------------------------ | --------------------------------------- |
| Flat, Gentle, Hill, Wall | 0, 2, 5, 10 % for everyone              |
| Own slope each (default) | each their own, the weakest on the flat |

Own slope each needs Distance: with Leg speed it is greyed out (and a
stored combination falls back to Gentle). The default is Distance + Own
slope each: fair between a child's 50 W and an adult's 300 W.

**Without power**, a game by distance is played by leg speed instead (the
settings stay as chosen, for the next bike), and the home screen says so.
A trainer speaking FTMS or Cycling Power is taken to measure power from the
moment it connects, until pedaling shows its power stuck at 0; a CSC sensor
never does. The home screen checks again every second.

**Stored settings are versioned** (`version` in the stored JSON, see
`migrateSettings` in `src/storage/storage.ts`). Settings are saved as soon
as the game opens, so stored values are mostly past defaults: version 2
moves everyone to the new default, keeping ride length and rounds.

**On the trainer**, the slope is a simulated grade (FTMS opcode `0x11`) or,
on trainers without simulation, a resistance level: 2.5 % of the range per
percent, which keeps the Suito values tested with a child (0, 10, 25, 50).
The grades still have to be checked on the bike with a child.

## What the players see

Little text, nothing hidden. The time left is the background: it drains
like an hourglass (pink for the last 5 s), the seconds riding on its
surface. The ride screen, top to bottom: who rides and the round; the distance in
metres, big (the countdown takes the same box, so nothing moves at "Go");
speed, cadence and watts; the gauge; the track and its slope; virtual gears
(− and +) and the demo's pedal buttons.

- **Every ride**: the track leans with the slope ridden, held up at its far
  end by a pole bearer drawn by a young rider: sweating from 5 %, red and
  shaking from 8 %. He keeps an eye on the cyclist, the player and the
  seconds, and stares at them just before they come for him. Same for a
  common slope, whatever counts.
- **Before "Go"**: the speed shown is the one the flying start will give.
- **The pole bearer** stands at the bottom of the screen, at the foot of the
  column the seconds come down (as wide as they are, so the track stops
  short of it on any screen), and holds the track's end up with a pole.
- **Last 5 s**: as the seconds reach him, he steps left under the track and
  holds on, so they pass him by.
- **Last-seconds twist** (option in ⚙, on by default): as the last 5 s
  start (the seconds reach the pole bearer, standing right of the track),
  the game compares the rider with the bell's pace, once. Ahead: he lifts
  the track higher, +3 %. Behind: he lets go and runs away, the track falls
  3 % (a descent from the flat; a trainer set by resistance stops at its
  lowest level). Up or down by the same amount, so that on own slopes it
  helps a weak rider on the flat about as much as a strong one on a slope
  (flattening the road would only help those who have a slope). In the
  game model and on the trainer; it tightens the ends of rides, at the
  cost of the handicap being exact over those 5 s.
- **Round 1**: a "Measuring your level" badge.
- **Next rounds**: from the 3/2/1 to the end, a gauge of power against
  the player's level (a mark). The needle turns green from 95 %; no upper
  limit is shown, since going above one's level is what pays (and showing
  the 110 % raise threshold would invite riding just under it).
- **Results**: the grade ridden under the score, the next rider's grade,
  and each player's latest grade in the ranking.

The track leans twice the real angle (up to 8°), so a 2 % slope shows.

## Handicap

Players are scored on the **distance** their measured power takes them,
but each rides **their own virtual slope**: the stronger the player, the
steeper. At equal effort relative to their own level, everyone covers the
same distance. The slope is also sent to the trainer, so a strong rider
really feels the climb.

Only slope is used (no headwind) for now: it is easy to grasp ("you climb at
5 %") and every FTMS trainer in simulation mode renders it.

### Game flow

1. **Round 1, calibration.** Same duration as the other rounds, flat
   (θ = 0) for everyone, all out. A player's reference power `P_ref` is
   the mean power over the whole ride, with zeros counted (no pedaling,
   cadence < 30 rpm, BLE dropout).
2. **Rounds 2…N, handicapped.** Each player rides their slope `θ_i`,
   computed before the game resumes from every `P_ref`.

Every round scores its distance in metres, round 1 included: going all
out pays from the first ride. (Half points for round 1 were tried, and
dropped: too hard to explain on screen.)

| Round | Start speed | Slope |
| ----- | ----------- | ----- |
| 1     | 25 km/h     | 0 %   |
| 2…N   | `v_c`       | `θ_i` |

Round 1 has no handicap yet: over 30 s, a 300 W adult covers 288 m against
188 m for a 50 W child, a lead the next rounds do not take back.
Open question: reuse a returning player's stored `P_ref` to handicap their
round 1 as well.

### Virtual flying start

The 3/2/1/Go countdown is unchanged (timer, ~2.9 s). At "Go", the virtual
speed starts at the **common speed `v_c`** instead of 0; from then on it
only follows measured power. A player at their `P_ref` stays at `v_c`,
more power accelerates, less slows down.

Why: in a 20–45 s ride, a standing start takes most of the ride (kinetic
energy at 31 km/h ≈ 3 kJ, i.e. 20 s at 150 W). The strongest gets up to
speed sooner and the slope barely slows them while slow: from a standing
start, 350 W on its 3 % slope covers 15–20 % more than 150 W on the flat.
Pedaling during the countdown in the game model would not fix it (11 km/h
at "Go") and would reward pushing before the start.

During the countdown, players are expected to reach their power: the
slope is already on the trainer, and a gauge shows power against
`P_ref` (green zone, no text). Missing the start costs distance, more on
a steeper slope (30 s ride, 150 W vs 350 W players):

| Late to reach `P_ref` after "Go" | Weakest (0 %) | Strongest (3 %) |
| -------------------------------- | ------------- | --------------- |
| 0.5 s                            | −1.4 m        | −2.4 m          |
| 1 s                              | −2.8 m        | −4.9 m          |
| 2 s                              | −5.7 m        | −9.9 m          |

Out of ~257 m each. Accepted: stopping on a climb costs more, in real life
too.

### Physics model

One model for the game and for computing slopes. The trainer only renders
the feel.

```
F = m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v²
a = (P / max(v, 1 m/s) − F) / m
```

m = 80 kg (the same for every player, not their real weight), Crr = 0.004,
CdA = 0.32 m², ρ = 1.225 kg/m³, g = 9.81 m/s². Time step clamped to 0.25 s
(split longer frames).

### Computing each player's slope

With a flying start at `v_c`, the steady-state formula is exact, no
simulation needed.

1. `v_c` = flat speed of the weakest player at `P_ref,min`, by bisection
   on 0–30 m/s:

   ```
   P_ref,min = m·g·Crr·v_c + ½·ρ·CdA·v_c³
   ```

2. Each player's slope, the force that absorbs their extra power at
   `v_c`:

   ```
   F_flat = m·g·Crr + ½·ρ·CdA·v_c²
   sin θ_i = (P_ref,i / v_c − F_flat) / (m·g)
   ```

The weakest, or a single player, gets θ = 0. Examples:

| `P_ref` weakest / strongest | `v_c`     | Strongest's slope |
| --------------------------- | --------- | ----------------- |
| 150 / 250 W                 | 30.8 km/h | 1.5 %             |
| 150 / 350 W                 | 30.8 km/h | 3.0 %             |
| 50 / 150 W (child / adult)  | 19.8 km/h | 2.3 %             |
| 50 / 300 W (child / adult)  | 19.8 km/h | 5.8 %             |
| 50 / 400 W (child / adult)  | 19.8 km/h | 8.1 %             |

θ is capped at 12 % above the common slope (`MAX_EXTRA_GRADE`): past it,
the handicap is no longer exact for that player. Nothing on screen says so;
it takes a gap far beyond a child against an adult (50 / 400 W is 8.1 %).

The slope is sent to the trainer when the ride screen opens, before the
countdown: at "Go", every player is already on their slope. No ramp for
now: trainers smooth grade changes themselves; to be checked on the bike.

### Fairness at the margins (accepted)

The handicap is exact at `P_ref`. On a slope, extra power converts into
more speed than on the flat. If both ride at 110 % of their `P_ref` for
30 s: child +2.0 % distance, adult on 5.8 % slope +6.3 %. Realistic
(effort pays when climbing) and small as long as players stay near their
level.

### Sandbagging: P_ref only goes up

Riding round 1 easy lowers `P_ref`, and therefore the slope. Hence:

- At the end of every ride: `P_ref = max(P_ref, mean power of the ride)`.
- During a ride: if the 10 s moving average exceeds `1.1 × P_ref`, raise
  `P_ref` to it and recompute θ (same `v_c`), in the game and on the
  trainer. Implemented with the ride's average so far instead of a moving
  average: simpler, same effect after 10 s.
- Never lower `P_ref` or θ during a game: fatigue is not rewarded.
- `v_c` and every slope come from the levels as the round started: rides
  of the current round (a player who improves, a ride being retried) count
  from the next round on, so the order of play changes nothing. Only the
  rider's own mid-ride raise applies at once.

### Trainer

FTMS _Set Indoor Bike Simulation Parameters_ (Control Point opcode `0x11`),
after _Request Control_:

| Field           | Type   | Unit      | Sent                      |
| --------------- | ------ | --------- | ------------------------- |
| Wind speed      | sint16 | 0.001 m/s | 0                         |
| Grade           | sint16 | 0.01 %    | `100·tan θ` + trainer min |
| Crr             | uint8  | 0.0001    | 40 (0.004)                |
| Wind resistance | uint8  | 0.01 kg/m | 20 (½·ρ·CdA ≈ 0.20)       |

- **No trainer minimum grade** for now: the common slope setting plays
  that role (2 % by default).
- Grade is sent as a percentage (`tan θ`), the model works in radians.
- After a reconnection: _Request Control_ again, then resend the grade
  ridden at that moment (raised or twisted, not the starting one).
- The trainer computes resistance with its own model: only the feel comes
  from it. Score always comes from the game model and measured power.
- Without simulation mode (Cycling Power only), the handicap stays in the
  game, without the feel. Without power (CSC), the mode is unavailable.

## Where it lives

- `src/core/handicap.ts`: physics model, courses, mid-ride raise.
- `src/core/course.ts`: reference powers, each player's course in a game.
  Both pure, unit-tested (fairness at the reference as a test case).
- `src/core/ride.ts`: distance scoring on a slope.
- `TRAINER_ROAD` in `src/core/handicap.ts`, given to `useSensor`: the
  model's Crr and air drag, sent by home-trainer-kit (opcode `0x11`).
- `src/ui/RideScreen.tsx`, `src/ui/lifter/`: flying start, gauge, leaning
  track and its pole bearer.
- `e2e/slope.spec.ts`: a whole game in demo mode.
