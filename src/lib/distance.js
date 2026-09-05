const EARTH_RADIUS_MILES = 3958.8

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

// A plain average of lat/lng is a fine "initial candidate area" for the group centroid at
// city scale (per the group-location feature's own step 1a) — the travel-time-weighted
// ranking that follows is what actually accounts for real routes, not straight lines.
export function centroidOf(points) {
  if (points.length === 0) return null
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 })
  return { lat: sum.lat / points.length, lng: sum.lng / points.length }
}

export function milesBetween(a, b) {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function formatDistance(miles) {
  if (miles < 0.1) return '< 0.1 mi'
  return `${miles.toFixed(1)} mi`
}

// Picking just one participant's travel time to display would be quietly misleading once
// people are coming from different places — a single "12 min" reads as one number for
// everyone. Once the spread is wide enough to matter, show it as a range instead.
const GROUP_TRAVEL_RANGE_THRESHOLD_MIN = 5

export function formatGroupTravelLabel(minMinutes, maxMinutes) {
  if (minMinutes == null || maxMinutes == null) return null
  if (maxMinutes - minMinutes <= GROUP_TRAVEL_RANGE_THRESHOLD_MIN) {
    return `${Math.round((minMinutes + maxMinutes) / 2)} min`
  }
  return `${minMinutes}-${maxMinutes} min depending on who's going`
}
