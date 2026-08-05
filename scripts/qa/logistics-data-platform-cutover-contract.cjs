#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const unlock = read('scripts/ops/sql/logistics-data-platform-pilot-unlock.sql');
const emergencyLock = read('scripts/ops/sql/logistics-data-platform-emergency-lock.sql');
const readback = read('scripts/qa/sql/logistics-data-platform-shadow-readback.sql');

const checks = [];
const check = (id, assertion, evidence) => {
  assertion();
  checks.push({ id, ok: true, evidence });
};

check('pilot-unlock-is-transactional-and-guarded', () => {
  assert.match(unlock, /^begin;/iu);
  assert.match(unlock, /commit;\s*$/iu);
  assert.match(unlock, /active_pilot_count\s*<>\s*3/iu);
  assert.match(unlock, /latest_migration_status\s+is distinct from\s+'validated'/iu);
  assert.match(unlock, /latest_critical_exception_count[\s\S]{0,80}<>\s*0/iu);
  assert.match(unlock, /monthly_ledger_entries[\s\S]{0,100}<>\s*0/iu);
  assert.match(unlock, /locked_route_count\s*<>\s*active_asset_count/iu);
}, 'exactly three pilots, validated backfill, zero critical errors, empty finance, and locked routes');

check('pilot-unlock-opens-only-two-v2-writers', () => {
  const grants = [...unlock.matchAll(/grant execute on function\s+([^;]+)\s+to authenticated;/giu)]
    .map((match) => match[1].replace(/\s+/gu, ' ').trim());
  assert.deepEqual(grants, [
    'logistics_api.rent_roll_batch_save(uuid, text, jsonb, jsonb)',
    'logistics_api.finance_batch_save(uuid, text, jsonb, jsonb)',
  ]);
  assert.match(unlock, /set writer_mode = 'v2'/iu);
  assert.match(unlock, /set v2_write_enabled = true/iu);
  assert.match(unlock, /'pilot_write_unlock'/u);
}, 'only rent-roll and finance mutation RPCs are granted and audited');

check('emergency-lock-reverses-write-access', () => {
  assert.match(emergencyLock, /^begin;/iu);
  assert.match(emergencyLock, /set v2_write_enabled = false/iu);
  assert.match(emergencyLock, /set writer_mode = 'locked'/iu);
  assert.match(emergencyLock, /revoke execute on function logistics_api\.rent_roll_batch_save\(uuid, text, jsonb, jsonb\) from authenticated;/iu);
  assert.match(emergencyLock, /revoke execute on function logistics_api\.finance_batch_save\(uuid, text, jsonb, jsonb\) from authenticated;/iu);
  assert.match(emergencyLock, /'emergency_write_lock'/u);
  assert.match(emergencyLock, /commit;\s*$/iu);
}, 'feature flag, asset routes, and RPC grants return to the locked state');

check('shadow-readback-covers-cutover-invariants', () => {
  for (const requiredFragment of [
    'authenticator_config',
    'legacy_counts',
    'core_counts',
    'critical_exception_count',
    'active_count',
    'feature_enabled',
    'route_counts',
    'rent_roll_mutation_granted',
    'finance_mutation_granted',
  ]) {
    assert.ok(readback.includes(requiredFragment), `missing readback field ${requiredFragment}`);
  }
}, 'post-migration readback reports data parity, pilot identity, and server write state');

process.stdout.write(`${JSON.stringify({
  ok: true,
  mode: 'static-cutover-contract',
  operating_network_used: false,
  database_write_used: false,
  checks,
}, null, 2)}\n`);
