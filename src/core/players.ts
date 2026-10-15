import { freeLivery, isLivery } from "./livery";

export interface Player {
  id: string;
  name: string;
  /** Index in LIVERIES: their colours. Given when they join the roster. */
  livery?: number;
}

export const MIN_PLAYERS = 2;
/**
 * A full party: as many as the screens are laid out (and tested) for, and as
 * the riders' colours and the shared picture's rows.
 */
export const MAX_PLAYERS = 8;
export const MAX_NAME_LENGTH = 14;

export type NameError = "empty" | "duplicate" | "full";

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH).trim();
}

export function validateName(name: string, roster: readonly Player[]): NameError | null {
  if (roster.length >= MAX_PLAYERS) return "full";
  if (name === "") return "empty";
  const key = name.toLocaleLowerCase();
  return roster.some((p) => p.name.toLocaleLowerCase() === key) ? "duplicate" : null;
}

export function canStart(roster: readonly Player[]): boolean {
  return roster.length >= MIN_PLAYERS;
}

/** Reads a roster from untrusted data (e.g. storage), dropping invalid entries. */
export function parseRoster(value: unknown): Player[] {
  if (!Array.isArray(value)) return [];
  const roster: Player[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const { id, name, livery } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") continue;
    const clean = normalizeName(name);
    if (roster.length >= MAX_PLAYERS) break;
    if (validateName(clean, roster) === null && !roster.some((p) => p.id === id)) {
      const taken = roster.map((p) => p.livery);
      const own = isLivery(livery) && !taken.includes(livery) ? livery : freeLivery(taken);
      roster.push({ id, name: clean, livery: own });
    }
  }
  return roster;
}
