// Personal expense categories. Keys match the backend PersonalExpense model.
export const CATEGORIES = [
  { key: 'food', label: 'Food & Dining', emoji: '🍜', placeholder: 'e.g. Momo, chowmein, pizza' },
  { key: 'drinks', label: 'Cold Drinks', emoji: '🥤', placeholder: 'e.g. Xtreme, Red Bull' },
  { key: 'transport', label: 'Transport', emoji: '🚌', placeholder: 'e.g. Tempo, Pathao, InDrive' },
  { key: 'health', label: 'Medicines', emoji: '💊', placeholder: 'e.g. Medicines, checkup' },
  { key: 'clothes', label: 'Clothes', emoji: '👕', placeholder: 'e.g. Jacket, shoes, T-shirt' },
  { key: 'social', label: 'Friends Gathering', emoji: '🎉', placeholder: 'e.g. Party, outing' },
  { key: 'tech', label: 'Tech Items', emoji: '💻', placeholder: 'e.g. Earphones, charger' },
  { key: 'groceries', label: 'Groceries', emoji: '🛒', placeholder: 'e.g. Vegetables, milk' },
  { key: 'bills', label: 'Rent & Bills', emoji: '💡', placeholder: 'e.g. Internet, electricity' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️', placeholder: 'e.g. Gifts, household items' },
  { key: 'education', label: 'Education', emoji: '📚', placeholder: 'e.g. Books, course fee' },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬', placeholder: 'e.g. Movie, games' },
  { key: 'other', label: 'Other', emoji: '📦', placeholder: 'What did you spend on?' }
];

const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

export const getCategory = (key) => CATEGORY_BY_KEY[key] || CATEGORY_BY_KEY.other;

// Chart colors, validated for contrast and color-vision deficiency against
// the card surface (ink-900 #111118). Color follows the source everywhere:
// personal spending is blue, group spending is orange.
export const SOURCE_COLORS = {
  personal: '#3987e5',
  group: '#d95926'
};

// Pace chart: the current period is emphasised, the previous one recedes.
export const PERIOD_COLORS = {
  current: '#a59fff',
  previous: '#66667f'
};

export const CHART_SURFACE = '#111118';

// Indian/Nepali digit grouping: 1,00,000 rather than 100,000.
const rupeeFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const formatRs = (amount) => `Rs ${rupeeFormat.format(amount || 0)}`;

// Always two decimals ("Rs 11,760.00"), for values shown to the paisa.
const exactFormat = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatRsExact = (amount) => `Rs ${exactFormat.format(amount || 0)}`;

// "Rs 1.2K", "Rs 3.5L" — for axis ticks and tight spaces.
export const formatRsCompact = (amount) => `Rs ${compactFormat.format(amount || 0)}`;

const LAST_CATEGORY_KEY = 'flatshare:lastExpenseCategory';

export const getLastCategory = () => {
  try {
    const key = localStorage.getItem(LAST_CATEGORY_KEY);
    return CATEGORY_BY_KEY[key] ? key : 'food';
  } catch {
    return 'food';
  }
};

export const rememberCategory = (key) => {
  try { localStorage.setItem(LAST_CATEGORY_KEY, key); } catch { /* storage unavailable */ }
};
