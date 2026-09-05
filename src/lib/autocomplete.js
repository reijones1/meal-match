// Uses the modern AutocompleteSuggestion API (Places API New) rather than the legacy
// Autocomplete widget, consistent with the rest of this app's Places usage — and it lets the
// suggestion dropdown be styled as this app's own UI instead of Google's default widget chrome.
export async function fetchAddressSuggestions(input, sessionToken) {
  if (!input.trim()) return []

  const { AutocompleteSuggestion } = await window.google.maps.importLibrary('places')
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
  })

  return suggestions
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      placeId: prediction.placeId,
      text: prediction.text.text,
      prediction,
    }))
}

// Resolves a picked suggestion down to coordinates — a separate step from fetching the
// suggestion list itself, since Places only returns location data once you commit to one.
export async function resolveSuggestion(suggestion) {
  const place = suggestion.prediction.toPlace()
  await place.fetchFields({ fields: ['location', 'formattedAddress'] })
  if (!place.location) return null

  return {
    lat: place.location.lat(),
    lng: place.location.lng(),
    formattedAddress: place.formattedAddress ?? suggestion.text,
  }
}

// A fresh token per "typing session" is how Google bills autocomplete-then-select as one
// unit instead of a full per-keystroke lookup fee — created lazily so importing this module
// doesn't itself require the Maps script to already be loaded.
export async function createAutocompleteSessionToken() {
  const { AutocompleteSessionToken } = await window.google.maps.importLibrary('places')
  return new AutocompleteSessionToken()
}
