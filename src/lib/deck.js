import { cuisines } from '../data/cuisines'
import { fetchFoodItems } from './foodItems'
import { shuffleArray } from './shuffle'

export const CARD_TYPES = { CUISINES: 'cuisines', DISHES: 'dishes' }
export const DECK_SIZE_OPTIONS = [5, 10, 15, 'all']
export const AVAILABLE_TAGS = ['vegan', 'vegetarian', 'gluten-free', 'spicy']

export const DEFAULT_SETTINGS = {
  cardType: CARD_TYPES.CUISINES,
  deckSize: 15,
  tagFilters: [],
}

async function getPool(cardType) {
  if (cardType === CARD_TYPES.DISHES) {
    const items = await fetchFoodItems()
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      description: item.description ?? '',
      tags: item.tags ?? [],
    }))
  }
  return cuisines.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    description: c.description,
    tags: c.tags ?? [],
  }))
}

// A tag filter must match ALL selected tags, not just any one — dietary restrictions are
// exclusionary (vegan + gluten-free means both, not either), so "must satisfy everything
// selected" is the safer default even though "spicy" alongside a diet tag reads more like
// a loose preference than a restriction.
function matchesFilters(item, tagFilters) {
  if (tagFilters.length === 0) return true
  return tagFilters.every((tag) => item.tags.includes(tag))
}

// Computes a fresh, randomized deck from settings. Used by solo mode, and by the group
// host at the moment they start a session — nobody else should call this for the same
// round, since two independent calls could sample two different subsets from the same pool.
export async function buildDeck(settings) {
  const pool = await getPool(settings.cardType)
  const filtered = pool.filter((item) => matchesFilters(item, settings.tagFilters))
  const shuffled = shuffleArray(filtered)
  if (settings.deckSize === 'all') return shuffled
  return shuffled.slice(0, Number(settings.deckSize))
}

// Reconstructs the *exact* set of items the host's buildDeck() already chose (identified
// by name, matching how the rest of the app already references cuisines/dishes), so every
// group member votes on the same deck. Only the display order is re-shuffled per client —
// the set itself is fixed by `names`.
export async function resolveDeckItems(cardType, names) {
  const pool = await getPool(cardType)
  const nameSet = new Set(names)
  const matched = pool.filter((item) => nameSet.has(item.name))
  return shuffleArray(matched)
}
