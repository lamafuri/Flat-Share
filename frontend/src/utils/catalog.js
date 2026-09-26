// Item suggestions for adding expenses. Every item belongs to a category, so
// picking one fills the category in and spending can be broken down by it.

// Shared-flat categories. Keys match GROUP_ITEM_CATEGORIES in the backend
// Expense model.
export const GROUP_CATEGORIES = [
  { key: 'drinks', label: 'Cold Drinks', emoji: '🥤' },
  { key: 'dairy', label: 'Dairy Products', emoji: '🥛' },
  { key: 'vegetables', label: 'Vegetables', emoji: '🥬' },
  { key: 'fruits', label: 'Fruits', emoji: '🍎' },
  { key: 'essentials', label: 'Cooking Essentials', emoji: '🧂' },
  { key: 'instant', label: 'Instant & Bakery', emoji: '🍞' },
  { key: 'household', label: 'Gas & Water', emoji: '🔥' },
  { key: 'cleaning', label: 'Cleaning & Laundry', emoji: '🧼' },
  { key: 'other', label: 'Other', emoji: '📦' }
];

const GROUP_CATEGORY_BY_KEY = Object.fromEntries(GROUP_CATEGORIES.map(c => [c.key, c]));

export const getGroupCategory = (key) => GROUP_CATEGORY_BY_KEY[key] || GROUP_CATEGORY_BY_KEY.other;

const toItems = (byCategory) =>
  Object.entries(byCategory).flatMap(([category, names]) => names.map(name => ({ name, category })));

export const GROUP_ITEMS = toItems({
  drinks: ['Mountain Dew', 'Coke', 'Sprite', 'Red Bull'],
  dairy: ['Milk', 'Dahi (Curd)', 'Mohi (Buttermilk)'],
  vegetables: [
    'Tomatoes', 'Onions', 'Potatoes', 'Saag (Leafy Greens)', 'Garlic',
    'Green Chillies', 'Ladyfinger (Bhindi)', 'Dhaniya (Coriander Leaves)'
  ],
  fruits: ['Apples', 'Bananas', 'Mangoes', 'Pomegranate'],
  essentials: [
    'Salt', 'Dry Chillies', 'Rice', 'Lentils', 'Cooking Oil', 'Maida',
    'Chiura (Beaten Rice)', 'Masala', 'Turmeric Powder', 'Jeera (Cumin)',
    'Dhaniya (Coriander Powder)', 'Garam Masala'
  ],
  instant: ['Noodles', 'Biscuits', 'Bread'],
  household: ['LPG Gas', 'Water (Gallon)'],
  cleaning: ['Dish Soap', 'Comfort (Fabric Conditioner)', 'Detergent', 'Laundry Soap']
});

// Personal categories live in utils/expenses.js (CATEGORIES).
export const PERSONAL_ITEMS = toItems({
  food: ['Momo', 'Chowmein', 'Pizza', 'Burger', 'Syaphale', 'Lunch'],
  drinks: ['Xtreme', 'Red Bull', 'Coke', 'Sprite', 'Mountain Dew'],
  transport: ['Tempo', 'Bus', 'Yango', 'InDrive', 'Pathao'],
  health: ['Medicines'],
  clothes: ['Jacket', 'Pant', 'Trouser', 'Socks', 'Shoes', 'T-Shirt', 'Underwear', 'Bra'],
  social: ['Friends Gathering']
});

// Shown as quick picks until the user's own history takes over.
const DEFAULT_PICKS = {
  group: ['Milk', 'Tomatoes', 'Onions', 'Potatoes', 'Rice', 'LPG Gas', 'Water (Gallon)', 'Noodles'],
  personal: ['Momo', 'Chowmein', 'Tempo', 'Pathao', 'Red Bull', 'Medicines', 'Friends Gathering', 'Lunch']
};

// Lowercase, punctuation to spaces: "Dahi (Curd)" -> "dahi curd".
const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const findItem = (items, name) => {
  const target = normalize(name || '');
  return target ? items.find(item => normalize(item.name) === target) : undefined;
};

// How well `name` matches `query`: 0 = the name starts with it, 1 = a word
// in it does ("curd" finds "Dahi (Curd)"), 2 = it appears anywhere, null =
// no match. Spaces are ignored too, so "redbull" finds "Red Bull".
const matchScore = (name, query) => {
  const q = normalize(query);
  if (!q) return null;
  const qCompact = q.replace(/ /g, '');
  const n = normalize(name);
  const compact = n.replace(/ /g, '');
  if (n.startsWith(q) || compact.startsWith(qCompact)) return 0;
  if (n.split(' ').some(word => word.startsWith(q))) return 1;
  if (n.includes(q) || compact.includes(qCompact)) return 2;
  return null;
};

export const matchesQuery = (item, query) => matchScore(item.name, query) !== null;

// Best matches first, then in catalog order.
export const searchItems = (items, query, limit = 8) => {
  const scored = [];
  items.forEach((item, index) => {
    const score = matchScore(item.name, query);
    if (score !== null) scored.push({ item, score, index });
  });
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(entry => entry.item);
};

// ── Usage history (this device only) ────────────────────────────────────────
// Remembers which items the user adds, and under which category, so quick
// picks show their most-used items and their own items become suggestions.

const MAX_REMEMBERED = 60;
const usageKey = (kind) => `flatshare:itemUsage:${kind}`;

const readUsage = (kind) => {
  try {
    return JSON.parse(localStorage.getItem(usageKey(kind))) || {};
  } catch {
    return {};
  }
};

export const rememberItems = (kind, items) => {
  const usage = readUsage(kind);
  const now = Date.now();
  items.forEach(({ name, category }) => {
    const key = normalize(name || '');
    if (!key) return;
    const previous = usage[key];
    usage[key] = { name: name.trim(), category, count: (previous?.count || 0) + 1, last: now };
  });
  const kept = Object.entries(usage)
    .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
    .slice(0, MAX_REMEMBERED);
  try {
    localStorage.setItem(usageKey(kind), JSON.stringify(Object.fromEntries(kept)));
  } catch { /* storage unavailable */ }
};

const usedItems = (kind) =>
  Object.values(readUsage(kind))
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .map(({ name, category }) => ({ name, category }));

// The catalog plus items the user typed themselves, with the category they
// chose, so those are suggested (and categorised) next time too. A catalog
// item keeps its catalog category.
export const suggestionsFor = (kind, catalog) => {
  const custom = usedItems(kind).filter(item => !findItem(catalog, item.name));
  return [...catalog, ...custom];
};

export const quickPicksFor = (kind, catalog, count = 8) => {
  const picks = [];
  const add = (item) => {
    if (item && picks.length < count && !findItem(picks, item.name)) picks.push(item);
  };
  usedItems(kind).forEach(item => add(findItem(catalog, item.name) || item));
  DEFAULT_PICKS[kind].forEach(name => add(findItem(catalog, name)));
  return picks;
};
