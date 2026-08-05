#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const assetsDir = path.join(root, 'dist', 'assets');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

const fileEnv = {
  ...readEnvFile(path.join(root, '.env')),
  ...readEnvFile(path.join(root, '.env.local')),
  ...readEnvFile(path.join(root, '.env.production')),
};
const expectedUrl = String(process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '').replace(/\/$/u, '');
const bundles = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
  : [];
const bundleText = bundles.map((name) => fs.readFileSync(path.join(assetsDir, name), 'utf8')).join('\n');
const failures = [];

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/iu.test(expectedUrl)) failures.push('EXPECTED_SUPABASE_URL_MISSING');
if (!bundles.length) failures.push('PREVIEW_JS_BUNDLE_MISSING');
const expectedUrlPresent = Boolean(expectedUrl && bundleText.includes(expectedUrl));
if (/dummy-url\.supabase\.co|dummy-key/iu.test(bundleText) && !expectedUrlPresent) {
  failures.push('PLACEHOLDER_SUPABASE_CONFIG_IS_THE_ONLY_BUNDLE_CONFIG');
}
if (expectedUrl && !expectedUrlPresent) failures.push('EXPECTED_SUPABASE_URL_NOT_IN_BUNDLE');

const report = {
  ok: failures.length === 0,
  operating_network_used: false,
  database_write_used: false,
  bundle_count: bundles.length,
  expected_project_host: expectedUrl ? new URL(expectedUrl).host : null,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
