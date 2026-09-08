import { useState } from 'react'
import { deliverooSearchUrl, justEatSearchUrl, placeMapsUrl, ubereatsSearchUrl } from '../lib/mapsUrl'
import { formatPrice } from '../lib/priceLevel'
import { formatOpenStatus } from '../lib/openingHours'
import { ClockIcon } from './icons'

// A sibling of RestaurantCard for delivery mode — same photo/name/rating/price/address
// treatment, but no distance/travel-time (nobody's traveling) and no map-related buttons.
// "Order food" goes to the restaurant's own Google Maps listing (the same listing URL used
// elsewhere in the app), since Google's business listings often surface delivery-platform
// ordering links directly; the platform search links below it are an explicit fallback.
function DeliveryRestaurantCard({ restaurant, index }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showPhoto = restaurant.photoUrl && !imageFailed

  return (
    <div className="restaurant-item restaurant-item-delivery">
      {index != null && <span className="restaurant-index">{index + 1}</span>}

      <div className="restaurant-photo">
        {showPhoto ? (
          <img src={restaurant.photoUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="restaurant-photo-fallback" aria-hidden="true">
            🍽️
          </span>
        )}
      </div>

      <div className="restaurant-info">
        <span className="restaurant-name">{restaurant.name}</span>

        <span className="restaurant-stats">
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

        <div className="delivery-actions">
          <a
            className="btn btn-primary btn-order-food"
            href={placeMapsUrl(restaurant.id, restaurant.name)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Order food
          </a>
          <div className="delivery-fallback">
            <span className="delivery-fallback-label">or search directly:</span>
            <a href={ubereatsSearchUrl(restaurant.name)} target="_blank" rel="noopener noreferrer">
              Uber Eats
            </a>
            <a href={deliverooSearchUrl(restaurant.name)} target="_blank" rel="noopener noreferrer">
              Deliveroo
            </a>
            <a href={justEatSearchUrl(restaurant.name)} target="_blank" rel="noopener noreferrer">
              Just Eat
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeliveryRestaurantCard
