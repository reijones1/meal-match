import { getOpenStatus } from './openingHours'

const FIELDS = [
  'id',
  'displayName',
  'rating',
  'userRatingCount',
  'formattedAddress',
  'location',
  'priceLevel',
  'priceRange',
  'photos',
  'regularOpeningHours',
  'businessStatus',
  'utcOffsetMinutes',
]

const HOURS_FIELDS = ['regularOpeningHours', 'businessStatus', 'utcOffsetMinutes']

function getPhotoUrl(place) {
  try {
    return place.photos?.[0]?.getURI({ maxWidth: 400 }) ?? null
  } catch {
    return null
  }
}

// Text Search normally returns these fields directly, but falls back to a per-place Place
// Details fetch (fetchFields) for any result that came back without them, rather than
// treating that place's hours as unavailable when one extra request would resolve it.
async function ensureHoursFields(place) {
  if (place.regularOpeningHours !== undefined) return
  try {
    await place.fetchFields({ fields: HOURS_FIELDS })
  } catch {
    // Leave fields unset — getOpenStatus treats that as "hours unavailable", not "closed".
  }
}

const MILES_TO_METERS = 1609.34

export async function searchRestaurantsByCuisine(cuisineName, { lat, lng }, radiusMiles) {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing Google Places API key. Add VITE_GOOGLE_PLACES_API_KEY to a .env.local file and restart the dev server.',
    )
  }

  const { Place } = await window.google.maps.importLibrary('places')

  const { places } = await Place.searchByText({
    textQuery: `${cuisineName} restaurants`,
    fields: FIELDS,
    // locationBias only *biases* ranking toward this circle — Google can still return
    // results outside it, so callers additionally filter by real distance afterward.
    locationBias: { radius: radiusMiles * MILES_TO_METERS, center: { lat, lng } },
    maxResultCount: 20,
  })

  return Promise.all(
    places.map(async (place) => {
      await ensureHoursFields(place)
      const openStatus = await getOpenStatus(place)

      return {
        id: place.id,
        name: place.displayName,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        address: place.formattedAddress ?? 'Address unavailable',
        location: place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null,
        priceLevel: place.priceLevel ?? null,
        priceRange: place.priceRange ?? null,
        photoUrl: getPhotoUrl(place),
        openStatus,
      }
    }),
  )
}
