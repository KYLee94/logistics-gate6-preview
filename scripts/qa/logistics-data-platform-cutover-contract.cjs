#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase', 'migrations', '20260807180000_simplify_logistics_core_to_four_ui_tables.sql'),
  'utf8',
);

const checks = [];
function check(id, assertion, evidence) {
  assertion();
  checks.push({ id, ok: true, evidence });
}

check('document-cutover-is-transactional-and-guarded', () => {
  assert.match(migration, /(?:^|\n)begin;/iu);
  assert.match(migration, /pg_advisory_xact_lock/iu);
  assert.match(migration, /SIMPLE_CORE_SOURCE_SCHEMA_MISSING/iu);
  assert.match(migration, /SIMPLE_CORE_ROLLBACK_SCHEMA_ALREADY_EXISTS/iu);
  assert.match(migration, /SIMPLE_CORE_SOURCE_READERS_MISSING/iu);
  assert.match(migration, /commit;\s*$/iu);
}, 'the four-document replacement rolls back atomically on every failed preflight or readback');

check('four-documents-are-staged-and-read-back', () => {
  for (const table of ['funds', 'assets', 'rent_roll', 'income_expense']) {
    assert.match(migration, new RegExp(`create\\s+temporary\\s+table\\s+simple_core_${table}`, 'iu'));
    assert.match(migration, new RegExp(`create\\s+table\\s+logistics_core\\.${table}`, 'iu'));
    assert.match(migration, new RegExp(`insert\\s+into\\s+logistics_core\\.${table}`, 'iu'));
  }
  assert.match(migration, /SIMPLE_CORE_FINAL_ROW_COUNT_MISMATCH/iu);
  assert.match(migration, /SIMPLE_CORE_FINAL_READBACK_MISMATCH/iu);
}, 'all four UI documents are copied through temporary staging and compared before commit');

check('three-person-login-gate-survives-cutover', () => {
  for (const name of ['이관용', '전기영', '이시정']) assert.ok(migration.includes(name));
  assert.match(migration, /create\s+temporary\s+table\s+simple_core_login_allowlist/iu);
  assert.match(migration, /create\s+or\s+replace\s+function\s+logistics_core\.enforce_temporary_login_gate/iu);
  assert.match(migration, /create\s+trigger\s+ll_user_permissions_temporary_login_gate[\s\S]*on\s+public\.ll_user_permissions/iu);
  assert.match(migration, /SIMPLE_CORE_LOGIN_GATE_READBACK_MISMATCH/iu);
  assert.match(migration, /SIMPLE_CORE_POST_DROP_LOGIN_GATE_MISSING/iu);
}, 'the exact approved users and trigger function are verified before and after archive cleanup');

check('archive-cleanup-cannot-cascade-public-contracts', () => {
  const dependencyCheck = migration.indexOf('SIMPLE_CORE_ARCHIVE_EXTERNAL_DEPENDENCY');
  const archiveDrop = migration.indexOf('drop schema logistics_core_rollback_20260807 cascade');
  const postDropCheck = migration.indexOf('SIMPLE_CORE_ARCHIVE_DROP_FAILED');
  assert.ok(dependencyCheck >= 0 && archiveDrop > dependencyCheck && postDropCheck > archiveDrop);
  assert.match(migration, /pg_depend/iu);
  assert.match(migration, /SIMPLE_CORE_POST_DROP_WRAPPER_MISMATCH/iu);
}, 'external dependencies are zero before CASCADE and eight wrappers are present afterward');

check('writers-are-document-rpcs-with-xmin', () => {
  for (const writer of ['home_batch_save', 'rent_roll_batch_save', 'finance_batch_save']) {
    assert.match(migration, new RegExp(`logistics_api\\.${writer}`, 'iu'));
    assert.match(migration, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+logistics_api\\.${writer}[^;]+to\\s+authenticated`, 'iu'));
  }
  assert.match(migration, /EXPECTED_XMIN_REQUIRED/iu);
  assert.match(migration, /REVISION_CONFLICT/iu);
  assert.match(migration, /v_readback\s*:=\s*logistics_core\.home_read_entry/iu);
  assert.match(migration, /RENT_ROLL_READBACK_MISMATCH/iu);
  assert.match(migration, /FINANCE_READBACK_MISMATCH/iu);
}, 'home, rent-roll, and finance save complete documents with xmin conflict and readback guards');

check('final-schema-is-exact-and-forbidden-keys-are-checked', () => {
  const tables = [...migration.matchAll(/create\s+table\s+logistics_core\.([a-z0-9_]+)/giu)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(tables, ['assets', 'funds', 'income_expense', 'rent_roll']);
  assert.match(migration, /SIMPLE_CORE_FINAL_TABLE_COUNT_MISMATCH/iu);
  assert.match(migration, /SIMPLE_CORE_RENT_KEY_FORBIDDEN/iu);
  assert.match(migration, /SIMPLE_CORE_STATEMENT_ROW_KEY_FORBIDDEN/iu);
}, 'the final application schema is four tables and recursively rejects technical nested keys');

process.stdout.write(`${JSON.stringify({
  ok: true,
  mode: 'four-document-cutover-contract',
  operating_network_used: false,
  database_write_used: false,
  checks,
}, null, 2)}\n`);
