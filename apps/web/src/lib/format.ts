const MMK = new Intl.NumberFormat('my-MM', {
  style: 'currency',
  currency: 'MMK',
  maximumFractionDigits: 0,
});

export function formatMMK(amount: number): string {
  return MMK.format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(ratio: number, decimals = 1): string {
  return `${ratio.toFixed(decimals)}%`;
}
