#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const root = path.resolve(__dirname, '..', '..');
  const documentPath = path.join(root, 'src', 'features', 'logistics-data-platform', 'documentContract.js');
  const documents = await import(`${pathToFileURL(documentPath).href}?contract=${Date.now()}`);

  const entries = [
    { account_code: 'BASE_RENT', month: '2026-08', amount: 70, source_kind: 'projection' },
    { account_code: 'BASE_RENT', month: '2026-08-15', amount: 30, entry_key: 'legacy-entry' },
    { account_code: 'BASE_RENT', month: '2026-09', amount: 20 },
  ];
  const replaced = documents.replaceFinanceCellValue(entries, 'BASE_RENT', '2026-08', 125);
  assert.deepEqual(replaced, [
    { account_code: 'BASE_RENT', month: '2026-09', amount: 20 },
    { account_code: 'BASE_RENT', month: '2026-08', amount: 125, operation: 'update' },
  ], 'one visible cell replaces every same-account same-month source row');

  const cleared = documents.replaceFinanceCellValue(entries, 'BASE_RENT', '2026-08', '');
  assert.deepEqual(cleared, [{ account_code: 'BASE_RENT', month: '2026-09', amount: 20 }]);

  const statement = documents.buildIncomeExpenseStatement({
    periods: ['2026-09', '2026-08', 'invalid'],
    accounts: [{ account_code: 'BASE_RENT', name: '임대료', statement_section: 'potential_income' }],
    entries: replaced,
    selectedAccountCodes: ['BASE_RENT'],
  });
  assert.deepEqual(statement.periods, ['2026-08', '2026-09']);
  assert.deepEqual(statement.potential_income, [{
    account_code: 'BASE_RENT',
    statement_section: 'potential_income',
    label: '임대료',
    normal_sign: 1,
    selected: true,
    amounts: { '2026-08': 125, '2026-09': 20 },
  }]);

  const payload = documents.buildIncomeExpenseDocumentPayload({
    ...statement,
    source_kind: 'client-forbidden',
    potential_income: [{
      ...statement.potential_income[0],
      entry_key: 'legacy-entry',
      account_code: 'BASE_RENT',
      revision: 4,
      amounts: {
        ...statement.potential_income[0].amounts,
        entry_key: 1,
        '2026-10': Number.POSITIVE_INFINITY,
      },
    }],
  });
  assert.deepEqual(payload.statement.potential_income, [{
    account_code: 'BASE_RENT',
    statement_section: 'potential_income',
    label: '임대료',
    normal_sign: 1,
    selected: true,
    amounts: { '2026-08': 125, '2026-09': 20 },
  }]);
  for (const forbidden of ['entry_key', 'source_kind', 'revision', 'operation']) {
    assert.equal(JSON.stringify(payload).includes(forbidden), false, `${forbidden} leaked into finance document`);
  }

  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260807180000_simplify_logistics_core_to_four_ui_tables.sql'),
    'utf8',
  );
  assert.match(migration, /assert_statement_valid\(p_payload->'statement'\)/iu);
  assert.match(migration, /EXPECTED_XMIN_REQUIRED/iu);
  assert.match(migration, /FINANCE_AMOUNT_INVALID/iu);
  assert.match(migration, /FINANCE_READBACK_MISMATCH/iu);
  assert.doesNotMatch(
    migration.match(/create\s+table\s+logistics_core\.income_expense[\s\S]*?\n\);/iu)?.[0] || '',
    /entry_key|account_code|source_kind|scenario|accounting_basis/iu,
  );

  console.log('PASS logistics finance full-document cell edit contract');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
