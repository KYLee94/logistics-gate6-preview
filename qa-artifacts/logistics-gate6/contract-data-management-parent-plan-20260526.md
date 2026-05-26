# Contract Data Management Parent Plan - 2026-05-26

## Purpose

Users need to update lease contract data directly in the web platform. The source scope is the original Excel workbook `★ 260414_물류센터 임대차계약 DB_취합본.xlsx`, especially `DB_일반` and `DB_히스토리 누적`.

This is not the same as the existing management project table or Asset overview/investment/fund overview editors. Those already have separate edit paths.

## Checklist Parent

Stage 16 was added to the Gate 6 tracker:

- Parent: `임대차계약 데이터 관리 탭 구축`
- Current status: `0 / 24`

## Target Tables

The contract data management workflow should use the canonical operating schema:

- `ll_assets`
- `ll_tenants`
- `ll_leases`
- `ll_lease_spaces`
- `ll_rent_history`
- `ll_lease_attributes`
- `ll_source_field_registry`
- `ll_source_cells`
- `ll_edit_requests`
- `ll_audit_events`

## Design Principle

Do not copy the current Data Quality cell-edit API for all contract changes.

Simple typo correction can use the existing edit request pattern, but real contract operations need event-based workflows because they can create rows, expire rows, split floors, or append history.

## Event Types

| Event | Purpose | DB principle |
|---|---|---|
| 신규 계약 | Add a new tenant/contract/space/rent history | create `ll_leases`, `ll_lease_spaces`, first `ll_rent_history`, optional attributes |
| 연장 계약 | Extend an existing contract | preserve prior history and append/adjust current period |
| 임대료/관리비 변경 | Change time-based amounts | append `ll_rent_history`; do not overwrite old periods |
| RF/FO/TI 변경 | Change concession terms | store on lease or event payload and recalculate monthly basis |
| 만료/공실 전환 | End active lease space | mark active row expired and update vacancy basis |
| 부분공실 | Split leased and vacant portions | supersede old row and create child rows |
| 층/구역 분할 | Split one broad row into multiple physical rows | child row sums must equal original row |
| 오입력 정정 | Correct wrong source value | before-value readback, source evidence, audit required |

## Required API

Recommended Edge actions:

- `lease-events/list`
- `lease-events/detail`
- `lease-events/preview`
- `lease-events/submit`
- `lease-events/readback`
- `lease-events/approve`
- `lease-events/reject`
- `lease-events/drafts/save`
- `lease-events/drafts/list`

Approval writer must be transactional.

## Required Validation

- server checks JWT and `ll_user_permissions`
- client-sent role/user/scope ignored
- read/add/update/delete permissions separated
- no self approval
- stale value blocked by readback before write
- child split area sum must match source row
- active lease overlap forbidden unless explicitly modeled as split
- rent history period must not destroy prior periods
- source row/cell evidence required when available

## UI Structure

Recommended tab sections:

1. `계약 현황`
2. `이벤트 등록`
3. `승인 대기`
4. `처리 이력`
5. `원본 매핑`

Recommended layout:

- top filters: asset, tenant, status, event type, date range
- left list: contracts/spaces
- right detail: current contract, rent history, source evidence
- event wizard:
  1. choose event type
  2. edit required fields
  3. preview before/after and KPI impact
  4. submit approval request

## Notification Linkage

Add a notification bell later for cross-source inconsistencies:

- contract ledger vs management project table
- contract ledger vs Asset overview
- contract ledger vs investment/fund overview
- dashboard KPI mismatch after edit

The notification should show who changed what, affected asset, date/time, source, and required action.

## QA

- Reader cannot submit or approve.
- Editor can submit but cannot self-approve.
- Manager/Admin can approve permitted assets.
- New lease, extension, rent change, vacancy, partial vacancy, split, typo correction all have readback evidence.
- Home/Asset/Company KPI changes are recalculated after approved events.
- Audit event includes actor, approver, before/after, target table/row/cell, source id, status.

## Risk

The highest risk is forcing multi-row contract operations through a cell-edit-only API. That would create duplicate rows, stale current values, or wrong dashboard totals. Contract events must be modeled explicitly before implementation.
