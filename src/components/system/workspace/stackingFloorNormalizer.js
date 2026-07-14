function compactFloorLabel(value) {
  return String(value ?? '').trim().replace(/\s+/gu, '').toUpperCase();
}

function firstExplicitFloorLabel(row = {}) {
  return [row.floorLabel, row.floor_label, row.sourceFloorLabel, row.source_floor_label]
    .find((value) => String(value ?? '').trim());
}

function firstSourceFloorLabel(row = {}) {
  return [row.sourceFloorLabel, row.source_floor_label, row.floorLabel, row.floor_label]
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

function stackingFloorNumber(value) {
  const floorLabel = normalizeStackingFloorLabel(value);
  if (!floorLabel) return null;
  if (floorLabel.startsWith('B')) return -Number(floorLabel.slice(1));
  return Number(floorLabel.slice(0, -1));
}

function stackingFloorLabelFromNumber(value) {
  if (!Number.isInteger(value) || value === 0) return '';
  return value < 0 ? `B${Math.abs(value)}` : `${value}F`;
}

export function expandStackingFloorLabels(value) {
  const expanded = [];
  const seen = new Set();
  compactFloorLabel(value).split(',').forEach((part) => {
    if (!part) return;
    const range = part.split('~');
    if (range.length === 1) {
      const floorLabel = normalizeStackingFloorLabel(part);
      if (floorLabel && !seen.has(floorLabel)) {
        seen.add(floorLabel);
        expanded.push(floorLabel);
      }
      return;
    }
    if (range.length !== 2) return;
    const start = stackingFloorNumber(range[0]);
    const end = stackingFloorNumber(range[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return;
    const step = start <= end ? 1 : -1;
    for (let floor = start; floor !== end + step; floor += step) {
      const floorLabel = stackingFloorLabelFromNumber(floor);
      if (floorLabel && !seen.has(floorLabel)) {
        seen.add(floorLabel);
        expanded.push(floorLabel);
      }
    }
  });
  return expanded;
}

export function normalizeStackingFloorLabelFromRow(row = {}, options = {}) {
  const explicitFloorLabel = options.expandRanges
    ? firstSourceFloorLabel(row)
    : firstExplicitFloorLabel(row);
  if (explicitFloorLabel !== undefined) {
    return options.expandRanges
      ? expandStackingFloorLabels(explicitFloorLabel)
      : normalizeStackingFloorLabel(explicitFloorLabel);
  }

  const spacePrefix = String(row.spaceLabel ?? '').trim().split(/\s+/u)[0];
  return options.expandRanges
    ? expandStackingFloorLabels(spacePrefix)
    : normalizeStackingFloorLabel(spacePrefix);
}
