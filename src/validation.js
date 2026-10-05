import {
  SIZE,
  STRUCTURES,
  TECH,
  CONDITIONS,
  ACTIONS,
  ROLES,
} from "./catalog.js";
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const position = (o) => finite(o.x, 0, SIZE - 1) && finite(o.y, 0, SIZE - 1);
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
function check(ok, field) {
  if (!ok) throw Error(`Invalid save: ${field}`);
}
export function validateState(s) {
  check(s && s.version === 1, "state version");
  check(typeof s.seed === "string" && s.seed.length <= 32, "seed");
  check(
    integer(s.tick, 0, 1e12) &&
      integer(s.rng, 0, 0xffffffff) &&
      integer(s.nextId, 1, 1e8),
    "simulation clock",
  );
  check(Array.isArray(s.tiles) && s.tiles.length === SIZE * SIZE, "terrain");
  s.tiles.forEach((t, i) =>
    check(
      t &&
        t.x === i % SIZE &&
        t.y === Math.floor(i / SIZE) &&
        finite(t.ore, 0, 1e6) &&
        finite(t.shade, 0, 1) &&
        ["basalt", "grove", "scar"].includes(t.biome) &&
        typeof t.seen === "boolean" &&
        typeof t.rock === "boolean",
      "terrain tile",
    ),
  );
  check(
    Array.isArray(s.buildings) && s.buildings.length <= SIZE * SIZE,
    "buildings",
  );
  check(s.lost || s.buildings.some((b) => b.type === "hub"), "landing core");
  for (const b of s.buildings) {
    check(
      Object.hasOwn(STRUCTURES, b.type) &&
        position(b) &&
        finite(b.hp, 0, 600) &&
        finite(b.progress, 0, 100) &&
        finite(b.work, 0, 1e12),
      "structure",
    );
    check(
      b.inventory &&
        ["ore", "alloy", "component"].every((k) =>
          integer(b.inventory[k], 0, 1e9),
        ),
      "inventory",
    );
  }
  check(Array.isArray(s.drones) && s.drones.length <= 80, "fleet");
  for (const d of s.drones) {
    check(
      Object.hasOwn(ROLES, d.role) &&
        position(d) &&
        finite(d.hp, 0, 100) &&
        finite(d.battery, 0, 100) &&
        finite(d.cooldown, 0, 100),
      "drone",
    );
    check(
      Array.isArray(d.rules) &&
        d.rules.length <= 8 &&
        d.rules.every(
          (r) =>
            r &&
            Object.hasOwn(CONDITIONS, r.condition) &&
            Object.hasOwn(ACTIONS, r.action),
        ),
      "rules",
    );
    check(
      d.cargo === null ||
        (d.cargo &&
          ["ore", "alloy", "component"].includes(d.cargo.item) &&
          integer(d.cargo.amount, 1, 6)),
      "cargo",
    );
    check(
      Array.isArray(d.path) &&
        d.path.length <= SIZE * SIZE &&
        d.path.every(position),
      "navigation",
    );
  }
  check(
    Array.isArray(s.enemies) &&
      s.enemies.length <= 1000 &&
      s.enemies.every(
        (e) =>
          position(e) &&
          finite(e.hp, 0, 100) &&
          ["swarm", "stalker"].includes(e.kind) &&
          (!e.path || (Array.isArray(e.path) && e.path.every(position))),
      ),
    "threats",
  );
  const ids = [...s.buildings, ...s.drones, ...s.enemies].map((o) => o.id);
  check(
    ids.every((id) => integer(id, 1, s.nextId - 1)) &&
      new Set(ids).size === ids.length,
    "entity identities",
  );
  check(
    Array.isArray(s.tech) &&
      s.tech.every((k) => Object.hasOwn(TECH, k)) &&
      new Set(s.tech).size === s.tech.length,
    "technology",
  );
  check(
    s.research === null ||
      (s.research &&
        Object.hasOwn(TECH, s.research.key) &&
        finite(s.research.progress, 0, 100)),
    "research",
  );
  check(
    finite(s.data, 0, 1e9) &&
      finite(s.power, 0, 1e6) &&
      finite(s.demand, 0, 1e6) &&
      integer(s.tutorial, 0, 6),
    "progress",
  );
  check(
    s.stats &&
      ["mined", "delivered", "built", "kills"].every((k) =>
        integer(s.stats[k], 0, 1e12),
      ),
    "statistics",
  );
  check(
    Array.isArray(s.events) &&
      s.events.length <= 30 &&
      s.events.every(
        (e) =>
          typeof e.text === "string" &&
          e.text.length < 500 &&
          [
            "info",
            "build",
            "delivery",
            "mine",
            "combat",
            "warning",
            "research",
          ].includes(e.type) &&
          finite(e.tick, 0, s.tick) &&
          position(e),
      ),
    "event log",
  );
  check(Array.isArray(s.actions) && s.actions.length < 100000, "action log");
  return s;
}
export function validateSettings(raw = {}) {
  return {
    volume: finite(raw.volume, 0, 1) ? raw.volume : 0.6,
    music: finite(raw.music, 0, 1) ? raw.music : 0.35,
    reducedMotion: !!raw.reducedMotion,
  };
}
