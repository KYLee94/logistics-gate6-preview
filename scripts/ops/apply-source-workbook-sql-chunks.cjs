#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_CHUNK_DIR = path.join(
  ROOT,
  'qa-artifacts',
  'logistics-gate6',
  'source-workbook-ingest',
  'source-workbook-ingest-sector_market-2026Q1-sql-chunks',
);

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function main() {
  const chunkDir = path.resolve(argValue('chunk-dir', DEFAULT_CHUNK_DIR));
  const from = Number(argValue('from', '1')) || 1;
  const to = Number(argValue('to', '9999')) || 9999;
  if (!fs.existsSync(chunkDir)) throw new Error(`Chunk directory not found: ${chunkDir}`);
  const files = fs.readdirSync(chunkDir)
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .filter((name) => {
      const index = Number(name.slice(0, 3));
      return index >= from && index <= to;
    })
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(chunkDir, name));
  if (!files.length) throw new Error(`No SQL chunks found in ${chunkDir}`);

  const startedAt = new Date().toISOString();
  console.log(JSON.stringify({ ok: true, event: 'start', chunk_dir: chunkDir, chunk_count: files.length, started_at: startedAt }));
  files.forEach((file, index) => {
    const label = `${index + 1}/${files.length}`;
    console.log(JSON.stringify({ ok: true, event: 'apply_chunk', index: index + 1, file: path.relative(ROOT, file).replace(/\\/gu, '/') }));
    const result = spawnSync(
      'npx',
      ['supabase@latest', 'db', 'query', '--linked', '--file', file],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
    );
    if (result.status !== 0) {
      console.error(JSON.stringify({
        ok: false,
        event: 'chunk_failed',
        label,
        file,
        status: result.status,
        error: result.error ? String(result.error.message || result.error) : '',
        stdout: result.stdout?.slice(-2000) || '',
        stderr: result.stderr?.slice(-4000) || '',
      }, null, 2));
      process.exit(result.status || 1);
    }
  });
  console.log(JSON.stringify({ ok: true, event: 'complete', chunk_count: files.length, completed_at: new Date().toISOString() }));
}

main();
