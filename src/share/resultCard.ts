// The end-of-game image, drawn on a canvas: a portrait card that looks the
// same whatever the screen the game was played on. Like the game, a sheet of
// indigo construction paper, the drawn bell, and the ranking on a sheet of
// the track's paper.

import bellUrl from "./bell.svg";
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
  pinkDark: "#b3234f",
  /** The track's paper, and its rows. */
  paper: "#d8ccb0",
  paperRow: "rgb(255 255 255 / 0.3)",
};

/** What the card is drawn with, beyond text: loaded first (see renderResultCard). */
export interface CardArt {
  /** The drawn bell, 780×950. */
  bell?: CanvasImageSource;
  /** The paper's grain, tiled over the background. */
  grain?: CanvasPattern | null;
}
// Capitals only, as on screen (text-transform: uppercase).
const DISPLAY = '"Luckiest Guy", Impact, sans-serif';
const TEXT = '"Mali", "Trebuchet MS", sans-serif';

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
export function drawResultCard(
  ctx: CanvasRenderingContext2D,
  content: ShareContent,
  art: CardArt = {},
): void {
  // Background: a sheet of indigo paper, lighter at the top, with its grain.
  const background = ctx.createRadialGradient(WIDTH / 2, 0, 0, WIDTH / 2, 0, HEIGHT);
  background.addColorStop(0, COLORS.nightLight);
  background.addColorStop(0.7, COLORS.night);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (art.grain) {
    ctx.fillStyle = art.grain;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.textBaseline = "alphabetic";
  const width = WIDTH - 2 * PAD;

  // The title, the drawn bell ringing before it.
  ctx.font = `76px ${DISPLAY}`;
  const bellHeight = art.bell ? 124 : 0;
  const bellWidth = (bellHeight * 780) / 950;
  const bellGap = art.bell ? 20 : 0;
  const title = fitText(ctx, content.title.toUpperCase(), width - bellWidth - bellGap);
  const titleWidth = ctx.measureText(title).width;
  const titleLeft = WIDTH / 2 - (bellWidth + bellGap + titleWidth) / 2;
  if (art.bell) {
    ctx.save();
    ctx.translate(titleLeft + bellWidth / 2, PAD + 70 - bellHeight / 2 + 6);
    ctx.rotate((-10 * Math.PI) / 180);
    ctx.drawImage(art.bell, -bellWidth / 2, -bellHeight / 2, bellWidth, bellHeight);
    ctx.restore();
  }
  ctx.textAlign = "left";
  const titleX = titleLeft + bellWidth + bellGap;
  ctx.fillStyle = COLORS.pinkDark;
  ctx.fillText(title, titleX, PAD + 76);
  ctx.fillStyle = COLORS.yellow;
  ctx.fillText(title, titleX, PAD + 70);
  ctx.textAlign = "center";

  // Measure the middle block first, to center it between title and footer.
  ctx.font = `52px ${DISPLAY}`;
  const winnerLines = wrapText(
    (t) => ctx.measureText(t).width,
    content.winner.toUpperCase(),
    width,
  ).slice(0, 3);
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
  // The ranking on a score sheet of the track's paper, lying a little askew.
  const sheetTop = y - 22;
  const sheetHeight = rows.length * rowHeight + 30;
  ctx.save();
  ctx.translate(WIDTH / 2, sheetTop + sheetHeight / 2);
  ctx.rotate((-1 * Math.PI) / 180);
  ctx.translate(-WIDTH / 2, -(sheetTop + sheetHeight / 2));
  ctx.shadowColor = "rgb(0 0 0 / 0.35)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(PAD - 24, sheetTop, width + 48, sheetHeight);
  ctx.shadowColor = "transparent";
  for (const row of rows) {
    const first = row.rank === 1;
    ctx.fillStyle = first ? COLORS.pink : COLORS.paperRow;
    ctx.beginPath();
    ctx.roundRect(PAD, y, width, rowHeight - 14 * scale, 3 * scale);
    ctx.fill();
    const baseline = y + (rowHeight - 14 * scale) / 2 + 16 * scale;
    ctx.textAlign = "left";
    ctx.fillStyle = first ? COLORS.cream : COLORS.pinkDark;
    ctx.font = `${String(Math.round(44 * scale))}px ${DISPLAY}`;
    ctx.fillText(String(row.rank), PAD + 32, baseline);
    ctx.fillStyle = first ? COLORS.cream : COLORS.night;
    ctx.font = `700 ${String(Math.round(46 * scale))}px ${TEXT}`;
    ctx.fillText(fitText(ctx, row.name, width - 360), PAD + 120, baseline);
    ctx.textAlign = "right";
    ctx.fillText(String(row.total), WIDTH - PAD - 32, baseline);
    y += rowHeight;
  }
  ctx.restore();

  y += 40;
  ctx.font = `700 34px ${TEXT}`;
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

/** The drawn bell, or nothing if it cannot be loaded: the card does without. */
async function loadBell(): Promise<HTMLImageElement | undefined> {
  const image = new Image();
  image.src = bellUrl;
  try {
    await image.decode();
    return image;
  } catch {
    return undefined;
  }
}

/** The fine grain of the game's indigo paper (theme/theme.css), as a tile. */
function paperGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement("canvas");
  tile.width = 240;
  tile.height = 240;
  const tileCtx = tile.getContext("2d");
  if (!tileCtx) return null;
  const pixels = tileCtx.createImageData(240, 240);
  // A seeded noise: the same card every time.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < pixels.data.length; i += 4) {
    const light = random();
    pixels.data[i] = 255;
    pixels.data[i + 1] = 243;
    pixels.data[i + 2] = 217;
    pixels.data[i + 3] = Math.round(Math.max(0, light * 0.35 - 0.1) * 255);
  }
  tileCtx.putImageData(pixels, 0, 0);
  return ctx.createPattern(tile, "repeat");
}

/** The card as a PNG, or null where canvases are not available. */
export async function renderResultCard(content: ShareContent): Promise<Blob | null> {
  // The game's fonts must be ready, or the canvas falls back to system ones.
  const [bell] = await Promise.all([
    loadBell(),
    Promise.all([
      document.fonts.load(`76px ${DISPLAY}`),
      document.fonts.load(`700 46px ${TEXT}`),
      document.fonts.load(`700 30px ${TEXT}`),
    ]).catch(() => undefined),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawResultCard(ctx, content, { bell, grain: paperGrain(ctx) });
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}
