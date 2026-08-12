const loanRateFormatter = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatHomeLoanRate(value) {
  if (value === '' || value === null || value === undefined) return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${loanRateFormatter.format(numeric)}%`;
}

export function formatHomeLoanRateInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '';
}
