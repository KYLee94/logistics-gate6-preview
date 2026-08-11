const loanRateFormatter = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 6,
});

export function formatHomeLoanRate(value) {
  if (value === '' || value === null || value === undefined) return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${loanRateFormatter.format(numeric)}%`;
}
