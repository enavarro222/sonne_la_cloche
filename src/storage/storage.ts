// Remembers players and settings between sessions. Storage may be missing or
// full (private browsing): the game must keep working without it.

import { parseRoster, type Player } from "../core/players";
import { parseSettings, type Settings } from "../core/settings";

const KEYS = {
  roster: "sonne-la-cloche.roster",
  settings: "sonne-la-cloche.settings",
} as const;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted this time; nothing else to do.
  }
}

export const loadRoster = (): Player[] => parseRoster(readJson(KEYS.roster));
export const saveRoster = (roster: readonly Player[]): void => {
  writeJson(KEYS.roster, roster);
};

export const loadSettings = (): Settings => parseSettings(readJson(KEYS.settings));
export const saveSettings = (settings: Settings): void => {
  writeJson(KEYS.settings, settings);
};
