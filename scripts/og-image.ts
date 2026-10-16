// Renders the link preview cards (public/og-fr.jpg, public/og-en.jpg) and the
// app icons (public/icon.svg, its PNGs and favicon.ico) from src/preview/,
// with the game's own drawings; also the bell of the end-of-game image
// (src/ui/share/bell.svg). Run after changing a drawing: pnpm og-image
//
// Then bump the "?v=" of their addresses (the pages' <head>, the manifest):
// browsers and link previews keep the old images otherwise.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const server = await createServer({ root, logLevel: "error", server: { port: 0 } });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error("Vite did not start");

const browser = await chromium.launch();
const open = async (page: Page, query: string) => {
  await page.goto(`${base}scripts/og-image.html?${query}`);
  await page.locator("#root > *").waitFor();
  await page.evaluate(() => document.fonts.ready);
};

const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of ["fr", "en"]) {
  await open(card, `view=card&lang=${lang}`);
  await card.screenshot({ path: out(`og-${lang}.jpg`), type: "jpeg", quality: 85 });
  console.log(out(`og-${lang}.jpg`));
}

const icon = await browser.newPage({ viewport: { width: 512, height: 512 } });
await open(icon, "view=icon");
// The favicon: the icon's own markup, with ids a file can hold.
const svg = await icon
  .locator("svg[data-icon]")
  .evaluate((element) => element.outerHTML.replace(/ data-icon="[^"]*"/, ""));
await writeFile(out("icon.svg"), `${svg}\n`);
console.log(out("icon.svg"));
// The bell alone, for the end-of-game image drawn on a canvas.
const bell = await icon
  .locator('svg[viewBox="400 440 780 950"]')
  .evaluate((element) =>
    element.outerHTML
      .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace('width="100%"', 'width="780" height="950"'),
  );
const bellPath = fileURLToPath(new URL("../src/ui/share/bell.svg", import.meta.url));
await writeFile(bellPath, `${bell}\n`);
console.log(bellPath);
const sizes: [string, number, boolean][] = [
  ["icon-512.png", 512, false],
  ["icon-192.png", 192, false],
  ["apple-touch-icon.png", 180, true],
  ["icon-maskable-512.png", 512, true],
];
/** The icon drawn `size` pixels wide, as a PNG. */
const iconPng = async (size: number, maskable: boolean): Promise<Buffer> => {
  await icon.setViewportSize({ width: 512, height: 512 });
  await open(icon, maskable ? "view=icon&maskable" : "view=icon");
  const target = icon.locator("svg[data-icon]");
  await target.evaluate((element, px) => {
    element.setAttribute("width", String(px));
    element.setAttribute("height", String(px));
  }, size);
  return target.screenshot({ omitBackground: true });
};
for (const [name, size, maskable] of sizes) {
  await writeFile(out(name), await iconPng(size, maskable));
  console.log(out(name));
}

// favicon.ico, for what still asks for it (bookmarks, some link previews):
// PNG images in an ICO container, 16, 32 and 48 px.
const icoSizes = [16, 32, 48];
const pngs: Buffer[] = [];
// One after the other: they share the page.
for (const size of icoSizes) pngs.push(await iconPng(size, false));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // an icon
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
for (const [i, png] of pngs.entries()) {
  const entry = 6 + 16 * i;
  header.writeUInt8(icoSizes[i] ?? 0, entry);
  header.writeUInt8(icoSizes[i] ?? 0, entry + 1);
  header.writeUInt16LE(1, entry + 4); // colour planes
  header.writeUInt16LE(32, entry + 6); // bits per pixel
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await writeFile(out("favicon.ico"), Buffer.concat([header, ...pngs]));
console.log(out("favicon.ico"));

await browser.close();
await server.close();
