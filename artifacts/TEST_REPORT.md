# Verification report

Verified in the Linux development environment on 2026-10-05 with Node v24.19.0 and Chromium.

## Results

- `npm test`: **20 / 20 passed**.
- `npm run test:browser`: **6 / 6 passed**.
- `npm run build`: production build succeeded; offline cache contains every production asset.
- `npm run mobile:sync`: Android and iOS native source projects synchronized successfully.
- Native XML resources and iOS launch storyboard parse successfully. This is not a native compilation test.

The simulation tests cover seeded generation, deterministic state hashing, identical save continuation, BFS obstacles, rule priority, actual cargo delivery, frontier exploration, placement/costs/construction, depot hauling, backup recovery, threats, fractional arrival, bounded production, power reachability, combat, invalid saves/commands, ally repairs, hazard damage, and deterministic onboarding.

Three complete campaigns (`KEPLER-09`, `ORION`, `EMBER-17`) reach the beacon objective through normal player commands. No free resources, research unlocks, invulnerability, forced construction completion, or enemy removal is used by the playthrough driver. The default run reached victory at tick 3157 (10m 31.4s simulated time), with 8 drones and 11 enemies defeated. The included completed save marks the tutorial as finished for inspection; world/economy results come from the simulation.

Browser tests cover:

1. Desktop launch, rule reorder, tile placement, actual engineer construction, manual save, page reload, and continuation.
2. A 390×844 phone viewport, touch controls, rule edits, fleet and research panels, and absence of horizontal overflow.
3. Real Chrome DevTools touchStart/touchMove/touchEnd gestures for drag and two-finger pinch.
4. JSON download/upload restoring edited behavior.
5. A production build loading, saving, disconnecting entirely, reloading from its service worker, and continuing with functioning rule controls. Development hooks are absent from production.
6. 320×568 and 844×390 layouts keeping panels and the toolbar in view.

Screenshots were visually inspected at desktop and phone sizes; the established colony has distinct facility geometry and role-colored drones. UI tests collect uncaught page errors. Normal and production-offline scenarios reported none.

## Profiles

### Simulation

48×48 fully revealed world, 80 starting drones, 200 warm-up ticks plus 3,000 measured ticks:

| Metric | Milliseconds per tick |
|---|---:|
| Mean | 1.494 |
| p95 | 1.902 |
| p99 | 2.936 |
| Maximum | 7.413 |
| Available fixed-step budget | 200 |

All 80 drones survived the benchmark. See `simulation-profile.txt`; reproduce with `npm run profile`.

### Canvas renderer

1440×1000 established-colony view, 240 measured draws in headless Chromium:

| Metric | Milliseconds per draw |
|---|---:|
| Mean | 2.605 |
| p95 | 4.100 |
| Maximum | 6.200 |

See `render-profile.json`. These are CPU command-submission measurements on the development machine, not physical phone frame-time or battery guarantees.

## Bugs found and fixed during testing

- Frontier selection could target an unexplored tile whose visible neighbour was an impassable cliff. Replaced distance-only frontier selection with reachable BFS discovery.
- A hauler could choose its ore pickup depot as the delivery destination. Hauler ore routes now target smelters and exclude their source.
- A fractional position within the target cell could produce an empty path before reaching the arrival radius. Added explicit final-cell movement.
- Factories could consume the entire alloy economy to accumulate unused components. Bounded output buffers and lab data production now preserve expansion resources.
- Foundry spawns could land on an adjacent cliff. New units start on the foundry apron.
- Cached static assets with a `Vary: Origin` response could miss offline module/CSS requests. Same-origin precached resource lookup now ignores Vary, verified by a full offline reload test.
- Tutorial state previously advanced in the UI refresh. It now advances from the deterministic command/tick boundary.

## Unverified

APK/IPA compilation and signing, physical Android/iOS performance, Safari/iOS audio interruption behavior, and real-device safe-area behavior. The environment has no Android SDK or Xcode. Native projects and instructions are supplied, not a claim of app-store readiness.
