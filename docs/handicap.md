# Handicap mode: each player on their own slope

Status: step 1 done (common slope), handicap not implemented.

## Step 1: a common slope instead of a resistance

The ⚙ setting is a slope, shown with its value: Flat 0 %, Gentle 2 %,
Hill 5 %, Wall 10 %. Every player rides it; scoring is unchanged. It is
sent as a simulated grade (FTMS opcode `0x11`) or, on trainers without
simulation, as a resistance level: 2.5 % of the range per percent, which
keeps the Suito values tested with a child (0, 10, 25, 50). The grades
still have to be checked on the bike with a child, against those levels.

The handicap will be an option on top of it, off by default: off, everyone
rides the common slope; on, each player gets the common slope + `θ_i`
(computed with the common slope instead of flat).

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

Round 1 also scores points, so that going all out pays from the first
ride, but with a lower weight `W1` (default 0.5, to tune).

| Round | Start speed | Slope | Points              |
| ----- | ----------- | ----- | ------------------- |
| 1     | 25 km/h     | 0 %   | `W1 × distance (m)` |
| 2…N   | `v_c`       | `θ_i` | `distance (m)`      |

Round 1 has no handicap yet: over 30 s, a 300 W adult covers 288 m against
188 m for a 50 W child. `W1` keeps that gap from deciding the game.
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

Above 12 %, cap θ and flag the player on screen: the handicap is no
longer exact.

The slope goes up at 0.5 %/s at most, in the game as on the trainer,
**during the countdown**: at "Go", every player is already on their slope.

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
  `P_ref` to it, recompute θ (same `v_c`) and move to it at 0.5 %/s.
- Never lower `P_ref` or θ during a game: fatigue is not rewarded.

### Trainer

FTMS _Set Indoor Bike Simulation Parameters_ (Control Point opcode `0x11`),
after _Request Control_:

| Field           | Type   | Unit      | Sent                      |
| --------------- | ------ | --------- | ------------------------- |
| Wind speed      | sint16 | 0.001 m/s | 0                         |
| Grade           | sint16 | 0.01 %    | `100·tan θ` + trainer min |
| Crr             | uint8  | 0.0001    | 40 (0.004)                |
| Wind resistance | uint8  | 0.01 kg/m | 20 (½·ρ·CdA ≈ 0.20)       |

- **Trainer minimum grade** of 1–2 %, added for every player alike, so the
  weakest does not spin in the void. The game model keeps 0 %.
- Grade is sent as a percentage (`tan θ`), the model works in radians.
- After a reconnection: _Request Control_ again, then resend the grade.
- The trainer computes resistance with its own model: only the feel comes
  from it. Score always comes from the game model and measured power.
- Without simulation mode (Cycling Power only), the handicap stays in the
  game, without the feel. Without power (CSC), the mode is unavailable.

## Where it lives

- `src/core/`: model, slope computation, `P_ref` ratchet, scoring. Pure,
  unit-tested (the table above as test cases).
- `src/sensors/ble/`: encoding of opcode `0x11`, next to the resistance
  command.
