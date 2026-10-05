# SIGNAL//LOST

A complete, small single-player automation-survival game for touchscreens and browsers. Crash-land, program a fleet, build a working production chain, defend the colony, and restore the orbital signal. A successful expedition takes roughly 10–25 minutes; the colony remains playable afterward.

## Play / run

Requires Node.js **22.12+** (tested with 24.19) and npm. No account, backend, API keys, or paid assets.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. On a phone on the same network, use your development machine's LAN IP and port 5173. The welcome screen lets you enter a seed or continue a saved colony.

For an optimized, installable, offline build:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173**. Deploy the contents of `dist/` to the **root** of any HTTPS static host. HTTPS (or localhost) is required for offline installation. After the first successful online load, the production service worker caches the entire game. Android: browser menu → Install app. iPhone: Safari → Share → Add to Home Screen. Do not open `index.html` with `file://`.

An already-built `dist/` is included in the deliverable. Android and iOS native projects are included too; see [MOBILE.md](MOBILE.md).

## Play a colony

1. Inspect a drone. Its highlighted rule explains its current decision. Rules run **top to bottom**, first matching condition wins.
2. Miners extract six ore into their cargo holds. They physically carry it to the core, a refinery, or a depot. Keep `Carrying cargo → Deliver cargo` above mining.
3. The core smelts **2 ore → 1 alloy** every three seconds. Construct a solar array and research lab near the core. An engineer travels to assemble each blueprint.
4. A hauler supplies alloy to the lab. **1 alloy → 2 research data**. Explorers also recover 10 data from archives. Research Industrial systems.
5. Add a fabricator and foundry, plus solar capacity. Haulers supply the chain: **3 alloy → 1 component**, **3 delivered components → 1 new drone**. Assemble drones in Fleet.
6. Research Adaptive defense and build sentinels. Hostile waves begin after four simulation minutes, grow over time, and increase with power demand. Swarms attack powered structures; stalkers hunt drones. Engineers repair structures and nearby allies. Charging also repairs a drone.
7. Research Orbital uplink. Build a beacon, provide power, and deliver **10 components** to restore the signal. Continue growing afterward.

The interactive mission panel teaches these steps. The starting fleet has two miners, a hauler, an explorer, and an engineer. Any drone can change role; role presets replace its rules. Combat drones are programmable from the beginning; defense research unlocks automated towers.

### Automation examples

- **Reliable miner:** battery low → charge; threat nearby → retreat; carrying cargo → deliver; no higher priority task → mine.
- **Supply drone:** the same first three rules, then transport goods. It chooses a source with a usable destination and carries each batch.
- **Field defender:** battery low → charge; ally under attack → defend; no higher priority task → defend. The ally condition requires Conditional intelligence.
- **Reserve capacity:** storage full → hold position above mining, but below charging/delivery. This condition measures colony ore buffers above 150 units.

Dragging a work rule above charging can strand a drone; putting mining above delivery fills its cargo and stops it. Use the live decision display to diagnose such problems. A depleted unit has a very slow emergency trickle recovery. Low-battery charging has hysteresis: once docked, it charges to 96% before returning to work.

### Economy and power

- Ore, alloy, and components exist in drone cargo or building inventories. The header totals **building inventories only**, not cargo in transit.
- Cargo depots and mining rigs need haulers. A miner can deliver to a local depot; a hauler takes that ore to a core/refinery.
- Fabricators pause at 24 output components. Labs stop at 120 data or when every technology is unlocked, preventing endless resource consumption. Ruin data may exceed the lab's cap.
- A structure connects when it is inside a powered structure's network range. Relays extend range; arrays increase generation. Load shedding follows construction order. Power coverage is available with the lightning button.
- Building alloy costs are reserved immediately from colony stocks as prefabricated kits; engineers carry out the construction. This is the deliberate abstraction in an otherwise physical production chain.
- The outer grove and scar regions contain more hazards and distant resources. Spore fields damage units; cliffs obstruct navigation. Explored terrain stays visible, but drones work from shared discoveries rather than unknown deposits.
- Losing the core ends the expedition. Losing every drone also ends it unless a powered foundry can assemble a replacement.

## Controls

| Action | Touch | Mouse / keyboard |
|---|---|---|
| Inspect | Tap drone, building, or resource | Click |
| Pan | Drag world | Drag world |
| Zoom | Pinch / + and − | Wheel / + and − buttons |
| Jump camera | Tap minimap | Click minimap |
| Center core | Home icon | H |
| Build | Build → structure → tile → Place blueprint | B |
| Program | Tap drone → edit conditions/actions | P |
| Rule priority | Up/down arrows | Up/down buttons |
| Research / log | Bottom toolbar | R / L |
| Pause | Top pause button | Space |
| Simulation speed | 1× / 2× / 3× control | Same |
| Cancel / close | Cancel / × | Escape |

## Saves

Autosave runs every **30 simulation seconds**, on page hide, and when starting/importing an expedition. Settings offers manual save, JSON export, and import. Primary and previous-generation saves have checksums. Loading falls back to the previous valid generation after corruption. Imports receive nested schema validation before replacing the game. New-expedition confirmation allows exporting the existing colony first.

Saves are local to the browser/app origin. Clearing browser/app data deletes them. Export before uninstalling, changing hosts, or switching devices. The format is explicitly versioned; future migrations can be added at `deserialize()`. Version 1 rejects unknown versions instead of guessing. No offline progression occurs while the game is closed or hidden.

## Architecture / dependencies

See [ARCHITECTURE.md](ARCHITECTURE.md) for update order, determinism, navigation, performance, and limitations.

- **Canvas 2D:** original isometric world renderer, no external game engine.
- **DOM/CSS:** responsive native controls and bottom-sheet menus.
- **Vite 7:** development server and optimized static build.
- **Capacitor 8:** Android/iOS packaging; no native plugins or network services required.
- **Node test runner:** deterministic simulation / gameplay tests.
- **Playwright:** browser, phone touch, persistence, and offline integration tests.
- **Prettier:** source formatting.

`package-lock.json` records exact dependency versions. All game code is JavaScript ES modules. Fonts use the operating system stack. No third-party font CDN or runtime asset service is required.

## Tests and inspection

```sh
npm test                 # simulation tests, deterministic replay, save continuation, 3 complete campaigns
npm run test:browser     # desktop + mobile + touch + export/import + production offline tests
npm run profile          # 80-agent simulation profile
npm run test:campaign    # full default-seed campaign trace
npm run build
```

Browser tests automatically run development and production servers. If Chromium is not installed, run `npx playwright install chromium`; alternatively set `CHROMIUM_PATH` to a Chromium executable. Linux may require `npx playwright install-deps chromium`.

Screenshots, measured profiles, a completed expedition save, and test results are in `artifacts/`. Import `artifacts/completed-expedition.json` in Settings to inspect the colony produced by the automated playthrough. `scripts/inspect-browser.js` reproduces screenshots against the running dev server.

## Credits / licensing

Original procedural visuals, icon, and synthesized ambient audio were created for this project. Kenney's Interface Sounds samples are CC0. See [ASSET_CREDITS.md](ASSET_CREDITS.md), the included upstream license, and [LICENSE](LICENSE). Dependency licenses remain with their packages.

## Scope and limitations

This is a compact, finished single-expedition game, not an unlimited commercial content library. It has a 48×48 world, 80-drone and 96-structure caps, five combined roles (engineer includes repair), four research technologies, two enemy behaviors, and one victory objective. Structures expose traversable drone landing aprons rather than blocking flight; cliffs block navigation. There is no multiplayer, cloud sync, terrain editing, demolition, or offline time advancement. Action logs preserve player commands, but there is no replay UI.

Native projects have been generated and synced, but **APK/IPA compilation, signing, physical-device performance, and iOS Safari behavior have not been verified in this Linux environment**. Browser mobile emulation and real dispatched touch gestures were tested in Chromium. Performance numbers are server measurements, not promises for all phones. See MOBILE.md for native build requirements.
