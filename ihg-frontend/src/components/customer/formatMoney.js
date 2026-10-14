export function formatMoney(amount, currency) {
  const value = Number(amount || 0).toFixed(2)
  return currency ? `${currency} ${value}` : value
}