// Renders the link preview cards (public/og-fr.jpg, public/og-en.jpg) and the
// app icons (public/icon.svg and its PNGs) from src/preview/, with the game's
// own drawings; also the bell of the end-of-game image (src/ui/share/bell.svg). Run after changing a drawing: pnpm og-image
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
  .evaluate((element) => element.outerHTML.replace(/[«»]/g, "").replace(/ data-icon="[^"]*"/, ""));
await writeFile(out("icon.svg"), `${svg}\n`);
console.log(out("icon.svg"));
// The bell alone, for the end-of-game image drawn on a canvas.
const bell = await icon
  .locator('svg[viewBox="400 440 780 950"]')
  .evaluate((element) =>
    element.outerHTML
      .replace(/[«»]/g, "")
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
for (const [name, size, maskable] of sizes) {
  await icon.setViewportSize({ width: 512, height: 512 });
  await open(icon, maskable ? "view=icon&maskable" : "view=icon");
  const target = icon.locator("svg[data-icon]");
  await target.evaluate((element, px) => {
    element.setAttribute("width", String(px));
    element.setAttribute("height", String(px));
  }, size);
  await target.screenshot({ path: out(name), omitBackground: true });
  console.log(out(name));
}

await browser.close();
await server.close();
