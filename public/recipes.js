/* Shared recipe data for the Multiplayer Moroccan Culinary Challenge.
   Used by both the server (require) and the browser (script tag). */
const RECIPES = {
  tagine: {
    id: 'tagine',
    name: 'Chicken Tagine with Preserved Lemon',
    short: 'Tagine',
    emoji: '🍲',
    blurb: 'Slow-braised, saffron-gold, and unforgiving of a heavy hand.',
    prep: {
      seconds: 45,
      ingredients: [
        { id: 'onion', name: 'Onion', emoji: '🧅', chops: 8 },
        { id: 'garlic', name: 'Garlic', emoji: '🧄', chops: 5 },
        { id: 'tomato', name: 'Tomato', emoji: '🍅', chops: 7 },
        { id: 'coriander', name: 'Coriander', emoji: '🌿', chops: 4 },
        { id: 'carrot', name: 'Carrot', emoji: '🥕', chops: 6 }
      ]
    },
    spice: {
      seconds: 45,
      tolerance: 6,
      spices: [
        { id: 'cumin', name: 'Cumin', emoji: '🟤', target: 30 },
        { id: 'paprika', name: 'Paprika', emoji: '🔴', target: 25 },
        { id: 'ginger', name: 'Ginger', emoji: '🟡', target: 20 },
        { id: 'saffron', name: 'Saffron', emoji: '🟠', target: 15 },
        { id: 'cinnamon', name: 'Cinnamon', emoji: '🪵', target: 10 }
      ]
    },
    heat: { seconds: 28, low: 58, high: 82, holdSeconds: 12 },
    plate: {
      seconds: 35,
      required: [
        { id: 'almonds', name: 'Toasted almonds', emoji: '🌰' },
        { id: 'mint', name: 'Fresh mint', emoji: '🌿' },
        { id: 'preservedlemon', name: 'Preserved lemon', emoji: '🍋' }
      ],
      extras: [
        { id: 'sesame', name: 'Sesame seeds', emoji: '⚪' },
        { id: 'olives', name: 'Green olives', emoji: '🫒' },
        { id: 'chili', name: 'Chili flakes', emoji: '🌶️' }
      ]
    }
  },
  couscous: {
    id: 'couscous',
    name: 'Couscous with Seven Vegetables',
    short: 'Couscous',
    emoji: '🥘',
    blurb: 'Friday lunch, the whole family watching. No pressure.',
    prep: {
      seconds: 45,
      ingredients: [
        { id: 'carrot', name: 'Carrot', emoji: '🥕', chops: 8 },
        { id: 'zucchini', name: 'Zucchini', emoji: '🥒', chops: 6 },
        { id: 'turnip', name: 'Turnip', emoji: '🟣', chops: 5 },
        { id: 'onion', name: 'Onion', emoji: '🧅', chops: 7 },
        { id: 'chickpea', name: 'Chickpeas', emoji: '🫘', chops: 4 }
      ]
    },
    spice: {
      seconds: 45,
      tolerance: 6,
      spices: [
        { id: 'turmeric', name: 'Turmeric', emoji: '🟡', target: 25 },
        { id: 'ginger', name: 'Ginger', emoji: '🟠', target: 25 },
        { id: 'cumin', name: 'Cumin', emoji: '🟤', target: 25 },
        { id: 'cinnamon', name: 'Cinnamon', emoji: '🪵', target: 15 },
        { id: 'paprika', name: 'Paprika', emoji: '🔴', target: 10 }
      ]
    },
    heat: { seconds: 28, low: 55, high: 78, holdSeconds: 14 },
    plate: {
      seconds: 35,
      required: [
        { id: 'chickpea', name: 'Chickpeas', emoji: '🫘' },
        { id: 'raisins', name: 'Golden raisins', emoji: '🍇' },
        { id: 'coriander', name: 'Coriander', emoji: '🌿' }
      ],
      extras: [
        { id: 'cheese', name: 'Grated cheese', emoji: '🧀' },
        { id: 'ketchup', name: 'Ketchup', emoji: '🍅' },
        { id: 'chili', name: 'Chili flakes', emoji: '🌶️' }
      ]
    }
  },
  tea: {
    id: 'tea',
    name: 'Atlas Mint Tea',
    short: 'Mint Tea',
    emoji: '🫖',
    blurb: 'Poured from a great height. The pour is the whole point.',
    prep: {
      seconds: 45,
      ingredients: [
        { id: 'mint', name: 'Mint leaves', emoji: '🌿', chops: 10 },
        { id: 'tea', name: 'Gunpowder tea', emoji: '🍃', chops: 4 },
        { id: 'sugar', name: 'Sugar cone', emoji: '🍬', chops: 5 },
        { id: 'blossom', name: 'Orange blossom', emoji: '🌸', chops: 3 }
      ]
    },
    spice: {
      seconds: 45,
      tolerance: 6,
      spices: [
        { id: 'tea', name: 'Gunpowder tea', emoji: '🍃', target: 35 },
        { id: 'mint', name: 'Fresh mint', emoji: '🌿', target: 30 },
        { id: 'sugar', name: 'Sugar', emoji: '🍬', target: 25 },
        { id: 'blossom', name: 'Orange blossom', emoji: '🌸', target: 10 }
      ]
    },
    heat: { seconds: 28, low: 50, high: 75, holdSeconds: 10 },
    plate: {
      seconds: 35,
      required: [
        { id: 'mintsprig', name: 'Mint sprig', emoji: '🌿' },
        { id: 'pine', name: 'Pine nuts', emoji: '🌰' },
        { id: 'cinnamon', name: 'Cinnamon stick', emoji: '🪵' }
      ],
      extras: [
        { id: 'ice', name: 'Ice cubes', emoji: '🧊' },
        { id: 'milk', name: 'Milk', emoji: '🥛' },
        { id: 'chili', name: 'Chili flakes', emoji: '🌶️' }
      ]
    }
  }
};

const STAGE_META = [
  { key: 'prep', name: 'Prep & Chopping', short: 'Prep', icon: '🔪', hint: 'Chop the right ingredient while the blade is in the green.' },
  { key: 'spice', name: 'Spice Balancing', short: 'Spices', icon: '🧂', hint: 'Match the recipe proportions. The whole mix must total 100.' },
  { key: 'heat', name: 'Heat & Simmering', short: 'Heat', icon: '🔥', hint: 'Hold the flame inside the sweet spot.' },
  { key: 'plate', name: 'Artisanal Plating', short: 'Plating', icon: '🍽️', hint: 'Only the traditional garnishes. Nothing else.' }
];

/* expose to the browser explicitly (and to node via require) */
if (typeof window !== 'undefined') {
  window.RECIPES = RECIPES;
  window.STAGE_META = STAGE_META;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RECIPES, STAGE_META };
}
