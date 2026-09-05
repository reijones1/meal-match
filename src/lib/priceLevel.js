const PRICE_LEVEL_LABELS = {
  FREE: 'Free',
  INEXPENSIVE: '$',
  MODERATE: '$$',
  EXPENSIVE: '$$$',
  VERY_EXPENSIVE: '$$$$',
}

function moneyToNumber(money) {
  if (!money) return null
  return Number(money.units ?? 0) + Number(money.nanos ?? 0) / 1e9
}

function formatMoney(money) {
  const amount = moneyToNumber(money)
  if (amount == null) return null
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currencyCode || 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${Math.round(amount)}`
  }
}

// priceLevel is a coarse $ tier; priceRange is an actual dollar range Google sometimes
// has on file even when it hasn't assigned a tier, so it's the fallback, not the primary source.
export function formatPrice(priceLevel, priceRange) {
  const tierLabel = PRICE_LEVEL_LABELS[priceLevel]
  if (tierLabel) return tierLabel

  if (priceRange) {
    const start = formatMoney(priceRange.startPrice)
    const end = formatMoney(priceRange.endPrice)
    if (start && end) return `${start}–${end}`
    if (start) return `${start}+`
  }

  return 'Price not available'
}
