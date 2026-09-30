// Renders the link preview images (public/og-fr.jpg, public/og-en.jpg) from
// og-image.html. Run after changing the card: pnpm og-image
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const pageUrl = new URL("og-image.html", import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of ["fr", "en"]) {
  await page.goto(`${pageUrl}?lang=${lang}`);
  await page.evaluate(() => document.fonts.ready);
  const path = fileURLToPath(new URL(`../public/og-${lang}.jpg`, import.meta.url));
  await page.screenshot({ path, type: "jpeg", quality: 85 });
  console.log(path);
}
await browser.close();
