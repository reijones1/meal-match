export function placeMapsUrl(placeId, name) {
  const params = new URLSearchParams({
    api: '1',
    query: name,
    query_place_id: placeId,
  })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

// `origin` is the user's coordinates — omitted entirely when we don't have them (e.g.
// location permission was denied), letting Google Maps fall back to the device's own current
// location instead of us guessing. `travelMode` matches this app's DRIVING/WALKING values.
export function directionsUrl(origin, destination, placeId, travelMode = 'DRIVING') {
  const params = new URLSearchParams({ api: '1', travelmode: travelMode.toLowerCase() })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  if (destination) params.set('destination', `${destination.lat},${destination.lng}`)
  if (placeId) params.set('destination_place_id', placeId)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

// None of these delivery platforms have a single global search domain, and there's no
// placeId-level API to link straight to a listing the way Google Maps offers — these are
// explicitly labeled as a fallback search in the UI, not a guaranteed direct link, so landing
// on the right regional site is a nice-to-have rather than something worth resolving here.
export function ubereatsSearchUrl(name) {
  return `https://www.ubereats.com/search?q=${encodeURIComponent(name)}`
}

export function deliverooSearchUrl(name) {
  return `https://deliveroo.co.uk/search?q=${encodeURIComponent(name)}`
}

export function justEatSearchUrl(name) {
  return `https://www.just-eat.co.uk/search?q=${encodeURIComponent(name)}`
}
