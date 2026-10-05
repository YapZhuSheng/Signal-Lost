import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  newGame,
  tick,
  command,
  stock,
  serialize,
  deserialize,
  addDrone,
  placement,
} from "../src/simulation.js";
import { generate, path } from "../src/world.js";
import { save, load } from "../src/save.js";
const run = (s, n) => {
  for (let i = 0; i < n; i++) tick(s);
  return s;
};
const hash = (s) => createHash("sha256").update(serialize(s)).digest("hex");
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
    m,
  };
};
test("same seed generates identical terrain; different seed differs", () => {
  assert.deepEqual(generate("alpha"), generate("alpha"));
  assert.notDeepEqual(generate("alpha"), generate("beta"));
});
test("BFS routes around obstacles and cannot cross a sealed wall", () => {
  const s = newGame();
  s.tiles.forEach((t) => {
    t.seen = true;
    t.rock = false;
  });
  s.tiles[24 * 48 + 25].rock = true;
  const p = path(s, { x: 24, y: 24 }, { x: 26, y: 24 });
  assert.equal(p.length, 4);
  assert.ok(p.every((t) => !s.tiles[t.y * 48 + t.x].rock));
  for (let y = 0; y < 48; y++) s.tiles[y * 48 + 25].rock = true;
  assert.equal(path(s, { x: 24, y: 24 }, { x: 26, y: 24 }), null);
});
test("identical action tapes produce identical state hashes", () => {
  const a = newGame("replay"),
    b = newGame("replay");
  for (let i = 0; i < 2500; i++) {
    if (i === 10)
      for (const s of [a, b])
        assert.equal(
          command(s, { type: "build", kind: "solar", x: 22, y: 24 }),
          null,
        );
    if (i === 200)
      for (const s of [a, b])
        command(s, { type: "role", id: 3, role: "builder" });
    tick(a);
    tick(b);
  }
  assert.equal(hash(a), hash(b));
});
test("save continuation matches uninterrupted simulation", () => {
  const s = run(newGame("save"), 230);
  const copy = deserialize(serialize(s)).state;
  run(s, 1100);
  run(copy, 1100);
  assert.equal(hash(s), hash(copy));
});
test("charging wins over mining; reordering changes the decision", () => {
  const s = newGame(),
    d = s.drones[0];
  d.battery = 10;
  tick(s);
  assert.equal(d.activeRule, 0);
  command(s, {
    type: "rules",
    id: d.id,
    rules: [
      { condition: "always", action: "mine" },
      { condition: "low", action: "charge" },
    ],
  });
  tick(s);
  assert.equal(d.activeRule, 0);
  assert.equal(d.reason, "always");
});
test("ore is carried before becoming colony stock and refines at the core", () => {
  const s = newGame();
  let carried = false;
  for (let i = 0; i < 500; i++) {
    tick(s);
    if (s.drones.some((d) => d.cargo?.item === "ore")) carried = true;
  }
  assert.ok(carried);
  assert.ok(s.stats.delivered > 0);
  assert.ok(stock(s, "alloy") > 60);
  assert.ok(s.stats.mined >= s.stats.delivered);
});
test("explorer leaves the core and reveals reachable frontier", () => {
  const s = newGame(),
    before = s.tiles.filter((t) => t.seen).length;
  run(s, 400);
  assert.ok(s.tiles.filter((t) => t.seen).length > before + 60);
  assert.ok(s.drones.find((d) => d.role === "explorer").battery < 100);
});
test("blueprint charges exactly once; invalid placement costs nothing", () => {
  const s = newGame();
  assert.ok(placement(s, "solar", 24, 24));
  assert.equal(
    command(s, { type: "build", kind: "solar", x: 22, y: 24 }),
    null,
  );
  assert.equal(stock(s, "alloy"), 50);
  assert.ok(command(s, { type: "build", kind: "solar", x: 22, y: 24 }));
  assert.equal(stock(s, "alloy"), 50);
  run(s, 150);
  assert.equal(s.buildings.find((b) => b.type === "solar").progress, 100);
});
test("depot ore moves through an actual hauler to the refinery", () => {
  const s = newGame();
  s.drones = s.drones.filter((d) => d.role === "hauler");
  s.tiles.forEach((t) => (t.ore = 0));
  command(s, { type: "build", kind: "storage", x: 22, y: 24 });
  const b = s.buildings.at(-1);
  b.progress = 100;
  b.inventory.ore = 12;
  run(s, 300);
  assert.equal(b.inventory.ore, 0);
  assert.ok(stock(s, "alloy") > 52);
});
test("save uses previous valid generation if current generation is corrupt", () => {
  const store = memory(),
    s = newGame();
  save(s, {}, store);
  run(s, 100);
  save(s, {}, store);
  store.setItem("signal-lost.save.v1", "bad");
  const restored = load(store);
  assert.ok(restored.recovered);
  assert.equal(restored.state.tick, 0);
  assert.throws(() => deserialize('{"version":999}'));
});
test("industrial activity spawns distinct threats; damage is simulated", () => {
  const s = run(newGame("threats"), 2400);
  assert.ok(s.enemies.length > 0);
  assert.ok(s.events.some((e) => e.type === "warning"));
  assert.ok(s.enemies.every((e) => e.hp > 0));
});

test("arrival inside goal cell does not strand a fractional drone", () => {
  const s = newGame(),
    d = s.drones[0];
  d.x = 24.25;
  d.y = 24;
  d.battery = 5;
  s.drones = [d];
  run(s, 90);
  assert.ok(d.battery > 80);
  assert.notEqual(d.task, "Route blocked");
});
test("production buffers stop consuming resources when output is full", () => {
  const s = newGame();
  s.drones = [];
  s.tech.push("industry");
  command(s, { type: "build", kind: "factory", x: 22, y: 24 });
  const b = s.buildings.at(-1);
  b.progress = 100;
  b.inventory = { ore: 0, alloy: 12, component: 24 };
  run(s, 100);
  assert.equal(b.inventory.alloy, 12);
  assert.equal(b.inventory.component, 24);
});
test("power only reaches connected structures and brownouts shed loads", () => {
  const s = newGame();
  s.tiles.forEach((t) => {
    t.seen = true;
    t.rock = false;
    t.ore = 0;
    t.ruin = false;
    t.hazard = false;
  });
  assert.equal(command(s, { type: "build", kind: "lab", x: 3, y: 3 }), null);
  const b = s.buildings.at(-1);
  b.progress = 100;
  tick(s);
  assert.equal(b.powered, false);
  assert.equal(command(s, { type: "build", kind: "lab", x: 22, y: 24 }), null);
  s.buildings.at(-1).progress = 100;
  run(s, 5);
  assert.equal(s.buildings.at(-1).powered, true);
});
test("sentinels kill nearby threats and attacks damage the core", () => {
  const s = newGame();
  s.tech.push("defense");
  command(s, { type: "build", kind: "turret", x: 22, y: 24 });
  s.buildings.at(-1).progress = 100;
  s.enemies.push({ id: s.nextId++, x: 24, y: 24, hp: 50, kind: "swarm" });
  run(s, 10);
  assert.equal(s.enemies.length, 0);
  assert.equal(s.stats.kills, 1);
  s.enemies.push({ id: s.nextId++, x: 24, y: 24, hp: 50, kind: "swarm" });
  s.buildings = s.buildings.filter((b) => b.type !== "turret");
  run(s, 20);
  assert.ok(s.buildings[0].hp < 600);
});
test("malformed nested saves and invalid commands are rejected", () => {
  const s = newGame();
  const v = JSON.parse(serialize(s));
  v.state.drones[0].x = "invalid";
  assert.throws(() => deserialize(JSON.stringify(v)), /drone/);
  assert.ok(command(s, { type: "role", id: 2, role: "nonsense" }));
  assert.ok(
    command(s, {
      type: "rules",
      id: 2,
      rules: [{ condition: "always", action: "nonsense" }],
    }),
  );
  assert.ok(command(s, { type: "build", kind: "solar", x: NaN, y: 24 }));
});
test("complete expedition reaches orbital uplink using only normal commands", async () => {
  const { playthrough } = await import("./playthrough.js");
  for (const seed of ["KEPLER-09", "ORION", "EMBER-17"]) {
    const { s } = playthrough(seed);
    assert.equal(s.won, true, seed + " should reach signal");
    assert.ok(s.drones.length > 5);
    assert.ok(s.stats.kills > 0);
    assert.ok(s.tech.includes("signal"));
    assert.ok(s.stats.built >= 8);
    assert.doesNotThrow(() => deserialize(serialize(s)));
  }
});

test("engineer repairs an ally at a fractional position", () => {
  const s = newGame(),
    engineer = s.drones.find((d) => d.role === "builder"),
    ally = s.drones[0];
  s.drones = [engineer, ally];
  engineer.x = 24;
  engineer.y = 24;
  ally.x = 24.4;
  ally.y = 24;
  ally.hp = 40;
  ally.rules = [{ condition: "always", action: "wait" }];
  run(s, 30);
  assert.ok(ally.hp > 75);
  assert.equal(engineer.task, "Repairing ally");
});
test("environmental spores damage a stationary drone", () => {
  const s = newGame(),
    d = s.drones[0];
  s.tiles[25 * 48 + 24].hazard = true;
  d.x = 24;
  d.y = 25;
  d.rules = [{ condition: "always", action: "wait" }];
  s.drones = [d];
  run(s, 25);
  assert.equal(d.hp, 95);
});
test("onboarding progresses via tick-stamped commands, not rendering", () => {
  const s = newGame();
  command(s, { type: "inspect", id: s.drones[0].id });
  assert.equal(s.tutorial, 1);
  run(s, 250);
  assert.equal(s.tutorial, 2);
  command(s, { type: "rules", id: s.drones[0].id, rules: s.drones[0].rules });
  assert.equal(s.tutorial, 3);
  assert.ok(s.actions.some((a) => a.type === "inspect"));
});
