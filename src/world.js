import { SIZE } from "./catalog.js";
export function hashSeed(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function random(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function generate(seed) {
  const s = { rng: hashSeed(seed) },
    tiles = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - 24, y - 24),
        r = random(s);
      tiles.push({
        x,
        y,
        biome: d > 18 ? "scar" : d > 11 ? "grove" : "basalt",
        rock: d > 4 && r < 0.1,
        ore: d > 4 && r > 0.84 ? 40 + Math.floor(random(s) * 100) : 0,
        hazard: d > 14 && r > 0.72 && r < 0.78,
        seen: d < 9,
        ruin: d > 12 && r > 0.996,
        shade: random(s),
      });
    }
  for (const [x, y] of [
    [19, 22],
    [28, 27],
    [26, 18],
  ]) {
    Object.assign(tiles[y * SIZE + x], {
      ore: 180,
      rock: false,
      hazard: false,
      seen: true,
    });
  }
  return { tiles, rng: s.rng };
}
export function reveal(s, x, y, r = 5) {
  for (
    let yy = Math.max(0, Math.floor(y - r));
    yy <= Math.min(SIZE - 1, y + r);
    yy++
  )
    for (
      let xx = Math.max(0, Math.floor(x - r));
      xx <= Math.min(SIZE - 1, x + r);
      xx++
    )
      if (Math.hypot(xx - x, yy - y) <= r) s.tiles[yy * SIZE + xx].seen = true;
}
// Stable cardinal BFS. Paths are cached on agents; only recomputed on goal / topology changes.
export function path(s, from, to, unknown = false) {
  const start = Math.round(from.y) * SIZE + Math.round(from.x),
    end = Math.round(to.y) * SIZE + Math.round(to.x);
  if (start === end) return [];
  const prev = new Int32Array(SIZE * SIZE).fill(-1),
    q = new Int32Array(SIZE * SIZE);
  let head = 0,
    tail = 0;
  q[tail++] = start;
  prev[start] = start;
  while (head < tail) {
    const n = q[head++],
      x = n % SIZE,
      y = Math.floor(n / SIZE);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = ny * SIZE + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= SIZE ||
        ny >= SIZE ||
        prev[k] !== -1 ||
        s.tiles[k].rock ||
        (!unknown && !s.tiles[k].seen && k !== end)
      )
        continue;
      prev[k] = n;
      if (k === end) {
        const out = [];
        for (let p = end; p !== start; p = prev[p])
          out.push({ x: p % SIZE, y: Math.floor(p / SIZE) });
        return out.reverse();
      }
      q[tail++] = k;
    }
  }
  return null;
}

// Reachability first: a visible rock is not a traversable frontier neighbour.
export function frontier(s, from) {
  const start = Math.round(from.y) * SIZE + Math.round(from.x),
    visited = new Uint8Array(SIZE * SIZE),
    q = [start];
  visited[start] = 1;
  for (let head = 0; head < q.length; head++) {
    const n = q[head],
      x = n % SIZE,
      y = Math.floor(n / SIZE);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = ny * SIZE + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= SIZE ||
        ny >= SIZE ||
        visited[k] ||
        s.tiles[k].rock
      )
        continue;
      if (!s.tiles[k].seen) return s.tiles[k];
      visited[k] = 1;
      q.push(k);
    }
  }
  return null;
}
