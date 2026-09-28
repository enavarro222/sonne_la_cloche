export interface Player {
  id: string;
  name: string;
}

export const MIN_PLAYERS = 2;
export const MAX_NAME_LENGTH = 14;

export type NameError = "empty" | "duplicate";

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH).trim();
}

export function validateName(name: string, roster: readonly Player[]): NameError | null {
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
    const { id, name } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") continue;
    const clean = normalizeName(name);
    if (validateName(clean, roster) === null && !roster.some((p) => p.id === id)) {
      roster.push({ id, name: clean });
    }
  }
  return roster;
}
