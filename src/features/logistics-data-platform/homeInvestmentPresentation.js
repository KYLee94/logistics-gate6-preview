export const HOME_SHARE_CLASS_OPTIONS = Object.freeze([
  '보통주',
  '1종 종류주',
  '2종 종류주',
  '3종 종류주',
]);

const GENERIC_SHARE_CLASS_VALUES = new Set(['수익자']);

export function homeShareClassPresentation(value) {
  const rawValue = String(value ?? '').trim();
  const requiresClassification = GENERIC_SHARE_CLASS_VALUES.has(rawValue);
  return {
    rawValue,
    displayValue: requiresClassification ? '' : rawValue,
    displayLabel: requiresClassification ? '분류 확인 필요' : rawValue,
    requiresClassification,
  };
}

export function homeShareClassOptions(value) {
  const { displayValue } = homeShareClassPresentation(value);
  return [...new Set([
    ...HOME_SHARE_CLASS_OPTIONS,
    ...(displayValue ? [displayValue] : []),
  ])];
}

export function homeShareClassOptionsFromInvestments(investments) {
  const customOptions = (Array.isArray(investments) ? investments : [])
    .map((row) => homeShareClassPresentation(row?.tranche).displayValue)
    .filter(Boolean);
  return [...new Set([
    ...HOME_SHARE_CLASS_OPTIONS,
    ...customOptions,
  ])];
}
