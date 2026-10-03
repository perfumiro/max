import { cp, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const exportRoot = path.join(appRoot, 'out');
const siteRoot = path.dirname(appRoot);
const siteEntry = path.join(siteRoot, 'app', 'index.html');
const exportedHtml = await readFile(path.join(exportRoot, 'index.html'), 'utf8');
const siteHtml = await readFile(siteEntry, 'utf8');
const entryPattern = /<script\b[^>]*\bsrc="(\/_expo\/static\/js\/web\/AppEntry-[a-f0-9]+\.js)"[^>]*><\/script>/g;
const exportedEntries = [...exportedHtml.matchAll(entryPattern)];
const siteEntries = [...siteHtml.matchAll(entryPattern)];
if (exportedEntries.length !== 1 || siteEntries.length !== 1) {
  throw new Error('Expected one Expo entry script in both exported and site HTML.');
}
const bundleUrl = exportedEntries[0][1];
await stat(path.join(exportRoot, bundleUrl.slice(1)));

// Copy assets first; preserve older hashed assets and the site's custom HTML/redirects.
for (const directory of ['assets', '_expo']) {
  await cp(path.join(exportRoot, directory), path.join(siteRoot, directory), { recursive: true });
}
await writeFile(siteEntry, siteHtml.replace(siteEntries[0][0], exportedEntries[0][0]));
console.log(`Updated /app/index.html to ${bundleUrl}`);
