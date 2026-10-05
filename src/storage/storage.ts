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

/** Bumped when stored settings need a migration: see `migrateSettings`. */
export const SETTINGS_VERSION = 2;

/**
 * Brings stored settings up to the current version. Settings are saved as
 * soon as the game opens, so a stored value is often a past default rather
 * than a choice: a new default reaches everyone through a migration.
 */
export function migrateSettings(stored: unknown): unknown {
  if (typeof stored !== "object" || stored === null) return stored;
  let settings = stored as Record<string, unknown>;
  const version = typeof settings.version === "number" ? settings.version : 1;
  // v2: each on their own slope by default; "power" became "distance" and
  // the trainer resistance a slope.
  if (version < 2) settings = { ...settings, metric: "distance", slope: "own" };
  return settings;
}

export const loadSettings = (): Settings => parseSettings(migrateSettings(readJson(KEYS.settings)));
export const saveSettings = (settings: Settings): void => {
  writeJson(KEYS.settings, { version: SETTINGS_VERSION, ...settings });
};
