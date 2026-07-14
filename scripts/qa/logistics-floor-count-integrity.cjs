#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const EDGE_FUNCTION = 'll-dashboard-api';
const EDGE_ACTION = 'dashboard/home/read';

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
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function compact(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/gu, '');
}

function parseFloorCount(value) {
  const text = compact(value);
  if (!text) return null;
  const parts = text.split('/').filter(Boolean);
  const abovePart = parts.find((part) => /^\d+F$/u.test(part));
  const belowPart = parts.find((part) => /^(?:B\d+|\d+B)$/u.test(part));
  if (!abovePart || !belowPart) return null;

  const above = Number(abovePart.slice(0, -1));
  const below = Number((belowPart.match(/\d+/u) || [''])[0]);
  if (!Number.isInteger(above) || above < 1 || !Number.isInteger(below) || below < 0) return null;
  return { above, below };
}

function parseFloorToken(value) {
  const text = compact(value);
  const basement = text.match(/^B(\d+)(?:F|층)?$/u) || text.match(/^(\d+)B$/u);
  if (basement) {
    const level = Number(basement[1]);
    return Number.isInteger(level) && level >= 1
      ? { position: -level, canonical: `B${level}` }
      : null;
  }

  const above = text.match(/^(?:지상)?(\d+)(?:F|층)?$/u);
  if (!above) return null;
  const level = Number(above[1]);
  return Number.isInteger(level) && level >= 1
    ? { position: level, canonical: `${level}F` }
    : null;
}

function canonicalFloorFromPosition(position) {
  return position < 0 ? `B${Math.abs(position)}` : `${position}F`;
}

function expandFloorLabel(value) {
  const text = compact(value);
  if (!text || text === '전체') return [];
  const segments = text.split(',');
  if (segments.some((segment) => !segment)) return null;
  const floors = [];

  for (const segment of segments) {
    const expanded = expandFloorSegment(segment);
    if (!expanded) return null;
    floors.push(...expanded);
  }
  return [...new Set(floors)];
}

function expandFloorSegment(text) {
  const parts = text.split('~');
  if (parts.length > 2) return null;
  const start = parseFloorToken(parts[0]);
  const end = parts.length === 2 ? parseFloorToken(parts[1]) : start;
  if (!start || !end) return null;

  const step = start.position <= end.position ? 1 : -1;
  const floors = [];
  for (let position = start.position; step > 0 ? position <= end.position : position >= end.position; position += step) {
    if (position !== 0) floors.push(canonicalFloorFromPosition(position));
  }
  return floors;
}

function isInsideMasterRange(label, floorCount) {
  const token = parseFloorToken(label);
  if (!token || !floorCount) return false;
  return token.position > 0
    ? token.position <= floorCount.above
    : Math.abs(token.position) <= floorCount.below;
}

function collectFloorCountViolations(assets, leaseSpaces) {
  const assetsById = new Map((assets || []).map((asset) => [String(asset.asset_id || ''), asset]));
  const violations = [];
  const ignored = {
    asset_missing: 0,
    floor_count_missing_or_unparseable: 0,
    floor_label_missing: 0,
    floor_label_non_positional: 0,
    floor_label_unparseable: 0,
  };

  for (const space of leaseSpaces || []) {
    const assetId = String(space.asset_id || '');
    const asset = assetsById.get(assetId);
    if (!asset) {
      ignored.asset_missing += 1;
      continue;
    }

    const floorCount = parseFloorCount(asset.floor_count);
    if (!floorCount) {
      ignored.floor_count_missing_or_unparseable += 1;
      continue;
    }

    const rawLabel = String(space.floor_label ?? '').trim();
    if (!rawLabel) {
      ignored.floor_label_missing += 1;
      continue;
    }
    if (compact(rawLabel) === '전체') {
      ignored.floor_label_non_positional += 1;
      continue;
    }

    const expanded = expandFloorLabel(rawLabel);
    if (!expanded) {
      ignored.floor_label_unparseable += 1;
      continue;
    }

    const outside = expanded.filter((label) => !isInsideMasterRange(label, floorCount));
    if (outside.length) {
      violations.push({
        asset_id: assetId,
        lease_space_id: String(space.lease_space_id || ''),
        lease_id: String(space.lease_id || ''),
        floor_label: rawLabel,
        expanded_floor_labels: expanded,
        outside_floor_labels: outside,
      });
    }
  }

  return { violations, ignored };
}

async function signIn(supabaseUrl, anonKey) {
  const accessToken = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (accessToken) return { token: accessToken, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL');
  const password = envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD');
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');

  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`Supabase Auth login failed (${response.status}).`);
  return { token: body.access_token, source: 'password_grant' };
}

async function readDashboardHome(supabaseUrl, anonKey, token) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: 'https://kylee94.github.io',
    },
    body: JSON.stringify({ action: EDGE_ACTION, payload: {} }),
  });
  const body = await response.json().catch(() => ({}));
  return { httpStatus: response.status, ok: response.ok && body?.ok === true, body };
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('Set LOGISTICS_SUPABASE_URL/VITE_SUPABASE_URL and LOGISTICS_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');

  const auth = await signIn(supabaseUrl, anonKey);
  const result = await readDashboardHome(supabaseUrl, anonKey, auth.token);
  const sourceIsSupabase = result.body?.source === 'supabase';
  const assets = Array.isArray(result.body?.data?.assets) ? result.body.data.assets : [];
  const leaseSpaces = Array.isArray(result.body?.data?.lease_spaces) ? result.body.data.lease_spaces : [];
  const integrity = result.ok && sourceIsSupabase
    ? collectFloorCountViolations(assets, leaseSpaces)
    : { violations: [], ignored: {} };
  const report = {
    ok: result.ok && sourceIsSupabase && integrity.violations.length === 0,
    generated_at: new Date().toISOString(),
    action: EDGE_ACTION,
    http_status: result.httpStatus,
    auth_source: auth.source,
    source: result.body?.source || null,
    asset_count: assets.length,
    lease_space_count: leaseSpaces.length,
    violations: integrity.violations,
    ignored: integrity.ignored,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  collectFloorCountViolations,
  expandFloorLabel,
  parseFloorCount,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
