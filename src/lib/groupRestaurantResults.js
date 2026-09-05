import { supabase } from './supabase'
import { searchRestaurantsByCuisine } from './places'
import { getGroupTravelTimeMatrix } from './distanceMatrix'
import { withGroupBestScore, sortByBest } from './ranking'
import { centroidOf, formatGroupTravelLabel, milesBetween } from './distance'

const MAX_RESULTS_PER_BATCH = 10

export async function fetchGroupRestaurantResults(groupId) {
  const { data, error } = await supabase
    .from('group_restaurant_results')
    .select()
    .eq('group_id', groupId)
    .maybeSingle()
  if (error) throw error
  return data // null if not computed yet
}

// Cleared before a fresh compute — either because a new cuisine won, or because the group's
// search area/travel mode/radius changed in a way that invalidates the previous result
// outright (see GroupRestaurantResults.jsx's handling of a *smaller* radius or a different
// travel mode — those replace, only a *larger* radius appends via expandGroupRestaurantResults).
export async function clearGroupRestaurantResults(groupId) {
  const { error } = await supabase.from('group_restaurant_results').delete().eq('group_id', groupId)
  if (error) throw error
}

// Upsert (not plain insert) because expandGroupRestaurantResults needs to update the same
// row in place — appending to it, not replacing it — without racing a fresh INSERT.
async function upsertGroupRestaurantResults(groupId, { cuisineName, searchCenter, restaurants, radiusMiles }) {
  const { data, error } = await supabase
    .from('group_restaurant_results')
    .upsert(
      { group_id: groupId, cuisine_name: cuisineName, search_center: searchCenter, restaurants, radius_miles: radiusMiles },
      { onConflict: 'group_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// Resolves the actual search center from the group's chosen mode:
//  - default: centroid of every participant who shared a location
//  - manual/visual: the stored override coordinates (both are just "a fixed point", the only
//    difference is which panel produced it)
//  - anchor: the chosen participant's own location, falling back to the centroid if that
//    participant somehow has none on file
function resolveSearchCenter(groupRow, membersWithLocation) {
  if (groupRow.search_mode === 'manual' || groupRow.search_mode === 'visual') {
    if (groupRow.search_lat != null && groupRow.search_lng != null) {
      return { lat: groupRow.search_lat, lng: groupRow.search_lng, label: groupRow.search_label }
    }
  }

  if (groupRow.search_mode === 'anchor' && groupRow.search_anchor_member_id) {
    const anchor = membersWithLocation.find((m) => m.id === groupRow.search_anchor_member_id)
    if (anchor) return { lat: anchor.lat, lng: anchor.lng, label: groupRow.search_label }
  }

  const centroid = centroidOf(membersWithLocation.map((m) => ({ lat: m.lat, lng: m.lng })))
  return centroid ? { ...centroid, label: null } : null
}

// Searches around searchCenter, filters to real-distance-within-radius + open + excludeIds,
// gets every participant's travel time to each survivor in as few Distance Matrix requests
// as possible, scores on rating + group travel convenience, and caps to one batch's worth.
// Shared by both a fresh compute and an expand-to-a-wider-radius append.
async function searchAndScoreCandidates({ cuisineName, searchCenter, radiusMiles, excludeIds, origins, travelMode }) {
  const rawResults = await searchRestaurantsByCuisine(cuisineName, searchCenter, radiusMiles)

  const withDistance = rawResults.map((r) => ({
    ...r,
    distanceMiles: r.location ? milesBetween(searchCenter, r.location) : null,
  }))
  // locationBias only *biases* Google's search, it doesn't strictly filter — enforce the
  // chosen radius for real, same as solo mode does.
  const withinRadius = withDistance.filter((r) => r.distanceMiles == null || r.distanceMiles <= radiusMiles)
  const openOnly = withinRadius.filter((r) => !r.openStatus.hoursAvailable || r.openStatus.isOpenNow)
  const withLocation = openOnly.filter((r) => r.location && !excludeIds.has(r.id))

  const matrix = await getGroupTravelTimeMatrix(origins, withLocation.map((r) => r.location), travelMode)

  const withGroupTimes = withLocation.map((restaurant, destIndex) => {
    const times = matrix.map((row) => row[destIndex]).filter((v) => v != null)
    const minMinutes = times.length ? Math.min(...times) : null
    const maxMinutes = times.length ? Math.max(...times) : null
    const avgMinutes = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null

    return {
      ...restaurant,
      minMinutes,
      maxMinutes,
      avgMinutes,
      durationText: formatGroupTravelLabel(minMinutes, maxMinutes),
    }
  })

  return sortByBest(withGroupBestScore(withGroupTimes)).slice(0, MAX_RESULTS_PER_BATCH)
}

// The core of the group-location feature: turns "these members, this cuisine, this search
// mode/radius/travel mode" into the shared restaurant list everyone renders from. Always a
// full fresh batch (no excludeIds) — used for the first compute, and for any change that
// should replace the list outright (travel mode change, or picking a *smaller* radius).
export async function computeGroupRestaurantResults(
  groupId,
  { cuisineName, groupRow, members, travelMode = 'DRIVING', radiusMiles = 5 },
) {
  const membersWithLocation = members.filter((m) => m.lat != null && m.lng != null)
  const searchCenter = resolveSearchCenter(groupRow, membersWithLocation)

  if (!searchCenter) {
    throw new Error("No one's location is available yet. Use \"Adjust search area\" to enter one manually.")
  }

  const origins = membersWithLocation.length > 0 ? membersWithLocation : [searchCenter]
  const ranked = await searchAndScoreCandidates({
    cuisineName,
    searchCenter,
    radiusMiles,
    excludeIds: new Set(),
    origins,
    travelMode,
  })

  return upsertGroupRestaurantResults(groupId, { cuisineName, searchCenter, restaurants: ranked, radiusMiles })
}

// "Show more" / picking a *larger* radius than what's already shown: re-searches at the
// wider radius, skips anything already in the list, and appends the newly-found restaurants
// to the end rather than re-ranking the whole set — so the existing results keep their order
// and the list just grows, instead of jumping around under the reader.
export async function expandGroupRestaurantResults(
  groupId,
  { cuisineName, groupRow, members, travelMode = 'DRIVING', radiusMiles, existingResultRow },
) {
  const membersWithLocation = members.filter((m) => m.lat != null && m.lng != null)
  const searchCenter = existingResultRow?.search_center ?? resolveSearchCenter(groupRow, membersWithLocation)

  if (!searchCenter) {
    throw new Error("No one's location is available yet. Use \"Adjust search area\" to enter one manually.")
  }

  const origins = membersWithLocation.length > 0 ? membersWithLocation : [searchCenter]
  const existingRestaurants = existingResultRow?.restaurants ?? []
  const existingIds = new Set(existingRestaurants.map((r) => r.id))

  const additional = await searchAndScoreCandidates({
    cuisineName,
    searchCenter,
    radiusMiles,
    excludeIds: existingIds,
    origins,
    travelMode,
  })

  return upsertGroupRestaurantResults(groupId, {
    cuisineName,
    searchCenter,
    restaurants: [...existingRestaurants, ...additional],
    radiusMiles,
  })
}
