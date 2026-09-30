# Sonne la cloche !

Pedaling game for a children's birthday party. A kid's bike sits on a smart
home trainer; children take turns sprinting for 20–45 s and a score shows on
one screen. Rewrite of the `../course-des-pedales` prototype.

## Usage context — keep it in mind for every decision

- **Audience: 8-year-olds**, plus one adult driving the screen. Everything must
  be understandable without reading, and readable from 3 m.
- **Fast default path.** From opening the page to pedaling: connect the bike,
  start. Players and settings are remembered; defaults must suit ~80% of
  games. New features must not lengthen that path — put options behind ⚙.
- **Fairness between sizes.** Default score is cadence (pedal turns), not
  watts: an 8-year-old makes 40–60 W, ranking by watts ranks kids by height.
- **One screen**: an Android tablet in landscape (Chrome) or a PC/TV. Both are
  tested (see `playwright.config.ts`). No page scroll during a game.
- **Client only.** No backend, no account, no network call while playing
  (fonts are bundled).

## Technical constraints

- **Web Bluetooth**: Chrome/Edge only (desktop and Android). No Safari, no
  Firefox, no iOS. Requires a secure context (`https://` or `localhost`).
- **One BLE connection at a time**: if Zwift, the vendor app or a Garmin watch
  holds the trainer, the page sees nothing. Top cause of "nothing happens".
- **Protocols**, in order of preference: FTMS (`0x1826`/`0x2AD2`), Cycling
  Power (`0x1818`/`0x2A63`), CSC (`0x1816`/`0x2A5B`). FTMS trap: **flag bit 0
  is "More Data" and inverted** — speed is present when it is 0. There are
  tests for it in `src/sensors/ble/parsers.test.ts`; don't "fix" it.
- **Language lives in the URL** (`/fr/`, `/en/`, root redirects by browser
  language). Switching language must never reload the page: it would drop the
  Bluetooth connection mid-game.

## Architecture

```
src/core/      pure game rules (reducer, scoring, players, settings) — no React, no DOM
src/sensors/   Sensor interface; ble/ (pure parsers + Web Bluetooth), demo/
src/i18n/      en (source, typed) + fr, locale from URL path
src/storage/   localStorage, always wrapped in try/catch
src/ui/        React screens and hooks; the only layer that renders text
src/export/    per-player export: FIT file, virtual GPS track, QR link codec
src/strava/    the page a player's QR code opens on their phone (/strava/)
server/        tiny Strava upload service (Python stdlib), holds the OAuth secret
e2e/           Playwright, fake clock (page.clock) to fast-forward rides
```

- Game state is one reducer (`src/core/game.ts`); screens derive from it.
  Rules belong in `core/` with unit tests, not in components.
- `core/` never produces text, only data; the UI translates.
- The ride loop polls `sensor.read(now)` each animation frame.
- A player's game reaches their phone inside the QR code's URL fragment
  (`#…`, never sent to a server). Keep it small: see `playerLink.ts`.
- FIT files are written with `@markw65/fit-file-writer` (MIT). Do not use
  Garmin's own SDK: its license forbids distributing it in an MIT project.
- Strava only accepts activity type, title and trainer flag through its API,
  hence the server. New Strava API apps are limited to their owner's account
  until Strava approves more athletes.

## Conventions

- Code and comments in English. UI strings only through i18n: ESLint
  (`i18next/no-literal-string`) rejects literal text in JSX. Add every key to
  `en.ts` and `fr.ts` (typed; a test checks parity and placeholders). For keys
  taking a first name, provide an `_elided` variant (French "d'Anne").
- Fairground theme (indigo, garland yellow, pink): tokens at the top of
  `src/ui/theme.css`. No new palette without a reason.
- Touch targets ≥ 48 px (tested ≥ 44 px).
- `pnpm check` runs format check, lint, typecheck, unit and e2e tests. A
  lefthook pre-commit runs Prettier, ESLint and tsc on staged files.
- TypeScript is pinned to 6.0: TypeScript 7 (native) has no JS API, which
  typescript-eslint needs. ESLint is pinned to 9 for eslint-plugin-jsx-a11y.

## Testing without the bike

"Try without a bike" enables the demo sensor: hold the on-screen button (or
Space) to pedal at ~95 rpm. It is the only way to check a change without the
hardware, and the e2e tests rely on it — **never break it**.
