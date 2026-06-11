// ── Color tokens ──────────────────────────────────────────────────────────────
export const C = {
  bg:"var(--color-background-primary)", bgS:"var(--color-background-secondary)",
  bgT:"var(--color-background-tertiary)", tx:"var(--color-text-primary)",
  txS:"var(--color-text-secondary)", txT:"var(--color-text-tertiary)",
  bd:"var(--color-border-tertiary)", bdS:"var(--color-border-secondary)",
  info:"var(--color-background-info)", infoTx:"var(--color-text-info)",
  success:"var(--color-background-success)", successTx:"var(--color-text-success)",
  warn:"var(--color-background-warning)", warnTx:"var(--color-text-warning)",
  danger:"var(--color-background-danger)", dangerTx:"var(--color-text-danger)",
};

export const TYPE_CLR = {
  number:  { bg:"#EFF5FD", tx:"#2271C4" },
  category:{ bg:"#E9F8F0", tx:"#1B8654" },
  text:    { bg:"#F4F4F5", tx:"#52525B" },
  date:    { bg:"#F2EFFD", tx:"#6E56CF" },
  empty:   { bg:"#FBF3E0", tx:"#B07816" },
};

export const ALL_TYPES = ["number","category","text","date","empty"];

export const PALETTE = [
  "#3E63DD","#30A46C","#F76B15","#E5484D","#8E4EC6",
  "#0EA5E9","#D6409F","#65A30D","#F59E0B","#6E56CF",
];
