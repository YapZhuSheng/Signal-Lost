# Architecture

## Modules

| File | Responsibility |
|---|---|
| `src/catalog.js` | Structure/technology definitions, economy costs, role presets and rule vocabulary |
| `src/world.js` | Seed hashing, PRNG, biomes, visibility, deterministic BFS and reachable frontier discovery |
| `src/simulation.js` | Command boundary, agents, cargo, power, production, research, threats, victory/loss |
| `src/validation.js` | Nested save validation and safe settings defaults |
| `src/render.js` | Isometric projection, original procedural geometry, effects, selection, power rings, minimap |
| `src/main.js` | Application lifecycle, panels, onboarding, pointer gestures, fixed-step accumulator |
| `src/audio.js` | AudioContext, CC0 samples, synthesized state feedback and ambient bed |
| `src/save.js` | Checksummed two-generation local persistence and JSON export |
| `scripts/build-offline.js` | Content-hashed production service-worker generation |
| `android/`, `ios/` | Capacitor mobile shells |

The simulation has no DOM, Canvas, sound, wall clock, network, or localStorage dependencies. Tests run it directly in Node. The renderer consumes the current state; render animation time never feeds back into simulation.

## Deterministic update

One simulation step is **0.2 seconds**. A requestAnimationFrame accumulator applies 1×, 2×, or 3× speed; wall-clock frame deltas are clamped to 100ms to avoid a catch-up spiral. Hidden tabs do not advance. Slow devices slow simulated time rather than skipping arbitrary logic. Save/load retains tick and PRNG state.

Within each tick:

1. Recompute the power graph every five ticks, using stable building order.
2. Evaluate drones in stable ID/insertion order. The first true rule runs; decisions inspect current state, including previous drones' transfers this tick.
3. Process powered production and ongoing research.
4. Spawn seeded waves, navigate threats, apply combat/environment damage, recover archives, remove destroyed entities, and evaluate defeat.

World randomness uses a string-to-32-bit hash and a stateful integer PRNG. The simulation never calls `Math.random()` or reads wall time. Cardinal BFS neighbour order is fixed. Nearest-target ties use stable array order. Commands are applied at tick boundaries between synchronous steps and logged with their tick and payload. Reproduction requires the same code version and the same ordered command tape; JavaScript floating-point movement is deterministic in the tested runtime, but cross-engine bitwise identity is not claimed.

The tests compare SHA-256 hashes of serialized states after identical command tapes and after a save/load branch continued alongside an uninterrupted run.

## Navigation and task selection

Drones are hovering agents: they share tiles and can cross structure landing aprons. Cliffs are obstacles. Known terrain is shared colony knowledge. A BFS returns a cardinal path through known clear cells, with one unknown frontier endpoint permitted for exploration. Explorers choose a **reachable** frontier using a flood search, rather than a Euclidean nearest unexplored tile hidden behind rocks.

Paths are cached on agents until the goal changes or the path ends. Mining destinations persist until exhausted. An explicit same-cell arrival case prevents fractional positions from being stranded when rounding yields the destination cell. Enemies use the same geometry with visibility restrictions disabled, and replan as targets move.

Coordinates, battery, health, cargo, rules, active rule, current task, path, targets, and cooldowns are inspectable state. The UI shows the actual matched predicate, not a scripted explanation. A role is a preset; rules can override it.

## Logistics and manufacturing

Mining decrements a deposit and creates cargo on a drone. Delivery removes that cargo and increments one building's inventory. Haulers withdraw from local outputs and retain an intended destination; if it becomes unavailable, they select another compatible recipient. They never deposit ore back into the depot from which it was withdrawn.

Smelting, fabrication, and research consume inputs from that building only. Components remain physical items until withdrawn at a foundry or beacon. Output/input buffers limit overproduction, while construction reserves alloy from colony stocks immediately. This avoids a separate builder-kit recipe in the short campaign; it is an explicit economy abstraction, not a hidden teleport in the ore/production chain.

Supply and demand are integer power units. Connected generators contribute supply; stable-order loads are enabled while capacity lasts. A brownout does not sever the physical conduit through a structure. A blueprint gets no power until complete.

## Persistence

Versioned JSON stores the seeded world *and its current depletion/reveal state*, simulation tick, PRNG, entities, inventories, rules, research, goals, cooldowns, statistics, tutorial, command history, and settings. Paths are small and deliberately retained because recomputing a path from a fractional position could alter exact continuation. Renderer objects, audio buffers, particle geometry, UI DOM, camera animation, and wall-clock accumulator are reconstructed, not serialized.

The save writer validates the new envelope before committing. It preserves the previous valid primary as backup, then atomically replaces the primary localStorage value. Validation checks identity uniqueness, dimensions, numeric bounds, cargo, rules, inventories, and progression. Unknown format versions are rejected; migrations should run before validation when introduced. Exports are plain versioned JSON for portability; local envelopes add checksums for integrity, not encryption/security.

## Performance

The map has 2,304 tiles. The renderer culls offscreen tiles, caps device pixel ratio at 2, sorts visible entities by depth, and derives brief effects from a bounded event ring (30 events), avoiding unbounded particle allocation. Panels and minimap update at 5 Hz; rendering runs at display cadence, with visual interpolation between agent positions to smooth the 5 Hz simulation. Rules are capped at eight per drone. Paths are cached. Simulation runs at 5 Hz independently of render frames.

At this scale, linear stable scans were kept over additional spatial indexing: the measured 80-drone workload is comfortably below the 200ms simulation budget. Measurements and reproduction commands are recorded in `artifacts/TEST_REPORT.md`. If expanding beyond the caps, spatial buckets for threat sensors and cargo availability would be the next useful optimization; worker migration would require a tick-stamped command queue.

## Design choices

- Browser + Capacitor was selected for immediate playability, small download size, inspectable source, touch support, and Android/iOS packaging.
- Procedural low-poly-style Canvas art gives consistent biomes, buildings, drone roles, and effects without large or uncertain asset licenses.
- Repair and construction share the engineer role. The combat system is autonomous and complements rule design.
- A compact orbital-uplink campaign supplies a concrete win condition; the colony remains a sandbox afterward.
- This release does not include infinite-world streaming, multiplayer, asynchronous offline progression, user-authored code, or a general node-graph language.
