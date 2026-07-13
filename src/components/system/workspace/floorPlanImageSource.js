export function normalizeFloorPlanImageSource(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function floorPlanLabelFromRecord(record = {}, fallback = '') {
  const metadata = record?.metadata && typeof record.metadata === 'object' ? record.metadata : {};
  const value = [
    record?.floorLabel,
    record?.floor_label,
    record?.floor,
    metadata.floor_label,
    metadata.floor_key,
    record?.label,
    fallback,
  ].find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim() || '';
}
