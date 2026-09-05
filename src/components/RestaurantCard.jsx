import { useState } from 'react'
import { formatDistance } from '../lib/distance'
import { directionsUrl, placeMapsUrl } from '../lib/mapsUrl'
import { formatPrice } from '../lib/priceLevel'
import { formatOpenStatus } from '../lib/openingHours'
import { CarIcon, ClockIcon, DirectionsIcon, MapPinIcon, WalkIcon } from './icons'

function RestaurantCard({ restaurant, index, active, onSelect, userLocation, travelMode }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showPhoto = restaurant.photoUrl && !imageFailed
  const TravelIcon = travelMode === 'WALKING' ? WalkIcon : CarIcon

  function handleSelect() {
    onSelect?.(restaurant.id)
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleSelect()
  }

  // Both action buttons stop the click from also selecting the card underneath them.
  function handleDirectionsClick(event) {
    event.stopPropagation()
    window.open(directionsUrl(userLocation, restaurant.location, restaurant.id, travelMode), '_blank', 'noopener,noreferrer')
  }

  function handleViewOnMapsClick(event) {
    event.stopPropagation()
  }

  return (
    <div
      className={`restaurant-item${active ? ' restaurant-item-active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
    >
      {index != null && <span className="restaurant-index">{index + 1}</span>}

      <div className="restaurant-photo">
        {showPhoto ? (
          <img
            src={restaurant.photoUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="restaurant-photo-fallback" aria-hidden="true">
            🍽️
          </span>
        )}
      </div>

      <div className="restaurant-info">
        <span className="restaurant-name">{restaurant.name}</span>

        <span className="restaurant-stats">
          <span className="restaurant-stat">
            <TravelIcon />
            {restaurant.durationText ?? formatDistance(restaurant.distanceMiles)}
          </span>
          <span className="restaurant-stat">{formatPrice(restaurant.priceLevel, restaurant.priceRange)}</span>
          {restaurant.openStatus && (
            <span className="restaurant-stat">
              <ClockIcon />
              {formatOpenStatus(restaurant.openStatus)}
            </span>
          )}
        </span>

        {restaurant.rating != null && (
          <span className="restaurant-rating">
            ★ {restaurant.rating}
            {restaurant.reviewCount != null && (
              <span className="restaurant-review-count"> ({restaurant.reviewCount})</span>
            )}
          </span>
        )}

        <span className="restaurant-address">{restaurant.address}</span>
      </div>

      <div className="restaurant-actions">
        {restaurant.location && (
          <button
            type="button"
            className="restaurant-directions"
            onClick={handleDirectionsClick}
            aria-label={`Get directions to ${restaurant.name}`}
            title="Directions"
          >
            <DirectionsIcon />
          </button>
        )}
        <a
          className="restaurant-view-maps"
          href={placeMapsUrl(restaurant.id, restaurant.name)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleViewOnMapsClick}
          aria-label={`View ${restaurant.name} on Google Maps`}
          title="View on Maps"
        >
          <MapPinIcon />
        </a>
      </div>
    </div>
  )
}

export default RestaurantCard
