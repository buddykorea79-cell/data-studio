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
  number:  { bg:"#E3EDF4", tx:"#3A6F8F" },
  category:{ bg:"#E3F1E8", tx:"#2D7A4F" },
  text:    { bg:"#F7FAF6", tx:"#4A6354" },
  date:    { bg:"#E8F1E7", tx:"#2E4D3D" },
  empty:   { bg:"#FAF1DC", tx:"#B8862C" },
};

export const ALL_TYPES = ["number","category","text","date","empty"];

export const PALETTE = [
  "#4A7560","#3A6F8F","#B8862C","#C44545","#6B8F7A",
  "#7F77DD","#2D7A4F","#D4537E","#2E4D3D","#A8C2B2",
];
