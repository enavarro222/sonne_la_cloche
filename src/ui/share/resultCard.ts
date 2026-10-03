// The end-of-game image, drawn on a canvas: a portrait card that looks the
// same whatever the screen the game was played on.

import type { ShareContent } from "./shareContent";

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 80;

const COLORS = {
  night: "#1b1464",
  nightLight: "#2c217e",
  yellow: "#ffc93c",
  pink: "#ff3b77",
  mint: "#2ee6a8",
  cream: "#fff3e0",
  creamDim: "rgb(255 243 224 / 0.72)",
  surface: "rgb(255 255 255 / 0.08)",
};
const DISPLAY = '"Bungee", Impact, sans-serif';
const TEXT = '"Nunito", "Trebuchet MS", sans-serif';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** Splits `text` into lines no wider than `maxWidth` (breaking at spaces). */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the card. Separate from the canvas creation so it can be reused. */
export function drawResultCard(ctx: CanvasRenderingContext2D, content: ShareContent): void {
  // Background: the game's night gradient and diagonal stripes.
  const background = ctx.createRadialGradient(WIDTH / 2, 0, 0, WIDTH / 2, 0, HEIGHT);
  background.addColorStop(0, COLORS.nightLight);
  background.addColorStop(0.7, COLORS.night);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.fillStyle = "rgb(255 255 255 / 0.035)";
  ctx.rotate((-25 * Math.PI) / 180);
  for (let x = -HEIGHT; x < WIDTH * 2; x += 136) ctx.fillRect(x, -HEIGHT, 68, HEIGHT * 3);
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  const width = WIDTH - 2 * PAD;

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.yellow;
  ctx.font = `76px ${DISPLAY}`;
  ctx.fillText(fitText(ctx, `🔔 ${content.title}`, width), WIDTH / 2, PAD + 70);

  // Measure the middle block first, to center it between title and footer.
  ctx.font = `52px ${DISPLAY}`;
  const winnerLines = wrapText((t) => ctx.measureText(t).width, content.winner, width).slice(0, 3);
  const winnerLineHeight = 66;
  const rows = content.ranking.slice(0, 8);
  const awardHeight = 52;
  const top = PAD + 110;
  const bottom = HEIGHT - PAD - 110;
  // A crowded game (8 players, every award) squeezes the ranking rows rather
  // than pushing the awards onto the footer.
  const others =
    winnerLines.length * winnerLineHeight + 40 + 40 + content.awards.length * awardHeight;
  const rowHeight = Math.min(92, (bottom - top - others) / Math.max(1, rows.length));
  const scale = rowHeight / 92;
  const blockHeight = others + rows.length * rowHeight;
  let y = top + Math.max(0, (bottom - top - blockHeight) / 2);

  ctx.fillStyle = COLORS.mint;
  for (const line of winnerLines) {
    y += winnerLineHeight;
    ctx.fillText(line, WIDTH / 2, y - 14);
  }

  y += 40;
  for (const row of rows) {
    const first = row.rank === 1;
    ctx.fillStyle = first ? COLORS.pink : COLORS.surface;
    ctx.beginPath();
    ctx.roundRect(PAD, y, width, rowHeight - 14 * scale, 22 * scale);
    ctx.fill();
    const baseline = y + (rowHeight - 14 * scale) / 2 + 16 * scale;
    ctx.textAlign = "left";
    ctx.fillStyle = first ? COLORS.cream : COLORS.yellow;
    ctx.font = `${String(Math.round(44 * scale))}px ${DISPLAY}`;
    ctx.fillText(String(row.rank), PAD + 32, baseline);
    ctx.fillStyle = COLORS.cream;
    ctx.font = `900 ${String(Math.round(46 * scale))}px ${TEXT}`;
    ctx.fillText(fitText(ctx, row.name, width - 360), PAD + 120, baseline);
    ctx.textAlign = "right";
    ctx.fillText(String(row.total), WIDTH - PAD - 32, baseline);
    y += rowHeight;
  }

  y += 40;
  ctx.font = `900 34px ${TEXT}`;
  for (const award of content.awards) {
    y += awardHeight;
    const label = `${award.label}  `;
    const labelWidth = ctx.measureText(label).width;
    const start = WIDTH / 2 - (labelWidth + ctx.measureText(award.value).width) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(label, start, y - 14);
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(award.value, start + labelWidth, y - 14);
  }

  ctx.textAlign = "center";
  // Footer.
  ctx.fillStyle = COLORS.creamDim;
  ctx.font = `700 30px ${TEXT}`;
  ctx.fillText(content.date, WIDTH / 2, HEIGHT - PAD - 44);
  ctx.fillText(content.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), WIDTH / 2, HEIGHT - PAD);
}

/** The card as a PNG, or null where canvases are not available. */
export async function renderResultCard(content: ShareContent): Promise<Blob | null> {
  // The game's fonts must be ready, or the canvas falls back to system ones.
  await Promise.all([
    document.fonts.load(`76px ${DISPLAY}`),
    document.fonts.load(`900 46px ${TEXT}`),
    document.fonts.load(`700 30px ${TEXT}`),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawResultCard(ctx, content);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}
