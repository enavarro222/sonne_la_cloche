# Sonne la cloche !

A kid's bike on a smart home trainer, one screen, and children taking turns to
pedal as hard as they can. Each round everyone rides once; the ranking adds up
every round, and the bell on the track marks the best single ride to beat.

## Run it

```sh
pnpm install
pnpm dev          # http://localhost:5173 → redirects to /fr/ or /en/
```

Open it in **Chrome or Edge** (Web Bluetooth). On an Android tablet it must be
served over HTTPS.

## Play

1. **Connect the bike**: the trainer must be on and closed in every other app
   (Zwift, vendor app, Garmin watch).
2. Add at least two players (remembered for next time).
3. **Let's go!** Defaults: leg speed, 30 s, 4 rounds — change them behind ⚙.

No bike at hand? **Try without a bike**, then hold the on-screen button (or
Space) to pedal.

## Develop

```sh
pnpm check        # format check + lint + typecheck + unit tests + e2e
pnpm test         # unit tests (Vitest)
pnpm e2e          # end-to-end tests (Playwright, tablet + desktop)
pnpm build        # static site in dist/ (/, /fr/, /en/)
```

First e2e run: `pnpm exec playwright install chromium`.

## Troubleshooting

| Symptom                          | Most likely cause                                                |
| -------------------------------- | ---------------------------------------------------------------- |
| "Connect the bike" is greyed out | Browser without Web Bluetooth (Safari, Firefox, iOS) or no HTTPS |
| The trainer is not in the list   | Still connected to another app, or asleep                        |
| Connected but cadence stays at 0 | Power meter without crank data: switch the metric to "Strength"  |
| Values look doubled or empty     | FTMS parsing — see the note on bit 0 in `CLAUDE.md`              |
