# Changelog

Each version is tagged `v<version>`; pushing the tag publishes its GitHub
release with the notes below (see `.github/workflows/release.yml`).

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
