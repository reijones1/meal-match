import { useEffect, useMemo, useRef, useState } from 'react'
import RestaurantCard from './RestaurantCard'
import DeliveryRestaurantCard from './DeliveryRestaurantCard'
import RestaurantMap from './RestaurantMap'
import RestaurantMapModal from './RestaurantMapModal'
import AdjustSearchAreaPanel from './AdjustSearchAreaPanel'
import { fetchGroup, fetchGroupMembers, setGroupRadiusMiles, setGroupSearchMode, setGroupTravelMode } from '../lib/groups'
import { getCurrentPosition } from '../lib/geolocation'
import {
  computeGroupRestaurantResults,
  expandGroupRestaurantResults,
  fetchGroupRestaurantResults,
} from '../lib/groupRestaurantResults'
import { sortByBest, sortByCheapest, sortByClosest } from '../lib/ranking'
import { supabase } from '../lib/supabase'

const SORT_OPTIONS = [
  { id: 'best', label: 'Best' },
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'closest', label: 'Closest' },
]

const TRAVEL_MODE_OPTIONS = [
  { id: 'DRIVING', label: 'Driving' },
  { id: 'WALKING', label: 'Walking' },
]

const RESULTS_TABS = [
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'delivery', label: 'Delivery' },
]

// Explicitly three tiers here, not solo mode's four ([1, 3, 5, 10]) — the group "show more"
// flow steps 1 -> 5 -> 10, skipping a 3 mi tier entirely, per how this was asked for.
const RADIUS_OPTIONS_MILES = [1, 5, 10]
const DEFAULT_RADIUS_MILES = 5

function searchAreaLabel(groupRow, members) {
  if (!groupRow) return null
  if (groupRow.search_mode === 'anchor') {
    const anchor = members.find((m) => m.id === groupRow.search_anchor_member_id)
    return anchor ? `Showing results near ${anchor.display_name}` : null
  }
  if (groupRow.search_mode === 'manual' && groupRow.search_label) {
    return `Showing results near ${groupRow.search_label}`
  }
  if (groupRow.search_mode === 'visual') {
    return 'Showing results near a custom point on the map'
  }
  return null
}

function GroupRestaurantResults({ group, isHost, cuisine }) {
  const [groupRow, setGroupRow] = useState(null)
  const [members, setMembers] = useState([])
  const [resultRow, setResultRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [computeError, setComputeError] = useState('')
  const [myLocation, setMyLocation] = useState(null)

  // Purely local/per-device — each participant can look at either tab without it affecting
  // what anyone else sees, unlike everything else on this screen (search area, radius, travel
  // mode), which is genuinely shared state.
  const [activeTab, setActiveTab] = useState('restaurants')
  const [indicatorStyle, setIndicatorStyle] = useState(null)
  const tabRefs = useRef({})
  const [sortMode, setSortMode] = useState('best')
  const [activeId, setActiveId] = useState(null)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')

  const [radiusBusy, setRadiusBusy] = useState(false)
  const [showingMore, setShowingMore] = useState(false)

  const hostComputedRef = useRef(false)

  // Measures the active tab's actual rendered position/width so the underline can sit exactly
  // beneath whichever label is active and slide precisely between them — "Restaurants" and
  // "Delivery" aren't the same width, so a fixed 50/50 split wouldn't line up correctly.
  useEffect(() => {
    function updateIndicator() {
      const el = tabRefs.current[activeTab]
      if (el) setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth })
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeTab])

  // Shares this device's own location for its own Directions/View-on-Maps buttons — separate
  // from the group's shared search center, since those two actions are personal to whoever
  // taps them, not a group decision.
  useEffect(() => {
    getCurrentPosition()
      .then(setMyLocation)
      .catch(() => {
        // No fallback needed here — the per-card buttons just omit an origin, and Google
        // Maps falls back to the device's own location when the link opens.
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchGroup(group.id), fetchGroupMembers(group.id), fetchGroupRestaurantResults(group.id)])
      .then(([groupData, memberData, resultData]) => {
        if (cancelled) return
        setGroupRow(groupData)
        setMembers(memberData)
        setResultRow(resultData)
      })
      .catch((err) => console.error('Could not load group restaurant results:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [group.id])

  // The search area/travel mode/radius are all session-wide — everyone needs to see the same
  // change the moment anyone applies one.
  useEffect(() => {
    const channel = supabase
      .channel(`groups_search_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] groups UPDATE received (search area):', payload.new)
          setGroupRow(payload.new)
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] groups (search area) subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id])

  // The shared restaurant list itself. A DELETE (fired when the search area/travel mode
  // changes, or the radius shrinks) clears it back to null so everyone shows "finding
  // restaurants" again until the host's next compute writes a fresh row. An UPDATE (fired by
  // an expand/"show more") replaces it in place, no "finding restaurants" flash.
  useEffect(() => {
    const channel = supabase
      .channel(`group_restaurant_results_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_restaurant_results', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] group_restaurant_results INSERT received:', payload.new)
          setResultRow(payload.new)
          hostComputedRef.current = false
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_restaurant_results', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] group_restaurant_results UPDATE received:', payload.new)
          setResultRow(payload.new)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_restaurant_results' },
        () => {
          console.log('[realtime] group_restaurant_results DELETE received')
          setResultRow(null)
          hostComputedRef.current = false
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] group_restaurant_results subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id])

  // Only the host computes the shared list — everyone else only ever renders resultRow.
  useEffect(() => {
    if (!isHost || loading || resultRow || !groupRow || hostComputedRef.current) return
    hostComputedRef.current = true

    computeGroupRestaurantResults(group.id, {
      cuisineName: cuisine.name,
      groupRow,
      members,
      travelMode: groupRow.travel_mode ?? 'DRIVING',
      radiusMiles: groupRow.radius_miles ?? DEFAULT_RADIUS_MILES,
    })
      .then(setResultRow)
      .catch((err) => {
        setComputeError(err.message || 'Could not find restaurants for the group. Please try again.')
        hostComputedRef.current = false
      })
  }, [isHost, loading, resultRow, groupRow, members, group.id, cuisine.name])

  // Recomputes and writes the shared row directly, using explicitly-passed settings rather
  // than reading them back off `groupRow` state. `groupRow` only updates once this client's
  // own realtime broadcast for the settings write round-trips back — which can arrive *after*
  // this function already needs to compute, so trusting it here would risk computing with the
  // stale (pre-change) setting. Passing the just-written values in directly avoids that race.
  async function replaceResults({ groupRowOverride, travelModeOverride, radiusOverride }) {
    const updated = await computeGroupRestaurantResults(group.id, {
      cuisineName: cuisine.name,
      groupRow: groupRowOverride ?? groupRow,
      members,
      travelMode: travelModeOverride ?? travelMode,
      radiusMiles: radiusOverride ?? currentRadius,
    })
    setResultRow(updated)
  }

  async function handleApplySearchArea(choice) {
    setApplying(true)
    setApplyError('')
    try {
      await setGroupSearchMode(group.id, choice)
      await replaceResults({
        groupRowOverride: {
          ...groupRow,
          search_mode: choice.mode,
          search_lat: choice.lat ?? null,
          search_lng: choice.lng ?? null,
          search_label: choice.label ?? null,
          search_anchor_member_id: choice.anchorMemberId ?? null,
        },
      })
      setPanelOpen(false)
    } catch (err) {
      setApplyError(err.message || 'Could not update the search area. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const travelMode = groupRow?.travel_mode ?? 'DRIVING'
  const currentRadius = resultRow?.radius_miles ?? groupRow?.radius_miles ?? DEFAULT_RADIUS_MILES
  const nextRadiusTier = RADIUS_OPTIONS_MILES.find((r) => r > currentRadius)

  async function handleSelectTravelMode(mode) {
    if (mode === travelMode || radiusBusy || showingMore) return
    setComputeError('')
    try {
      await setGroupTravelMode(group.id, mode)
      // Travel mode changes both the individual and group-ranking Distance Matrix results —
      // there's no way to patch that in place, so this always replaces, never appends.
      await replaceResults({ travelModeOverride: mode })
    } catch (err) {
      setComputeError(err.message || 'Could not update travel mode. Please try again.')
    }
  }

  async function handleSelectRadius(newRadius) {
    if (newRadius === currentRadius || radiusBusy || showingMore) return
    setRadiusBusy(true)
    setComputeError('')
    try {
      await setGroupRadiusMiles(group.id, newRadius)
      if (newRadius > currentRadius && resultRow) {
        const updated = await expandGroupRestaurantResults(group.id, {
          cuisineName: cuisine.name,
          groupRow,
          members,
          travelMode,
          radiusMiles: newRadius,
          existingResultRow: resultRow,
        })
        setResultRow(updated)
      } else {
        // Shrinking (or no existing result yet): start over at the smaller radius.
        await replaceResults({ radiusOverride: newRadius })
      }
    } catch (err) {
      setComputeError(err.message || 'Could not update the search radius. Please try again.')
    } finally {
      setRadiusBusy(false)
    }
  }

  async function handleShowMore() {
    if (!nextRadiusTier || showingMore || radiusBusy) return
    setShowingMore(true)
    setComputeError('')
    try {
      await setGroupRadiusMiles(group.id, nextRadiusTier)
      const updated = await expandGroupRestaurantResults(group.id, {
        cuisineName: cuisine.name,
        groupRow,
        members,
        travelMode,
        radiusMiles: nextRadiusTier,
        existingResultRow: resultRow,
      })
      setResultRow(updated)
    } catch (err) {
      setComputeError(err.message || 'Could not find more restaurants. Please try again.')
    } finally {
      setShowingMore(false)
    }
  }

  const restaurants = resultRow?.restaurants ?? []
  const metricKey = 'avgMinutes'
  const sortedRestaurants = useMemo(() => {
    if (sortMode === 'cheapest') return sortByCheapest(restaurants)
    if (sortMode === 'closest') return sortByClosest(restaurants, metricKey)
    return sortByBest(restaurants)
  }, [restaurants, sortMode])
  // Filtered straight from the same shared candidate set the Restaurants tab uses — no
  // separate search, per how the delivery flag is fetched once alongside everything else in
  // computeGroupRestaurantResults/expandGroupRestaurantResults.
  const deliveryRestaurants = useMemo(() => restaurants.filter((r) => r.delivery === true), [restaurants])

  const areaLabel = searchAreaLabel(groupRow, members)
  const mapCenter = resultRow?.search_center ?? myLocation

  if (loading || !groupRow) {
    return <p className="restaurant-status">Loading…</p>
  }

  return (
    <>
      <div className="results-tabbar" role="tablist" aria-label="Results view">
        {RESULTS_TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el
            }}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`results-tabbar-item${activeTab === tab.id ? ' results-tabbar-item-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        {indicatorStyle && (
          <span
            className="results-tabbar-indicator"
            style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
          />
        )}
      </div>

      <h3>Nearby {cuisine.name} spots</h3>

      <div className="adjust-search-row">
        {areaLabel && <p className="lobby-hint">{areaLabel}</p>}
        {isHost && (
          <button type="button" className="btn-link" onClick={() => setPanelOpen(true)}>
            Adjust search area
          </button>
        )}
      </div>

      {panelOpen && (
        <AdjustSearchAreaPanel
          members={members}
          applying={applying}
          applyError={applyError}
          onApply={handleApplySearchArea}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <div className="radius-control">
        <p className="radius-label">Showing results within {currentRadius} mi</p>
        <div className="pill-tabs" role="group" aria-label="Search radius">
          {RADIUS_OPTIONS_MILES.map((r) => (
            <button
              key={r}
              type="button"
              className={`pill-tab${currentRadius === r ? ' pill-tab-active' : ''}`}
              disabled={radiusBusy || showingMore}
              onClick={() => handleSelectRadius(r)}
            >
              {r} mi
            </button>
          ))}
        </div>
      </div>

      {computeError && <p className="restaurant-status restaurant-error">{computeError}</p>}

      {!resultRow && !computeError && (
        <p className="restaurant-status">Finding restaurants for the group…</p>
      )}

      {resultRow && restaurants.length === 0 && (
        <p className="restaurant-status">No {cuisine.name} restaurants found for the group. Try adjusting the search area.</p>
      )}

      {activeTab === 'restaurants' && (
        <>
          {resultRow && restaurants.length > 0 && mapCenter && (
            <RestaurantMap
              variant="preview"
              userLocation={mapCenter}
              restaurants={sortedRestaurants}
              activeId={activeId}
              onMarkerClick={setActiveId}
              cuisineEmoji={cuisine.emoji}
              onExpandRequest={() => setMapExpanded(true)}
            />
          )}

          {mapExpanded && mapCenter && (
            <RestaurantMapModal
              userLocation={mapCenter}
              restaurants={sortedRestaurants}
              activeId={activeId}
              onSelect={setActiveId}
              cuisineEmoji={cuisine.emoji}
              travelMode={travelMode}
              onClose={() => setMapExpanded(false)}
            />
          )}

          {resultRow && restaurants.length > 0 && (
            <>
              <div className="pill-tabs" role="group" aria-label="Travel mode">
                {TRAVEL_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`pill-tab${travelMode === option.id ? ' pill-tab-active' : ''}`}
                    disabled={radiusBusy || showingMore}
                    onClick={() => handleSelectTravelMode(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

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
                      userLocation={myLocation}
                      travelMode={travelMode}
                    />
                  </li>
                ))}
              </ul>

              {nextRadiusTier && (
                <button
                  type="button"
                  className="btn-link show-more-link"
                  onClick={handleShowMore}
                  disabled={showingMore || radiusBusy}
                >
                  {showingMore ? 'Finding more…' : `Show more (up to ${nextRadiusTier} mi)`}
                </button>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'delivery' && resultRow && restaurants.length > 0 && (
        <>
          {deliveryRestaurants.length === 0 ? (
            <p className="restaurant-status">No {cuisine.name} restaurants nearby offer delivery right now.</p>
          ) : (
            <ul className="restaurant-list">
              {deliveryRestaurants.map((r, index) => (
                <li key={r.id}>
                  <DeliveryRestaurantCard restaurant={r} index={index} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

export default GroupRestaurantResults
