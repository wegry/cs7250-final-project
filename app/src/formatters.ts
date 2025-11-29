export const price = new Intl.NumberFormat([], {
  currency: "USD",
  style: "currency",
  minimumSignificantDigits: 3,
  minimumFractionDigits: 2,
});
