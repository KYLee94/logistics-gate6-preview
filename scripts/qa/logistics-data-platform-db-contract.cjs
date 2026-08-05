const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const MIGRATION_PATTERN = /^2026080[45]\d{6}_logistics_data_platform.*\.sql$/u;

const CORE_TABLES = Object.freeze([
  'assets',
  'funds',
  'fund_asset_links',
  'fund_beneficiary_tranches',
  'lenders',
  'loans',
  'loan_lenders',
  'tenants',
  'lease_contracts',
  'spaces',
  'contract_spaces',
  'rent_terms',
  'rent_term_history',
  'lease_attributes',
  'cashflow_accounts',
  'monthly_ledger_entries',
  'ledger_adjustments',
  'user_permission_profiles',
  'user_asset_assignments',
  'maturities',
  'maturity_asset_scopes',
  'maturity_schedules',
  'formula_definitions',
  'api_idempotency_keys',
  'audit_events',
  'migration_runs',
  'migration_field_mappings',
  'migration_row_mappings',
  'migration_exceptions',
  'legacy_projection_state',
  'asset_writer_routes',
  'platform_feature_flags',
  'platform_pilot_users',
  'rollback_export_state',
]);

const PERMISSION_COLUMNS = Object.freeze([
  'managed_read',
  'managed_create',
  'managed_update',
  'managed_delete',
  'other_read',
  'other_create',
  'other_update',
  'other_delete',
]);

function migrationBundle() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => MIGRATION_PATTERN.test(name))
    .sort();
  assert.ok(files.length > 0, '20260804 logistics data-platform migration is missing');
  return {
    files,
    source: files
      .map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
      .join('\n'),
  };
}

function requirePattern(source, pattern, description) {
  assert.match(source, pattern, description);
  return description;
}

function main() {
  const checks = [];
  const check = (id, fn) => {
    try {
      checks.push({ id, ok: true, evidence: fn() });
    } catch (error) {
      checks.push({ id, ok: false, error: error.message });
    }
  };

  let bundle;
  check('migration-bundle-exists', () => {
    bundle = migrationBundle();
    return bundle.files;
  });

  if (bundle) {
    const { source } = bundle;

    check('additive-schema-boundary', () => {
      requirePattern(source, /create schema if not exists logistics_core/iu, 'logistics_core schema');
      requirePattern(source, /create schema if not exists logistics_api/iu, 'logistics_api schema');
      assert.doesNotMatch(
        source,
        /\b(?:drop|truncate)\s+table\s+(?:if\s+exists\s+)?public\.ll_|\balter\s+table\s+public\.ll_|\brename\s+(?:table|column)[\s\S]{0,120}public\.ll_/iu,
        'public.ll_* must never be dropped, truncated, renamed, or altered',
      );
      requirePattern(
        source,
        /alter role authenticator set pgrst\.db_schemas\s*=\s*'public, graphql_public, logistics_api'/iu,
        'Data API exposes logistics_api while preserving existing schemas',
      );
      assert.doesNotMatch(
        source,
        /pgrst\.db_schemas\s*=\s*'[^']*logistics_core/iu,
        'logistics_core must never be exposed through PostgREST',
      );
      requirePattern(source, /notify pgrst,\s*'reload config'/iu, 'PostgREST config reload');
      return 'schemas are additive and public.ll_* DDL is absent';
    });

    check('legacy-canonical-sources-are-preserved', () => {
      for (const table of [
        'll_assets', 'll_funds', 'll_fund_asset_links', 'll_fund_capital_tranches',
        'll_tenants', 'll_leases', 'll_lease_spaces', 'll_lease_attributes',
        'll_rent_history', 'll_notifications', 'll_user_permissions',
      ]) {
        requirePattern(source, new RegExp(`public\\.${table}\\b`, 'iu'), `${table} canonical source`);
      }
      requirePattern(source, /tranche_type[\s\S]{0,80}(?:=\s*'loan'|in\s*\(\s*'loan'\s*\))/iu, 'loan tranche discriminator');
      requirePattern(source, /source_is_active\s+boolean\s+not null/iu, 'loan source active state');
      requirePattern(source, /source_tranche_id,\s*source_is_active,\s*name_ko/iu, 'loan active state backfill column');
      requirePattern(source, /nullif\(source_row->>'is_active',\s*''\)::boolean/iu, 'loan active state backfill value');
      requirePattern(source, /repayment_schedule_status[\s\S]{0,80}not_provided/iu, 'missing repayment schedule is explicit');
      requirePattern(source, /drawdown_date\s+date/iu, 'loan drawdown date');
      requirePattern(source, /nullif\(source_row->>'drawdown_date',\s*''\)::date/iu, 'loan drawdown source value');
      const loanBackfill = source.match(/insert into logistics_core\.loans\s*\([\s\S]*?on conflict \(source_tranche_id\)[\s\S]*?;/iu)?.[0] || '';
      assert.ok(loanBackfill, 'loan backfill block is missing');
      assert.match(
        loanBackfill,
        /nullif\(source_row->>'committed_amount_krw',\s*''\)::numeric,\s*null,\s*nullif\(source_row->>'drawdown_date',\s*''\)::date/iu,
        'commitment is followed by an explicit unknown outstanding balance and the source drawdown date',
      );
      assert.doesNotMatch(
        loanBackfill,
        /nullif\(source_row->>'committed_amount_krw',\s*''\)::numeric,\s*nullif\(source_row->>'committed_amount_krw',\s*''\)::numeric/iu,
        'outstanding must not copy commitment when the source has no outstanding balance',
      );
      assert.doesNotMatch(source, /create table(?: if not exists)? logistics_core\.loan_repayment/iu);
      assert.doesNotMatch(source, /insert into logistics_core\.monthly_ledger_entries[\s\S]{0,600}(?:loan_schedule|repayment)/iu);
      return 'public.ll_* remains canonical and loan schedules are not synthesized';
    });

    check('normalized-core-tables', () => CORE_TABLES.map((table) => requirePattern(
      source,
      new RegExp(`create table(?: if not exists)? logistics_core\\.${table}\\b`, 'iu'),
      table,
    )));

    check('public-keys-preserve-legacy-compatible-shape', () => [
      requirePattern(source, /public_key\s+text\s+not null\s+unique/iu, 'canonical asset public key'),
      assert.doesNotMatch(
        source,
        /(?:public_key|asset_key)[\s\S]{0,160}\^\[A-Z0-9\]/u,
        'public key constraint must not reject existing lowercase asset_* keys',
      ),
    ]);

    check('rpc-only-grants', () => {
      requirePattern(source, /revoke all on all tables in schema logistics_core from public, anon, authenticated/iu, 'core table grants revoked');
      requirePattern(source, /alter default privileges[\s\S]{0,240}in schema logistics_core[\s\S]{0,160}revoke all on tables from public, anon, authenticated/iu, 'future core table grants revoked');
      assert.doesNotMatch(source, /grant\s+(?:all|select|insert|update|delete)[\s\S]{0,100}on\s+(?:all\s+tables\s+in\s+schema\s+)?logistics_core[\s\S]{0,100}to\s+(?:anon|authenticated)/iu);
      assert.doesNotMatch(source, /create\s+(?:table|view|materialized\s+view)\s+(?:if not exists\s+)?logistics_api\./iu);
      return 'core tables are private and logistics_api contains routines only';
    });

    check('defense-in-depth-rls', () => CORE_TABLES.map((table) => requirePattern(
      source,
      new RegExp(`alter table logistics_core\\.${table} enable row level security`, 'iu'),
      `${table} RLS`,
    )));

    check('eight-permission-columns', () => PERMISSION_COLUMNS.map((column) => requirePattern(
      source,
      new RegExp(`\\b${column}\\s+boolean\\s+not null`, 'iu'),
      column,
    )));

    check('exactly-three-dynamic-auth-uid-pilots', () => {
      requirePattern(source, /create table logistics_core\.platform_pilot_users\b/iu, 'pilot allowlist table');
      requirePattern(source, /user_id\s+uuid\s+primary key\s+references auth\.users\(id\)/iu, 'Auth UUID pilot key');
      requirePattern(source, /is_active\s+boolean\s+not null/iu, 'active pilot flag');
      requirePattern(source, /feature_permissions->>'permission_admin'/iu, 'permission_admin candidate source');
      for (const column of PERMISSION_COLUMNS) {
        const [scope, operation] = column.split('_');
        const jsonColumn = scope === 'managed' ? 'managed_asset_permissions' : 'other_asset_permissions';
        requirePattern(
          source,
          new RegExp(`${jsonColumn}->>'${operation}'`, 'iu'),
          `${column} pilot candidate condition`,
        );
      }
      requirePattern(source, /v_pilot_candidate_count\s*<>\s*3/iu, 'exactly three pilots or migration fails');
      requirePattern(source, /raise exception[\s\S]{0,180}PILOT_CANDIDATE_COUNT/iu, 'pilot count failure');
      const pilotBackfill = source.match(/insert into logistics_core\.platform_pilot_users[\s\S]*?on conflict \(user_id\)[\s\S]*?;/iu)?.[0] || '';
      assert.ok(pilotBackfill, 'pilot backfill block is missing');
      assert.doesNotMatch(pilotBackfill, /\b(?:email|staff_name)\b/iu, 'pilot selection must not use names or emails');
      assert.doesNotMatch(pilotBackfill, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu, 'pilot UUIDs must not be hardcoded');
      const writerGuard = source.match(/create or replace function logistics_core\.assert_v2_writer_route[\s\S]*?\$body\$;/iu)?.[0] || '';
      assert.match(writerGuard, /auth\.uid\(\)/iu);
      assert.match(writerGuard, /platform_pilot_users/iu);
      assert.match(writerGuard, /pilot\.user_id\s*=\s*actor_id[\s\S]{0,120}pilot\.is_active/iu);
      return 'exactly three active Auth UUID pilots selected from server permissions';
    });

    check('lease-attributes-lossless-generic-backfill', () => {
      for (const field of [
        'source_attribute_id', 'attribute_type', 'attribute_key', 'attribute_label',
        'value_text', 'value_numeric', 'value_sqm', 'value_py', 'unit_label', 'basis',
        'provenance', 'source_payload', 'source_row_hash',
      ]) {
        requirePattern(source, new RegExp(`\\b${field}\\b`, 'iu'), `generic lease attribute ${field}`);
      }
      for (const type of ['area_breakdown', 'space_spec', 'special_term']) {
        requirePattern(source, new RegExp(`'${type}'`, 'iu'), `supported attribute type ${type}`);
      }
      requirePattern(source, /public\.ll_lease_attributes[\s\S]{0,1200}attribute_type\s+not in/iu, 'unsupported attribute type detection');
      requirePattern(source, /'critical'[\s\S]{0,220}UNSUPPORTED_LEASE_ATTRIBUTE_TYPE/iu, 'unsupported type is critical');
      requirePattern(source, /on conflict \(source_attribute_id\) do update set/iu, 'attribute source changes update target');
      assert.doesNotMatch(source, /where[\s\S]{0,180}commencement_date[\s\S]{0,100}is not null[\s\S]{0,300}on conflict \(contract_key\)/iu);
      requirePattern(source, /commencement_date\s+date[,\n]/iu, 'contract start date is nullable');
      requirePattern(source, /effective_from\s+date[,\n]/iu, 'contract-space start date is nullable');
      return 'all legacy attribute values and provenance are retained without date-based contract exclusion';
    });

    check('invalid-legacy-rent-rows-are-quarantined-not-invented', () => {
      requirePattern(
        source,
        /LEGACY_RENT_ROW_QUARANTINED_MISSING_CONTRACT_SPACE/iu,
        'invalid legacy rent rows are recorded in the migration exception manifest',
      );
      requirePattern(
        source,
        /severity[\s\S]{0,240}'warning'/iu,
        'invalid source rows are explicit non-critical warnings',
      );
      requirePattern(
        source,
        /source_pk[\s\S]{0,600}'source_row'/iu,
        'original invalid source payload is retained for review',
      );
      requirePattern(
        source,
        /actionable rent parity failed/iu,
        'all source rows with a real contract space must match a core rent term',
      );
      return 'unlinked spreadsheet error rows are preserved as warnings without synthetic rent data';
    });

    check('production-sql-lint-hotfix-is-reproducible', () => {
      requirePattern(
        source,
        /RENT_ROLL_SPACE_PERMISSION_AMBIGUITY_HOTFIX/iu,
        'rent-roll space permission ambiguity hotfix marker',
      );
      requirePattern(
        source,
        /existing\.space_key = \(operation->>''space_key''\)/iu,
        'rent-roll permission lookup uses the operation value explicitly',
      );
      requirePattern(
        source,
        /alter function logistics_core\.normalize_month\(text\) stable/iu,
        'normalize_month volatility matches date parsing semantics',
      );
      requirePattern(
        source,
        /RENT_ROLL_ALLOCATION_SPACE_AMBIGUITY_HOTFIX/iu,
        'contract-space archive lookup ambiguity hotfix marker',
      );
      requirePattern(
        source,
        /allocation\.space_id = \(select matched_space\.id[\s\S]{0,360}row_record->>''space_key''/iu,
        'contract-space archive lookup resolves the saved row by its explicit operation key',
      );
      requirePattern(
        source,
        /RENT_ROLL_VARIABLE_CONFLICT_POLICY_HOTFIX/iu,
        'function-local variable conflict policy hotfix marker',
      );
      requirePattern(
        source,
        /#variable_conflict use_variable/iu,
        'rent-roll function resolves remaining ambiguous data expressions as local values',
      );
      requirePattern(
        source,
        /on conflict on constraint lease_contracts_contract_key_key do update/iu,
        'contract upsert conflict target uses the concrete unique constraint',
      );
      return 'production lint findings are repaired by an additive migration';
    });

    check('major-backfills-update-source-changes', () => {
      for (const key of [
        'asset_key', 'fund_key', 'link_key', 'source_tranche_id', 'lender_key',
        'loan_lender_key', 'tenant_key', 'contract_key', 'space_key',
        'contract_space_key', 'rent_term_key', 'user_id',
      ]) {
        requirePattern(
          source,
          new RegExp(`on conflict \\(${key}\\) do update set`, 'iu'),
          `${key} source change update`,
        );
      }
      return 'rerunning backfill refreshes major source projections';
    });

    check('ui-projection-uses-human-source-values', () => {
      requirePattern(source, /LOGISTICS_DATA_PLATFORM_UI_PROJECTION_V2/iu, 'UI projection migration marker');
      requirePattern(source, /add column if not exists display_order\s+integer/iu, 'rent-roll display order');
      requirePattern(source, /tenant_master_name/iu, 'human tenant master name source');
      requirePattern(source, /raw_tenant_name/iu, 'human tenant raw name fallback');
      requirePattern(source, /missing_master_placeholder[\s\S]{0,360}status\s*=\s*'inactive'/iu, 'unresolved placeholder tenant exclusion');
      requirePattern(source, /detail_area_label/iu, 'legacy detailed area label');
      requirePattern(source, /temperature_type/iu, 'legacy temperature use');
      requirePattern(source, /goods_type/iu, 'legacy goods use');
      requirePattern(source, /exclusive_ratio/iu, 'legacy exclusive ratio');
      requirePattern(source, /renewal_option/iu, 'legacy renewal option');
      requirePattern(source, /early_termination_right/iu, 'legacy termination right');
      requirePattern(source, /home_read_entry_v1/iu, 'home read compatibility wrapper');
      requirePattern(source, /rent_roll_read_entry_v1/iu, 'rent-roll read compatibility wrapper');
      requirePattern(source, /rent_roll_batch_save_entry_v1/iu, 'rent-roll save compatibility wrapper');
      requirePattern(source, /grant execute on function logistics_api\.rent_roll_batch_save\(uuid, text, jsonb, jsonb\) to authenticated/iu, 'rent-roll authenticated write RPC');
      requirePattern(source, /grant execute on function logistics_api\.finance_batch_save\(uuid, text, jsonb, jsonb\) to authenticated/iu, 'finance authenticated write RPC');
      requirePattern(source, /fund_beneficiary_tranches/iu, 'existing investment projection');
      requirePattern(source, /rent_free_months/iu, 'rent-free projection');
      requirePattern(source, /jsonb_build_object\(\s*'tenant_key'[\s\S]{0,240}'tenant_name'/iu, 'tenant selector human label');
      return 'legacy human values, investment detail, and row ordering are projected without new sample data';
    });

    check('auth-uid-and-asset-scope', () => [
      requirePattern(source, /auth\.uid\(\)\s+is\s+null/iu, 'explicit unauthenticated rejection'),
      requirePattern(source, /scope_mode\s+text\s+not null[\s\S]{0,180}(?:listed|all)/iu, 'listed/all managed scope'),
      requirePattern(source, /user_asset_assignments/iu, 'explicit managed asset assignment'),
      requirePattern(source, /assert_asset_permission/iu, 'central server permission check'),
    ]);

    check('soft-delete-and-revision', () => [
      requirePattern(source, /deleted_at\s+timestamptz/iu, 'soft delete timestamp'),
      requirePattern(source, /deleted_by\s+uuid/iu, 'soft delete actor'),
      requirePattern(source, /revision\s+bigint\s+not null\s+default\s+1/iu, 'revision counter'),
      requirePattern(source, /REVISION_CONFLICT/iu, 'revision conflict contract'),
      assert.doesNotMatch(source, /delete\s+from\s+logistics_core\.(?:assets|funds|loans|tenants|lease_contracts|spaces|rent_terms|monthly_ledger_entries|maturities)\b/iu),
    ]);

    check('monthly-ledger-dimensions', () => [
      requirePattern(source, /scenario\s+text\s+not null[\s\S]{0,220}'actual'[\s\S]{0,80}'budget'[\s\S]{0,80}'forecast'/iu, 'actual budget forecast'),
      requirePattern(source, /accounting_basis\s+text\s+not null[\s\S]{0,180}'accrual'[\s\S]{0,80}'cash'/iu, 'accrual cash'),
      requirePattern(source, /extract\(day from month\)\s*=\s*1/iu, 'month first-day check'),
      requirePattern(source, /monthly_ledger_entries[\s\S]{0,1600}unique\s*\(/iu, 'monthly natural-key uniqueness'),
      requirePattern(source, /source_ref\s+text\s+not null/iu, 'source document reference'),
      requirePattern(source, /source_line_key\s+text\s+not null/iu, 'source line reference'),
      requirePattern(source, /check\s*\(\s*btrim\(source_ref\)\s*<>\s*''/iu, 'non-empty source reference'),
      requirePattern(source, /check\s*\(\s*btrim\(source_line_key\)\s*<>\s*''/iu, 'non-empty source line key'),
      requirePattern(source, /account_kind\s+text\s+not null[\s\S]{0,180}'atomic'[\s\S]{0,80}'derived'/iu, 'atomic versus derived account'),
      requirePattern(source, /assert_atomic_ledger_account/iu, 'derived subtotal persistence guard'),
      requirePattern(source, /source_kind[\s\S]{0,240}'manual_input'/iu, 'manual input source kind'),
    ]);

    check('finance-starts-empty-and-email-delivery-is-absent', () => {
      const backfillSource = bundle.files
        .filter((name) => /backfill/iu.test(name))
        .map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
        .join('\n');
      assert.doesNotMatch(backfillSource, /insert\s+into\s+logistics_core\.monthly_ledger_entries/iu, 'finance rows must start empty');
      assert.doesNotMatch(source, /create table(?: if not exists)? logistics_core\.(?:delivery_outbox|delivery_attempts)\b/iu);
      assert.doesNotMatch(source, /\bresend\b|ll-maturity-email|recipient_email[\s\S]{0,120}channel\s+text/iu);
      requirePattern(source, /public\.ll_notifications/iu, 'existing in-app notifications store');
      return 'manual finance only and no outbound email schema';
    });

    check('formula-registry-is-versioned-and-immutable', () => [
      requirePattern(source, /formula_key\s+text\s+not null/iu, 'formula key'),
      requirePattern(source, /version\s+integer\s+not null/iu, 'formula version'),
      requirePattern(source, /expression_ast\s+jsonb\s+not null/iu, 'validated formula AST'),
      requirePattern(source, /prevent_formula_mutation/iu, 'formula immutability trigger'),
      requirePattern(source, /before update or delete on logistics_core\.formula_definitions/iu, 'formula update/delete guard'),
    ]);

    check('idempotency-audit-and-mapping', () => [
      requirePattern(source, /unique\s*\(actor_user_id, action, client_request_id\)/iu, 'idempotency unique key'),
      requirePattern(source, /request_hash\s+text\s+not null/iu, 'idempotency request hash'),
      requirePattern(source, /audit_events/iu, 'append-only audit'),
      requirePattern(source, /prevent_audit_mutation/iu, 'audit mutation guard'),
      requirePattern(source, /migration_row_mappings/iu, 'old-to-new row mapping'),
      requirePattern(source, /migration_exceptions[\s\S]{0,1600}critical/iu, 'critical migration exception'),
      requirePattern(source, /legacy_projection_state/iu, 'legacy projection readback state'),
    ]);

    check('single-writer-route-guard', () => [
      requirePattern(source, /asset_writer_routes/iu, 'asset writer route table'),
      requirePattern(source, /platform_feature_flags/iu, 'server feature flag table'),
      requirePattern(source, /v2_write_enabled\s+boolean\s+not null/iu, 'server pilot write flag'),
      requirePattern(source, /writer_mode\s+text\s+not null[\s\S]{0,180}'legacy'[\s\S]{0,80}'v2'[\s\S]{0,80}'locked'/iu, 'legacy v2 locked modes'),
      requirePattern(source, /assert_v2_writer_route/iu, 'v2 writer route guard'),
      requirePattern(source, /MAINTENANCE_MODE/iu, 'locked writer error'),
      assert.doesNotMatch(source, /WRITER_ROUTE_LOCKED|WRITER_LOCKED/iu),
    ]);

    check('finance-rollback-export-is-core-retained', () => [
      requirePattern(source, /create table logistics_core\.rollback_export_state\b/iu, 'rollback export table'),
      requirePattern(source, /retained_in_core\s+boolean\s+not null\s+default\s+true/iu, 'core retention flag'),
      requirePattern(source, /export_payload\s+jsonb\s+not null/iu, 'rollback export payload'),
      requirePattern(source, /readback_status[\s\S]{0,120}'verified'[\s\S]{0,80}'mismatch'/iu, 'rollback export readback state'),
    ]);

    check('base-migration-does-not-expose-core-entry-functions', () => {
      assert.doesNotMatch(
        source,
        /grant\s+execute\s+on\s+function\s+logistics_core\.[\s\S]{0,160}\s+to\s+authenticated/iu,
        'authenticated may execute logistics_api RPC only',
      );
      return 'no authenticated EXECUTE on logistics_core functions';
    });

    check('backfill-contract-is-present-before-implementation', () => {
      assert.ok(bundle.files.some((name) => /backfill/iu.test(name)), 'old-to-new backfill migration is missing');
      requirePattern(source, /critical_exception_count/iu, 'critical exception zero gate');
      requirePattern(source, /source_row_hash/iu, 'source row hash');
      requirePattern(source, /target_row_hash/iu, 'target row hash');
      requirePattern(source, /public\.ll_fund_capital_tranches/iu, 'loan and beneficiary source');
      requirePattern(source, /public\.ll_leases/iu, 'lease source');
      requirePattern(source, /public\.ll_rent_history/iu, 'rent source');
      return 'backfill migration and hash gates';
    });
  }

  const report = {
    ok: checks.every((row) => row.ok),
    mode: 'static-database-contract',
    database_write_used: false,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
