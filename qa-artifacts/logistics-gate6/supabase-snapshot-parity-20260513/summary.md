# Supabase Snapshot Parity - 2026-05-13

- mutationPerformed: false
- projectRef: qvegpozwrcmspdvjokiz
- qaStatus: pass_with_notes

## Company Parity

- local company options: 31
- Supabase company snapshot unique ids: 31
- missing in local: 0
- missing in snapshot: 0

## Home Monthly Cost Parity

- KPI monthly_total_cost: 11134228842
- readback docs_home_default monthly_total_cost: 11134228842
- asset option monthly cost sum: 11134228842
- company option monthly cost sum: 11134228842
- topTenants partial sum: 9527010261
- topContracts partial sum: 9527010261
- latest trend 2026-06 adjusted monthly cost: 10265767928

## Notes

- ll_data_quality_findings and ll_tenants are currently zero rows by public readback; dashboard parity must use ll_payload_snapshots and local static snapshot JSON until DB/RLS source changes.
- Home topTenants/topContracts are partial ranking/detail arrays and must not be used as total monthly cost evidence.
- Home rentTrend latest adjusted total remains a different source basis from portfolio KPI; chart labels and popup must disclose basis unless source payload is regenerated.
