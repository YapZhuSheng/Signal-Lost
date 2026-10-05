import { newGame, tick, command, placement, stock } from "../src/simulation.js";
import { STRUCTURES, TECH } from "../src/catalog.js";
export function playthrough(seed = "KEPLER-09", maxTicks = 16000) {
  const s = newGame(seed),
    history = [];
  let stage = 0;
  const built = (k) => s.buildings.some((b) => b.type === k),
    complete = (k) =>
      s.buildings.some((b) => b.type === k && b.progress === 100);
  const build = (k) => {
    const sites = s.tiles
      .filter(
        (t) => Math.hypot(t.x - 24, t.y - 24) < 7 && !placement(s, k, t.x, t.y),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - 24, a.y - 24) - Math.hypot(b.x - 24, b.y - 24),
      );
    if (!sites.length) return false;
    const p = sites[0];
    return !command(s, { type: "build", kind: k, x: p.x, y: p.y });
  };
  for (let i = 0; i < maxTicks && !s.won && !s.lost; i++) {
    if (i % 25 === 0) {
      if (!built("solar")) build("solar");
      else if (!built("lab")) build("lab");
      else if (!s.tech.includes("industry") && !s.research && s.data >= 12)
        command(s, { type: "research", key: "industry" });
      else if (s.tech.includes("industry") && !built("factory"))
        build("factory");
      else if (s.tech.includes("industry") && !built("bay")) build("bay");
      else if (
        s.power - s.demand < 7 &&
        s.buildings.filter((b) => b.type === "solar").length < 5
      )
        build("solar");
      else if (!s.tech.includes("defense") && !s.research && s.data >= 18)
        command(s, { type: "research", key: "defense" });
      else if (
        s.tech.includes("defense") &&
        s.buildings.filter((b) => b.type === "turret").length < 3
      )
        build("turret");
      else if (!built("refinery")) build("refinery");
      else if (
        !s.tech.includes("signal") &&
        s.tech.includes("defense") &&
        !s.research &&
        s.data >= 40
      )
        command(s, { type: "research", key: "signal" });
      else if (s.tech.includes("signal") && !built("beacon")) build("beacon");
      if (complete("bay") && s.drones.length < 8)
        command(s, {
          type: "drone",
          role:
            s.drones.filter((d) => d.role === "hauler").length < 2
              ? "hauler"
              : "combat",
        });
    }
    tick(s);
    if (i % 1000 === 0)
      history.push({
        tick: s.tick,
        stock: ["ore", "alloy", "component"].map((k) => stock(s, k)),
        data: s.data,
        tech: s.tech.slice(),
        buildings: s.buildings.map((b) => [
          b.type,
          b.progress,
          b.powered,
          structuredClone(b.inventory),
        ]),
        drones: s.drones.map((d) => [d.role, d.task, Math.round(d.hp)]),
        enemies: s.enemies.length,
      });
  }
  return { s, history };
}
if (process.argv[1]?.endsWith("playthrough.js")) {
  const { s, history } = playthrough();
  console.log(
    JSON.stringify(
      { won: s.won, lost: s.lost, tick: s.tick, history },
      null,
      2,
    ),
  );
  if (!s.won) process.exitCode = 1;
}
