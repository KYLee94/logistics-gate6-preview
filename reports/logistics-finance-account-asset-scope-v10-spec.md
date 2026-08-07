# Finance custom-account asset scope v10

## Status

SDD contract for the additive v10 finance account compatibility migration.
Previously applied migrations v6 through v9 are immutable inputs.

## Problem

The v6 contract correctly stores custom cash-flow accounts with an `asset_id`
and scopes active reads and writes to the resolved asset. It also uses
`finance_account_selections.selected = false` as the non-destructive inactive
state. Two user-facing recovery guarantees are missing:

1. a soft-deleted account disappears from `accounts_readback`, so the mutation
   response cannot prove which asset/account was archived; and
2. there is no user operation for restoring a soft-deleted custom account.

## Contract

- The server resolves `p_asset_key` to `v_asset_id`. Client-provided ownership,
  audit, revision, and deletion fields are discarded by the Edge router.
- A custom account is readable or mutable only when
  `cashflow_accounts.is_custom = true` and
  `cashflow_accounts.asset_id = v_asset_id`.
- `selection_operations.selected = false` is the reversible inactive state and
  preserves all ledger values.
- `account_operations.operation = delete` remains a soft delete. Accounts with
  active ledger entries remain protected by `FINANCE_ACCOUNT_HAS_LEDGER_ENTRIES`
  and must be made inactive instead.
- `account_operations.operation = restore` clears `deleted_at` and `deleted_by`
  for a custom account belonging to the same asset. It requires the current
  account revision and may be followed by a selection upsert in the same batch.
- `finance/read` returns active accounts in `data.accounts` and soft-deleted
  custom accounts for the selected asset only in `data.archived_accounts`.
- `finance/batch-save` returns active `accounts_readback` plus
  `account_mutations_readback`. The mutation readback includes `account_code`,
  `asset_id`, operation, active state, deletion timestamp, and revision, so a
  delete or restore is verifiable without treating absence as success.
- Account, selection, and ledger changes remain one transaction with the
  existing permission, revision, audit, and idempotency contracts.
- No public table access is added. Internal functions retain a fixed
  `search_path`, and execution remains revoked from public/anon/authenticated.

## Acceptance tests

- Router accepts `restore` without requiring editable name/section fields.
- Router removes client-supplied `asset_id`, audit, revision, and deletion
  fields from account records.
- SQL scopes active, archived, update, delete, and restore paths to the resolved
  `v_asset_id`.
- Delete and restore return an explicit mutation readback.
- Restore clears the soft-delete fields and uses revision checking.
- Audit and idempotency calls remain present.
- Byte hashes of applied v6, v7, v8, and v9 migration files do not change.
