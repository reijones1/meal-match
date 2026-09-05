// Builds the Google Maps `styles` array from this app's own CSS custom properties (read live,
// so light/dark mode both work automatically) instead of hardcoding a duplicate palette here.
// Also strips POI/transit clutter so the restaurant markers are the only things that stand out.
export function getAppMapStyles() {
  const root = getComputedStyle(document.documentElement)
  const token = (name) => root.getPropertyValue(name).trim()

  const bg = token('--bg')
  const surface = token('--surface')
  const border = token('--border')
  const textMuted = token('--text-muted')
  const gold = token('--gold')
  const like = token('--like')

  return [
    { elementType: 'geometry', stylers: [{ color: bg }] },
    { elementType: 'labels.text.fill', stylers: [{ color: textMuted }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: surface }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },

    // Hide every default point-of-interest icon/label — gas stations, shops, transit stops —
    // then re-enable just parks (recolored) so green space still reads on the map.
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: like, visibility: 'on' }] },
    { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },

    { featureType: 'road', elementType: 'geometry', stylers: [{ color: surface }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: border }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: gold }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: border }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: textMuted }] },
    { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },

    { featureType: 'transit', stylers: [{ visibility: 'off' }] },

    { featureType: 'water', elementType: 'geometry', stylers: [{ color: border }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: textMuted }] },
  ]
}
