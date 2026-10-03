# Sonne la cloche !

[![CI](https://github.com/enavarro222/sonne_la_cloche/actions/workflows/ci.yml/badge.svg)](https://github.com/enavarro222/sonne_la_cloche/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/enavarro222/sonne_la_cloche/graph/badge.svg)](https://codecov.io/gh/enavarro222/sonne_la_cloche)

A pedaling game for a group around one screen: a bike on a smart home
trainer, a tablet or a TV, and everyone takes turns pedaling as fast as they
can for 20 to 45 seconds to ring the bell. It was born for a kids' birthday
party and works just as well between adults: family gatherings, friends,
a team afternoon.

By default the score counts pedal turns rather than watts, so small legs stand
a chance against big ones; switch to watts for a strength contest. On smart
trainers the game also sets the resistance, from light to mega hard.

It runs in the browser, reads the trainer over Bluetooth, and works in French
(`/fr/`) and English (`/en/`).

Everything happens on the device: no account, no server, no tracking, nothing
sent anywhere during a game. Players and settings stay in the browser's local
storage. The one exception is publishing on Strava, which is optional and
goes through a small server (see below); without it, that button simply does
not show up.

**Play it at <https://sonnelacloche.enavarro.eu/>** (Chrome or Edge). No bike?
It is still a game: see _Without a bike_ below.

![A ride: Tom has just passed Léa's record and rung the bell](docs/screenshots/ride.png)

## How a game goes

Everyone rides once per round, for 3 to 5 rounds. The bell on the track marks
the best ride so far; pass it and it rings. On the very first ride there is no
record yet, so the bell marks a goal instead (80 rpm held for the whole ride).

After each ride you get the points, the average and peak cadence and power,
and a table of every round so far. At the end, the winner rings the bell, and
three awards go to the best single ride, the fastest legs and the strongest
rider.

| Before the game                           | After a ride                                 | End of the game                                  |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| ![Home screen](docs/screenshots/home.png) | ![Ride results](docs/screenshots/result.png) | ![Final ranking](docs/screenshots/game-over.png) |

Players and settings are remembered: for the next game, connect the bike and
hit _Let's go!_

At the end, everyone takes the game home on their own phone: _On your phones_
shows a QR code per player. It opens their game with the results picture, to
share on WhatsApp, Signal, Instagram… with their own accounts. After a game on
a real bike, they can also publish it on their Strava account (as a virtual
ride) or download it as a `.fit` file. The game data travels inside the QR
code; nothing is stored on a server. _Share_ sends the same picture straight
from the tablet.

## Without a bike

_Try without a bike_ turns the keyboard into pedals: press ← and → in turn,
the faster the rhythm the faster you go (on a touch screen, tap the _Left
foot_ and _Right foot_ buttons in turn). Same rules, same bell, same pictures
to share: a real game on a laptop or a tablet. Only Strava is kept for rides
on a real bike.

## What you need

- A home trainer or sensor that speaks Bluetooth **FTMS**, **Cycling Power**
  or **CSC** (speed/cadence). Close every other app that could hold it (Zwift,
  the vendor app, a Garmin watch): only one connection at a time.
- **Chrome or Edge**, on a computer or an Android tablet. Safari, Firefox and
  iOS don't support Web Bluetooth.
- **HTTPS** (or `localhost`): browsers only allow Bluetooth on secure pages.
- Resistance: the game sets it on FTMS trainers (light, normal, hard, mega
  hard). With another sensor, use the bike's gears; for young kids, the lowest
  gear, or their legs give up after ten seconds.

## Run it

```sh
pnpm install
pnpm dev          # http://localhost:5173, redirects to /fr/ or /en/
pnpm build        # static site in dist/ (/, /fr/, /en/), no server needed
```

## Strava publishing (optional)

Publishing needs the small service in `server/` (Python standard library
only): Strava's OAuth requires a client secret that cannot live in a web page.
It exchanges the authorization, uploads the file, sets the activity type and
revokes the access right away. It reads `STRAVA_CLIENT_ID`,
`STRAVA_CLIENT_SECRET` and `STRAVA_REDIRECT_URI` from its environment, and
expects `/api/strava/` of the game's domain to be proxied to it. The phone page
asks it whether Strava is set up (`/api/strava/status`) and only then offers to
publish; otherwise, as with `pnpm dev`, it offers the `.fit` download alone.

## Players' feedback (optional)

The same service files the messages of the _Your opinion?_ form (home screen
and phone page) as issues in a private GitHub repository: players need no
account, and their words are not made public. It reads `GITHUB_TOKEN` (a
fine-grained token allowed to write issues on that repository only) and
`GITHUB_FEEDBACK_REPO` (`owner/name`), and expects `/api/feedback` to be
proxied to it. Without them, the form is not offered.

## Develop

```sh
pnpm check          # format check + lint + typecheck + unit tests + e2e
pnpm test           # unit tests (Vitest)
pnpm test:coverage  # unit tests with coverage (coverage/lcov-report/)
pnpm e2e            # end-to-end tests (Playwright, tablet and desktop screens)
pnpm e2e:coverage   # the same, measuring what they run (coverage/e2e/)
pnpm test:server    # tests of the Strava and feedback service (Python)
```

First e2e run: `pnpm exec playwright install chromium`. `CLAUDE.md` describes
the architecture and the constraints to keep in mind. GitHub Actions runs the
same checks on every push and pull request, and sends coverage to Codecov.

Add `?dev` to the address (e.g. `/fr/?dev`) for a test mode: 5-second rides and
one-round games in the settings, and every end-of-game feature available
without a bike.

## Troubleshooting

| Symptom                          | Most likely cause                                                |
| -------------------------------- | ---------------------------------------------------------------- |
| "Connect the bike" is greyed out | Browser without Web Bluetooth (Safari, Firefox, iOS) or no HTTPS |
| The trainer is not in the list   | Still connected to another app, or asleep                        |
| Connected but cadence stays at 0 | Power meter without crank data: switch the metric to "Strength"  |
| Values look doubled or empty     | FTMS parsing: see the note on bit 0 in `CLAUDE.md`               |

## License

[MIT](LICENSE), by [enavarro222](https://github.com/enavarro222).
