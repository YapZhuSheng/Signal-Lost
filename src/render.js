import { SIZE, STRUCTURES } from "./catalog.js";
const C = { mint: "#97f4ca", ore: "#ebb284", enemy: "#f57587" };
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = { x: 24, y: 24, zoom: 1 };
    this.selected = null;
    this.placing = null;
    this.hover = null;
    this.time = 0;
    this.showPower = false;
    this.resize();
  }
  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    const d = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.w * d;
    this.canvas.height = this.h * d;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  screen(x, y, z = 0) {
    const c = this.camera,
      k = c.zoom;
    return {
      x: this.w / 2 + (x - c.x - y + c.y) * 30 * k,
      y: this.h * 0.49 + (x - c.x + y - c.y) * 16 * k - z * k,
    };
  }
  world(x, y) {
    const a = (x - this.w / 2) / 30 / this.camera.zoom,
      b = (y - this.h * 0.49) / 16 / this.camera.zoom;
    return {
      x: Math.round((a + b) / 2 + this.camera.x),
      y: Math.round((b - a) / 2 + this.camera.y),
    };
  }
  poly(points, fill, stroke) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.stroke();
    }
  }
  diamond(x, y, w, h, color, stroke) {
    this.poly(
      [
        [x, y - h],
        [x + w, y],
        [x, y + h],
        [x - w, y],
      ],
      color,
      stroke,
    );
  }
  box(x, y, w, h, z, color, top) {
    this.poly(
      [
        [x - w, y],
        [x, y + h],
        [x, y + h - z],
        [x - w, y - z],
      ],
      color,
    );
    this.poly(
      [
        [x, y + h],
        [x + w, y],
        [x + w, y - z],
        [x, y + h - z],
      ],
      "#1c3335",
    );
    this.diamond(x, y - z, w, h, top, "#5f797366");
  }
  line(a, b, color, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  text(text, x, y, color = "#d7e9df", size = 10) {
    const c = this.ctx;
    c.font = `${size}px ui-monospace,monospace`;
    c.textAlign = "center";
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  draw(s, dt) {
    this.time += dt;
    // Visual interpolation is intentionally outside saved simulation state.
    if (
      this.stateRef !== s ||
      this.lastTick === undefined ||
      s.tick < this.lastTick ||
      s.tick - this.lastTick > 5
    ) {
      this.previousPositions = new Map();
      this.currentPositions = new Map();
      this.stateRef = s;
      this.lastTick = -1;
    }
    if (this.lastTick !== s.tick) {
      this.previousPositions = this.currentPositions;
      this.currentPositions = new Map(
        [...s.drones, ...s.enemies].map((o) => [o.id, { x: o.x, y: o.y }]),
      );
      this.lastTick = s.tick;
      this.tickElapsed = 0;
    }
    this.tickElapsed += dt;
    const alpha = dt === 0 ? 1 : Math.min(1, this.tickElapsed / 0.2);
    const visual = (o) => {
      const p = this.previousPositions.get(o.id) || o;
      return {
        ...o,
        x: p.x + (o.x - p.x) * alpha,
        y: p.y + (o.y - p.y) * alpha,
      };
    };
    if (this.focusPoint) {
      const f = dt === 0 ? 1 : Math.min(1, dt * 8);
      this.camera.x += (this.focusPoint.x - this.camera.x) * f;
      this.camera.y += (this.focusPoint.y - this.camera.y) * f;
      if (
        Math.hypot(
          this.focusPoint.x - this.camera.x,
          this.focusPoint.y - this.camera.y,
        ) < 0.01
      )
        this.focusPoint = null;
    }
    const c = this.ctx,
      k = this.camera.zoom;
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = "#101d21";
    c.fillRect(0, 0, this.w, this.h);
    const tiles = s.tiles;
    for (let sum = 0; sum < SIZE * 2; sum++)
      for (
        let x = Math.max(0, sum - SIZE + 1);
        x <= Math.min(SIZE - 1, sum);
        x++
      ) {
        const y = sum - x,
          t = tiles[y * SIZE + x],
          p = this.screen(x, y);
        if (p.x < -70 || p.x > this.w + 70 || p.y < -70 || p.y > this.h + 90)
          continue;
        const v = Math.floor(t.shade * 8);
        const fill = !t.seen
          ? `rgb(${16 + v},${29 + v},${33 + v})`
          : t.biome === "scar"
            ? `rgb(${48 + v},${43 + v},${43 + v})`
            : t.biome === "grove"
              ? `rgb(${35 + v},${54 + v},${51 + v})`
              : `rgb(${43 + v},${61 + v},${61 + v})`;
        this.diamond(
          p.x,
          p.y,
          30 * k,
          16 * k,
          fill,
          t.seen ? "#7794860d" : "#17272a",
        );
        if (!t.seen) continue;
        if (t.hazard) {
          this.diamond(p.x, p.y, 24 * k, 11 * k, "#64845855");
          for (let j = 0; j < 3; j++) {
            const xx = p.x + (j - 1) * 9 * k,
              yy = p.y + (j % 2) * 5 * k;
            this.line(
              { x: xx, y: yy },
              { x: xx, y: yy - 9 * k },
              "#92ae77",
              2 * k,
            );
            c.fillStyle = "#b7c889";
            c.beginPath();
            c.ellipse(xx, yy - 10 * k, 6 * k, 3 * k, 0, Math.PI, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = "#cced9744";
          c.beginPath();
          c.arc(p.x + Math.sin(this.time) * 7 * k, p.y - 22 * k, 2 * k, 0, 7);
          c.fill();
        }
        if (t.rock) {
          const h = (15 + t.shade * 19) * k;
          this.poly(
            [
              [p.x - 22 * k, p.y],
              [p.x - 14 * k, p.y - h],
              [p.x + 7 * k, p.y - h - 8 * k],
              [p.x + 21 * k, p.y - 2 * k],
              [p.x, p.y + 8 * k],
            ],
            "#405150",
            "#65716a",
          );
          this.poly(
            [
              [p.x - 14 * k, p.y - h],
              [p.x + 7 * k, p.y - h - 8 * k],
              [p.x + 4 * k, p.y - 8 * k],
              [p.x - 22 * k, p.y],
            ],
            "#53635e",
          );
        }
        if (t.ore) {
          for (let i = 0; i < 3; i++) {
            const xx = p.x + (i - 1) * 10 * k,
              yy = p.y + (i % 2) * 5 * k;
            this.poly(
              [
                [xx - 6 * k, yy],
                [xx - 5 * k, yy - 12 * k - i * 4 * k],
                [xx + 1 * k, yy - 20 * k - i * 3 * k],
                [xx + 7 * k, yy - 5 * k],
                [xx, yy + 4 * k],
              ],
              i === 1 ? "#d8a57e" : "#a6775c",
            );
            this.line(
              { x: xx + 1 * k, y: yy - 20 * k - i * 3 * k },
              { x: xx, y: yy + 3 * k },
              "#f6c99d",
            );
          }
        }
        if (t.ruin)
          this.box(p.x, p.y, 13 * k, 8 * k, 25 * k, "#526e7e", "#8daab4");
        else if (!t.ore && !t.rock && t.biome === "grove" && t.shade > 0.7) {
          this.line(
            { x: p.x, y: p.y },
            { x: p.x, y: p.y - 15 * k },
            "#547869",
            2 * k,
          );
          this.poly(
            [
              [p.x, p.y - 18 * k],
              [p.x - 10 * k, p.y - 11 * k],
              [p.x, p.y - 8 * k],
              [p.x + 8 * k, p.y - 15 * k],
            ],
            "#678b76",
          );
        } else if (!t.ore && !t.rock && t.shade > 0.8) {
          this.line(
            { x: p.x, y: p.y },
            { x: p.x - 3 * k, y: p.y - 7 * k },
            "#8aaf9760",
          );
        }
      }
    if (this.showPower || this.placing)
      for (const b of s.buildings.filter(
        (b) => b.powered && STRUCTURES[b.type].range,
      )) {
        const p = this.screen(b.x, b.y),
          r = STRUCTURES[b.type].range;
        c.beginPath();
        c.ellipse(p.x, p.y, 42 * r * k, 22 * r * k, 0, 0, Math.PI * 2);
        c.strokeStyle = "#96efbb22";
        c.stroke();
      }
    const objects = [
      ...s.buildings.map((b) => ({ ...b, entity: "building" })),
      ...s.drones.map((d) => ({ ...visual(d), entity: "drone" })),
      ...s.enemies
        .filter((e) => tiles[Math.round(e.y) * SIZE + Math.round(e.x)]?.seen)
        .map((e) => ({ ...visual(e), entity: "enemy" })),
    ].sort((a, b) => a.x + a.y - b.x - b.y);
    for (const o of objects) {
      const p = this.screen(o.x, o.y),
        selected = this.selected?.id === o.id;
      if (selected) {
        this.diamond(p.x, p.y + 3 * k, 30 * k, 16 * k, "#b8f7d31a", C.mint);
        if (o.path?.length) {
          let prev = p;
          for (const t of o.path) {
            const next = this.screen(t.x, t.y);
            this.line(prev, next, "#a3f6c44d");
            prev = next;
          }
        }
      }
      if (o.entity === "building") {
        c.globalAlpha = o.progress < 100 ? 0.45 : 1;
        const big = o.type === "hub",
          w = (big ? 28 : 20) * k,
          z = (big ? 27 : 20) * k;
        this.box(
          p.x,
          p.y,
          w,
          w * 0.53,
          z,
          "#526a62",
          big ? "#9aa99a" : "#748b7f",
        );
        if (o.type === "solar") {
          this.box(
            p.x,
            p.y - 10 * k,
            26 * k,
            13 * k,
            12 * k,
            "#405565",
            "#617a87",
          );
          for (let i = -2; i <= 2; i++)
            this.line(
              { x: p.x + i * 8 * k - 9 * k, y: p.y - 25 * k - i * 4 * k },
              { x: p.x + i * 8 * k + 9 * k, y: p.y - 15 * k - i * 4 * k },
              "#9abfca",
            );
        } else if (o.type === "hub") {
          this.poly(
            [
              [p.x - 38 * k, p.y - 1 * k],
              [p.x - 22 * k, p.y - 23 * k],
              [p.x - 17 * k, p.y - 5 * k],
              [p.x - 23 * k, p.y + 7 * k],
            ],
            "#7f9387",
          );
          this.poly(
            [
              [p.x + 38 * k, p.y - 1 * k],
              [p.x + 22 * k, p.y - 23 * k],
              [p.x + 17 * k, p.y - 5 * k],
              [p.x + 23 * k, p.y + 7 * k],
            ],
            "#9fb09a",
          );
          this.box(
            p.x,
            p.y - 20 * k,
            16 * k,
            8 * k,
            16 * k,
            "#738d80",
            "#c4cdb2",
          );
          this.line(
            { x: p.x + 9 * k, y: p.y - 37 * k },
            { x: p.x + 9 * k, y: p.y - 57 * k },
            "#c2d2bd",
            2,
          );
          c.fillStyle = C.mint;
          c.fillRect(p.x + 7 * k, p.y - 59 * k, 4 * k, 4 * k);
        } else if (["relay", "beacon", "turret"].includes(o.type)) {
          this.line(
            { x: p.x, y: p.y - 20 * k },
            { x: p.x, y: p.y - 48 * k },
            "#a8bcb0",
            4 * k,
          );
          this.diamond(
            p.x,
            p.y - 47 * k,
            9 * k,
            5 * k,
            o.type === "turret" ? "#edac92" : C.mint,
          );
        } else if (o.type === "refinery") {
          for (const dx of [-9, 9]) {
            this.box(
              p.x + dx * k,
              p.y - 17 * k,
              6 * k,
              4 * k,
              22 * k,
              "#708578",
              "#b8bda0",
            );
            this.diamond(p.x + dx * k, p.y - 40 * k, 4 * k, 2 * k, "#e6aa73");
            if (o.powered) {
              c.fillStyle = "#b9cba922";
              c.beginPath();
              c.arc(
                p.x + (dx + Math.sin(this.time + dx) * 3) * k,
                p.y - (48 + ((this.time * 8 + dx) % 14)) * k,
                5 * k,
                0,
                7,
              );
              c.fill();
            }
          }
        } else if (o.type === "lab") {
          c.beginPath();
          c.ellipse(p.x, p.y - 21 * k, 14 * k, 17 * k, 0, Math.PI, Math.PI * 2);
          c.fillStyle = "#aaccc7";
          c.fill();
          this.line(
            { x: p.x, y: p.y - 38 * k },
            { x: p.x, y: p.y - 21 * k },
            "#e0f4de",
            1 * k,
          );
          this.diamond(p.x, p.y - 21 * k, 14 * k, 5 * k, "#567b78");
          this.diamond(p.x, p.y - 23 * k, 5 * k, 3 * k, "#bef5d2");
        } else if (o.type === "factory") {
          this.box(
            p.x + 4 * k,
            p.y - 17 * k,
            11 * k,
            7 * k,
            15 * k,
            "#78958c",
            "#b8cbb5",
          );
          this.box(
            p.x - 15 * k,
            p.y - 2 * k,
            9 * k,
            5 * k,
            5 * k,
            "#47685e",
            "#93b2a0",
          );
          for (let i = 0; i < 3; i++)
            this.line(
              { x: p.x - 21 * k + i * 5 * k, y: p.y - 9 * k },
              { x: p.x - 14 * k + i * 5 * k, y: p.y - 5 * k },
              "#284139",
              2 * k,
            );
          this.diamond(p.x + 4 * k, p.y - 33 * k, 5 * k, 3 * k, "#e3b78e");
        } else if (o.type === "storage") {
          for (const [dx, dy] of [
            [-8, -3],
            [8, -3],
            [0, -11],
          ])
            this.box(
              p.x + dx * k,
              p.y + dy * k - 14 * k,
              7 * k,
              4 * k,
              8 * k,
              "#9b8f6f",
              "#d6c5a0",
            );
        } else if (o.type === "mine") {
          for (const dx of [-12, 12])
            this.line(
              { x: p.x + dx * k, y: p.y - 20 * k },
              { x: p.x, y: p.y - 43 * k },
              "#b6c9ae",
              3 * k,
            );
          this.line(
            { x: p.x, y: p.y - 43 * k },
            { x: p.x, y: p.y - 15 * k },
            "#b8ad86",
            3 * k,
          );
          this.diamond(p.x, p.y - 15 * k, 6 * k, 3 * k, "#edbc85");
        } else if (o.type === "bay" || o.type === "charger") {
          this.diamond(p.x, p.y - 21 * k, 14 * k, 7 * k, "#223f36", "#b1ecc4");
          c.beginPath();
          c.ellipse(p.x, p.y - 22 * k, 9 * k, 4 * k, 0, 0, 7);
          c.strokeStyle = o.powered ? "#b7fad1" : "#748779";
          c.lineWidth = 2 * k;
          c.stroke();
          if (o.type === "bay") {
            this.line(
              { x: p.x - 16 * k, y: p.y - 18 * k },
              { x: p.x - 16 * k, y: p.y - 37 * k },
              "#bad9bf",
              3 * k,
            );
            this.line(
              { x: p.x - 16 * k, y: p.y - 37 * k },
              { x: p.x, y: p.y - 40 * k },
              "#bad9bf",
              3 * k,
            );
          }
        }

        c.fillStyle = o.powered ? C.mint : "#dfb97a";
        c.fillRect(p.x - 12 * k, p.y - 4 * k, 5 * k, 3 * k);
        c.globalAlpha = 1;
        if (o.progress < 100) {
          c.fillStyle = "#132b2a";
          c.fillRect(p.x - 20 * k, p.y + 15 * k, 40 * k, 3 * k);
          c.fillStyle = C.mint;
          c.fillRect(p.x - 20 * k, p.y + 15 * k, 0.4 * o.progress * k, 3 * k);
        }
        if (selected || big)
          this.text(
            STRUCTURES[o.type].name.toUpperCase(),
            p.x,
            p.y + 30 * k,
            "#b5c7bd",
            9 * k,
          );
      } else if (o.entity === "drone") {
        const bob = Math.sin(this.time * 3 + o.id) * 2 * k;
        c.fillStyle = "#07171988";
        c.beginPath();
        c.ellipse(p.x, p.y + 4 * k, 9 * k, 4 * k, 0, 0, 7);
        c.fill();
        this.box(
          p.x,
          p.y - 8 * k + bob,
          8 * k,
          5 * k,
          6 * k,
          "#628984",
          o.role === "combat" ? "#e7ac92" : "#c6e2c9",
        );
        this.line(
          { x: p.x - 13 * k, y: p.y - 12 * k + bob },
          { x: p.x + 13 * k, y: p.y - 12 * k + bob },
          "#83b6ae",
          2 * k,
        );
        c.fillStyle = {
          miner: "#f4c295",
          hauler: "#a6d8f0",
          explorer: "#cbb8e9",
          builder: "#aff4c5",
          combat: "#ffaeb5",
        }[o.role];
        c.fillRect(p.x - 3 * k, p.y - 13 * k + bob, 6 * k, 3 * k);
        if (o.cargo)
          this.box(
            p.x + 6 * k,
            p.y + 1 * k,
            4 * k,
            2 * k,
            5 * k,
            C.ore,
            "#edc29a",
          );
        if (selected)
          this.text(
            `${Math.round(o.battery)}%`,
            p.x,
            p.y - 29 * k,
            C.mint,
            10 * k,
          );
      } else {
        const bob = Math.sin(this.time * 7 + o.id) * 2 * k;
        for (let i = -1; i <= 1; i++)
          this.line(
            { x: p.x, y: p.y - 5 * k },
            { x: p.x + i * 13 * k, y: p.y + 5 * k + bob },
            "#d58389",
            2 * k,
          );
        this.diamond(p.x, p.y - 6 * k, 10 * k, 7 * k, "#ac6573");
        this.diamond(p.x, p.y - 10 * k, 4 * k, 3 * k, "#ffc1b9");
      }
    }
    for (const e of s.events) {
      const age = (s.tick - e.tick) * 0.2 + this.tickElapsed;
      if (age > 1.2) continue;
      const p = this.screen(e.x, e.y);
      c.globalAlpha = 1 - age / 1.2;
      if (
        ["mine", "delivery", "combat", "build", "research"].includes(e.type)
      ) {
        c.beginPath();
        c.ellipse(
          p.x,
          p.y - 8 * k,
          age * 26 * k + 4,
          age * 13 * k + 2,
          0,
          0,
          7,
        );
        c.strokeStyle = e.type === "combat" ? C.enemy : C.mint;
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    if (this.placing && this.hover) {
      const p = this.screen(this.hover.x, this.hover.y);
      this.diamond(
        p.x,
        p.y,
        29 * k,
        15 * k,
        this.hover.valid ? "#a2f3c64d" : "#f8858555",
        this.hover.valid ? C.mint : C.enemy,
      );
      this.text(
        STRUCTURES[this.placing].icon,
        p.x,
        p.y - 15 * k,
        this.hover.valid ? C.mint : C.enemy,
        25 * k,
      );
    }
    const g = c.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.2,
      this.w / 2,
      this.h / 2,
      this.w * 0.75,
    );
    g.addColorStop(0, "#08141c00");
    g.addColorStop(1, "#08141c99");
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
  }
  minimap(s, canvas) {
    const c = canvas.getContext("2d"),
      scale = canvas.width / SIZE;
    c.fillStyle = "#14262a";
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (const t of s.tiles)
      if (t.seen) {
        c.fillStyle = t.ore
          ? "#be9776"
          : t.rock
            ? "#3d5350"
            : t.biome === "scar"
              ? "#51464c"
              : "#45615a";
        c.fillRect(t.x * scale, t.y * scale, scale, scale);
      }
    for (const d of s.drones) {
      c.fillStyle = "#b7f9d4";
      c.fillRect(d.x * scale, d.y * scale, 2, 2);
    }
    for (const b of s.buildings) {
      c.fillStyle = "#e5edd6";
      c.fillRect(b.x * scale - 1, b.y * scale - 1, 3, 3);
    }
    c.strokeStyle = "#c6f4d0";
    c.strokeRect(this.camera.x * scale - 8, this.camera.y * scale - 6, 16, 12);
  }
}
