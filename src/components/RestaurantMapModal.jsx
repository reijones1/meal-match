import { useEffect, useRef } from 'react'
import RestaurantCard from './RestaurantCard'
import RestaurantMap from './RestaurantMap'
import { CloseIcon } from './icons'

function RestaurantMapModal({ userLocation, restaurants, activeId, onSelect, cuisineEmoji, travelMode, onClose }) {
  const itemRefs = useRef({})

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Keeps the marker highlight (from either a marker click or a card tap) and the list in
  // sync: whichever restaurant becomes active scrolls into view here too.
  useEffect(() => {
    itemRefs.current[activeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeId])

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div
        className="map-modal-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Map of nearby restaurants"
      >
        <div className="map-modal-map">
          <RestaurantMap
            variant="full"
            userLocation={userLocation}
            restaurants={restaurants}
            activeId={activeId}
            onMarkerClick={onSelect}
            cuisineEmoji={cuisineEmoji}
          />
          <button type="button" className="map-modal-close" onClick={onClose} aria-label="Close map">
            <CloseIcon />
          </button>
        </div>

        <ul className="map-modal-list restaurant-list">
          {restaurants.map((r, index) => (
            <li key={r.id} ref={(el) => { itemRefs.current[r.id] = el }}>
              <RestaurantCard
                restaurant={r}
                index={index}
                active={r.id === activeId}
                onSelect={onSelect}
                userLocation={userLocation}
                travelMode={travelMode}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default RestaurantMapModal
