// A small `OverlayView`-based marker that positions an arbitrary HTML element on the map.
// AdvancedMarkerElement would be the modern choice, but it requires a `mapId`, and Google
// does not support the JS `styles` array on any map that has one — only Cloud Console
// styling does. Since this app needs runtime, code-driven styling (recolored from the app's
// own CSS tokens), the map has to stay a classic un-styled-by-mapId (raster) map, so custom
// markers are built by hand instead.
//
// The class body is only built the first time `createHtmlOverlayMarker` runs (not at module
// load) because it extends `google.maps.OverlayView`, which doesn't exist until the Maps JS
// bootstrap script has loaded — evaluating that at import time (before any component has
// awaited `importLibrary`) crashes with "Class extends value undefined".
let OverlayMarkerClass = null

function getOverlayMarkerClass() {
  if (OverlayMarkerClass) return OverlayMarkerClass

  OverlayMarkerClass = class extends window.google.maps.OverlayView {
    constructor(map, position, content, offsetY) {
      super()
      this.position = position
      this.content = content
      this.offsetY = offsetY ?? 0
      this.div = null
      this.setMap(map)
    }

    onAdd() {
      this.div = document.createElement('div')
      this.div.style.position = 'absolute'
      this.div.appendChild(this.content)
      this.getPanes().overlayMouseTarget.appendChild(this.div)
    }

    draw() {
      const projection = this.getProjection()
      if (!projection || !this.div) return
      const point = projection.fromLatLngToDivPixel(this.position)
      if (!point) return
      // The content's own markup (see RestaurantMap) puts its visual "tip" at its
      // bottom-center, so shifting the div by (-50%, -100%) lands that tip on the coordinate.
      // `offsetY` pushes it up further still (in px) — used to float the info popup above
      // the pin it belongs to instead of covering it.
      this.div.style.left = `${point.x}px`
      this.div.style.top = `${point.y}px`
      this.div.style.transform = `translate(-50%, calc(-100% - ${this.offsetY}px))`
    }

    onRemove() {
      if (this.div) {
        this.div.remove()
        this.div = null
      }
    }
  }

  return OverlayMarkerClass
}

export function createHtmlOverlayMarker(map, position, content, offsetY) {
  const Marker = getOverlayMarkerClass()
  return new Marker(map, position, content, offsetY)
}
