import { describe, expect, it } from "vitest";
import { drawResultCard } from "./resultCard";
import type { ShareContent } from "./shareContent";

const WIDTH = 1080;
const PAD = 80;

interface Drawn {
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * A canvas that records the text it is asked to draw. Every character is as
 * wide as the font size: wider than real fonts, so overflows show up.
 */
function recordingCanvas() {
  const drawn: Drawn[] = [];
  let font = "10px sans-serif";
  const size = () => Number(/(\d+)px/.exec(font)?.[1] ?? 10);
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * size() }),
    fillText: (text: string, x: number, y: number) => {
      drawn.push({ text, x, y, width: text.length * size() });
    },
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  };
  const ctx = new Proxy(target, {
    get: (target, key: string) => target[key] ?? (() => undefined),
    set: (target, key: string, value: unknown) => {
      if (key === "font") font = value as string;
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
}

function content(overrides: Partial<ShareContent> = {}): ShareContent {
  return {
    title: "Ring the Bell!",
    winner: "Léa rings the bell!",
    ranking: [
      { rank: 1, name: "Léa", total: 120 },
      { rank: 2, name: "Tom", total: 95 },
    ],
    awards: [{ label: "Best ride", value: "Léa · 64 pts" }],
    date: "Game of October 3, 2026",
    url: "https://sonnelacloche.enavarro.eu/en/",
    text: "",
    ...overrides,
  };
}

const texts = (drawn: Drawn[]) => drawn.map((d) => d.text);

describe("drawResultCard", () => {
  it("shows the ranking, the awards and where to play", () => {
    const { ctx, drawn } = recordingCanvas();
    drawResultCard(ctx, content());
    expect(texts(drawn)).toEqual(
      expect.arrayContaining(["Léa", "120", "Tom", "95", "Best ride  ", "Léa · 64 pts"]),
    );
    // The address as people would type it.
    expect(texts(drawn)).toContain("sonnelacloche.enavarro.eu/en");
  });

  it("cuts a name too wide for its row, so it never runs into the score", () => {
    const { ctx, drawn } = recordingCanvas();
    drawResultCard(ctx, content({ ranking: [{ rank: 1, name: "WWWWWWWWWWWWWW", total: 120 }] }));
    const name = drawn.find((d) => d.text.startsWith("WWW"));
    expect(name?.text.endsWith("…")).toBe(true);
    const score = drawn.find((d) => d.text === "120");
    // Names are left-aligned at x, scores right-aligned at x.
    expect((name?.x ?? 0) + (name?.width ?? 0)).toBeLessThan((score?.x ?? 0) - (score?.width ?? 0));
  });

  it("fits a full party on the card, however long the winners' line", () => {
    // Eight players and every award: the awards used to overlap the date.
    const ranking = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      name: `Player ${String(i + 1)}`,
      total: 200 - i * 10,
    }));
    const { ctx, drawn } = recordingCanvas();
    drawResultCard(
      ctx,
      content({
        winner:
          "Anne-Charlotte, Maximilien, Jean-Baptiste and Marie-Antoinette ring the bell together!",
        ranking,
        awards: [
          { label: "Best ride", value: "Player 1 · 64 pts" },
          { label: "Fastest legs", value: "Player 2 · 140 rpm" },
          { label: "Strongest", value: "Player 3 · 410 W" },
        ],
      }),
    );
    // The first eight only: more would not fit.
    expect(texts(drawn)).toContain("Player 8");
    expect(texts(drawn)).not.toContain("Player 9");
    // Nothing runs into the footer (the date, then the address).
    const date = drawn.find((d) => d.text === "Game of October 3, 2026");
    const footerTop = (date?.y ?? 0) - 30;
    for (const { text, y } of drawn.filter((d) => d !== date && !d.text.includes("enavarro"))) {
      expect(y, text).toBeGreaterThan(PAD);
      expect(y, text).toBeLessThan(footerTop);
    }
    // The title and the winners' lines stay within the margins, centered.
    for (const { text, x, width } of drawn.filter((d) => d.x === WIDTH / 2)) {
      expect(width, text).toBeLessThanOrEqual(WIDTH - 2 * PAD);
      expect(x - width / 2, text).toBeGreaterThanOrEqual(PAD);
    }
  });
});
