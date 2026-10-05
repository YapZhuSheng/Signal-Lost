import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: "Begin expedition" }).click();
const game = JSON.parse(
  await readFile("artifacts/completed-expedition.json", "utf8"),
).state;
await page.evaluate((s) => {
  window.__signal.start(s);
  window.__signal.pause(true);
  window.__signal.renderer.camera.zoom = 1.35;
}, game);
await page.screenshot({ path: "artifacts/established-colony.png" });
const metrics = await page.evaluate(async () => {
  const r = window.__signal.renderer,
    s = window.__signal.state;
  const times = [];
  for (let i = 0; i < 240; i++) {
    const start = performance.now();
    r.draw(s, 0.016);
    times.push(performance.now() - start);
    if (i % 20 === 0) await new Promise(requestAnimationFrame);
  }
  times.sort((a, b) => a - b);
  return {
    scenario: "1440 × 1000 established colony, headless Chromium CPU canvas",
    meanMs: times.reduce((a, b) => a + b, 0) / times.length,
    p95Ms: times[Math.floor(times.length * 0.95)],
    maxMs: times.at(-1),
  };
});
console.log(metrics);
await writeFile(
  "artifacts/render-profile.json",
  JSON.stringify(metrics, null, 2),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => {
  window.__signal.renderer.camera.zoom = 0.9;
});
await page.screenshot({ path: "artifacts/mobile-established.png" });
// Render original vector icon at native launcher sizes.
if(process.argv.includes("--icons")) for (const size of [192, 512, 1024]) {
  await page.setViewportSize({ width: size, height: size });
  await page.goto("http://127.0.0.1:5173/icon.svg");
  await page.screenshot({
    path: `public/icon-${size}.png`,
    omitBackground: true,
  });
}
await browser.close();
