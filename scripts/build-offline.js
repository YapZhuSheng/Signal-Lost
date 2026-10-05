import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (e.name !== "sw.js") out.push(p);
  }
  return out;
}
const all = await files("dist"),
  hash = createHash("sha256");
for (const f of all) hash.update(await readFile(f));
const version = hash.digest("hex").slice(0, 12),
  urls = all.map((p) => "/" + p.slice(5));
await writeFile(
  "dist/sw.js",
  `const CACHE='signal-lost-${version}',ASSETS=${JSON.stringify(["/", ...urls])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('signal-lost-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request).catch(()=>event.request.mode==='navigate'?caches.match('/index.html'):Response.error())));});
`,
);
console.log(`Offline cache ${version}: ${urls.length} files`);
