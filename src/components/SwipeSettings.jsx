import { CARD_TYPES, DECK_SIZE_OPTIONS, AVAILABLE_TAGS } from '../lib/deck'

function SwipeSettings({ settings, onChange, disabled }) {
  function update(patch) {
    const next = { ...settings, ...patch }
    // Cuisines only ever carry the "spicy" tag — drop any other filter that would
    // otherwise silently produce an empty deck when switching back to Cuisines mode.
    if (next.cardType === CARD_TYPES.CUISINES) {
      next.tagFilters = next.tagFilters.filter((tag) => tag === 'spicy')
    }
    onChange(next)
  }

  function toggleTag(tag) {
    const active = settings.tagFilters.includes(tag)
    update({ tagFilters: active ? settings.tagFilters.filter((t) => t !== tag) : [...settings.tagFilters, tag] })
  }

  function toggleDietMode(tag) {
    const isActive = settings.tagFilters.length === 1 && settings.tagFilters[0] === tag
    if (isActive) {
      update({ tagFilters: [] })
    } else {
      // A vegan/vegetarian filter only means something for specific dishes, so switch
      // card type automatically rather than silently filtering cuisines to nothing.
      update({ tagFilters: [tag], cardType: CARD_TYPES.DISHES })
    }
  }

  const isVeganActive = settings.tagFilters.length === 1 && settings.tagFilters[0] === 'vegan'
  const isVegetarianActive = settings.tagFilters.length === 1 && settings.tagFilters[0] === 'vegetarian'

  return (
    <div className="swipe-settings">
      <div className="settings-row">
        <span className="settings-label">Cards</span>
        <div className="pill-tabs">
          <button
            type="button"
            className={`pill-tab${settings.cardType === CARD_TYPES.CUISINES ? ' pill-tab-active' : ''}`}
            onClick={() => update({ cardType: CARD_TYPES.CUISINES })}
            disabled={disabled}
          >
            Cuisines
          </button>
          <button
            type="button"
            className={`pill-tab${settings.cardType === CARD_TYPES.DISHES ? ' pill-tab-active' : ''}`}
            onClick={() => update({ cardType: CARD_TYPES.DISHES })}
            disabled={disabled}
          >
            Specific dishes
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">Deck size</span>
        <div className="pill-tabs">
          {DECK_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              className={`pill-tab${settings.deckSize === size ? ' pill-tab-active' : ''}`}
              onClick={() => update({ deckSize: size })}
              disabled={disabled}
            >
              {size === 'all' ? 'All' : size}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row diet-shortcut-row">
        <button
          type="button"
          className={`btn diet-btn${isVeganActive ? ' diet-btn-active' : ''}`}
          onClick={() => toggleDietMode('vegan')}
          disabled={disabled}
        >
          🌱 Vegan mode
        </button>
        <button
          type="button"
          className={`btn diet-btn${isVegetarianActive ? ' diet-btn-active' : ''}`}
          onClick={() => toggleDietMode('vegetarian')}
          disabled={disabled}
        >
          🥕 Vegetarian mode
        </button>
      </div>

      <div className="settings-row">
        <span className="settings-label">Filters</span>
        <div className="pill-tabs">
          {AVAILABLE_TAGS.map((tag) => {
            const unavailable = settings.cardType === CARD_TYPES.CUISINES && tag !== 'spicy'
            return (
              <button
                key={tag}
                type="button"
                className={`pill-tab${settings.tagFilters.includes(tag) ? ' pill-tab-active' : ''}`}
                onClick={() => toggleTag(tag)}
                disabled={disabled || unavailable}
                title={unavailable ? 'Only available in Specific dishes mode' : undefined}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SwipeSettings
