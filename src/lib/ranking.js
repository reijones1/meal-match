const PRICE_LEVEL_ORDER = {
  FREE: 0,
  INEXPENSIVE: 1,
  MODERATE: 2,
  EXPENSIVE: 3,
  VERY_EXPENSIVE: 4,
}

// `metricKey` is whichever "closeness" field is available — travel minutes once the
// Distance Matrix call resolves, straight-line miles as the fallback while that's still
// loading (or if it failed). Same normalization approach either way: normalize relative to
// what's actually in this result set, not a fixed scale, so both factors keep meaningful
// spread whether results are tightly clustered or spread out. Restaurants missing a value
// get a neutral 0.5 for that half of the score, so one missing rating/metric doesn't sink
// or boost them unfairly.
export function withBestScore(restaurants, metricKey = 'distanceMiles') {
  const ratings = restaurants.map((r) => r.rating).filter((v) => v != null)
  const metrics = restaurants.map((r) => r[metricKey]).filter((v) => v != null)

  const minRating = ratings.length ? Math.min(...ratings) : 0
  const maxRating = ratings.length ? Math.max(...ratings) : 5
  const minMetric = metrics.length ? Math.min(...metrics) : 0
  const maxMetric = metrics.length ? Math.max(...metrics) : 1

  return restaurants.map((r) => {
    const ratingScore =
      r.rating != null && maxRating > minRating ? (r.rating - minRating) / (maxRating - minRating) : 0.5
    const metricScore =
      r[metricKey] != null && maxMetric > minMetric ? 1 - (r[metricKey] - minMetric) / (maxMetric - minMetric) : 0.5

    return { ...r, bestScore: ratingScore * 0.5 + metricScore * 0.5 }
  })
}

export function sortByBest(restaurants) {
  return [...restaurants].sort((a, b) => b.bestScore - a.bestScore)
}

export function sortByCheapest(restaurants) {
  return [...restaurants].sort((a, b) => {
    const priceA = PRICE_LEVEL_ORDER[a.priceLevel] ?? Infinity
    const priceB = PRICE_LEVEL_ORDER[b.priceLevel] ?? Infinity
    if (priceA !== priceB) return priceA - priceB
    return (b.rating ?? 0) - (a.rating ?? 0)
  })
}

// Group version of withBestScore: "closeness" is itself a blend of the group's average
// travel time and the single longest (worst-case) participant's time, weighted toward the
// average but still let a bad outlier drag the score down — so a restaurant that's a dream
// for most of the group but a nightmare for one person doesn't win purely on the average.
export function withGroupBestScore(restaurants) {
  const ratings = restaurants.map((r) => r.rating).filter((v) => v != null)
  const avgs = restaurants.map((r) => r.avgMinutes).filter((v) => v != null)
  const maxes = restaurants.map((r) => r.maxMinutes).filter((v) => v != null)

  const minRating = ratings.length ? Math.min(...ratings) : 0
  const maxRating = ratings.length ? Math.max(...ratings) : 5
  const minAvg = avgs.length ? Math.min(...avgs) : 0
  const maxAvg = avgs.length ? Math.max(...avgs) : 1
  const minMax = maxes.length ? Math.min(...maxes) : 0
  const maxMax = maxes.length ? Math.max(...maxes) : 1

  return restaurants.map((r) => {
    const ratingScore =
      r.rating != null && maxRating > minRating ? (r.rating - minRating) / (maxRating - minRating) : 0.5
    const avgScore = r.avgMinutes != null && maxAvg > minAvg ? 1 - (r.avgMinutes - minAvg) / (maxAvg - minAvg) : 0.5
    const worstScore = r.maxMinutes != null && maxMax > minMax ? 1 - (r.maxMinutes - minMax) / (maxMax - minMax) : 0.5
    const convenienceScore = avgScore * 0.6 + worstScore * 0.4

    return { ...r, bestScore: ratingScore * 0.5 + convenienceScore * 0.5 }
  })
}

export function sortByClosest(restaurants, metricKey = 'distanceMiles') {
  // Round so restaurants a hair apart on the metric are treated as "similar distance" and
  // broken by rating instead of by noise-level differences. Minutes are already coarse
  // enough (Google rounds them itself), so only miles need the extra rounding step.
  const bucketSize = metricKey === 'distanceMiles' ? 10 : 1

  return [...restaurants].sort((a, b) => {
    const bucketA = a[metricKey] != null ? Math.round(a[metricKey] * bucketSize) / bucketSize : Infinity
    const bucketB = b[metricKey] != null ? Math.round(b[metricKey] * bucketSize) / bucketSize : Infinity
    if (bucketA !== bucketB) return bucketA - bucketB
    return (b.rating ?? 0) - (a.rating ?? 0)
  })
}
