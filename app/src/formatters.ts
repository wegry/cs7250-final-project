export const price = new Intl.NumberFormat([], {
  currency: "USD",
  style: "currency",
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
});

export const list = new Intl.ListFormat([]);
