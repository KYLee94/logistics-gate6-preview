const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const modulePath = path.resolve(__dirname, '..', '..', 'src', 'features', 'logistics-data-platform', 'financeSchema.js');
  const finance = await import(`${pathToFileURL(modulePath).href}?contract=${Date.now()}`);
  const accounts = [
    { account_code: 'RENT_INCOME', manual_entry_allowed: true },
    { account_code: 'DEBT_PRINCIPAL', manual_entry_allowed: false },
  ];

  const row = finance.emptyManualFinanceEntry({ draftId: 'manual-1', month: '2026-08' });
  let errors = finance.validateManualFinanceEntries([row], accounts).join('\n');
  assert.match(errors, /계정/u);
  assert.match(errors, /금액/u);
  assert.match(errors, /입력 근거/u);

  Object.assign(row, { account_code: 'RENT_INCOME', amount: 0, reason: '해당 월 실제 수납 없음', accounting_basis: 'cash' });
  assert.deepEqual(finance.validateManualFinanceEntries([row], accounts), [], 'explicit zero must be accepted');

  row.amount = '';
  assert.match(finance.validateManualFinanceEntries([row], accounts).join('\n'), /입력하지 않은 값과 0/u);

  Object.assign(row, { amount: 100, account_code: 'DEBT_PRINCIPAL' });
  assert.match(finance.validateManualFinanceEntries([row], accounts).join('\n'), /기존 원장/u);

  Object.assign(row, { account_code: 'RENT_INCOME', scenario: 'budget' });
  assert.match(finance.validateManualFinanceEntries([row], accounts).join('\n'), /실적만/u);

  const apiMigration = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20260804091000_logistics_data_platform_api.sql'),
    'utf8',
  );
  const mutation = apiMigration.match(
    /create or replace function logistics_core\.finance_batch_save_entry[\s\S]*?\$body\$;/iu,
  )?.[0] || '';
  assert.ok(mutation, 'finance mutation SQL must exist');
  for (const forbiddenField of ['source_ref', 'source_kind', 'data_status']) {
    assert.match(
      mutation,
      new RegExp(`record'\\s*\\?\\s*'${forbiddenField}'[\\s\\S]{0,260}CLIENT_SOURCE_METADATA_FORBIDDEN`, 'iu'),
      `${forbiddenField} must be rejected when supplied by a client`,
    );
  }
  assert.match(mutation, /source_kind[\s\S]{0,180}'manual_input'/iu);
  assert.match(mutation, /data_status[\s\S]{0,180}'provided'/iu);
  assert.match(mutation, /source_ref[\s\S]{0,260}'v2\/finance\/batch-save:'\s*\|\|\s*p_request_id::text/iu);
  assert.match(mutation, /rollback_export_state/iu);
  assert.match(mutation, /retained_in_core/iu);

  console.log('PASS logistics finance manual-input contract');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
