import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { X509Certificate } from 'node:crypto';
import { parseEnv } from 'node:util';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0];
if (!projectRef) throw new Error('Supabase project configuration is missing');
const version = '202610040001';
const name = 'catalog_price_display_repair';
const migration = await readFile(new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url), 'utf8');
const literal = value => `'${value.replaceAll("'", "''")}'`;
const query = `begin;\n${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values (${literal(version)},${literal(name)},ARRAY[${literal(migration)}]) on conflict(version) do nothing;\ncommit;`;
if (token) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, read_only: false }), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Catalog schema repair failed: HTTP ${response.status}`);
} else {
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error('Database credentials are missing');
  const require = createRequire(import.meta.url);
  const { Client } = require(process.env.IPORDISE_PG_MODULE || 'pg');
  const pooler = new URL((await readFile(new URL('../supabase/.temp/pooler-url', import.meta.url), 'utf8')).trim());
  if (pooler.username !== `postgres.${projectRef}`) throw new Error('Linked database does not match the app API');
  const caResponse = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', { signal: AbortSignal.timeout(20_000) });
  if (!caResponse.ok) throw new Error(`Supabase root certificate download failed: HTTP ${caResponse.status}`);
  const ca = await caResponse.text();
  const certificate = new X509Certificate(ca);
  if (!certificate.ca || !certificate.subject.includes('Supabase')) throw new Error('Unexpected database root certificate');
  const envFile = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const configuredPasswords = [...new Set([process.env.SUPABASE_DB_PASSWORD, ...envFile.split(/\r?\n/).filter(line => /^SUPABASE_DB_PASSWORD\s*=/.test(line)).map(line => parseEnv(line).SUPABASE_DB_PASSWORD)].filter(Boolean))];
  let applied = false;
  for (const password of configuredPasswords) {
    const client = new Client({ host: pooler.hostname, port: Number(pooler.port || 5432), database: 'postgres', user: pooler.username, password, ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 20_000, statement_timeout: 30_000 });
    try { await client.connect(); await client.query(query); applied = true; break; }
    catch (error) { if (error.code !== '28P01') throw error; }
    finally { await client.end(); }
  }
  if (!applied) throw new Error('The configured database credentials are rejected; restore production project access');
}
console.log(JSON.stringify({ ok: true, migration: version, priceDisplayDefault: false }));
