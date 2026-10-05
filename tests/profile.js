import { newGame, tick, addDrone } from "../src/simulation.js";
import { performance } from "node:perf_hooks";
const s = newGame("PERFORMANCE");
s.tiles.forEach((t) => (t.seen = true));
while (s.drones.length < 80)
  addDrone(
    s,
    ["miner", "hauler", "builder", "combat", "explorer"][s.drones.length % 5],
  );
for (let i = 0; i < 200; i++) tick(s);
const times = [];
for (let i = 0; i < 3000; i++) {
  const start = performance.now();
  tick(s);
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      scenario:
        "48 × 48 revealed map, 80 starting drones, 3000 simulation ticks",
      runtime: process.version,
      meanMs: times.reduce((a, b) => a + b, 0) / times.length,
      p95Ms: times[Math.floor(times.length * 0.95)],
      p99Ms: times[Math.floor(times.length * 0.99)],
      maxMs: times.at(-1),
      finalDrones: s.drones.length,
      finalEnemies: s.enemies.length,
      budgetMs: 200,
    },
    null,
    2,
  ),
);
