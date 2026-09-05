import { useEffect, useMemo, useState } from 'react'
import RestaurantCard from './RestaurantCard'
import RestaurantMap from './RestaurantMap'
import RestaurantMapModal from './RestaurantMapModal'
import { milesBetween } from '../lib/distance'
import { getCurrentPosition } from '../lib/geolocation'
import { geocodeLocationText } from '../lib/geocode'
import { searchRestaurantsByCuisine } from '../lib/places'
import { getTravelTimes } from '../lib/distanceMatrix'
import { sortByBest, sortByCheapest, sortByClosest, withBestScore } from '../lib/ranking'

const SORT_OPTIONS = [
  { id: 'best', label: 'Best' },
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'closest', label: 'Closest' },
]

const TRAVEL_MODE_OPTIONS = [
  { id: 'DRIVING', label: 'Driving' },
  { id: 'WALKING', label: 'Walking' },
]

const RADIUS_OPTIONS_MILES = [1, 3, 5, 10]
const DEFAULT_RADIUS_MILES = 3 // ~5km — roughly the "reasonable radius" default asked for
const MAX_RESULTS = 10

function RestaurantResults({ cuisine }) {
  const [coords, setCoords] = useState(null)
  const [locationStatus, setLocationStatus] = useState('locating') // locating | denied | ready
  const [locationErrorMessage, setLocationErrorMessage] = useState('')

  const [manualLocationInput, setManualLocationInput] = useState('')
  const [manualLocationChecking, setManualLocationChecking] = useState(false)
  const [manualLocationError, setManualLocationError] = useState('')

  const [searchStatus, setSearchStatus] = useState('idle') // idle | searching | success | error
  const [searchError, setSearchError] = useState('')
  const [baseRestaurants, setBaseRestaurants] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [allClosedRightNow, setAllClosedRightNow] = useState(false)

  const [travelMode, setTravelMode] = useState('DRIVING')
  const [travelTimeError, setTravelTimeError] = useState('')

  const [sortMode, setSortMode] = useState('best')
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES)
  const [activeId, setActiveId] = useState(null)
  const [mapExpanded, setMapExpanded] = useState(false)

  // Fetch location once when this results view first mounts (see RestaurantResults'
  // history — this deliberately doesn't depend on `cuisine`, so switching to a runner-up
  // cuisine re-uses the location already fetched instead of asking again).
  useEffect(() => {
    let cancelled = false

    getCurrentPosition()
      .then((c) => {
        if (cancelled) return
        setCoords(c)
        setLocationStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLocationErrorMessage(
          err.code === 1
            ? 'Location permission was denied.'
            : "Couldn't get your location automatically.",
        )
        setLocationStatus('denied')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleManualLocationSubmit(event) {
    event.preventDefault()
    const text = manualLocationInput.trim()
    if (!text) return

    setManualLocationChecking(true)
    setManualLocationError('')
    try {
      const result = await geocodeLocationText(text)
      if (!result) {
        setManualLocationError(`Couldn't find "${text}". Try being more specific.`)
        return
      }
      setCoords({ lat: result.lat, lng: result.lng })
      setLocationStatus('ready')
    } catch (err) {
      setManualLocationError(err.message || 'Could not look up that location. Please try again.')
    } finally {
      setManualLocationChecking(false)
    }
  }

  // Search Places whenever the cuisine, radius, or coords change. Scores/sorts by
  // straight-line distance immediately (so the list isn't empty while waiting), then the
  // effect below replaces that with travel-time-based scoring once it resolves.
  useEffect(() => {
    if (!coords) return
    let cancelled = false

    async function run() {
      setSearchStatus('searching')
      setActiveId(null)
      try {
        const results = await searchRestaurantsByCuisine(cuisine.name, coords, radiusMiles)
        if (cancelled) return
        const withDistance = results
          .map((r) => ({ ...r, distanceMiles: r.location ? milesBetween(coords, r.location) : null }))
          .filter((r) => r.distanceMiles == null || r.distanceMiles <= radiusMiles)

        // Filter out places that are closed right now (or permanently/temporarily closed)
        // before sorting and capping — otherwise a full page of results could collapse to a
        // handful once closed places are removed. Unknown hours are kept, not excluded, per
        // the "don't punish missing data" rule; they're just labeled "Hours unavailable".
        const openOnly = withDistance.filter((r) => !r.openStatus.hoursAvailable || r.openStatus.isOpenNow)
        setAllClosedRightNow(withDistance.length > 0 && openOnly.length === 0)

        const capped = sortByBest(withBestScore(openOnly, 'distanceMiles')).slice(0, MAX_RESULTS)
        setBaseRestaurants(capped)
        setRestaurants(capped)
        setSearchStatus('success')
      } catch (err) {
        if (cancelled) return
        setSearchError(err.message || 'Something went wrong while searching for restaurants.')
        setSearchStatus('error')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [coords, radiusMiles, cuisine])

  // Enrich with real travel times once the base list (and travel mode) are known. Kept as
  // a separate effect/state from the search above so this can re-run on its own (e.g. the
  // driving/walking toggle) without re-querying Places, and so it can't loop back on itself.
  useEffect(() => {
    if (baseRestaurants.length === 0 || !coords) return
    let cancelled = false

    getTravelTimes(
      coords,
      baseRestaurants.map((r) => r.location),
      travelMode,
    )
      .then((times) => {
        if (cancelled) return
        setTravelTimeError('')
        const merged = baseRestaurants.map((r, i) => ({
          ...r,
          durationText: times[i]?.durationText ?? null,
          durationMinutes: times[i]?.durationMinutes ?? null,
        }))
        setRestaurants(withBestScore(merged, 'durationMinutes'))
      })
      .catch((err) => {
        if (cancelled) return
        // Non-fatal: the list already has straight-line distances to fall back on.
        setTravelTimeError(err.message || 'Could not calculate travel times.')
      })

    return () => {
      cancelled = true
    }
  }, [baseRestaurants, travelMode, coords])

  const metricKey = restaurants.some((r) => r.durationMinutes != null) ? 'durationMinutes' : 'distanceMiles'

  const sortedRestaurants = useMemo(() => {
    if (sortMode === 'cheapest') return sortByCheapest(restaurants)
    if (sortMode === 'closest') return sortByClosest(restaurants, metricKey)
    return sortByBest(restaurants)
  }, [restaurants, sortMode, metricKey])

  if (locationStatus === 'locating') {
    return <p className="restaurant-status">Finding your location…</p>
  }

  if (locationStatus === 'denied' && !coords) {
    return (
      <div className="location-fallback">
        <p className="restaurant-status restaurant-error">
          {locationErrorMessage} Enter a location instead to see nearby restaurants.
        </p>
        <form className="location-fallback-form" onSubmit={handleManualLocationSubmit}>
          <input
            type="text"
            className="room-code-input"
            placeholder="City, neighborhood, or address"
            value={manualLocationInput}
            onChange={(event) => setManualLocationInput(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={manualLocationChecking || !manualLocationInput.trim()}
          >
            {manualLocationChecking ? 'Searching…' : 'Use this location'}
          </button>
        </form>
        {manualLocationError && <p className="form-error">{manualLocationError}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="radius-control">
        <p className="radius-label">Showing results within {radiusMiles} mi</p>
        <div className="pill-tabs" role="group" aria-label="Search radius">
          {RADIUS_OPTIONS_MILES.map((r) => (
            <button
              key={r}
              type="button"
              className={`pill-tab${radiusMiles === r ? ' pill-tab-active' : ''}`}
              onClick={() => setRadiusMiles(r)}
            >
              {r} mi
            </button>
          ))}
        </div>
      </div>

      {searchStatus === 'searching' && (
        <p className="restaurant-status">Looking for {cuisine.name} restaurants nearby…</p>
      )}
      {searchStatus === 'error' && <p className="restaurant-status restaurant-error">{searchError}</p>}
      {searchStatus === 'success' && restaurants.length === 0 && allClosedRightNow && (
        <p className="restaurant-status">No matching restaurants are open right now.</p>
      )}
      {searchStatus === 'success' && restaurants.length === 0 && !allClosedRightNow && (
        <p className="restaurant-status">
          No {cuisine.name} restaurants found within {radiusMiles} mi.
        </p>
      )}

      {(searchStatus === 'searching' || searchStatus === 'success') && restaurants.length > 0 && (
        <RestaurantMap
          variant="preview"
          userLocation={coords}
          restaurants={sortedRestaurants}
          activeId={activeId}
          onMarkerClick={setActiveId}
          cuisineEmoji={cuisine.emoji}
          onExpandRequest={() => setMapExpanded(true)}
        />
      )}

      {mapExpanded && (
        <RestaurantMapModal
          userLocation={coords}
          restaurants={sortedRestaurants}
          activeId={activeId}
          onSelect={setActiveId}
          cuisineEmoji={cuisine.emoji}
          travelMode={travelMode}
          onClose={() => setMapExpanded(false)}
        />
      )}

      {searchStatus === 'success' && restaurants.length > 0 && (
        <>
          <div className="pill-tabs" role="group" aria-label="Travel mode">
            {TRAVEL_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`pill-tab${travelMode === option.id ? ' pill-tab-active' : ''}`}
                onClick={() => setTravelMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {travelTimeError && <p className="restaurant-status">{travelTimeError} Showing straight-line distance instead.</p>}

          <div className="pill-tabs" role="group" aria-label="Sort restaurants">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`pill-tab${sortMode === option.id ? ' pill-tab-active' : ''}`}
                onClick={() => setSortMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <ul className="restaurant-list">
            {sortedRestaurants.map((r, index) => (
              <li key={r.id}>
                <RestaurantCard
                  restaurant={r}
                  index={index}
                  active={r.id === activeId}
                  onSelect={setActiveId}
                  userLocation={coords}
                  travelMode={travelMode}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export default RestaurantResults
