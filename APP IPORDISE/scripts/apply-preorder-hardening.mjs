import { readFile } from 'node:fs/promises';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0];
if (!token || !projectRef) throw new Error('Supabase management credentials are missing');
const query = await readFile(new URL('../supabase/migrations/202609020001_preorder_deletion_integrity.sql', import.meta.url), 'utf8');
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, read_only: false }),
});
if (!response.ok) throw new Error(`Preorder hardening migration failed: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);

const verify = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `select column_name, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'preorder_requests' and column_name in ('product_id','variant_id') order by column_name`, parameters: [] }),
});
if (!verify.ok) throw new Error(`Preorder migration verification failed: HTTP ${verify.status}`);
const rows = await verify.json();
if (!Array.isArray(rows) || rows.length !== 2 || rows.some(row => row.is_nullable !== 'YES')) throw new Error('Preorder foreign-key columns are not deletion-safe');
console.log(JSON.stringify({ ok: true, migration: '202609020001_preorder_deletion_integrity', verifiedColumns: rows }, null, 2));
