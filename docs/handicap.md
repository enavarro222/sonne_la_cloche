# Handicap mode: each player on their own slope

Status: design, not implemented.

Players are scored on **raw power**, but each rides **their own virtual
slope**: the stronger the player, the steeper. At equal effort relative to
their own level, everyone covers the same distance. The slope is also sent
to the trainer, so a strong rider really feels the climb.

Only slope is used (no headwind) for now: it is easy to grasp ("you climb at
5 %") and every FTMS trainer in simulation mode renders it.

## Game flow

1. **Round 1, calibration.** Same duration as the other rounds, flat
   (θ = 0) for everyone, all out. A player's reference power `P_ref` is
   the mean power over the whole ride, with zeros counted (no pedaling,
   cadence < 30 rpm, BLE dropout).
2. **Rounds 2…N, handicapped.** Each player rides their slope `θ_i`,
   computed before the game resumes from every `P_ref`.

Round 1 also scores points, so that going all out pays from the first
ride, but with a lower weight `W1` (default 0.5, to tune).

| Round | Slope | Points              |
| ----- | ----- | ------------------- |
| 1     | 0 %   | `W1 × distance (m)` |
| 2…N   | `θ_i` | `distance (m)`      |

Round 1 has no handicap yet: at 30 s, a 300 W adult covers 244 m against
100 m for a 50 W child. `W1` keeps that gap from deciding the game.
Open question: reuse a returning player's stored `P_ref` to handicap their
round 1 as well.

## Physics model

One model for the game and for computing slopes. The trainer only renders
the feel.

```
F = m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v²
a = (P / max(v, 1 m/s) − F) / m
```

m = 80 kg (the same for every player, not their real weight), Crr = 0.004,
CdA = 0.32 m², ρ = 1.225 kg/m³, g = 9.81 m/s². Ride from a standing start,
time step clamped to 0.25 s (split longer frames).

## Computing each player's slope

**By simulation, not by formula.** The steady-state formula
(`sin θ = (P/v_c − F_flat) / (m·g)`) assumes everyone is already at
cruising speed. In a 20–45 s ride, the start takes most of the ride
(kinetic energy at 31 km/h ≈ 3 kJ, i.e. 20 s at 150 W), and the formula
under-handicaps badly: over 30 s, 350 W against 150 W covers 20 % more
distance.

1. Simulate the weakest player at `P_ref,min`, flat, from a standing
   start, for the ride duration `T`: reference distance `D_ref`.
2. For each other player, bisect θ in [0, 12 %] so that constant power
   `P_ref,i` over `T` covers `D_ref`.
3. The weakest gets θ = 0. A single player gets θ = 0.

That takes 40 bisection steps × `T/dt` simulation steps per player,
negligible. Resulting slopes:

| `P_ref` weakest / strongest | 20 s   | 30 s   | 45 s  |
| --------------------------- | ------ | ------ | ----- |
| 150 / 250 W                 | 3.0 %  | 2.5 %  | 2.2 % |
| 150 / 350 W                 | 5.8 %  | 4.9 %  | 4.2 % |
| 50 / 150 W (child / adult)  | 5.1 %  | 4.2 %  | 3.6 % |
| 50 / 300 W (child / adult)  | 12.2 % | 10.2 % | 8.7 % |

Above 12 %, cap θ and flag the player on screen: the handicap is no
longer exact (short ride, very large gap).

### Slope ramp

The slope goes up at 0.5 %/s at most, in the game as on the trainer,
**during the pre-start countdown**: at the start, every player is already
on their slope, so the simulation above stays exact. A ramp during the
ride would make the slope from step 2 too small (or the simulation would
have to include it, and the strongest would need 30 %+ in 20 s).

## Fairness at the margins (accepted)

The handicap is exact at `P_ref`. On a slope, extra power converts into
more speed than on the flat. If both ride at 110 % of their `P_ref` for
30 s: child +5.4 % distance, adult on 10 % slope +9.0 %. Realistic (effort
pays when climbing) and small as long as players stay near their level.

## Sandbagging: P_ref only goes up

Riding round 1 easy lowers `P_ref`, and therefore the slope. Hence:

- At the end of every ride: `P_ref = max(P_ref, mean power of the ride)`.
- During a ride: if the 10 s moving average exceeds `1.1 × P_ref`, raise
  `P_ref` to it, recompute θ and move to it at 0.5 %/s.
- Never lower `P_ref` or θ during a game: fatigue is not rewarded.

## Trainer

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
