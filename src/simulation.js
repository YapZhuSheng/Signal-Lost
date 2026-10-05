import { validateState, validateSettings } from "./validation.js";
import {
  SIZE,
  STEP,
  STRUCTURES,
  TECH,
  rules,
  CONDITIONS,
  ACTIONS,
  ROLES,
} from "./catalog.js";
import { generate, random, distance, reveal, path, frontier } from "./world.js";
export const stock = (s, item) =>
  s.buildings.reduce((n, b) => n + (b.inventory[item] || 0), 0);
export function event(s, text, type = "info", x = 24, y = 24) {
  s.events.push({ tick: s.tick, text, type, x, y });
  if (s.events.length > 30) s.events.shift();
}
export function addDrone(s, role, x = 24, y = 25) {
  const d = {
    id: s.nextId++,
    role,
    x,
    y,
    hp: 100,
    battery: 100,
    cargo: null,
    rules: rules(role),
    task: "Initializing",
    reason: "",
    activeRule: -1,
    path: [],
    goal: null,
    cooldown: 0,
  };
  s.drones.push(d);
  return d;
}
export function newGame(seed = "KEPLER-09") {
  const w = generate(seed),
    s = {
      version: 1,
      seed,
      ...w,
      tick: 0,
      nextId: 1,
      buildings: [],
      drones: [],
      enemies: [],
      events: [],
      tech: [],
      data: 0,
      research: null,
      power: 0,
      demand: 0,
      tutorial: 0,
      stats: { mined: 0, delivered: 0, built: 0, kills: 0 },
      won: false,
      lost: false,
      actions: [],
    };
  s.buildings.push({
    id: s.nextId++,
    type: "hub",
    x: 24,
    y: 24,
    hp: 600,
    progress: 100,
    inventory: { ore: 0, alloy: 60, component: 0 },
    powered: true,
    work: 0,
  });
  for (const role of ["miner", "miner", "hauler", "explorer", "builder"])
    addDrone(
      s,
      role,
      24 + (s.drones.length % 3),
      25 + Math.floor(s.drones.length / 3),
    );
  event(s, "Landing complete. Five drones await your signal.");
  return s;
}
function spend(s, item, count) {
  if (stock(s, item) < count) return false;
  for (const b of s.buildings) {
    const n = Math.min(count, b.inventory[item] || 0);
    b.inventory[item] = (b.inventory[item] || 0) - n;
    count -= n;
  }
  return true;
}
export function placement(s, type, x, y) {
  const def = STRUCTURES[type],
    t = s.tiles[y * SIZE + x];
  if (!Object.hasOwn(STRUCTURES, type) || type === "hub")
    return "Invalid structure";
  if (s.buildings.length >= 96) return "Colony structure limit: 96";
  if (!t || x < 0 || y < 0 || x >= SIZE || y >= SIZE || !t.seen)
    return "Explore this sector first";
  if (t.rock || t.hazard || t.ore || t.ruin) return "Requires clear terrain";
  if (s.buildings.some((b) => distance(b, { x, y }) < 1.5))
    return "Too close to another structure";
  if (def.tech && !s.tech.includes(def.tech)) return "Research required";
  if (stock(s, "alloy") < def.cost) return "Not enough alloy";
  return null;
}
export function command(s, a) {
  let error = null;
  if (!a || typeof a !== "object") return "Invalid command";
  if (a.type === "build" && (!Number.isInteger(a.x) || !Number.isInteger(a.y)))
    return "Choose a map tile";
  if (a.type === "role" || a.type === "drone") {
    if (!Object.hasOwn(ROLES, a.role)) return "Unknown drone role";
  }
  if (a.type === "rules") {
    if (
      !Array.isArray(a.rules) ||
      a.rules.length > 8 ||
      a.rules.some(
        (r) =>
          !r ||
          !Object.hasOwn(CONDITIONS, r.condition) ||
          !Object.hasOwn(ACTIONS, r.action),
      )
    )
      return "Invalid behavior stack";
    if (
      a.rules.some((r) => ["hurt", "full", "ally"].includes(r.condition)) &&
      !s.tech.includes("logic")
    )
      return "Research Conditional intelligence first";
  }
  if (a.type === "build") {
    error = placement(s, a.kind, a.x, a.y);
    if (!error) {
      spend(s, "alloy", STRUCTURES[a.kind].cost);
      s.buildings.push({
        id: s.nextId++,
        type: a.kind,
        x: a.x,
        y: a.y,
        hp: 200,
        progress: 0,
        inventory: { ore: 0, alloy: 0, component: 0 },
        powered: false,
        work: 0,
      });
      event(s, "Blueprint placed. Engineer dispatched.", "build", a.x, a.y);
    }
  } else if (a.type === "rules") {
    const d = s.drones.find((d) => d.id === a.id);
    if (d) {
      s.programmed = true;
      d.rules = structuredClone(a.rules);
      d.goal = null;
      d.path = [];
    }
  } else if (a.type === "role") {
    const d = s.drones.find((d) => d.id === a.id);
    if (d) {
      d.role = a.role;
      d.rules = rules(a.role);
      d.goal = null;
      d.path = [];
    }
  } else if (a.type === "research") {
    const t = TECH[a.key];
    if (!Object.hasOwn(TECH, a.key) || s.tech.includes(a.key) || s.research)
      error = "Research unavailable";
    else if (t.requires && !s.tech.includes(t.requires))
      error = "Requires industrial systems";
    else if (
      !s.buildings.some(
        (b) => b.type === "lab" && b.progress === 100 && b.powered,
      )
    )
      error = "Build a powered research lab";
    else if (s.data < t.cost) error = "Need more research data";
    else {
      s.data -= t.cost;
      s.research = { key: a.key, progress: 0 };
    }
  } else if (a.type === "drone") {
    const b = s.buildings.find(
      (b) =>
        b.type === "bay" &&
        b.powered &&
        b.progress === 100 &&
        (b.inventory.component || 0) >= 3,
    );
    if (!b) error = "Foundry needs power and 3 delivered components";
    else if (s.drones.length >= 80) error = "Fleet limit: 80";
    else {
      b.inventory.component -= 3;
      addDrone(s, a.role, b.x, b.y);
      event(s, "New drone online.", "research", b.x, b.y);
    }
  }
  if (a.type === "inspect") {
    if (s.drones.some((d) => d.id === a.id)) {
      if (s.tutorial === 0) s.tutorial = 1;
    } else error = "Unknown drone";
  }
  if (
    !["build", "rules", "role", "research", "drone", "inspect"].includes(a.type)
  )
    return "Unknown command";
  if (!error) {
    s.actions.push({ tick: s.tick, ...structuredClone(a) });
    updateObjectives(s);
  }
  return error;
}
function nearest(d, arr) {
  let best = null,
    dist = Infinity;
  for (const a of arr) {
    const n = distance(d, a);
    if (n < dist) {
      best = a;
      dist = n;
    }
  }
  return best;
}
function move(s, d, target) {
  if (distance(d, target) < 0.18) return true;
  const key = `${Math.round(target.x)},${Math.round(target.y)}`;
  if (d.goal !== key || !d.path?.length) {
    d.goal = key;
    d.path = path(s, d, target) || [];
  }
  const p =
    d.path[0] ||
    (Math.round(d.x) === Math.round(target.x) &&
    Math.round(d.y) === Math.round(target.y)
      ? { x: Math.round(target.x), y: Math.round(target.y) }
      : null);
  if (!p) {
    d.task = "Route blocked";
    return false;
  }
  const n = distance(d, p),
    speed = d.role === "explorer" ? 0.29 : 0.22;
  if (n <= speed) {
    d.x = p.x;
    d.y = p.y;
    d.path.shift();
  } else {
    d.x += ((p.x - d.x) / n) * speed;
    d.y += ((p.y - d.y) / n) * speed;
  }
  d.battery = Math.max(0, d.battery - 0.035);
  return distance(d, target) < 0.18;
}
function network(s) {
  for (const b of s.buildings) b.powered = false;
  const core = s.buildings.find((b) => b.type === "hub");
  if (!core) return;
  core.powered = true;
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of s.buildings)
      if (
        !b.powered &&
        b.progress === 100 &&
        s.buildings.some(
          (a) =>
            a.powered &&
            STRUCTURES[a.type].range > 0 &&
            distance(a, b) <= STRUCTURES[a.type].range,
        )
      ) {
        b.powered = true;
        changed = true;
      }
  }
  s.power = s.buildings
    .filter((b) => b.powered)
    .reduce((n, b) => n + Math.max(0, STRUCTURES[b.type].power), 0);
  s.demand = 0;
  for (const b of s.buildings)
    if (b.powered) {
      const need = Math.max(0, -STRUCTURES[b.type].power);
      if (s.demand + need > s.power) b.powered = false;
      else s.demand += need;
    }
}
function condition(s, d, c) {
  return (
    c === "always" ||
    (c === "low" &&
      (d.battery < 25 || (d.task === "Charging" && d.battery < 96))) ||
    (c === "cargo" && !!d.cargo) ||
    (c === "hurt" && d.hp < 60) ||
    (c === "enemy" && s.enemies.some((e) => distance(d, e) < 5)) ||
    (c === "full" && stock(s, "ore") > 150) ||
    (c === "ally" &&
      s.drones.some(
        (a) =>
          a.lastHit != null && s.tick - a.lastHit < 25 && distance(a, d) < 7,
      ))
  );
}
function recipient(s, d, item, exclude = null) {
  const target = d.cargo?.destination;
  const candidates = s.buildings.filter(
    (b) =>
      b.id !== exclude &&
      b.progress === 100 &&
      !(b.type === "lab" && (s.data >= 120 || s.tech.length === 4)) &&
      (item === "ore"
        ? (d.role === "hauler"
            ? ["hub", "refinery"]
            : ["hub", "refinery", "storage"]
          ).includes(b.type)
        : item === "alloy"
          ? ["factory", "lab"].includes(b.type)
          : ["bay", "beacon"].includes(b.type)) &&
      (b.inventory[item] || 0) <
        (item === "ore"
          ? 80
          : b.type === "lab"
            ? 6
            : b.type === "bay"
              ? 6
              : 20),
  );
  return candidates.find((b) => b.id === target) || nearest(d, candidates);
}
function droneTick(s, d) {
  if (d.hp <= 0) return;
  d.cooldown = Math.max(0, d.cooldown - 1);
  reveal(s, d.x, d.y, d.role === "explorer" ? 6 : 3);
  const i = d.rules.findIndex((r) => condition(s, d, r.condition));
  d.activeRule = i;
  const r = d.rules[i];
  if (!r) {
    d.task = "No matching rule";
    return;
  }
  d.reason = r.condition;
  const action = r.action;
  d.task = action;
  if (d.battery <= 0 && action !== "charge") {
    d.task = "Emergency recharge";
    d.battery += 0.1;
    return;
  }
  if (action === "charge" || action === "retreat") {
    const b = nearest(
      d,
      s.buildings.filter(
        (b) =>
          b.powered &&
          b.progress === 100 &&
          ["hub", "charger"].includes(b.type),
      ),
    );
    if (b && move(s, d, b)) {
      d.task = "Charging";
      d.battery = Math.min(100, d.battery + 1.5);
      d.hp = Math.min(100, d.hp + 0.4);
    }
    return;
  }
  if (action === "deliver") {
    if (!d.cargo) return;
    const b = recipient(s, d, d.cargo.item);
    if (!b) {
      d.task = "No cargo destination";
      return;
    }
    if (move(s, d, b)) {
      b.inventory[d.cargo.item] =
        (b.inventory[d.cargo.item] || 0) + d.cargo.amount;
      s.stats.delivered += d.cargo.amount;
      event(
        s,
        `${d.cargo.amount} ${d.cargo.item} delivered`,
        "delivery",
        b.x,
        b.y,
      );
      d.cargo = null;
    }
    return;
  }
  if (action === "mine") {
    if (d.cargo) {
      d.task = "Cargo full · add delivery rule";
      return;
    }
    let t = d.mineTarget != null ? s.tiles[d.mineTarget] : null;
    if (!t || !t.ore) {
      const deposits = s.tiles
        .filter((t) => t.seen && t.ore > 0 && !t.rock)
        .sort((a, b) => distance(d, a) - distance(d, b));
      t = deposits.find((t) => path(s, d, t) !== null);
      d.mineTarget = t ? t.y * SIZE + t.x : null;
    }
    if (t && move(s, d, t)) {
      if (!d.cooldown) {
        const amount = Math.min(6, t.ore);
        t.ore -= amount;
        d.cargo = { item: "ore", amount };
        s.stats.mined += amount;
        d.cooldown = 10;
        d.battery -= 1;
        event(s, "Ore extracted", "mine", d.x, d.y);
      }
    } else if (!t) d.task = "No known ore · explore";
    return;
  }
  if (action === "haul") {
    if (d.cargo) return;
    const candidates = [];
    for (const b of s.buildings.filter((b) => b.progress === 100))
      for (const item of ["component", "alloy", "ore"])
        if (
          (b.inventory[item] || 0) > 0 &&
          (item === "ore"
            ? ["storage", "mine"].includes(b.type)
            : item === "alloy"
              ? ["hub", "refinery"].includes(b.type)
              : b.type === "factory")
        ) {
          const dest = recipient(s, d, item, b.id);
          if (dest && dest.id !== b.id)
            candidates.push({ b, item, destination: dest.id });
        }
    const b = nearest(
      d,
      candidates.map((c) => c.b),
    );
    const job = candidates.find((c) => c.b === b);
    if (job && move(s, d, b)) {
      const amount = Math.min(6, b.inventory[job.item]);
      b.inventory[job.item] -= amount;
      d.cargo = { item: job.item, amount, destination: job.destination };
    } else if (!job) d.task = "Waiting for logistics";
    return;
  }
  if (action === "build") {
    const ally = nearest(
      d,
      s.drones.filter((a) => a.id !== d.id && a.hp < 95),
    );
    if (ally && distance(d, ally) < 6) {
      if (distance(d, ally) < 0.8 || move(s, d, ally)) {
        ally.hp = Math.min(100, ally.hp + 1.5);
        d.battery = Math.max(0, d.battery - 0.04);
        d.task = "Repairing ally";
      }
      return;
    }
    const b = nearest(
      d,
      s.buildings.filter(
        (b) => b.progress < 100 || b.hp < (b.type === "hub" ? 600 : 200),
      ),
    );
    if (b && move(s, d, b)) {
      if (b.progress < 100) {
        b.progress = Math.min(100, b.progress + 2);
        if (b.progress === 100) {
          s.stats.built++;
          event(s, `${STRUCTURES[b.type].name} online`, "build", b.x, b.y);
        }
      } else b.hp = Math.min(b.type === "hub" ? 600 : 200, b.hp + 2);
      d.battery = Math.max(0, d.battery - 0.03);
    } else if (!b) {
      d.task = "Standing by · repairs ready";
      d.battery = Math.min(100, d.battery + 0.02);
    }
    return;
  }
  if (action === "explore") {
    let t = d.exploreTarget && s.tiles[d.exploreTarget];
    if (!t || t.seen) {
      t = frontier(s, d);
      d.exploreTarget = t ? t.y * SIZE + t.x : null;
    }
    if (t) move(s, d, t);
    else d.task = "Planet mapped";
    return;
  }
  if (action === "fight") {
    const e = nearest(
      d,
      s.enemies.filter(
        (e) => s.tiles[Math.round(e.y) * SIZE + Math.round(e.x)]?.seen,
      ),
    );
    if (e) {
      if (distance(d, e) < 4) {
        if (!d.cooldown) {
          e.hp -= 18;
          d.cooldown = 5;
          d.battery = Math.max(0, d.battery - 0.3);
          event(s, "Pulse fired", "combat", e.x, e.y);
        }
      } else move(s, d, e);
    } else d.task = "Patrolling · no threats";
  }
}
function production(s) {
  for (const b of s.buildings) {
    if (b.progress < 100 || !b.powered) continue;
    b.work++;
    const inv = b.inventory;
    if (
      ["hub", "refinery"].includes(b.type) &&
      b.work % 15 === 0 &&
      inv.ore >= 2 &&
      inv.alloy < 200
    ) {
      inv.ore -= 2;
      inv.alloy++;
    }
    if (
      b.type === "factory" &&
      b.work % 25 === 0 &&
      inv.alloy >= 3 &&
      inv.component < 24
    ) {
      inv.alloy -= 3;
      inv.component++;
    }
    if (
      b.type === "lab" &&
      b.work % 15 === 0 &&
      inv.alloy >= 1 &&
      s.data < 120 &&
      s.tech.length < 4
    ) {
      inv.alloy--;
      s.data += 2;
    }
    if (b.type === "mine" && b.work % 20 === 0 && inv.ore < 60) {
      const t = nearest(
        b,
        s.tiles.filter((t) => t.ore > 0 && distance(t, b) < 4),
      );
      if (t) {
        const n = Math.min(4, t.ore);
        t.ore -= n;
        inv.ore += n;
        s.stats.mined += n;
      }
    }
    if (b.type === "turret" && b.work % 5 === 0) {
      const e = nearest(b, s.enemies);
      if (e && distance(b, e) < 6) {
        e.hp -= 25;
        event(s, "Sentinel pulse", "combat", e.x, e.y);
      }
    }
    if (b.type === "beacon" && inv.component >= 10 && !s.won) {
      inv.component -= 10;
      s.won = true;
      event(
        s,
        "SIGNAL RESTORED. Orbit has your coordinates.",
        "research",
        b.x,
        b.y,
      );
    }
  }
  if (s.research && s.buildings.some((b) => b.type === "lab" && b.powered)) {
    s.research.progress += 0.5;
    if (s.research.progress >= 100) {
      s.tech.push(s.research.key);
      event(s, `${TECH[s.research.key].name} unlocked`, "research");
      s.research = null;
    }
  }
}
function threats(s) {
  if (s.tick % 600 === 0 && s.tick >= 900) {
    const angle = random(s) * Math.PI * 2,
      r = 16 + random(s) * 5;
    for (
      let i = 0;
      i <
      Math.min(7, 1 + Math.floor(s.tick / 1800) + Math.floor(s.demand / 15));
      i++
    ) {
      const x = Math.max(
          1,
          Math.min(46, Math.round(24 + Math.cos(angle) * r) + i),
        ),
        y = Math.max(1, Math.min(46, Math.round(24 + Math.sin(angle) * r)));
      s.enemies.push({
        id: s.nextId++,
        x,
        y,
        hp: 50,
        kind: i % 2 ? "stalker" : "swarm",
        cooldown: 0,
      });
    }
    event(s, "Movement on the perimeter. Power attracts life.", "warning");
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const target = nearest(
      e,
      e.kind === "stalker" ? s.drones : s.buildings.filter((b) => b.powered),
    );
    if (!target) continue;
    const n = distance(e, target);
    if (n > 1) {
      const speed = e.kind === "stalker" ? 0.08 : 0.045,
        key = `${Math.round(target.x)},${Math.round(target.y)}`;
      if (e.goal !== key || !e.path?.length) {
        e.goal = key;
        e.path = path(s, e, target, true) || [];
      }
      const p = e.path[0];
      if (p) {
        const step = distance(e, p);
        if (step <= speed) {
          e.x = p.x;
          e.y = p.y;
          e.path.shift();
        } else {
          e.x += ((p.x - e.x) / step) * speed;
          e.y += ((p.y - e.y) / step) * speed;
        }
      }
    } else if (s.tick % 10 === 0) {
      target.hp -= e.kind === "stalker" ? 6 : 4;
      target.lastHit = s.tick;
      event(s, "Colony under attack", "warning", target.x, target.y);
    }
  }
  for (const d of s.drones) {
    const t = s.tiles[Math.round(d.y) * SIZE + Math.round(d.x)];
    if (t?.hazard && s.tick % 5 === 0) d.hp -= 1;
    if (t?.ruin) {
      t.ruin = false;
      s.data += 10;
      event(s, "Recovered archive · +10 data", "research", t.x, t.y);
    }
  }
  s.stats.kills += s.enemies.filter((e) => e.hp <= 0).length;
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.drones = s.drones.filter((d) => d.hp > 0);
  s.buildings = s.buildings.filter((b) => b.hp > 0);
  if (
    !s.buildings.some((b) => b.type === "hub") ||
    (!s.drones.length &&
      !s.buildings.some(
        (b) => b.type === "bay" && b.powered && b.inventory.component >= 3,
      ))
  )
    s.lost = true;
}
export function tick(s) {
  if (s.lost) return;
  s.tick++;
  if (s.tick % 5 === 1) network(s);
  for (const d of s.drones) {
    droneTick(s, d);
    d.battery = Math.max(0, Math.min(100, d.battery));
  }
  production(s);
  threats(s);
  updateObjectives(s);
}
export function serialize(s, settings = {}) {
  return JSON.stringify({
    format: "signal-lost",
    version: 1,
    state: s,
    settings,
  });
}
export function deserialize(raw) {
  const v = JSON.parse(raw);
  if (v.format !== "signal-lost" || v.version !== 1)
    throw Error("Unsupported save format");
  validateState(v.state);
  v.settings = validateSettings(v.settings);
  return v;
}

function updateObjectives(s) {
  let n = s.tutorial;
  if (n === 1 && s.stats.delivered >= 6) n = 2;
  if (n === 2 && s.programmed) n = 3;
  if (
    n === 3 &&
    ["solar", "lab"].every((k) =>
      s.buildings.some((b) => b.type === k && b.progress === 100),
    )
  )
    n = 4;
  if (n === 4 && s.tech.includes("industry")) n = 5;
  if (n === 5 && s.drones.length > 5) n = 6;
  s.tutorial = n;
}
