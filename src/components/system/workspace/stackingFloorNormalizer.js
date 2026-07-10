function compactFloorLabel(value) {
  return String(value ?? '').trim().replace(/\s+/gu, '').toUpperCase();
}

function firstExplicitFloorLabel(row = {}) {
  return [row.floorLabel, row.floor_label, row.sourceFloorLabel, row.source_floor_label]
    .find((value) => String(value ?? '').trim());
}

export function normalizeStackingFloorLabel(value) {
  const label = compactFloorLabel(value);
  if (!label) return '';

  const basementMatch = label.match(/^(?:B|지하)(\d+)(?:F|층)?$/u);
  if (basementMatch) return `B${Number(basementMatch[1])}`;

  const aboveGroundMatch = label.match(/^(?:지상)?(\d+)(?:F|층)?$/u);
  if (aboveGroundMatch) return `${Number(aboveGroundMatch[1])}F`;

  return '';
}

export function normalizeStackingFloorLabelFromRow(row = {}) {
  const explicitFloorLabel = firstExplicitFloorLabel(row);
  if (explicitFloorLabel !== undefined) return normalizeStackingFloorLabel(explicitFloorLabel);

  const spacePrefix = String(row.spaceLabel ?? '').trim().split(/\s+/u)[0];
  return normalizeStackingFloorLabel(spacePrefix);
}
