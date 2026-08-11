const LEFT_ALIGNED_FIELDS = new Set([
  "name",
  "beneficiary_name",
  "lender_name",
]);

const RIGHT_ALIGNED_KRW_FIELDS = new Set([
  "aum_krw",
  "agreed_amount_krw",
  "contributed_amount_krw",
  "committed_amount_krw",
]);

export function homeFundTableCellAlign(field) {
  if (LEFT_ALIGNED_FIELDS.has(field)) return "left";
  if (RIGHT_ALIGNED_KRW_FIELDS.has(field)) return "right";
  return "center";
}
