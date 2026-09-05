// Resolves free-text (a city, address, landmark) into coordinates using the same Places
// text-search method already used for restaurant search, rather than adding a separate
// Geocoding API dependency for one fallback path.
export async function geocodeLocationText(text) {
  const { Place } = await window.google.maps.importLibrary('places')

  const { places } = await Place.searchByText({
    textQuery: text,
    fields: ['location', 'formattedAddress'],
    maxResultCount: 1,
  })

  const match = places[0]
  if (!match?.location) return null

  return {
    lat: match.location.lat(),
    lng: match.location.lng(),
    formattedAddress: match.formattedAddress ?? text,
  }
}
