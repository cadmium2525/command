import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
async function files(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir,e.name),`${prefix}${e.name}/`) : [`${prefix}${e.name}`]));
  return nested.flat().filter(x=>x!=='sw.js');
}
const paths = (await files(fileURLToPath(root))).sort();
const hash = createHash('sha256');
for (const path of paths) { hash.update(path); hash.update(await readFile(new URL(path,root))); }
const version = hash.digest('hex').slice(0,16);
const script = `// Generated from the complete production build. No external dependencies.
const VERSION=${JSON.stringify(version)};
const CACHE='secret-start:'+self.registration.scope+':'+VERSION;
const URLS=${JSON.stringify(paths.map(p=>'./'+p))}.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('secret-start:'+self.registration.scope+':')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||!request.url.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./index.html',self.registration.scope).href))));
  return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(request);if(cached)return cached;
  return fetch(request);
 }));
});
`;
await writeFile(new URL('sw.js',root),script);
console.log(`Offline cache ${version}: ${paths.length} local files.`);
