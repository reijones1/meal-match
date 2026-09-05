// Hardcoded starter list. Each cuisine just needs an id, name, emoji, and a short blurb.
//
// `tags` intentionally only ever contains "spicy" here, and only for cuisines where that's
// a well-established general trait. Cuisines aren't inherently vegan/vegetarian/gluten-free
// the way a specific dish is (Ethiopian food has great vegan dishes, but also meat-heavy
// ones) — that filtering only applies in "Specific dishes" mode, see src/lib/deck.js.
export const cuisines = [
  { id: 1, name: 'Italian', emoji: '🍝', description: 'Pasta, pizza, and rich tomato sauces.', tags: [] },
  { id: 2, name: 'Mexican', emoji: '🌮', description: 'Tacos, salsas, and bold spices.', tags: ['spicy'] },
  { id: 3, name: 'Japanese', emoji: '🍣', description: 'Sushi, ramen, and delicate flavors.', tags: [] },
  { id: 4, name: 'Indian', emoji: '🍛', description: 'Curries, spices, and fresh naan.', tags: ['spicy'] },
  { id: 5, name: 'Thai', emoji: '🍜', description: 'Sweet, sour, salty, and spicy in balance.', tags: ['spicy'] },
  { id: 6, name: 'Chinese', emoji: '🥡', description: 'Stir-fries, dumplings, and noodles.', tags: [] },
  { id: 7, name: 'French', emoji: '🥐', description: 'Buttery pastries and classic sauces.', tags: [] },
  { id: 8, name: 'Greek', emoji: '🥙', description: 'Olive oil, feta, and fresh herbs.', tags: [] },
  { id: 9, name: 'Korean', emoji: '🍢', description: 'Kimchi, barbecue, and bold ferments.', tags: ['spicy'] },
  { id: 10, name: 'Vietnamese', emoji: '🍲', description: 'Fresh herbs, broths, and pho.', tags: [] },
  { id: 11, name: 'Spanish', emoji: '🥘', description: 'Tapas, paella, and smoky paprika.', tags: [] },
  { id: 12, name: 'Lebanese', emoji: '🧆', description: 'Hummus, falafel, and grilled meats.', tags: [] },
  { id: 13, name: 'American', emoji: '🍔', description: 'Burgers, barbecue, and comfort food.', tags: [] },
  { id: 14, name: 'Ethiopian', emoji: '🌶️', description: 'Injera and richly spiced stews.', tags: ['spicy'] },
  { id: 15, name: 'Brazilian', emoji: '🍖', description: 'Grilled meats and hearty sides.', tags: [] },
]
