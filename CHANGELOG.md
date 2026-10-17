# Changelog

Each version is tagged `v<version>`; pushing the tag publishes its GitHub
release with the notes below (see `.github/workflows/release.yml`).

## 0.2.0 — 2026-10-17

Fair between all sizes on any trainer that measures power, and a new look:
the whole game drawn by hand, its characters drawn by a young rider.

### Fairer: each player on their own slope

- Every score is now a distance, in metres. By default the watts measured
  become metres through a physics model, from a virtual flying start (the
  countdown is the run-up). Scored on leg speed, for trainers without
  power, the pedal turns drive a virtual bike at 4 m per turn.
- The new default road is "own slope each": round 1 measures everyone on
  a common slope, then each player rides their own slope, flat for the
  weakest, steeper for the stronger, so that everyone at their own level
  covers the same distance. A player's level only goes up, mid-ride too
  when they ride well above it; the others' slopes come from the levels as
  the round started, so the order of play changes nothing. See
  `docs/handicap.md`.
- The difficulty setting is now a slope (flat 0 %, gentle 2 %, hill 5 %,
  wall 10 %), sent to FTMS trainers as a simulated grade, or as a
  resistance level on the others.
- During the ride, a gauge shows the player's power against their level.
- Without a power meter (a CSC sensor, or power stuck at 0) the game scores
  on leg speed instead, and the home screen says so. A trainer is taken to
  measure power until shown otherwise, so a game started right after
  connecting keeps scoring distance.
- Saved settings move to the new defaults, keeping ride length and rounds.

### A last-seconds twist

- As the last 5 seconds start, the rider is compared with the bell's pace:
  ahead, the pole bearer lifts the track 3 % higher; behind, he lets go and
  runs away, and the track falls 3 % (a descent for those on the flat).
  On by default, off in the settings.
- He sees it coming three seconds ahead: he stares at the timer, panics,
  and a "!" pops by his head.

### Virtual gears

- For trainers with a single cog (Zwift Cog and the like), a "Gears:
  virtual" setting with the real chainring and cog (the Zwift Cog's 14 or
  18 teeth from a list, or any other). The game then shifts 24
  gears on the trainer with + and − on a Zwift Click or Ride, a gamepad's
  shoulder buttons, or the keyboard; a derailleur's clic-clac sounds at each
  shift, and the ride shows the gear. Each ride starts on the gear closest
  to the real one. The score doesn't change: it comes from the power.
- The home screen always says which gears the ride uses, the bike's own or
  virtual, connects the Zwift remote, and warns when the trainer can't be
  controlled (virtual gears would change nothing).

### Drawn by hand

- The cyclist and the pole bearer holding up the track come from a child's
  drawings. The cyclist's legs follow the real cadence; the wheels roll at
  the bike's speed and on after the legs stop, raising dust. The pole
  bearer breathes, sweats and shakes as the slope steepens, keeps an eye
  on the cyclist, the player and the timer, and dodges the falling seconds.
- The whole screen is a sheet of indigo construction paper: matt paper
  panels, fonts drawn by hand but readable from afar, the track and the
  score sheet on kraft paper, a crayoned hand bell hanging from the track.
- The ride screen is laid out anew: the time left drains the background
  like an hourglass, the track leans with the slope written above it, the
  distance and speed are shown, and nothing moves at "Go".

### Players

- Each player has their own cyclist, in their own colours: tap it for
  other colours, drag the sheets (or Alt + ← →) to change the order of
  play, a clear pin to remove a player. Every rider pedals on the home
  screen at their own pace.
- 8 players at most, a full party.

### Sharing

- The link preview, the app icon and the results picture to share now
  have the hand-drawn look.
- On Strava, the activity covers the distance the game counted, climbs the
  slope actually ridden, second by second, and its average speed counts
  only the time ridden. With a map, the rides keep their real times and the
  rests between them show; without one, they follow one another. Power
  goes up to 1020 W (510 W before).
- The QR codes' links carry a format version: those of 0.1.0 keep working.

## 0.1.0 — 2026-10-03

The first release: a complete game, played at a kids' birthday party.

### The game

- Players take turns sprinting 20 to 45 seconds on a smart home trainer,
  over 3 to 5 rounds, on one shared screen (an Android tablet or a PC/TV).
- Scored on pedal turns by default, fair between children and adults; on
  watts as an option.
- Connects to the trainer over Bluetooth (FTMS, Cycling Power or CSC) and,
  on FTMS trainers, sets its resistance from the game.
- A pedaling cyclist, a bell to ring, a per-round table and awards at the
  end; the next rider's name on the button; full screen.
- Players and settings are remembered; the screen stays on while playing.
- A demo mode without a bike (← and → in turn), and a `?dev` test mode.
- French and English, chosen by the address, switched without a reload.

### After the game

- A results picture to share (WhatsApp, Signal…).
- One QR code per player: their game on their own phone, as a picture and,
  for a game ridden on a real bike, a `.fit` file or a Strava activity
  (with an optional map around the phone's position).
- A "Your opinion?" form whose messages reach the author only.
