# Checklist conflict cleanup - 2026-05-20

## What was checked

- Exact duplicate checklist IDs
- Invalid status values
- Active items contradicted by newer user instructions
- Old tab names and moved responsibilities

## Result

- Duplicate IDs: 0
- Invalid status values normalized: completed -> done
- Retired from active denominator in this cleanup run: 20
- New active overall: 169 / 280 (60.4%)

## Retired groups

1. Weekly tab/upload UI items: superseded by latest instruction to remove Weekly tab and weekly upload buttons, while keeping weekly source data through Work Platform management project table.
2. Main search AI merge item: superseded by latest instruction to keep keyword search in main row and AI in right collapsible chatbot dock.
3. PDF implementation details in final stage: moved to Stage 4 so Stage 15 remains final acceptance only.

## Still active after cleanup

- Supabase-first data source cleanup and 1-by-1 Excel/Supabase readback
- Work Platform task/board persistence and stakeholder suggestions
- Home/Asset/Company chart/table/data consistency
- Pivot Table and Analysis Tools parity
- Data Quality submit/approve/readback/write/audit completion
- OpenDART/building-registry provider live verification
- Manual browser QA for map hover, PDF output, and key dashboard views
