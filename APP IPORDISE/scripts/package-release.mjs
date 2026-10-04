import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const siteRoot = path.dirname(appRoot);
const version = JSON.parse(await readFile(path.join(appRoot, 'app.json'), 'utf8')).expo.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
const output = path.join(appRoot, 'release-artifacts', version, 'deployment');
const website = path.join(output, 'website');
const api = path.join(output, 'api');
await mkdir(path.join(website, 'app'), { recursive: true });
for (const file of ['index.html', 'discover.html', 'script.js']) await cp(path.join(siteRoot, file), path.join(website, file));
await cp(path.join(siteRoot, 'app', 'index.html'), path.join(website, 'app', 'index.html'));
const html = await readFile(path.join(website, 'app', 'index.html'), 'utf8');
const bundle = html.match(/src="(\/_expo\/static\/js\/web\/AppEntry-[a-f0-9]+\.js)"/)?.[1];
if (!bundle) throw new Error('Website release bundle is missing');
await mkdir(path.dirname(path.join(website, bundle)), { recursive: true });
await cp(path.join(siteRoot, bundle), path.join(website, bundle));
await cp(path.join(appRoot, 'out', 'assets'), path.join(website, 'assets'), { recursive: true });
for (const folder of ['admin-catalog-sync', 'create-preorder', '_shared']) {
  await cp(path.join(appRoot, 'supabase', 'functions', folder), path.join(api, 'supabase', 'functions', folder), { recursive: true, filter: source => !/(?:^|[\\/])\.env(?:\.|$)/.test(source) });
}
await mkdir(path.join(api, 'supabase', 'migrations'), { recursive: true });
await cp(path.join(appRoot, 'supabase', 'migrations', '202610040001_catalog_price_display_repair.sql'), path.join(api, 'supabase', 'migrations', '202610040001_catalog_price_display_repair.sql'));
await cp(path.join(appRoot, 'docs', 'RELEASE_1.0.1.md'), path.join(output, 'RELEASE.md'));
await writeFile(path.join(output, 'README.txt'), `IPORDISE ${version}\n\nMerge the contents of website/ into the existing website, preserving other pages. Root index.html is the existing boutique homepage with updated script caching. The app/index.html and matching bundle belong together.\n\nDeploy the API functions from the existing Supabase project with the command in RELEASE.md. The additive schema repair is already applied in production.\n\nThis package contains public website assets, function source, and release notes. It contains no environment files or signing credentials.\n`);
console.log(JSON.stringify({ version, output, bundle }));
