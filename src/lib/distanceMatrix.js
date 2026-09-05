const TIMEOUT_MS = 8000

// A misconfigured API key (e.g. the key's "API restrictions" allowlist doesn't include
// Distance Matrix) doesn't cleanly reject here — the library's own callback just never
// fires, so without this the caller would await forever instead of showing an error.
function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), TIMEOUT_MS)),
  ])
}

// Uses the Maps JavaScript API's DistanceMatrixService (not the raw REST endpoint) so this
// runs entirely client-side with no CORS issues — Google's own script makes the request,
// the same reason the Places library is used instead of a raw fetch elsewhere in this app.
export async function getTravelTimes(origin, destinations, travelMode = 'DRIVING') {
  if (destinations.length === 0) return []

  return withTimeout(fetchTravelTimes(origin, destinations, travelMode), 'Could not calculate travel times right now.')
}

async function fetchTravelTimes(origin, destinations, travelMode) {
  const { DistanceMatrixService, TravelMode } = await window.google.maps.importLibrary('routes')
  const service = new DistanceMatrixService()

  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: destinations.map((d) => ({ lat: d.lat, lng: d.lng })),
        travelMode: TravelMode[travelMode],
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      },
      (response, status) => {
        if (status !== 'OK') {
          reject(new Error('Could not calculate travel times right now.'))
          return
        }
        const elements = response?.rows?.[0]?.elements ?? []
        resolve(
          elements.map((el) =>
            el.status === 'OK'
              ? {
                  durationText: el.duration.text,
                  durationMinutes: Math.round(el.duration.value / 60),
                }
              : null,
          ),
        )
      },
    )
  })
}

// DistanceMatrixService caps how many origins/destinations fit in one request — chunking
// keeps every call under that regardless of group/candidate-list size, while still sending
// as few requests as possible (typically exactly one: a handful of participants times up to
// ~20 candidate restaurants is well within a single request's limits).
const MAX_ORIGINS_PER_REQUEST = 25
const MAX_DESTINATIONS_PER_REQUEST = 25

function chunk(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// Batched multi-origin/multi-destination lookup — every participant's location as one
// "origins" list against every candidate restaurant as one "destinations" list, in as few
// Distance Matrix requests as the API's size limits require (see chunking above), rather than
// one request per participant or per restaurant. Returns `matrix[originIndex][destIndex]` as
// minutes (or null if that pair came back without a valid route).
export async function getGroupTravelTimeMatrix(origins, destinations, travelMode = 'DRIVING') {
  if (origins.length === 0 || destinations.length === 0) return []
  return withTimeout(
    fetchGroupTravelTimeMatrix(origins, destinations, travelMode),
    'Could not calculate travel times right now.',
  )
}

async function fetchGroupTravelTimeMatrix(origins, destinations, travelMode) {
  const { DistanceMatrixService, TravelMode } = await window.google.maps.importLibrary('routes')
  const service = new DistanceMatrixService()

  function requestChunk(originChunk, destinationChunk) {
    return new Promise((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: originChunk.map((o) => ({ lat: o.lat, lng: o.lng })),
          destinations: destinationChunk.map((d) => ({ lat: d.lat, lng: d.lng })),
          travelMode: TravelMode[travelMode],
          unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        },
        (response, status) => {
          if (status !== 'OK') {
            reject(new Error('Could not calculate travel times right now.'))
            return
          }
          resolve(
            (response?.rows ?? []).map((row) =>
              row.elements.map((el) => (el.status === 'OK' ? Math.round(el.duration.value / 60) : null)),
            ),
          )
        },
      )
    })
  }

  const originChunks = chunk(origins, MAX_ORIGINS_PER_REQUEST)
  const destinationChunks = chunk(destinations, MAX_DESTINATIONS_PER_REQUEST)
  const matrix = origins.map(() => new Array(destinations.length).fill(null))

  let originOffset = 0
  for (const originChunk of originChunks) {
    let destinationOffset = 0
    for (const destinationChunk of destinationChunks) {
      const partial = await requestChunk(originChunk, destinationChunk)
      partial.forEach((row, i) => {
        row.forEach((minutes, j) => {
          matrix[originOffset + i][destinationOffset + j] = minutes
        })
      })
      destinationOffset += destinationChunk.length
    }
    originOffset += originChunk.length
  }

  return matrix
}
