export const price = new Intl.NumberFormat([], {
  currency: "USD",
  style: "currency",
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
});
export const countFormatter = new Intl.NumberFormat([], {
  notation: "compact",
});

export const list = new Intl.ListFormat([]);
