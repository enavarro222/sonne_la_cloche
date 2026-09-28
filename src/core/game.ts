// Application state and rules: roster, settings and the tournament.
// A "round" means every player rides once; the ranking is the sum of every
// ride over all rounds.

import { canStart, normalizeName, type Player, validateName } from "./players";
import type { Settings } from "./settings";

export interface RideResult {
  playerId: string;
  round: number;
  points: number;
}

export interface Game {
  players: readonly Player[];
  settings: Settings;
  /** 1-based. */
  round: number;
  /** Index in `players` of whoever rides now (or just rode). */
  turn: number;
  phase: "riding" | "result";
  rides: readonly RideResult[];
  /** Changes on every new ride attempt, so the UI can remount the ride. */
  rideId: number;
}

export interface AppState {
  roster: readonly Player[];
  settings: Settings;
  game: Game | null;
}

export type Action =
  | { type: "playerAdded"; player: Player }
  | { type: "playerRemoved"; id: string }
  | { type: "settingsChanged"; settings: Partial<Settings> }
  | { type: "gameStarted" }
  | { type: "rideFinished"; points: number }
  | { type: "rideRetried" }
  | { type: "nextTurn" }
  | { type: "gameQuit" };

export const initialState = (roster: readonly Player[], settings: Settings): AppState => ({
  roster,
  settings,
  game: null,
});

function newGame(state: AppState): Game {
  return {
    players: state.roster,
    settings: state.settings,
    round: 1,
    turn: 0,
    phase: "riding",
    rides: [],
    rideId: (state.game?.rideId ?? 0) + 1,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  const { game } = state;
  switch (action.type) {
    case "playerAdded": {
      if (game) return state;
      const player = { ...action.player, name: normalizeName(action.player.name) };
      if (validateName(player.name, state.roster) !== null) return state;
      return { ...state, roster: [...state.roster, player] };
    }
    case "playerRemoved":
      if (game) return state;
      return { ...state, roster: state.roster.filter((p) => p.id !== action.id) };
    case "settingsChanged":
      if (game) return state;
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case "gameStarted":
      if (!canStart(state.roster) || (game && !isGameOver(game))) return state;
      return { ...state, game: newGame(state) };
    case "rideFinished": {
      if (game?.phase !== "riding") return state;
      const player = currentPlayer(game);
      const points = Number.isFinite(action.points) ? Math.max(0, Math.round(action.points)) : 0;
      // A retried ride replaces the previous attempt for the same round.
      const rides = game.rides.filter((r) => !(r.playerId === player.id && r.round === game.round));
      return {
        ...state,
        game: {
          ...game,
          phase: "result",
          rides: [...rides, { playerId: player.id, round: game.round, points }],
        },
      };
    }
    case "rideRetried":
      if (game?.phase !== "result") return state;
      return { ...state, game: { ...game, phase: "riding", rideId: game.rideId + 1 } };
    case "nextTurn": {
      if (game?.phase !== "result" || isGameOver(game)) return state;
      const lastInRound = game.turn === game.players.length - 1;
      return {
        ...state,
        game: {
          ...game,
          phase: "riding",
          turn: lastInRound ? 0 : game.turn + 1,
          round: lastInRound ? game.round + 1 : game.round,
          rideId: game.rideId + 1,
        },
      };
    }
    case "gameQuit":
      return { ...state, game: null };
  }
}

// --- selectors ------------------------------------------------------------

export function currentPlayer(game: Game): Player {
  const player = game.players[game.turn];
  if (!player) throw new Error(`No player at turn ${game.turn}`);
  return player;
}

export const isGameOver = (game: Game): boolean =>
  game.phase === "result" &&
  game.round === game.settings.rounds &&
  game.turn === game.players.length - 1;

export function upNext(game: Game): { player: Player; round: number } | null {
  if (isGameOver(game)) return null;
  const lastInRound = game.turn === game.players.length - 1;
  const player = game.players[lastInRound ? 0 : game.turn + 1];
  if (!player) return null;
  return { player, round: lastInRound ? game.round + 1 : game.round };
}

export interface Standing {
  player: Player;
  total: number;
  /** Competition ranking: equal totals share a rank (1, 1, 3). */
  rank: number;
}

export function standings(game: Game): Standing[] {
  const totals = game.players.map((player) => ({
    player,
    total: game.rides.filter((r) => r.playerId === player.id).reduce((s, r) => s + r.points, 0),
  }));
  // Array.prototype.sort is stable: ties keep the playing order.
  const sorted = totals.sort((a, b) => b.total - a.total);
  return sorted.map((s) => ({ ...s, rank: sorted.findIndex((o) => o.total === s.total) + 1 }));
}

/**
 * Best single ride so far: the mark to beat on the track. While a ride is
 * being retried, the attempt it will replace does not count.
 */
export function bestRide(game: Game): { player: Player; points: number } | null {
  const replaced = game.phase === "riding" ? currentPlayer(game).id : null;
  let best: { player: Player; points: number } | null = null;
  for (const ride of game.rides) {
    if (ride.playerId === replaced && ride.round === game.round) continue;
    if (ride.points <= (best?.points ?? 0)) continue;
    const player = game.players.find((p) => p.id === ride.playerId);
    if (player) best = { player, points: ride.points };
  }
  return best;
}

/** The ride just finished by the current player, for the result screen. */
export function lastRide(game: Game): { points: number; personalBest: boolean } | null {
  if (game.phase !== "result") return null;
  const player = currentPlayer(game);
  const own = game.rides.filter((r) => r.playerId === player.id);
  const ride = own.find((r) => r.round === game.round);
  if (!ride) return null;
  const earlier = own.filter((r) => r.round !== game.round).map((r) => r.points);
  // No "personal best" on a first ride: there is nothing to beat yet.
  const personalBest = earlier.length > 0 && ride.points > Math.max(...earlier);
  return { points: ride.points, personalBest };
}
