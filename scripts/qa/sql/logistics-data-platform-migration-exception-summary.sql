select
  severity,
  resolution_status,
  source_table,
  target_entity,
  reason,
  count(*) as exception_count
from logistics_core.migration_exceptions
group by severity, resolution_status, source_table, target_entity, reason
order by severity, source_table, target_entity, reason;
