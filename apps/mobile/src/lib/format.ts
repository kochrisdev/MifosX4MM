const MMK = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'MMK',
  maximumFractionDigits: 0,
});

export const fmt = {
  mmk: (n: number) => MMK.format(n),
  number: (n: number) => new Intl.NumberFormat('en-US').format(n),
  percent: (n: number, dp = 1) => `${n.toFixed(dp)}%`,
  date: (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
};
