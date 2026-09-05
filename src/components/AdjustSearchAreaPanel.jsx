import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { createAutocompleteSessionToken, fetchAddressSuggestions, resolveSuggestion } from '../lib/autocomplete'
import { centroidOf } from '../lib/distance'
import { getAppMapStyles } from '../lib/mapStyle'

const TABS = [
  { id: 'manual', label: 'Enter an address' },
  { id: 'anchor', label: 'Anchor to a person' },
  { id: 'visual', label: 'Adjust on map' },
]

function ManualTab({ onApply, applying }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [error, setError] = useState('')
  const tokenRef = useRef(null)

  useEffect(() => {
    createAutocompleteSessionToken().then((token) => {
      tokenRef.current = token
    })
  }, [])

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetchAddressSuggestions(input, tokenRef.current)
        .then((results) => {
          if (!cancelled) setSuggestions(results)
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [input])

  async function handlePick(suggestion) {
    setError('')
    try {
      const resolved = await resolveSuggestion(suggestion)
      if (!resolved) {
        setError(`Couldn't find "${suggestion.text}". Try being more specific.`)
        return
      }
      await onApply({ mode: 'manual', lat: resolved.lat, lng: resolved.lng, label: resolved.formattedAddress })
      tokenRef.current = await createAutocompleteSessionToken()
    } catch (err) {
      setError(err.message || 'Could not use that address. Please try again.')
    }
  }

  return (
    <div className="adjust-search-tab">
      <p className="lobby-hint">Search everyone's restaurants near an address instead of using GPS.</p>
      <input
        type="text"
        className="room-code-input"
        placeholder="Address, neighborhood, or landmark"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={applying}
        autoFocus
      />
      {suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button type="button" onClick={() => handlePick(s)} disabled={applying}>
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function AnchorTab({ members, onApply, applying }) {
  const withLocation = members.filter((m) => m.lat != null && m.lng != null)

  return (
    <div className="adjust-search-tab">
      <p className="lobby-hint">Use one person's location as the search center for everyone.</p>
      {withLocation.length === 0 ? (
        <p className="restaurant-status">No one's location is available yet.</p>
      ) : (
        <ul className="member-list">
          {withLocation.map((m) => (
            <li key={m.id}>
              <span>{m.display_name}</span>
              <button
                type="button"
                className="btn btn-restart"
                disabled={applying}
                onClick={() => onApply({ mode: 'anchor', anchorMemberId: m.id, label: m.display_name })}
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VisualTab({ members, onApply, applying }) {
  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  const midpointMarkerRef = useRef(null)
  const [pendingPosition, setPendingPosition] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const [{ Map }, { Marker }] = await Promise.all([
        window.google.maps.importLibrary('maps'),
        window.google.maps.importLibrary('marker'),
      ])
      if (cancelled || !mapDivRef.current) return

      const withLocation = members.filter((m) => m.lat != null && m.lng != null)
      const initial = centroidOf(withLocation.map((m) => ({ lat: m.lat, lng: m.lng }))) ?? { lat: 0, lng: 0 }

      const map = new Map(mapDivRef.current, {
        center: initial,
        zoom: 12,
        styles: getAppMapStyles(),
        clickableIcons: false,
        disableDoubleClickZoom: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
      })
      mapRef.current = map

      withLocation.forEach((member) => {
        new Marker({
          map,
          position: { lat: member.lat, lng: member.lng },
          title: member.display_name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: getToken('--text-muted'),
            fillOpacity: 1,
            strokeColor: getToken('--surface'),
            strokeWeight: 2,
          },
        })
      })

      const midpointMarker = new Marker({
        map,
        position: initial,
        draggable: true,
        title: 'Suggested midpoint — drag to adjust',
        icon: {
          url: buildPinIconDataUri(),
          scaledSize: new window.google.maps.Size(34, 42),
          anchor: new window.google.maps.Point(17, 42),
        },
      })
      midpointMarker.addListener('dragend', (event) => {
        setPendingPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() })
      })
      midpointMarkerRef.current = midpointMarker
      setPendingPosition(initial)
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleUseLocation() {
    if (!pendingPosition) return
    onApply({ mode: 'visual', lat: pendingPosition.lat, lng: pendingPosition.lng, label: null })
  }

  return (
    <div className="adjust-search-tab">
      <p className="lobby-hint">Drag the pin to set where the group searches from.</p>
      <div ref={mapDivRef} className="adjust-search-map" />
      <button type="button" className="btn btn-primary" onClick={handleUseLocation} disabled={applying || !pendingPosition}>
        {applying ? 'Applying…' : 'Use this location'}
      </button>
    </div>
  )
}

function getToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function buildPinIconDataUri() {
  const accent = getToken('--accent')
  const surface = getToken('--surface')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
    <path d="M17 41C17 41 33 24.6 33 17C33 7.6 25.9 1 17 1C8.1 1 1 7.6 1 17C1 24.6 17 41 17 41Z" fill="${accent}" stroke="${surface}" stroke-width="2"/>
    <circle cx="17" cy="17" r="6" fill="${surface}"/>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function AdjustSearchAreaPanel({ members, applying, applyError, onApply, onClose }) {
  const [activeTab, setActiveTab] = useState('manual')

  return (
    <Modal title="Adjust search area" onClose={onClose}>
      <div className="pill-tabs" role="group" aria-label="Adjust search area mode">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`pill-tab${activeTab === tab.id ? ' pill-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'manual' && <ManualTab onApply={onApply} applying={applying} />}
      {activeTab === 'anchor' && <AnchorTab members={members} onApply={onApply} applying={applying} />}
      {activeTab === 'visual' && <VisualTab members={members} onApply={onApply} applying={applying} />}

      {applyError && <p className="form-error">{applyError}</p>}
    </Modal>
  )
}

export default AdjustSearchAreaPanel
