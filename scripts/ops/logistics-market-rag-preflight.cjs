#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6', 'market-rag-preflight');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function countRows(supabase, table) {
  const result = await supabase.from(table).select('*', { count: 'exact', head: true });
  return result.error ? { table, error: result.error.message, count: null } : { table, count: result.count || 0 };
}

async function countObjects(supabase, bucket) {
  const first = await supabase.storage.from(bucket).list('', { limit: 1000 });
  if (first.error) return { bucket, error: first.error.message, object_count: null };
  let count = 0;
  const walk = async (prefix = '') => {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const item of data || []) {
      if (item.id) count += 1;
      else await walk(`${prefix}${item.name}/`);
    }
  };
  await walk('');
  return { bucket, object_count: count };
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  ensureDir(OUT_DIR);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [documents, chunks, facts, objects] = await Promise.all([
    countRows(supabase, 'll_market_documents'),
    countRows(supabase, 'll_market_chunks'),
    countRows(supabase, 'll_market_facts'),
    countObjects(supabase, 'll-market-sources').catch((error) => ({ bucket: 'll-market-sources', error: error.message, object_count: null })),
  ]);
  const report = {
    ok: ![documents, chunks, facts, objects].some((item) => item.error),
    destructive_action_required: false,
    note: 'This command only reads counts. It does not delete tables, functions, or Storage objects.',
    checked_at: new Date().toISOString(),
    tables: [documents, chunks, facts],
    storage: objects,
  };
  const outPath = path.join(OUT_DIR, `market-rag-preflight-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'market-rag-preflight-latest.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ ...report, outPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
