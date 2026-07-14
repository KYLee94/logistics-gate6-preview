const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'qa', 'logistics-supabase-catalog-inventory.cjs'),
  'utf8',
);

test('active Supabase surfaces are classified as keep instead of cleanup candidates', () => {
  for (const tableName of [
    'll_asset_spec_files',
    'll_source_files',
    'll_source_rows',
    'll_news_items',
    'll_notifications',
    'll_staff_profiles',
  ]) {
    assert.match(source, new RegExp(`['"]${tableName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}['"]`, 'u'));
  }
  assert.match(source, /tableName\.startsWith\(['"]ll_sector_market_['"]\)/u);
});
