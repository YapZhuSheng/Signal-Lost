import { test, expect } from "@playwright/test";
test("desktop expedition, inspect rules, construct and reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin expedition" }).click();
  await page.evaluate(() => window.__signal.pause(true));
  await page.screenshot({ path: "artifacts/desktop-colony.png" });
  await page.locator('[data-panel="program"]').click();
  await expect(page.locator("#rules .rule")).toHaveCount(4);
  await page.locator('[data-up="3"]').click();
  await expect(page.locator('[data-action="2"]')).toHaveValue("mine");
  await page.locator('[data-down="2"]').click();
  await page.locator("[data-close]").click();
  await page.locator('[data-panel="build"]').click();
  await page.locator('[data-build="solar"]').click();
  const point = await page.evaluate(() =>
    window.__signal.renderer.screen(22, 25),
  );
  await page.locator("#world").click({ position: { x: point.x, y: point.y } });
  await expect(page.locator("#confirm-build")).toBeEnabled();
  await page.locator("#confirm-build").click();
  await page.evaluate(() => window.__signal.tick(250));
  expect(
    await page.evaluate(() =>
      window.__signal.state.buildings.some(
        (b) => b.type === "solar" && b.progress === 100,
      ),
    ),
  ).toBe(true);
  await page.locator("#settings").click();
  await page.locator("#save-now").click();
  const saved = await page.evaluate(() => ({
    tick: window.__signal.state.tick,
    seed: window.__signal.state.seed,
  }));
  await page.reload();
  await page.getByRole("button", { name: "Continue colony" }).click();
  await page.evaluate(() => window.__signal.pause(true));
  expect(await page.evaluate(() => window.__signal.state.tick)).toBe(
    saved.tick,
  );
  await expect(page.locator("#sector")).toHaveText(saved.seed);
  expect(errors).toEqual([]);
});
test("phone touch, menus and rules remain usable", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Begin expedition" }).tap();
  await page.evaluate(() => window.__signal.pause(true));
  await page.screenshot({ path: "artifacts/mobile-colony.png" });
  await page.locator('[data-panel="fleet"]').tap();
  await page.locator("[data-drone]").first().tap();
  await expect(page.locator("#rules .rule")).toHaveCount(4);
  await page.locator('[data-condition="0"]').selectOption("enemy");
  await expect(page.locator('[data-condition="0"]')).toHaveValue("enemy");
  await page.screenshot({ path: "artifacts/mobile-rules.png" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await page.locator("[data-close]").tap();
  await page.locator('[data-panel="research"]').tap();
  await expect(page.locator(".tech-card")).toHaveCount(4);
  expect(errors).toEqual([]);
  await context.close();
});

test("real touch drag and two-finger pinch control the camera", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Begin expedition" }).tap();
  await page.evaluate(() => window.__signal.pause(true));
  const before = await page.evaluate(() => ({
    ...window.__signal.renderer.camera,
  }));
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([x, y, id]) => ({
        x,
        y,
        id,
        radiusX: 2,
        radiusY: 2,
      })),
    });
  await touch("touchStart", [[160, 450, 1]]);
  await touch("touchMove", [[210, 480, 1]]);
  await touch("touchEnd", []);
  const after = await page.evaluate(() => ({
    ...window.__signal.renderer.camera,
  }));
  expect(after.x).not.toBe(before.x);
  await touch("touchStart", [
    [130, 450, 1],
    [230, 450, 2],
  ]);
  await touch("touchMove", [
    [100, 450, 1],
    [260, 450, 2],
  ]);
  await touch("touchEnd", []);
  expect(
    await page.evaluate(() => window.__signal.renderer.camera.zoom),
  ).toBeGreaterThan(before.zoom);
  await context.close();
});

test("settings export and import preserve rules and state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin expedition" }).click();
  await page.evaluate(() => window.__signal.pause(true));
  await page.locator('[data-panel="program"]').click();
  await page.locator('[data-action="3"]').selectOption("explore");
  await page.locator("#settings").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = await downloadPromise;
  await file.saveAs("artifacts/browser-export.json");
  await page
    .locator("#import-file")
    .setInputFiles("artifacts/browser-export.json");
  await page.evaluate(() => window.__signal.pause(true));
  expect(
    await page.evaluate(() => window.__signal.state.drones[0].rules[3].action),
  ).toBe("explore");
  await expect(page.locator("#modal")).toBeHidden();
});

test("production game reloads and resumes entirely offline", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("button", { name: "Begin expedition" }).click();
  await page.locator("#settings").click();
  await page.locator("#save-now").click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  expect(await page.evaluate(() => typeof window.__signal)).toBe("undefined");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Continue colony" }).click();
  await expect(page.locator("#sector")).toHaveText("KEPLER-09");
  await page.locator('[data-panel="program"]').click();
  await expect(page.locator("#rules .rule")).toHaveCount(4);
  expect(errors).toEqual([]);
  await context.close();
});

test("small phone and landscape keep controls in the viewport", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const continueButton = page.getByRole("button", {
      name: "Continue colony",
    });
    if (await continueButton.isVisible()) await continueButton.click();
    else await page.getByRole("button", { name: "Begin expedition" }).click();
    await page.locator('[data-panel="build"]').click();
    await expect(page.locator(".panel-head")).toBeInViewport();
    await expect(page.locator(".dock")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
