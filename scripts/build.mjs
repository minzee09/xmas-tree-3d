// Assemble each site into dist/<site>/ = the site's own files + shared/.
// Usage: node scripts/build.mjs [lite|guestbook ...] [--watch]
import { cpSync, rmSync, mkdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Files from each site folder that are served to the browser (the rest is config or server code). */
const SITES = {
  lite: ['index.html', 'main.js'],
  guestbook: ['index.html', 'main.js', 'guestbook.js', 'guestbook.css'],
};

const args = process.argv.slice(2);
const watching = args.includes('--watch');
const sites = args.filter((a) => !a.startsWith('--'));
const targets = sites.length ? sites : Object.keys(SITES);

for (const site of targets) {
  if (!SITES[site]) {
    console.error(`Unknown site "${site}". Choose from: ${Object.keys(SITES).join(', ')}`);
    process.exit(1);
  }
}

function build(site) {
  const out = join(root, 'dist', site);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(root, 'shared'), join(out, 'shared'), { recursive: true });
  for (const file of SITES[site]) cpSync(join(root, site, file), join(out, file));
  console.log(`built dist/${site}`);
}

targets.forEach(build);

if (watching) {
  let timer = null;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => targets.forEach(build), 100); };
  watch(join(root, 'shared'), { recursive: true }, rebuild);
  for (const site of targets) watch(join(root, site), rebuild);
  console.log('watching for changes…');
}
