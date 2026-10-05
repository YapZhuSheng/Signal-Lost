import "./style.css";
import {
  STEP,
  STRUCTURES,
  TECH,
  CONDITIONS,
  ACTIONS,
  ROLES,
} from "./catalog.js";
import {
  newGame,
  tick,
  command,
  placement,
  stock,
  deserialize,
} from "./simulation.js";
import { Renderer } from "./render.js";
import { AudioSystem } from "./audio.js";
import { save, load, exportSave } from "./save.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let state = newGame(),
  settings = {
    volume: 0.6,
    music: 0.35,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  },
  paused = true,
  speed = 1,
  started = false,
  panel = null,
  selected = null,
  accumulator = 0,
  last = performance.now(),
  lastUI = 0,
  lastSaved = 0,
  toastTimer,
  lastEvent = null,
  backup = null;
try {
  backup = load();
  if (backup) settings = { ...settings, ...backup.settings };
} catch (e) {
  setTimeout(() => toast(e.message), 400);
}
const renderer = new Renderer($("#world")),
  audio = new AudioSystem(settings);
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3600);
}
function perform(a) {
  const error = command(state, a);
  if (error) {
    toast(error);
    audio.sound("warning");
    return false;
  }
  audio.sound("select");
  updateHUD();
  return true;
}
function persist(notify = true) {
  try {
    save(state, settings);
    if (notify) toast("Colony saved on this device");
    lastSaved = state.tick;
  } catch {
    toast("Device storage unavailable. Export your save in Settings.");
  }
}
function setPause(value) {
  paused = value;
  $("#pause").textContent = paused ? "▷" : "Ⅱ";
  $("#pause").setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  $("#pause").classList.toggle("paused-indicator", paused);
  accumulator = 0;
}
function openModal(html) {
  $("#modal").innerHTML = `<section class="modal-card">${html}</section>`;
  $("#modal").hidden = false;
  setPause(true);
}
function closeModal() {
  $("#modal").hidden = true;
  setPause(false);
  audio.unlock();
}
function welcome() {
  openModal(
    `<div class="eyebrow">A QUIET PLANET. A THINKING COLONY.</div><h1>SIGNAL<span>//</span>LOST</h1><p class="tagline">You are not alone. You have your drones.</p><div class="landing-glyph"><span>⌁</span><p>LANDING CORE ONLINE<br>5 AUTONOMOUS UNITS RECOVERED<br>ORBITAL CONNECTION · LOST</p></div><p>Build an autonomous colony on an alien world. Teach your drones how to survive. Follow the signal home.</p>${backup ? '<button class="primary wide" id="resume-save">Continue colony →</button>' : ""}<label for="seed">WORLD SEED</label><input id="seed" type="text" maxlength="32" value="KEPLER-09" autocomplete="off"><button class="${backup ? "secondary" : "primary"} wide" id="start-game">${backup ? "Start a new expedition" : "Begin expedition"} →</button><footer>DRAG TO EXPLORE · PINCH TO ZOOM · TAP TO INSPECT<br>LOCAL SAVES · OFFLINE READY · HEADPHONES RECOMMENDED</footer>`,
  );
  $("#start-game").onclick = () => {
    const seed = $("#seed").value.trim() || "KEPLER-09";
    if (backup) {
      openModal(
        `<h2>Start a new expedition?</h2><p>Your existing colony will be replaced when this expedition saves. Export it first if you want to keep both worlds.</p><button id="export-old" class="secondary wide">Export existing colony</button><button id="new-confirm" class="primary wide">Start ${esc(seed)}</button><button id="new-cancel" class="secondary wide">Go back</button>`,
      );
      $("#export-old").onclick = () =>
        exportSave(backup.state, backup.settings);
      $("#new-confirm").onclick = () => start(newGame(seed));
      $("#new-cancel").onclick = welcome;
    } else start(newGame(seed));
  };
  if (backup)
    $("#resume-save").onclick = () => {
      start(backup.state);
      if (backup.recovered) toast("Recovered previous save from backup");
    };
}
function start(s) {
  state = s;
  endingShown = !!s.won;
  started = true;
  lastSaved = s.tick;
  selected = null;
  renderer.selected = null;
  renderer.camera = { x: 24, y: 24, zoom: innerWidth < 700 ? 0.85 : 1.1 };
  closePanel();
  closeModal();
  updateHUD();
  persist(false);
}
function panelHead(title, subtitle = "") {
  return `<div class="panel-head"><h2>${title}</h2><button data-close aria-label="Close panel">×</button></div>${subtitle ? `<p>${subtitle}</p>` : ""}`;
}
function closePanel() {
  panel = null;
  $("#panel").hidden = true;
  document.body.classList.remove("panel-open");
  document
    .querySelectorAll("[data-panel]")
    .forEach((b) => b.classList.remove("active"));
}
function openPanel(name) {
  if (renderer.placing) cancelPlacement();
  if (name === "program") {
    if (!selected || !state.drones.some((d) => d.id === selected.id))
      selected = state.drones[0];
    renderer.selected = selected;
    if (selected && state.tutorial === 0)
      perform({ type: "inspect", id: selected.id });
  }
  panel = name;
  $("#panel").hidden = false;
  document.body.classList.add("panel-open");
  document
    .querySelectorAll("[data-panel]")
    .forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
  renderPanel();
}
function renderPanel() {
  const el = $("#panel");
  if (!panel) return;
  if (panel === "build") {
    el.innerHTML =
      panelHead(
        "Build your colony",
        "Place a blueprint on clear, explored terrain. Your engineer will assemble it.",
      ) +
      `<div class="stat-row"><span>Power network</span><strong id="build-power">${state.demand} / ${state.power} used</strong></div>` +
      Object.entries(STRUCTURES)
        .filter(([k]) => k !== "hub")
        .map(
          ([key, b]) =>
            `<button class="build-card" data-build="${key}" ${b.tech && !state.tech.includes(b.tech) ? "disabled" : ""}><span class="build-icon">${b.icon}</span><span><strong>${b.name}</strong><small>${b.tech && !state.tech.includes(b.tech) ? "Requires " + TECH[b.tech].name : b.description}</small></span><span class="cost">${b.cost}<br>▰</span></button>`,
        )
        .join("");
    el.querySelectorAll("[data-build]").forEach(
      (b) => (b.onclick = () => beginPlacement(b.dataset.build)),
    );
  }
  if (panel === "fleet") {
    el.innerHTML =
      panelHead(
        "Autonomous fleet",
        "Tap a unit to inspect its live decisions and edit its behavior.",
      ) +
      `<span class="badge">${state.drones.length} / 80 UNITS ONLINE</span><div id="fleet-list">${state.drones.map((d) => `<button class="fleet-card" data-drone="${d.id}"><span>✥</span><div><strong>${ROLES[d.role]} ${String(d.id).padStart(2, "0")}</strong><small data-fleet-task="${d.id}">${esc(d.task)}</small></div><b data-fleet-battery="${d.id}">${Math.round(d.battery)}%</b></button>`).join("")}</div><div class="section-label">DRONE ASSEMBLY</div><p>A powered foundry assembles one drone from 3 components in its local buffer.</p><select id="new-role" aria-label="New drone role">${Object.entries(
        ROLES,
      )
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join(
          "",
        )}</select><button class="primary wide" id="make-drone">Assemble drone · 3 ⬡</button>`;
    el.querySelectorAll("[data-drone]").forEach(
      (b) => (b.onclick = () => selectDrone(Number(b.dataset.drone))),
    );
    $("#make-drone").onclick = () => {
      if (perform({ type: "drone", role: $("#new-role").value })) renderPanel();
    };
  }
  if (panel === "program") renderProgram(el);
  if (panel === "research") {
    el.innerHTML =
      panelHead(
        "Research archive",
        "Explorers recover archive data from ruins. A powered lab turns delivered alloy into data.",
      ) +
      `<span class="badge"><span id="research-data">${state.data}</span> DATA AVAILABLE</span><div id="research-active" class="subtext"></div>` +
      Object.entries(TECH)
        .map(
          ([key, t]) =>
            `<article class="tech-card"><h3>${t.name}</h3><p>${t.description}</p><button class="${state.tech.includes(key) ? "secondary" : "primary"}" data-research="${key}" ${state.tech.includes(key) || state.research ? "disabled" : ""}>${state.tech.includes(key) ? "✓ Research complete" : `${t.cost} data · Research`}</button></article>`,
        )
        .join("");
    el.querySelectorAll("[data-research]").forEach(
      (b) =>
        (b.onclick = () => {
          if (perform({ type: "research", key: b.dataset.research }))
            renderPanel();
        }),
    );
  }
  if (panel === "log") {
    el.innerHTML =
      panelHead(
        "Colony log",
        "Recent transmissions from your autonomous network.",
      ) + '<div id="log-list"></div>';
    updateLog();
  }
  if (panel === "building") renderBuilding(el);
  el.querySelector("[data-close]")?.addEventListener("click", closePanel);
  updatePanelLive();
}
function selectDrone(id) {
  selected = state.drones.find((d) => d.id === id);
  if (!selected) return;
  renderer.selected = selected;
  perform({ type: "inspect", id });
  openPanel("program");
  audio.sound("select");
  updateHUD();
}
function renderProgram(el) {
  const d = state.drones.find((d) => d.id === selected?.id);
  if (!d) {
    el.innerHTML =
      panelHead("No drone selected") + "<p>Select a unit from your fleet.</p>";
    return;
  }
  el.innerHTML =
    panelHead(
      `${ROLES[d.role]} ${String(d.id).padStart(2, "0")}`,
      "Rules run from top to bottom. The first matching condition wins.",
    ) +
    `<div class="stat-row"><span>Battery</span><strong id="drone-battery"></strong></div><div class="meter"><i id="battery-meter"></i></div><div class="stat-row"><span>Integrity</span><strong id="drone-health"></strong></div><div class="meter"><i id="health-meter"></i></div><div class="telemetry"><div class="eyebrow">LIVE DECISION</div><div class="decision" id="drone-task"></div><small id="drone-reason"></small><p id="drone-cargo"></p></div><label for="drone-role">ROLE PRESET · replaces current rules</label><select id="drone-role">${Object.entries(
      ROLES,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${k === d.role ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select><div class="section-label">BEHAVIOR STACK <span class="badge">LIVE</span></div><div id="rules">${d.rules
      .map(
        (r, i) =>
          `<div class="rule" data-rule="${i}"><div class="rule-top"><span class="priority">${String(i + 1).padStart(2, "0")} <span data-running="${i}"></span></span><div><button data-up="${i}" aria-label="Move rule ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button><button data-down="${i}" aria-label="Move rule ${i + 1} down" ${i === d.rules.length - 1 ? "disabled" : ""}>↓</button><button data-remove="${i}" aria-label="Delete rule ${i + 1}">×</button></div></div><div class="rule-flow"><span>IF</span><select data-condition="${i}" aria-label="Rule ${i + 1} condition">${Object.entries(
            CONDITIONS,
          )
            .filter(
              ([k]) =>
                ["low", "cargo", "enemy", "always"].includes(k) ||
                state.tech.includes("logic") ||
                r.condition === k,
            )
            .map(
              ([k, v]) =>
                `<option value="${k}" ${r.condition === k ? "selected" : ""}>${v}</option>`,
            )
            .join(
              "",
            )}</select><span>THEN</span><select data-action="${i}" aria-label="Rule ${i + 1} action">${Object.entries(
            ACTIONS,
          )
            .map(
              ([k, v]) =>
                `<option value="${k}" ${r.action === k ? "selected" : ""}>${v}</option>`,
            )
            .join("")}</select></div></div>`,
      )
      .join(
        "",
      )}</div><button id="add-rule" class="secondary wide" ${d.rules.length >= 8 ? "disabled" : ""}>+ Add rule</button><p>Keep charging and delivery above work rules. Reordering changes behavior immediately.</p>${!state.tech.includes("logic") ? "<p>Research Conditional intelligence to unlock health, storage and ally conditions.</p>" : ""}`;
  const change = (fn) => {
    const next = structuredClone(d.rules);
    fn(next);
    perform({ type: "rules", id: d.id, rules: next });
    renderPanel();
    updateHUD();
  };
  el.querySelectorAll("[data-condition]").forEach(
    (b) =>
      (b.onchange = () =>
        change((r) => (r[+b.dataset.condition].condition = b.value))),
  );
  el.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onchange = () =>
        change((r) => (r[+b.dataset.action].action = b.value))),
  );
  el.querySelectorAll("[data-up]").forEach(
    (b) =>
      (b.onclick = () =>
        change((r) => {
          const i = +b.dataset.up;
          [r[i - 1], r[i]] = [r[i], r[i - 1]];
        })),
  );
  el.querySelectorAll("[data-down]").forEach(
    (b) =>
      (b.onclick = () =>
        change((r) => {
          const i = +b.dataset.down;
          [r[i + 1], r[i]] = [r[i], r[i + 1]];
        })),
  );
  el.querySelectorAll("[data-remove]").forEach(
    (b) => (b.onclick = () => change((r) => r.splice(+b.dataset.remove, 1))),
  );
  $("#add-rule").onclick = () =>
    change((r) => r.push({ condition: "always", action: "wait" }));
  $("#drone-role").onchange = () => {
    perform({ type: "role", id: d.id, role: $("#drone-role").value });
    renderPanel();
  };
}
function renderBuilding(el) {
  const b = state.buildings.find((b) => b.id === selected?.id);
  if (!b) {
    closePanel();
    return;
  }
  el.innerHTML =
    panelHead(STRUCTURES[b.type].name, STRUCTURES[b.type].description) +
    `<div class="telemetry"><div class="eyebrow">STRUCTURE TELEMETRY</div><p id="building-status"></p><div id="building-inventory"></div></div><p>${b.type === "hub" ? "Your landing core is a small refinery, emergency charger and power source. Protect it to keep the expedition alive." : "Buildings connect through nearby powered structures. Use relays to extend coverage and solar arrays to increase supply."}</p><button id="show-network" class="secondary wide">Show power network</button>${b.type === "bay" ? '<button id="open-fleet" class="primary wide">Assemble a drone</button>' : ""}`;
  $("#show-network").onclick = () => {
    renderer.showPower = true;
    $("#power-toggle").classList.add("active");
    closePanel();
  };
  $("#open-fleet")?.addEventListener("click", () => openPanel("fleet"));
}
function updatePanelLive() {
  if (panel === "program") {
    const d = state.drones.find((d) => d.id === selected?.id);
    if (!d) {
      if (selected) {
        toast("This unit was lost. Select another drone.");
        selected = null;
        renderPanel();
      }
      return;
    }
    $("#drone-battery").textContent = `${Math.round(d.battery)}%`;
    $("#battery-meter").style.width = d.battery + "%";
    $("#drone-health").textContent = `${Math.round(d.hp)} / 100`;
    $("#health-meter").style.width = d.hp + "%";
    $("#drone-task").textContent = ACTIONS[d.task] || d.task;
    $("#drone-reason").textContent =
      d.activeRule >= 0
        ? `RULE ${d.activeRule + 1} · ${CONDITIONS[d.reason] || d.reason}`
        : "No condition matched";
    $("#drone-cargo").textContent = d.cargo
      ? `Cargo: ${d.cargo.amount} ${d.cargo.item}`
      : "Cargo hold empty";
    document.querySelectorAll("[data-rule]").forEach((r) => {
      r.classList.toggle("firing", +r.dataset.rule === d.activeRule);
      r.querySelector("[data-running]").textContent =
        +r.dataset.rule === d.activeRule ? "EXECUTING" : "";
    });
  }
  if (panel === "fleet")
    for (const d of state.drones) {
      const t = $(`[data-fleet-task="${d.id}"]`),
        b = $(`[data-fleet-battery="${d.id}"]`);
      if (t) t.textContent = ACTIONS[d.task] || d.task;
      if (b) b.textContent = Math.round(d.battery) + "%";
    }
  if (panel === "research") {
    $("#research-data").textContent = state.data;
    $("#research-active").textContent = state.research
      ? `${TECH[state.research.key].name} · ${Math.floor(state.research.progress)}%`
      : "";
    for (const b of document.querySelectorAll("[data-research]"))
      if (state.tech.includes(b.dataset.research)) {
        b.disabled = true;
        b.textContent = "✓ Research complete";
      } else b.disabled = !!state.research;
  }
  if (panel === "build")
    $("#build-power").textContent = `${state.demand} / ${state.power} used`;
  if (panel === "building") {
    const b = state.buildings.find((b) => b.id === selected?.id);
    if (!b) {
      closePanel();
      return;
    }
    $("#building-status").textContent =
      b.progress < 100
        ? `Construction ${b.progress}%`
        : `${b.powered ? "● Network connected" : "○ No power / outside network"} · ${Math.round(b.hp)} integrity`;
    $("#building-inventory").innerHTML = Object.entries(b.inventory)
      .map(
        ([k, v]) =>
          `<div class="stat-row"><span>${k}</span><strong>${v}</strong></div>`,
      )
      .join("");
  }
}
function updateLog() {
  if (panel === "log")
    $("#log-list").innerHTML = state.events
      .slice()
      .reverse()
      .map(
        (e) =>
          `<div class="log-entry ${e.type}"><small>${formatTime(e.tick)}</small>${esc(e.text)}</div>`,
      )
      .join("");
}
function beginPlacement(kind) {
  closePanel();
  renderer.placing = kind;
  renderer.hover = null;
  $("#placement").hidden = false;
  $("#placement-name").textContent = STRUCTURES[kind].name;
  $("#placement-help").textContent =
    `${STRUCTURES[kind].cost} alloy · Tap a clear tile, then confirm.`;
  $("#confirm-build").disabled = true;
  audio.sound("select");
}
function cancelPlacement() {
  renderer.placing = null;
  renderer.hover = null;
  $("#placement").hidden = true;
}
function previewPlacement(p) {
  const error = placement(state, renderer.placing, p.x, p.y);
  renderer.hover = { ...p, valid: !error };
  $("#confirm-build").disabled = !!error;
  $("#placement-help").textContent =
    error ||
    `Sector ${p.x}, ${p.y} · ${STRUCTURES[renderer.placing].cost} alloy · Ready to build`;
}
$("#confirm-build").onclick = () => {
  if (
    renderer.placing &&
    renderer.hover &&
    perform({
      type: "build",
      kind: renderer.placing,
      x: renderer.hover.x,
      y: renderer.hover.y,
    })
  ) {
    cancelPlacement();
    toast("Blueprint placed. Your engineer will build it.");
  }
};
$("#cancel-build").onclick = cancelPlacement;
const missions = [
  [
    "Meet your crew",
    "Tap a drone to see what it is doing, which rule triggered, and what it carries.",
    "Inspect a drone",
    "program",
  ],
  [
    "A working supply line",
    "Miners carry ore to the core. Watch a delivery turn into your first alloy.",
    "Watch the fleet",
    "fleet",
  ],
  [
    "Give them a better plan",
    "Edit or reorder one rule. Charging and cargo delivery should come before mining.",
    "Open behavior stack",
    "program",
  ],
  [
    "A foothold on this world",
    "Build a solar array and a research lab. Your engineer assembles both blueprints.",
    "Build infrastructure",
    "build",
  ],
  [
    "Teach the colony",
    "Your hauler supplies alloy to the lab. Research Industrial systems to unlock production.",
    "Open research",
    "research",
  ],
  [
    "Machines that make machines",
    "Build a fabricator and a foundry. Haulers carry components; assemble another drone.",
    "Expand production",
    "build",
  ],
  [
    "Find your way home",
    "Research Orbital uplink. Build a beacon and supply 10 components. Defend your growing network.",
    "Restore the signal",
    "research",
  ],
];
function updateMission() {
  const n = state.tutorial;
  const m = missions[Math.min(n, 6)];
  $("#mission-count").textContent = `${String(n + 1).padStart(2, "0")} / 07`;
  $("#mission-symbol").textContent = state.won
    ? "✓"
    : String(n + 1).padStart(2, "0");
  $("#mission-name").textContent = state.won ? "Signal restored" : m[0];
  $("#mission-description").textContent = state.won
    ? "Orbit has your coordinates. Your autonomous colony can keep growing."
    : m[1];
  $("#mission-action").innerHTML =
    `${state.won ? "Keep expanding" : m[2]} <span>→</span>`;
  $("#mission-progress").style.width =
    (state.won ? 100 : ((n + 1) / 7) * 100) + "%";
  $("#mission-action").onclick = () => openPanel(state.won ? "build" : m[3]);
}
function formatTime(t) {
  const sec = Math.floor(t * STEP);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}
function updateHUD() {
  for (const k of ["ore", "alloy", "component"])
    $("#" + k).textContent = stock(state, k);
  $("#data").textContent = state.data;
  $("#fleet-count").textContent = state.drones.length;
  $("#sector").textContent = state.seed;
  $("#clock").textContent =
    `SOL ${String(1 + Math.floor(state.tick / 3000)).padStart(2, "0")} · ${formatTime(state.tick)}`;
  $("#explored").textContent =
    Math.round(
      (state.tiles.filter((t) => t.seen).length / state.tiles.length) * 100,
    ) + "%";
  const e = state.events.at(-1);
  const danger = state.enemies.some((e) => Math.hypot(e.x - 24, e.y - 24) < 9);
  const offline = state.buildings.filter(
    (b) => b.progress === 100 && !b.powered && STRUCTURES[b.type].power < 0,
  ).length;
  $("#activity-text").textContent =
    paused && started
      ? "Simulation paused"
      : danger
        ? "Threats approaching · defend the colony"
        : offline
          ? `${offline} structures without power · add solar / relays`
          : e?.text || "All systems nominal";
  $(".activity").classList.toggle("threat-active", danger && !paused);
  if (e && e !== lastEvent) {
    lastEvent = e;
    audio.sound(e.type);
    updateLog();
  }
  updateMission();
  updatePanelLive();
  renderer.minimap(state, $("#minimap"));
}
function settingsModal() {
  openModal(
    `<div class="panel-head"><h2>Expedition settings</h2><button id="close-settings" aria-label="Resume">×</button></div><p>Colony paused. Saves stay on this device; export a backup to move between devices.</p><label class="setting-row">Effects volume<input id="volume" type="range" min="0" max="1" step=".05" value="${settings.volume}"></label><label class="setting-row">Ambient music<input id="music" type="range" min="0" max="1" step=".05" value="${settings.music}"></label><label class="setting-row">Reduce motion<input id="motion" type="checkbox" ${settings.reducedMotion ? "checked" : ""}></label><div class="button-row"><button id="save-now" class="primary">Save colony</button><button id="export" class="secondary">Export save</button></div><div class="button-row"><button id="import" class="secondary">Import save</button><button id="new-world" class="danger">New expedition</button></div><input type="file" id="import-file" accept=".json,application/json" hidden><button id="resume-game" class="secondary wide">Resume expedition →</button><footer>SEED ${esc(state.seed)} · SAVE FORMAT 1 · ${formatTime(state.tick)}<br>Built with original procedural art. Interface sounds: Kenney (CC0).<br>Tap to select · Drag to pan · Pinch / scroll to zoom</footer>`,
  );
  $("#close-settings").onclick = $("#resume-game").onclick = closeModal;
  for (const k of ["volume", "music"])
    $("#" + k).oninput = (e) => {
      settings[k] = Number(e.target.value);
      audio.update();
    };
  $("#motion").onchange = (e) => (settings.reducedMotion = e.target.checked);
  $("#save-now").onclick = () => persist();
  $("#export").onclick = () => exportSave(state, settings);
  $("#import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || file.size > 8e6)
        throw Error("Choose a save smaller than 8 MB");
      const loaded = deserialize(await file.text());
      settings = { ...settings, ...loaded.settings };
      audio.settings = settings;
      audio.update();
      start(loaded.state);
      toast("Colony restored from export");
    } catch (err) {
      toast("Could not import save: " + err.message);
    }
  };
  $("#new-world").onclick = () => {
    persist(false);
    backup = { state: structuredClone(state), settings };
    welcome();
  };
}
$("#settings").onclick = $("#title-button").onclick = () => {
  if (started) settingsModal();
};
$("#pause").onclick = () => {
  if (started) setPause(!paused);
};
$("#speed").onclick = () => {
  speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
  $("#speed").textContent = speed + "×";
};
document.querySelectorAll("[data-panel]").forEach(
  (b) =>
    (b.onclick = () => {
      audio.unlock();
      audio.sound("select");
      if (panel === b.dataset.panel) closePanel();
      else openPanel(b.dataset.panel);
    }),
);
$("#home").onclick = () => {
  renderer.focusPoint = { x: 24, y: 24 };
};
$("#zoom-in").onclick = () =>
  (renderer.camera.zoom = Math.min(2.2, renderer.camera.zoom * 1.2));
$("#zoom-out").onclick = () =>
  (renderer.camera.zoom = Math.max(0.45, renderer.camera.zoom / 1.2));
$("#power-toggle").onclick = () => {
  renderer.showPower = !renderer.showPower;
  $("#power-toggle").classList.toggle("active", renderer.showPower);
};
const pointers = new Map();
let gesture = null;
$("#world").addEventListener("pointerdown", (e) => {
  if (!started) return;
  renderer.focusPoint = null;
  audio.unlock();
  e.target.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  gesture = {
    x: e.clientX,
    y: e.clientY,
    moved: false,
    pinch: pointers.size > 1,
  };
});
$("#world").addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) {
    if (renderer.placing && e.pointerType === "mouse")
      previewPlacement(renderer.world(e.clientX, e.clientY));
    return;
  }
  const prev = pointers.get(e.pointerId),
    next = { x: e.clientX, y: e.clientY };
  if (pointers.size === 2) {
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
    const before = Math.hypot(prev.x - other.x, prev.y - other.y),
      after = Math.hypot(next.x - other.x, next.y - other.y);
    renderer.camera.zoom = Math.max(
      0.45,
      Math.min(2.2, (renderer.camera.zoom * after) / Math.max(1, before)),
    );
    gesture.pinch = true;
    gesture.moved = true;
  } else {
    const dx = next.x - prev.x,
      dy = next.y - prev.y,
      k = renderer.camera.zoom;
    renderer.camera.x -= (dx / 30 + dy / 16) / 2 / k;
    renderer.camera.y -= (dy / 16 - dx / 30) / 2 / k;
    renderer.camera.x = Math.max(0, Math.min(47, renderer.camera.x));
    renderer.camera.y = Math.max(0, Math.min(47, renderer.camera.y));
    if (Math.hypot(next.x - gesture.x, next.y - gesture.y) > 6)
      gesture.moved = true;
  }
  pointers.set(e.pointerId, next);
});
$("#world").addEventListener("pointerup", (e) => {
  pointers.delete(e.pointerId);
  if (!gesture || gesture.moved || gesture.pinch) return;
  const p = renderer.world(e.clientX, e.clientY);
  if (renderer.placing) {
    previewPlacement(p);
    return;
  }
  let best = null,
    dist = 30;
  for (const d of state.drones) {
    const q = renderer.screen(d.x, d.y, 10),
      n = Math.hypot(q.x - e.clientX, q.y - e.clientY);
    if (n < dist) {
      best = d;
      dist = n;
    }
  }
  if (best) {
    selectDrone(best.id);
    return;
  }
  const b = state.buildings.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < 1.5);
  if (b) {
    selected = b;
    renderer.selected = b;
    openPanel("building");
    audio.sound("select");
  } else {
    closePanel();
    selected = null;
    renderer.selected = null;
    const t = state.tiles[p.y * 48 + p.x];
    if (t?.seen) {
      if (t.ore) toast(`Mineral deposit · ${t.ore} ore remaining`);
      else if (t.hazard)
        toast("Spore field · damages drones. Repair and retreat rules help.");
      else if (t.ruin)
        toast("Abandoned archive · send an explorer to recover data");
    }
  }
});
$("#world").addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
  gesture = null;
});
$("#world").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    renderer.camera.zoom = Math.max(
      0.45,
      Math.min(2.2, renderer.camera.zoom * Math.exp(-e.deltaY * 0.001)),
    );
  },
  { passive: false },
);
$("#minimap").onclick = (e) => {
  const r = e.target.getBoundingClientRect();
  renderer.focusPoint = {
    x: ((e.clientX - r.left) / r.width) * 48,
    y: ((e.clientY - r.top) / r.height) * 48,
  };
};
addEventListener("resize", () => renderer.resize());
addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) ||
    !started ||
    !$("#modal").hidden
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    setPause(!paused);
  }
  const key = e.key.toLowerCase();
  if (key === "escape") {
    cancelPlacement();
    closePanel();
  }
  if (key === "b") openPanel("build");
  if (key === "p") openPanel("program");
  if (key === "r") openPanel("research");
  if (key === "l") openPanel("log");
  if (key === "h") $("#home").click();
});
addEventListener("pagehide", () => {
  if (started) persist(false);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (started) persist(false);
    audio.suspend();
    accumulator = 0;
  } else {
    last = performance.now();
    if (started) audio.unlock();
  }
});
let endingShown = false;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && !document.hidden) {
    accumulator += dt * speed;
    while (accumulator >= STEP) {
      tick(state);
      accumulator -= STEP;
    }
    if (state.tick - lastSaved >= 150) persist(false);
    if ((state.won || state.lost) && !endingShown) {
      endingShown = true;
      openModal(
        `<div class="eyebrow">${state.won ? "TRANSMISSION RECEIVED" : "CORE CONNECTION LOST"}</div><h2>${state.won ? "You brought them home." : "The colony fell silent."}</h2><p>${state.won ? "Your autonomous network restored the orbital signal. Keep building, or begin another expedition with a new seed." : "The expedition can no longer sustain itself. Protect the landing core and keep a reserve of drones before power attracts larger swarms."}</p><p>${state.drones.length} drones · ${state.stats.mined} ore extracted · ${state.stats.kills} threats stopped</p><button id="end-continue" class="primary wide">${state.won ? "Keep expanding" : "New expedition"}</button>`,
      );
      $("#end-continue").onclick = () => (state.won ? closeModal() : welcome());
    }
  }
  renderer.draw(state, settings.reducedMotion ? 0 : dt);
  if (now - lastUI > 200) {
    lastUI = now;
    updateHUD();
  }
  requestAnimationFrame(frame);
}
welcome();
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
// Explicit development hooks for browser integration tests; absent in production builds.
if (import.meta.env.DEV)
  window.__signal = {
    get state() {
      return state;
    },
    get renderer() {
      return renderer;
    },
    command: perform,
    tick: (n) => {
      for (let i = 0; i < n; i++) tick(state);
      updateHUD();
    },
    pause: setPause,
    openPanel,
    start,
  };
