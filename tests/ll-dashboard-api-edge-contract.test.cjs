const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const edgePath = path.join(__dirname, '..', 'supabase', 'functions', 'll-dashboard-api', 'index.ts');
const edgeSource = fs.readFileSync(edgePath, 'utf8');

test('floor plan uploads resolve the private bucket on the server', () => {
  assert.match(edgeSource, /async function resolveAssetFloorPlanBucket\(ctx: Context\)/u);
  assert.match(edgeSource, /await resolveAssetFloorPlanBucket\(ctx\)/u);
  assert.match(edgeSource, /storage_bucket is resolved by the server and cannot be overridden/u);
  assert.match(edgeSource, /LOGISTICS_FLOOR_PLAN_STORAGE_BUCKET/u);
});

test('gyeongsan coupang floor count preview action stays admin-only and dry-run', () => {
  assert.match(edgeSource, /const GYEONGSAN_COUPANG_FLOOR_COUNT_TARGET = Object\.freeze\(\{/u);
  assert.match(edgeSource, /async function callAdminGyeongsanCoupangFloorCountPreview\(ctx: Context, payload: Record<string, unknown>\)/u);
  assert.match(edgeSource, /if \(!hasRole\(ctx\.role, 'Admin'\)\) return fail\(403, 'Insufficient logistics permission', ctx\.origin\);/u);
  assert.match(edgeSource, /write_blocked: true/u);
  assert.match(edgeSource, /action === 'asset-admin\/gyeongsan-coupang-floor-count-preview'/u);
});
