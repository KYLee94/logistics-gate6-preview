const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const modulePath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'features',
    'logistics-data-platform',
    'financeSchema.js',
  );
  const finance = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);
  const accounts = [
    { account_code: 'POTENTIAL_BASE_RENT', manual_entry_allowed: true },
    { account_code: 'PROPERTY_TAX_PUBLIC_DUES', manual_entry_allowed: true },
    { account_code: 'NET_OPERATING_INCOME', manual_entry_allowed: false },
  ];

  const row = finance.emptyManualFinanceEntry({ draftId: 'manual-1', month: '2026-08' });
  let errors = finance.validateManualFinanceEntries([row], accounts);
  assert.equal(errors.length, 2, 'account and amount are required; a default audit reason is supplied');

  Object.assign(row, {
    account_code: 'POTENTIAL_BASE_RENT',
    amount: 0,
    scenario: 'actual',
    accounting_basis: 'cash',
  });
  assert.deepEqual(finance.validateManualFinanceEntries([row], accounts), [], 'explicit zero must be accepted');

  row.amount = '';
  assert.equal(finance.validateManualFinanceEntries([row], accounts).length, 1, 'blank and zero must remain distinct');

  Object.assign(row, { amount: -100, account_code: 'NET_OPERATING_INCOME' });
  assert.equal(
    finance.validateManualFinanceEntries([row], accounts).length,
    1,
    'derived statement lines must not be manually overwritten',
  );

  for (const scenario of ['actual', 'budget', 'forecast']) {
    Object.assign(row, { account_code: 'PROPERTY_TAX_PUBLIC_DUES', scenario });
    assert.deepEqual(finance.validateManualFinanceEntries([row], accounts), [], `${scenario} must be writable`);
  }

  const serialized = finance.financeEntryForSave({
    ...row,
    source_kind: 'projection',
    source_ref: 'server-owned',
    data_status: 'provided',
  });
  assert.equal(serialized.scenario, 'forecast');
  assert.equal(serialized.source_kind, undefined);
  assert.equal(serialized.source_ref, undefined);
  assert.equal(serialized.data_status, undefined);

  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      'supabase',
      'migrations',
      '20260806024935_editable_noi_rent_roll_home.sql',
    ),
    'utf8',
  );
  assert.match(migration, /FINANCE_DERIVED_ACCOUNT_FORBIDDEN/u);
  assert.match(migration, /'actual',\s*'budget',\s*'forecast'/u);
  assert.match(migration, /source_kind[\s\S]{0,180}'manual_input'/u);
  assert.match(migration, /'manual_input',\s*'v2\/finance\/batch-save:'[\s\S]{0,160}entry_key,\s*'provided'/u);
  assert.match(migration, /sync_rent_roll_finance/iu);

  console.log('PASS logistics finance editable NOI contract');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
