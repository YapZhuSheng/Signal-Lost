import { serialize, deserialize } from "./simulation.js";
const KEY = "signal-lost.save.v1",
  BACKUP = KEY + ".backup";
function checksum(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
function wrap(raw) {
  return JSON.stringify({ checksum: checksum(raw), payload: raw });
}
function unwrap(raw) {
  const x = JSON.parse(raw);
  if (!x.payload || checksum(x.payload) !== x.checksum)
    throw Error("Save integrity check failed");
  return deserialize(x.payload);
}
export function save(s, settings, storage = localStorage) {
  const next = wrap(serialize(s, settings));
  unwrap(next);
  const old = storage.getItem(KEY);
  if (old) {
    try {
      unwrap(old);
      storage.setItem(BACKUP, old);
    } catch {}
  }
  storage.setItem(KEY, next);
}
export function load(storage = localStorage) {
  let broken = false;
  for (const k of [KEY, BACKUP]) {
    const raw = storage.getItem(k);
    if (raw) {
      try {
        return { ...unwrap(raw), recovered: k === BACKUP };
      } catch {
        broken = true;
      }
    }
  }
  if (broken)
    throw Error("Saved data is damaged. Import an exported save to recover.");
  return null;
}
export function exportSave(s, settings) {
  const blob = new Blob([serialize(s, settings)], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `signal-lost-${s.seed.replace(/[^a-z0-9-]/gi, "_")}-${s.tick}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
