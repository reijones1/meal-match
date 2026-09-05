import { useEffect, useRef, useState } from 'react'
import { ExpandIcon } from './icons'
import { getAppMapStyles } from '../lib/mapStyle'
import { createHtmlOverlayMarker } from '../lib/htmlMarker'
import { placeMapsUrl } from '../lib/mapsUrl'

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  )
}

// A key whose "API restrictions" allowlist doesn't cover Maps JavaScript API doesn't reject
// cleanly — `new Map()` itself succeeds, and the failure only shows up later as Google's own
// fallback UI (a `.gm-err-container`) silently replacing the div's contents. There's no
// promise rejection or event for this, so a MutationObserver is the only reliable way to
// notice it and swap in a message that matches the app instead of Google's default box.
function watchForMapError(container, onError) {
  const observer = new MutationObserver(() => {
    if (container.querySelector('.gm-err-container')) {
      onError()
      observer.disconnect()
    }
  })
  observer.observe(container, { childList: true, subtree: true })
  return observer
}

// Order-independent signature for "is this genuinely a new set of pins" (a new search, a new
// location) vs. "same restaurants, just re-sorted" — the drop-in animation should only replay
// for the former, per the one-moment-only requirement.
function restaurantSetSignature(userLocation, restaurants) {
  const ids = restaurants.map((r) => r.id).sort().join(',')
  return `${userLocation?.lat},${userLocation?.lng}|${ids}`
}

function RestaurantMap({
  userLocation,
  restaurants,
  activeId,
  onMarkerClick,
  cuisineEmoji,
  variant = 'full',
  onExpandRequest,
}) {
  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  // { [restaurantId]: { marker, restaurant } } — persists across renders so click handlers
  // and the preview overlay's elementsFromPoint lookup can find a pin's restaurant.
  const markerEntriesRef = useRef({})
  const userMarkerRef = useRef(null)
  const lastActiveIdRef = useRef(null)
  const lastSignatureRef = useRef(null)
  const [mapError, setMapError] = useState(false)

  const isPreview = variant === 'preview'

  // Opens the restaurant's own Google Maps listing (photos, reviews, hours) in a new tab —
  // this is what a marker *double*-click does. A single click just selects/highlights the
  // restaurant in the side list (see the activeId effect below) — no navigation, no delay.
  function openListing(restaurant) {
    window.open(placeMapsUrl(restaurant.id, restaurant.name), '_blank', 'noopener,noreferrer')
  }

  // Finds which pin (if any) sits under a point, for the preview overlay handlers below.
  function pinRestaurantAtPoint(x, y) {
    const stack = document.elementsFromPoint(x, y)
    const pinEl = stack.find((el) => el.classList?.contains('map-pin'))
    return pinEl && markerEntriesRef.current[pinEl.dataset.restaurantId]?.restaurant
  }

  // The preview map's single full-cover "tap to expand" button sits above everything
  // (including the pins) so the whole area is one tappable affordance. To still let a tap
  // that lands on a pin select it (or double-tap it to open its listing) instead of
  // expanding, these check what's actually underneath the tap via elementsFromPoint rather
  // than relying on click-through.
  function handlePreviewOverlayClick(event) {
    const restaurant = pinRestaurantAtPoint(event.clientX, event.clientY)
    if (restaurant) {
      onMarkerClick?.(restaurant.id)
      return
    }
    onExpandRequest?.()
  }

  function handlePreviewOverlayDoubleClick(event) {
    const restaurant = pinRestaurantAtPoint(event.clientX, event.clientY)
    if (restaurant) openListing(restaurant)
  }

  // Create the map once. This deliberately has no `mapId` — Google only supports the JS
  // `styles` array (used below to recolor the map from this app's own CSS tokens) on maps
  // *without* one; a mapId switches styling to a Cloud Console-managed style instead, which
  // can't be driven from code. Markers are hand-built HTML overlays for the same reason
  // (AdvancedMarkerElement requires a mapId) — see src/lib/htmlMarker.js.
  useEffect(() => {
    let cancelled = false
    let observer = null

    async function init() {
      try {
        const { Map } = await window.google.maps.importLibrary('maps')
        if (cancelled || !mapDivRef.current) return
        mapRef.current = new Map(mapDivRef.current, {
          center: userLocation,
          zoom: 14,
          styles: getAppMapStyles(),
          clickableIcons: false,
          // A marker double-click opens its listing, not a map zoom — see the pins' own
          // dblclick listener below, which also stops the event from reaching the map itself.
          disableDoubleClickZoom: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: !isPreview,
          gestureHandling: isPreview ? 'none' : 'greedy',
          keyboardShortcuts: !isPreview,
        })
        observer = watchForMapError(mapDivRef.current, () => {
          if (!cancelled) setMapError(true)
        })
      } catch {
        if (!cancelled) setMapError(true)
      }
    }

    init()
    return () => {
      cancelled = true
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (Re)place every marker whenever the result set or user location changes.
  useEffect(() => {
    let cancelled = false

    async function placeMarkers() {
      await window.google.maps.importLibrary('maps')
      if (cancelled || !mapRef.current) return

      const signature = restaurantSetSignature(userLocation, restaurants)
      const shouldAnimate = signature !== lastSignatureRef.current
      lastSignatureRef.current = signature

      userMarkerRef.current?.setMap(null)
      Object.values(markerEntriesRef.current).forEach(({ marker }) => marker.setMap(null))
      markerEntriesRef.current = {}

      mapRef.current.setCenter(userLocation)

      const userPin = document.createElement('div')
      userPin.className = 'map-user-pin'
      if (shouldAnimate) userPin.classList.add('map-pin-enter')
      userPin.innerHTML = '<div class="map-user-pin-dot"></div>'
      userMarkerRef.current = createHtmlOverlayMarker(mapRef.current, userLocation, userPin)

      restaurants.forEach((restaurant, index) => {
        if (!restaurant.location) return

        const pin = document.createElement('div')
        pin.className = 'map-pin'
        pin.dataset.restaurantId = String(restaurant.id)
        if (shouldAnimate) {
          pin.classList.add('map-pin-enter')
          pin.style.animationDelay = `${Math.min(index * 45, 400)}ms`
        }
        pin.innerHTML = `
          <div class="map-pin-circle">${escapeHtml(cuisineEmoji ?? '📍')}</div>
          <div class="map-pin-tail"></div>
          <div class="map-pin-badge">${index + 1}</div>
        `

        const marker = createHtmlOverlayMarker(mapRef.current, restaurant.location, pin)

        // On the expanded/full map, a single pin click selects/highlights it in the list
        // (instant, no delay); a double-click opens its listing instead (the preview map's
        // pins are handled by the overlay button instead — see handlePreviewOverlayClick).
        if (!isPreview) {
          pin.addEventListener('click', () => onMarkerClick?.(restaurant.id))
          pin.addEventListener('dblclick', (event) => {
            // Stops the double-click from also reaching the map underneath and zooming it —
            // belt-and-suspenders alongside the map's own disableDoubleClickZoom option.
            event.stopPropagation()
            openListing(restaurant)
          })
        }

        markerEntriesRef.current[restaurant.id] = { marker, restaurant }
      })
    }

    placeMarkers()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, userLocation, onMarkerClick, cuisineEmoji, isPreview])

  // Selecting a restaurant — from a marker click or a list-item tap — pans to it and gives
  // its pin a visually distinct "active" look. No navigation happens here.
  useEffect(() => {
    if (isPreview) return
    const entries = markerEntriesRef.current

    if (lastActiveIdRef.current && entries[lastActiveIdRef.current]) {
      entries[lastActiveIdRef.current].marker.content?.classList.remove('map-pin-active')
    }
    lastActiveIdRef.current = activeId

    if (!activeId || !entries[activeId] || !mapRef.current) return

    const { marker } = entries[activeId]
    marker.content?.classList.add('map-pin-active')
    mapRef.current.panTo(marker.position)
  }, [activeId, isPreview])

  if (mapError) {
    return (
      <p className="restaurant-status restaurant-error">
        The map couldn't load right now. The list below still works — see it for directions.
      </p>
    )
  }

  return (
    <div className={`restaurant-map restaurant-map-${variant}`}>
      <div ref={mapDivRef} className="restaurant-map-canvas" role="application" aria-label="Map of nearby restaurants" />
      {isPreview && (
        <button
          type="button"
          className="map-expand-overlay"
          onClick={handlePreviewOverlayClick}
          onDoubleClick={handlePreviewOverlayDoubleClick}
          aria-label="Expand map"
        >
          <span className="map-expand-hint">
            <ExpandIcon /> Tap to expand
          </span>
        </button>
      )}
    </div>
  )
}

export default RestaurantMap
