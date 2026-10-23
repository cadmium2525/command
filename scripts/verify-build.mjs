import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Script } from 'node:vm';

const root = path.resolve('dist');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<html[^>]*lang="ja"/);
assert.match(html, /<meta[^>]*name="viewport"/);
assert.doesNotMatch(html, /(?:src|href)="\/src\//, 'development source must not be shipped');
const files = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(target);
    else files.push(target);
  }
}
await visit(root);
assert.ok(files.some(file => /\.js$/.test(file) && !/sw\.js$/.test(file)), 'production JavaScript exists');
assert.ok(files.some(file => /\.css$/.test(file)), 'production styles exist');
const worker = await readFile(path.join(root, 'sw.js'), 'utf8');
new Script(worker, { filename: 'sw.js' });
assert.match(worker, /(?:install|precache)/i, 'offline worker has installation handling');
const assetPrefix = html.match(/(?:src|href)="([^"?#]*\/)assets\/[^"?#]+/)?.[1] ?? '/';
for (const reference of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
  const url = reference[1];
  if (/^(?:https?:|data:|mailto:)/.test(url)) continue;
  // Vite's emitted script identifies the Pages prefix for other local references too.
  const relative = (url.startsWith(assetPrefix) ? url.slice(assetPrefix.length) : url).replace(/^\.\//, '').replace(/^\//, '');
  const file = path.resolve(root, relative);
  assert.ok(file.startsWith(`${root}${path.sep}`), `reference stays in dist: ${url}`);
  assert.ok((await stat(file)).isFile(), `referenced production file exists: ${url}`);
}
const bytes = (await Promise.all(files.map(file => stat(file)))).reduce((total, file) => total + file.size, 0);
assert.ok(bytes < 5 * 1024 * 1024, `initial static release should stay below 5 MiB (actual ${bytes})`);
console.log(`Verified ${files.length} production files (${(bytes / 1024).toFixed(1)} KiB), references, and offline worker.`);
