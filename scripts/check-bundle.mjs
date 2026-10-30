import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const excluded = new Set(['.git', '.github', '.imd', 'node_modules', '.cache']);
const files = [];
async function walk(dir = '.') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('.log')) continue;
    const path = join(dir, entry.name);
    if (path === 'test/scratch') continue;
    if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed in deliverable: ${path}`);
    if (entry.isDirectory()) await walk(path);
    else files.push({ path, bytes: (await stat(path)).size });
  }
}
await walk();
const total = files.reduce((sum, f) => sum + f.bytes, 0);
const production = files.filter(f => f.path.startsWith('dist/')).reduce((sum, f) => sum + f.bytes, 0);
if (total > 8_388_608) throw new Error(`Bundle exceeds 8 MiB: ${total} B`);
const html = await readFile('dist/index.html', 'utf8');
if (!html.includes('<title>') || !html.includes('og:image') || /(?:src|href)="\/assets\//.test(html)) throw new Error('Static HTML metadata or relative paths invalid');
for (const path of ['dist/deployment.json', 'dist/favicon.svg', 'dist/social.png', 'dist/contract/SqueekCompanion.json', 'package-lock.json', 'DESIGN.md', 'README.md']) {
  if (!files.some(f => f.path === path)) throw new Error(`Missing deliverable ${path}`);
}
console.log(JSON.stringify({ bytes: total, limit: 8_388_608, productionBytes: production, files: files.length, largest: [...files].sort((a,b) => b.bytes - a.bytes).slice(0, 10) }, null, 2));
