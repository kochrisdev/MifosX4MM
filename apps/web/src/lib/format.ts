const MMK = new Intl.NumberFormat('my-MM', {
  style: 'currency',
  currency: 'MMK',
  maximumFractionDigits: 0,
});

export function formatMMK(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return 'K 0';
  return MMK.format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(ratio: number, decimals = 1): string {
  return `${ratio.toFixed(decimals)}%`;
}
