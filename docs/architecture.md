# Architecture

How the code of _Sonne la cloche !_ is laid out and how the pieces talk to
each other. The diagrams are [Mermaid](https://mermaid.js.org/): GitHub and
VS Code (with a Mermaid extension) render them.

For the scoring model itself (virtual slopes, handicap), see
[handicap.md](handicap.md). For the rules every change must respect (audience,
one screen, fast path), see [CLAUDE.md](../CLAUDE.md).

## The big picture

One tablet or PC runs the game, talks to the trainer over Web Bluetooth and
needs nothing else while playing. After the game, each player can scan a QR
code: their rides travel _inside the URL_ to their phone, which can download
a FIT file or publish on Strava through a tiny optional server.

```mermaid
flowchart LR
    subgraph room["In the room"]
        trainer["Smart trainer<br/>(FTMS / Cycling Power / CSC)"]
        remote["Zwift Click /<br/>gamepad (optional)"]
        tablet["Tablet or PC<br/>/fr/ or /en/<br/>(the game)"]
        phone["Player's phone<br/>/strava/#…"]
    end

    subgraph host["Web host (static files + /api/)"]
        static["Static build<br/>(Vite, dist/)"]
        server["server/strava_upload.py<br/>(Python stdlib)"]
    end

    strava[("Strava API")]
    github[("GitHub<br/>private feedback repo")]

    trainer <-- "Web Bluetooth<br/>readings / slope" --> tablet
    remote -- "BLE / Gamepad API<br/>gear + / −" --> tablet
    static -- "page load only" --> tablet
    tablet -- "QR code<br/>(game in the #fragment)" --> phone
    static --> phone
    phone -- "/api/strava/*" --> server
    phone -- "/api/feedback" --> server
    tablet -. "/api/feedback<br/>(feedback page)" .-> server
    server -- "OAuth + upload" --> strava
    server -- "new issue" --> github
```

Key points:

- **No network during a game.** Fonts are bundled, nothing is fetched after
  page load. The server is optional: without it the phone page still offers
  the FIT download, and the feedback form hides itself.
- **The phone gets its data from the QR code**, in the URL fragment (`#…`),
  which browsers never send to a server. Nothing about a game is stored
  anywhere but on the tablet.
- **The server stores nothing**: it holds the Strava client secret, uses each
  access token for a single upload and revokes it.

## Pages (build entry points)

The build is a multi-page app (`appType: "mpa"` in
[vite.config.ts](../vite.config.ts)): one static HTML file per page, so any
static host works without rewrite rules.

```mermaid
flowchart TD
    root["/ (index.html)<br/>src/redirect.ts"] -- "navigator.languages" --> fr & en
    fr["/fr/ (fr/index.html)"] --> main["src/main.tsx<br/>React app"]
    en["/en/ (en/index.html)"] --> main
    strava["/strava/ (strava/index.html)"] --> smain["src/strava/main.ts<br/>plain DOM"]
    feedback["/feedback/ (feedback/index.html)"] --> fmain["src/feedback/main.ts<br/>plain DOM"]
    playground["playground.html (dev only)"] --> pmain["src/playground/main.tsx<br/>RideScreen with a fake clock"]
```

| Page           | Code                      | Role                                                                        |
| -------------- | ------------------------- | --------------------------------------------------------------------------- |
| `/`            | `src/redirect.ts`         | Picks a language from the browser and redirects (keeps `?…` and `#…`).      |
| `/fr/`, `/en/` | `src/main.tsx` → `App`    | The game. Same bundle, language read from the path.                         |
| `/strava/`     | `src/strava/main.ts`      | The phone page a QR code opens: rides, results picture, FIT, Strava.        |
| `/feedback/`   | `src/feedback/main.ts`    | The "Your opinion?" form, reached from the game.                            |
| `playground`   | `src/playground/main.tsx` | Local tool to tune the ride screen (speed up time, fake sensor). Not built. |

The phone and feedback pages are plain DOM on purpose: they load fast on a
phone and need no React.

## Layers

One arrow per real import between folders. Everything points down: nothing
imports the React app, and `core/` imports only from the kit. `i18n/` and
`theme/` are used by all three pages and left out of the arrows.

```mermaid
flowchart TD
    subgraph pages["Pages"]
        ui["<b>src/ui/</b> · the game, React<br/>App · screens · hooks<br/>cyclist/ · lifter/ · Bell · sound"]
        phone["<b>src/strava/</b><br/>phone page, plain DOM"]
        feedback["<b>src/feedback/</b><br/>form + /feedback/ page"]
    end

    subgraph shared["Shared by the pages"]
        share["<b>src/share/</b><br/>results picture"]
        export["<b>src/export/</b><br/>QR codec · FIT · GPS track"]
        storage["<b>src/storage/</b><br/>localStorage"]
    end

    core["<b>src/core/</b> · pure rules, no DOM, no text<br/>game · ride · rideLoop · course<br/>handicap · players · settings · livery"]
    kit["<b>home-trainer-kit</b><br/>Bluetooth · FTMS · demo sensor · gears"]
    cross["<b>src/i18n/</b> · <b>src/theme/</b> · credits.ts<br/>used by every page"]

    ui --> share & export & storage
    phone --> feedback & share & export
    ui --> core
    ui --> kit
    share & export & storage --> core
    core -- "gears" --> kit
```

Rules the arrows follow:

- **`core/` is pure**: no React, no DOM, no text. It returns data (numbers,
  enums, error codes); only `ui/` and the phone pages turn it into words
  through i18n. Its only import from outside is a type and the default
  drivetrain from `home-trainer-kit/gears`. Inside it there is no import
  cycle: `handicap.ts` is the physics, `course.ts` picks each player's course
  from the game, `rideLoop.ts` runs a ride frame by frame.
- **Game rules live in `core/` with unit tests**, never in components.
- **What is shared lives outside `ui/`**: the results picture (`share/`), the
  theme and the plain pages' layout (`theme/`), the credits. The phone and
  feedback pages never import the React app.
- **`storage/` never throws**: storage may be missing or full (private
  browsing) and the game must still work. Everything read back goes through
  `parseRoster` / `parseSettings`, which treat it as untrusted.
- **`home-trainer-kit`** owns everything about the hardware (Web Bluetooth,
  FTMS/CP/CSC parsing, slope control, demo sensor, virtual gears, Zwift
  remote). It is shared with _contour_ and pinned to a git tag in
  `package.json`.

## Application state

All game state is one reducer, [src/core/game.ts](../src/core/game.ts).
`App.tsx` holds it with `useReducer` and picks the screen from it; the
screens derive everything else through selectors (`standings`, `bestRide`,
`lastRide`, `highlights`, `upNext`, `summarize`).

```mermaid
classDiagram
    class AppState {
        roster: Player[]
        settings: Settings
        game: Game | null
    }
    class Game {
        players: Player[]
        settings: Settings
        round: number
        turn: number
        phase: "riding" | "result"
        rides: RideResult[]
        rideId: number
    }
    class Player {
        id: string
        name: string
        livery?: number
    }
    class Settings {
        metric: "distance" | "cadence"
        durationSec: 5 | 20 | 30 | 45
        rounds: 1 | 3 | 4 | 5
        slope: flat | gentle | hill | wall | own
        finale: off | on
        gears: bike | virtual
        chainring, cog
    }
    class RideResult {
        playerId: string
        round: number
        metres: number
        stats: RideStats
        trace: RideTrace
        gradePct?: number
    }
    class RideTrace {
        startedAt: ISO string
        samples: RideSample[]
    }
    AppState --> "0..8" Player : roster
    AppState --> Settings
    AppState --> "0..1" Game
    Game --> Player : players (copy of roster)
    Game --> Settings : forSensor(settings)
    Game --> "*" RideResult
    RideResult --> RideTrace
```

- `game.players` and `game.settings` are **copies taken at start**: the
  roster and settings can't change mid-game (the reducer ignores those
  actions while a game exists), and `forSensor` switches a game to pedal
  turns when the bike measures no power, without touching the saved settings.
- `rideId` changes on every ride attempt; `App` uses it as the `key` of
  `RideScreen`, so each ride starts from a fresh component.
- `roster` and `settings` are saved to `localStorage` by two `useEffect`s in
  `App`. Stored settings carry a `version`; `migrateSettings` brings old ones
  up to date.

### Game flow

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Home
    Home --> Settings : ⚙
    Settings --> Home : done
    Home --> Riding : gameStarted<br/>(≥ 2 players, sensor ready)

    state "In a game" as inGame {
        Riding --> Result : rideFinished
        Result --> Riding : rideRetried<br/>(replaces the attempt)
        Result --> Riding : nextTurn<br/>(next player, or round + 1)
        Result --> GameOver : last player<br/>of last round
    }

    GameOver --> Riding : gameStarted<br/>(play again)
    inGame --> Home : gameQuit
```

`Home` and `Settings` are `game === null` (with a local `settingsOpen` flag
in `App`); `GameOver` is `phase === "result"` with `isGameOver(game)` true.
While a game exists, `useHistoryGuard` keeps the back button on the page and
`useLeaveWarning` asks before closing it: leaving would drop the Bluetooth
connection.

## The ride loop

A ride is the hot path. `RideScreen` runs a countdown (3, 2, 1, Go), then
`useRideLoop` polls the sensor **once per animation frame** and hands each
reading to `stepRideState` ([src/core/rideLoop.ts](../src/core/rideLoop.ts)).
That pure function makes every decision (score, raised slope, finale, bell,
ticks) and returns the new state with **events**; the hook only carries them
out (trainer, sounds) and draws the frame.

```mermaid
sequenceDiagram
    autonumber
    participant App as App.tsx
    participant RS as RideScreen<br/>useRideLoop
    participant S as Sensor<br/>(home-trainer-kit)
    participant Core as core/rideLoop<br/>(pure)
    participant T as Trainer

    App->>RS: mount (key = rideId), course = courseFor(game)
    RS->>T: setSlope(course.gradePct)
    Note over RS: countdown 3 · 2 · 1 · Go (timers + sounds)
    loop every requestAnimationFrame
        RS->>S: read(now)
        S-->>RS: { cadence, power }
        RS->>Core: stepRideState(state, reading, dt, settings)
        Note right of Core: stepRide (dt capped at 0.25 s)<br/>raiseCourse · finaleFor<br/>stepTrack · ringsBell · ticks
        Core-->>RS: { state, events }
        opt event "slope" (raised level, finale ± 3 %)
            RS->>T: setSlope(gradePct)
        end
        opt event "bell" / "tick"
            RS->>RS: sounds.bell() / sounds.tick()
        end
        RS->>RS: setFrame(…) → draw cyclist, track, bell, lifter
    end
    RS->>App: onFinish(rideOutcome(state) + trace)
    App->>App: dispatch rideFinished → ResultScreen
```

- The sensor is read **through a ref**: reconnecting the bike mid-ride must
  not restart the ride.
- One `RideSample` is recorded per whole second (cadence, power, speed,
  slope); that trace is what the FIT export and the QR link carry.
- **Scoring** (`stepRide`): by _distance_, measured power drives a virtual
  bike on the course's slope (`stepSpeed`, a physics model shared with the
  trainer's road settings, `TRAINER_ROAD`); by _leg speed_, cadence drives it
  at 4 m per crank turn. Either way the score is metres.
- **Own slopes** (`courseFor` / `courseOf` in `core/course.ts`): round 1 is on the common slope
  and measures everyone; from round 2 each player gets the slope on which
  their reference power holds the weakest player's speed. See
  [handicap.md](handicap.md).
- Out of a ride, `App` keeps the trainer on the common slope.

## Hardware: home-trainer-kit

The game only sees the `Sensor` interface. Bluetooth and the demo sensor are
interchangeable, which is what makes the demo mode (and the e2e tests)
possible.

```mermaid
flowchart LR
    subgraph kit["home-trainer-kit"]
        useSensor["useSensor(TRAINER_ROAD)<br/>→ SensorState { sensor, connection,<br/>connecting, error, ready, … }"]
        ble["BluetoothSensor<br/>FTMS › Cycling Power › CSC<br/>ftmsControl (slope / resistance)"]
        demo["DemoSensor<br/>← → keys or foot buttons"]
        gears["gears: Drivetrain, VIRTUAL_RATIOS,<br/>useZwiftController, useGamepadControls"]
        useSensor --> ble
        useSensor --> demo
    end
    iface{{"Sensor<br/>read(now) · measuresPower()<br/>reset() · setSlope?() · setGear?()"}}
    ble -.implements.-> iface
    demo -.implements.-> iface
    App["App / HomeScreen / Header"] --> useSensor
    Ride["RideScreen"] --> iface
    Ride --> gears
```

- `useMeasuresPower` watches the sensor on the home screen; at "Let's go",
  `measuresPower()` decides whether the game scores distance or pedal turns.
- With `gears: "virtual"` (a Zwift Cog), `useVirtualGear` shifts through
  `setGear` from the Zwift Click or any gamepad.
- `useWakeLock` keeps the screen on while a sensor is connected.

## After the game: phone, FIT and Strava

```mermaid
sequenceDiagram
    autonumber
    participant Tab as Tablet<br/>PhoneDialog
    participant Phone as Phone<br/>/strava/
    participant Srv as server/<br/>strava_upload.py
    participant St as Strava

    Tab->>Tab: playerActivities(game) → pack → deflate-raw → base64url
    Tab->>Phone: QR code: https://…/strava/#…
    Phone->>Phone: decodePlayerActivity(fragment)<br/>show rides + redraw results picture
    alt Download
        Phone->>Phone: buildFit(rides, map center?) → .fit file
    else Publish on Strava
        Phone->>Srv: GET /api/strava/status
        Phone->>Srv: GET /api/strava/authorize?state=fragment.lat,lon
        Srv->>St: redirect to consent page
        St->>Phone: back to /strava/?code=…&state=…
        Phone->>Phone: state → fragment (+ map center)
        Phone->>Srv: POST /api/strava/upload { code, FIT (base64), name, … }
        Srv->>St: exchange code · upload · set VirtualRide + trainer · revoke
        Srv-->>Phone: { url }
    end
```

- **The OAuth `state` carries the game itself** through Strava's consent
  page, so the upload can finish in whichever tab or app Strava returns to.
- **The link must stay small** (it is a QR code): `playerLink.ts` packs each
  second into a few bytes (power in 4 W steps, speed as deltas), then
  compresses. Its format has a version byte; older links keep being read.
- **FIT** (`export/fit.ts`, with `@markw65/fit-file-writer`): with the
  player's consent the phone's position becomes the centre of a virtual
  30 m circular track (`virtualTrack.ts`), so the activity gets a map and
  Strava counts real moving time.
- The Strava part only appears after a game on a real bike (`strava: false`
  in demo mode), except with `?dev`.

## Server

[server/strava_upload.py](../server/strava_upload.py), standard library only
(`ThreadingHTTPServer`, `urllib`), listening on `127.0.0.1:8787` behind the
web server's `/api/` proxy. Configuration comes from the environment.

| Route                       | Does                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `GET /api/strava/status`    | `{configured}`: whether to show "Publish on Strava".                  |
| `GET /api/strava/authorize` | Redirects to Strava's consent page (mobile or web).                   |
| `POST /api/strava/upload`   | Code → token, upload FIT, set type/title/trainer, revoke.             |
| `GET /api/feedback/status`  | `{configured}`: whether to show the feedback form.                    |
| `POST /api/feedback`        | Files the message as an issue ([feedback.py](../server/feedback.py)). |

## Internationalisation

```mermaid
flowchart LR
    url["URL path<br/>/fr/ · /en/"] -- localeFromPath --> init["initI18n + applyLocale<br/>(main.tsx)"]
    header["Header FR | EN"] -- switchLocale --> push["history.pushState<br/>+ changeLanguage"]
    push --> url
    back["back / forward"] -- popstate --> init
    init --> i18next["i18next<br/>en.ts (typed source) · fr.ts"]
    i18next --> ui["React screens (useTranslation)<br/>phone pages (i18n.t)"]
```

The language lives in the URL so a link or bookmark carries it, and switching
**never reloads the page** (that would drop the Bluetooth connection). ESLint
(`i18next/no-literal-string`) rejects literal text in JSX, and a unit test
checks that `en.ts` and `fr.ts` have the same keys and placeholders.

## Tests

```mermaid
flowchart LR
    unit["Vitest + jsdom<br/>src/**/*.test.ts(x)"] --> core2["core/ rules"]
    unit --> ui2["components & hooks<br/>(Testing Library)"]
    unit --> exp2["export: FIT round-trip,<br/>QR link codec"]
    e2e["Playwright e2e/<br/>tablet + desktop projects"] --> demo2["full games in demo mode<br/>page.clock fast-forwards rides"]
    py["unittest<br/>server/test_*.py"] --> srv2["server routes,<br/>Strava & GitHub mocked"]
```

`pnpm check` runs them all after Prettier, ESLint and `tsc`. CI
([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs the same three
suites and sends coverage to Codecov. The demo sensor is the only way to
test without the bike: never break it.

## Where to look

| To change…                             | Go to                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| a game rule, turn order, ranking       | `src/core/game.ts` (+ `game.test.ts`)                        |
| scoring during a ride, the bell, track | `src/core/ride.ts`, `src/core/rideLoop.ts`                   |
| slopes, handicap, physics              | `src/core/handicap.ts`, `course.ts`, `docs/handicap.md`      |
| a setting or its default               | `src/core/settings.ts`, `src/storage/storage.ts` (migration) |
| what the ride screen shows             | `src/ui/RideScreen.tsx`, `cyclist/`, `lifter/`               |
| a text                                 | `src/i18n/en.ts` and `src/i18n/fr.ts`                        |
| colours, fonts                         | tokens at the top of `src/theme/theme.css`                   |
| what the QR code carries               | `src/export/playerLink.ts`                                   |
| the Strava activity                    | `src/export/fit.ts`, `activityText.ts`, `server/`            |
| the results picture                    | `src/share/resultCard.ts`                                    |
| Bluetooth, trainer control, gears      | `home-trainer-kit` (fix there, tag, bump here)               |
