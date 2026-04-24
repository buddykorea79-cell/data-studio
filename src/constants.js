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
  number:  { bg:"#E6F1FB", tx:"#0C447C" },
  category:{ bg:"#EEEDFE", tx:"#3C3489" },
  text:    { bg:"#F1EFE8", tx:"#444441" },
  date:    { bg:"#EAF3DE", tx:"#27500A" },
  empty:   { bg:"#FAEEDA", tx:"#633806" },
};

export const ALL_TYPES = ["number","category","text","date","empty"];

export const PALETTE = [
  "#378ADD","#1D9E75","#D85A30","#7F77DD","#BA7517",
  "#D4537E","#639922","#185FA5","#0F6E56","#993C1D",
];
