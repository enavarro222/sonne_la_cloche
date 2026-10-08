// Each player rides in their own colours: jersey, helmet and bike frame. A
// player keeps theirs (stored with them), so removing someone never repaints
// the others.

export interface Livery {
  jersey: string;
  /** Crayon strokes over the jersey. */
  jerseyLight: string;
  helmet: string;
  helmetLight: string;
  frame: string;
  frameLight: string;
}

/** The drawing as the young rider made it. */
export const ORIGINAL_LIVERY: Livery = {
  jersey: "#c62f2a",
  jerseyLight: "#e8673d",
  helmet: "#f0dd2a",
  helmetLight: "#fffbd0",
  frame: "#1d7a34",
  frameLight: "#5fae6e",
};

export const LIVERIES: readonly Livery[] = [
  ORIGINAL_LIVERY,
  {
    jersey: "#2a62d0",
    jerseyLight: "#6f9bf0",
    helmet: "#ff7a1a",
    helmetLight: "#ffc28f",
    frame: "#c62f2a",
    frameLight: "#e8673d",
  },
  {
    jersey: "#1d9a50",
    jerseyLight: "#6fd08e",
    helmet: "#ff3b77",
    helmetLight: "#ff9ab8",
    frame: "#2a62d0",
    frameLight: "#6f9bf0",
  },
  {
    jersey: "#7b3fc4",
    jerseyLight: "#b48af0",
    helmet: "#2ee6a8",
    helmetLight: "#b0f5dc",
    frame: "#e8951c",
    frameLight: "#ffd27a",
  },
  {
    jersey: "#f0c419",
    jerseyLight: "#fff0a0",
    helmet: "#c62f2a",
    helmetLight: "#e8673d",
    frame: "#1d4296",
    frameLight: "#6f8fe0",
  },
  {
    jersey: "#ff3b77",
    jerseyLight: "#ff9ab8",
    helmet: "#1d4296",
    helmetLight: "#6f8fe0",
    frame: "#138a8a",
    frameLight: "#5cc4c4",
  },
  {
    jersey: "#f07a1a",
    jerseyLight: "#ffb070",
    helmet: "#2a62d0",
    helmetLight: "#8fb3f5",
    frame: "#7b3fc4",
    frameLight: "#b48af0",
  },
  {
    jersey: "#138a8a",
    jerseyLight: "#5cc4c4",
    helmet: "#f0dd2a",
    helmetLight: "#fffbd0",
    frame: "#ff3b77",
    frameLight: "#ff9ab8",
  },
];

export const isLivery = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < LIVERIES.length;

/** The first livery nobody wears yet; when all are taken, they come round again. */
export function freeLivery(taken: readonly (number | undefined)[]): number {
  const index = LIVERIES.findIndex((_, i) => !taken.includes(i));
  return index === -1 ? taken.length % LIVERIES.length : index;
}

export const liveryOf = (player: { livery?: number }): Livery =>
  (isLivery(player.livery) ? LIVERIES[player.livery] : undefined) ?? ORIGINAL_LIVERY;
