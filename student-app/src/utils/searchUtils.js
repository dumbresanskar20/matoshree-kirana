/**
 * Keyword and synonym mappings for Kirana store product searching.
 * Allows searching by common terms like "serials" (to match grains, pulses, atta, dal)
 * and "dairy" / "dairy products" (to match milk, paneer, curd, cheese, ghee, etc.)
 */
const SYNONYM_MAP = {
  serials: ['cereal', 'cereals', 'grain', 'grains', 'pulses', 'pulse', 'atta', 'flour', 'dal', 'rice', 'wheat'],
  serial: ['cereal', 'cereals', 'grain', 'grains', 'pulses', 'pulse', 'atta', 'flour', 'dal', 'rice', 'wheat'],
  cereal: ['cereal', 'cereals', 'grain', 'grains', 'pulses', 'pulse', 'atta', 'flour', 'dal', 'rice', 'wheat'],
  cereals: ['cereal', 'cereals', 'grain', 'grains', 'pulses', 'pulse', 'atta', 'flour', 'dal', 'rice', 'wheat'],
  dairy: ['dairy', 'milk', 'cheese', 'butter', 'ghee', 'paneer', 'curd', 'yogurt', 'dahi', 'taaza', 'cream'],
  milk: ['dairy', 'milk', 'taaza', 'cow', 'toned', 'amul'],
  oil: ['oil', 'edible', 'ghee', 'cooking', 'sunflower', 'mustard', 'groundnut', 'refined'],
  oils: ['oil', 'edible', 'ghee', 'cooking', 'sunflower', 'mustard', 'groundnut', 'refined'],
  ghee: ['ghee', 'oil', 'butter', 'dairy'],
  rice: ['rice', 'basmati', 'kolam', 'chawal', 'grain', 'grains'],
  dal: ['dal', 'dall', 'pulses', 'pulse', 'toor', 'moong', 'chana', 'urad', 'masoor'],
  dals: ['dal', 'dall', 'pulses', 'pulse', 'toor', 'moong', 'chana', 'urad', 'masoor'],
  pulses: ['pulses', 'pulse', 'dal', 'toor', 'moong', 'chana', 'urad', 'grains'],
  pulse: ['pulses', 'pulse', 'dal', 'toor', 'moong', 'chana', 'urad', 'grains'],
  flour: ['flour', 'atta', 'wheat', 'maida', 'besan', 'grain'],
  atta: ['flour', 'atta', 'wheat', 'grain', 'grains'],
  biscuit: ['biscuit', 'biscuits', 'cookie', 'cookies', 'parle', 'britannia', 'snacks'],
  biscuits: ['biscuit', 'biscuits', 'cookie', 'cookies', 'parle', 'britannia', 'snacks'],
  soap: ['soap', 'bath', 'wash', 'personal', 'clean', 'shampoo'],
  essential: ['cooking', 'essential', 'essentials', 'grocery', 'groceries'],
  essentials: ['cooking', 'essential', 'essentials', 'grocery', 'groceries'],
  snack: ['snack', 'snacks', 'namkeen', 'chips', 'beverage', 'tea', 'coffee'],
  snacks: ['snack', 'snacks', 'namkeen', 'chips', 'beverage', 'tea', 'coffee'],
  spice: ['spice', 'spices', 'masala', 'mirchi', 'haldi', 'turmeric'],
  spices: ['spice', 'spices', 'masala', 'mirchi', 'haldi', 'turmeric'],
  masala: ['spice', 'spices', 'masala', 'mirchi', 'haldi', 'turmeric', 'chilli'],
};

/**
 * Checks if a product matches a search query across all product types and fields:
 * - Product Name
 * - Category Name / Meal Type
 * - Brand
 * - Description
 * - Unit
 * - Variant Names
 */
export const matchesProductSearch = (item, query) => {
  if (!query || !query.trim()) return true;
  const cleanQuery = query.toLowerCase().trim();

  // Words that are noise when user types e.g. "dairy products", "grain items"
  const ignoredWords = new Set(['product', 'products', 'item', 'items', 'store', 'kirana', 'type', 'types']);
  const allSearchTerms = cleanQuery.split(/\s+/).filter(Boolean);
  const searchTerms = allSearchTerms.filter((w) => !ignoredWords.has(w));
  const effectiveTerms = searchTerms.length > 0 ? searchTerms : allSearchTerms;

  const name = (item.name || item.item_name || '').toLowerCase();
  const category = (item.category || item.category_name || item.meal_type || '').toLowerCase().replace(/_/g, ' ');
  const mealType = (item.meal_type || '').toLowerCase().replace(/_/g, ' ');
  const brand = (item.brand || '').toLowerCase();
  const description = (item.description || '').toLowerCase();
  const unit = (item.unit || '').toLowerCase();

  let variantNames = '';
  if (Array.isArray(item.variants)) {
    variantNames = item.variants.map((v) => v.name || '').join(' ').toLowerCase();
  }

  const corpus = `${name} ${category} ${mealType} ${brand} ${description} ${unit} ${variantNames}`;

  // 1. Direct substring match of the full query
  if (corpus.includes(cleanQuery)) {
    return true;
  }

  // 2. Check if every effective search word (or its synonyms) matches the corpus
  return effectiveTerms.every((term) => {
    if (corpus.includes(term)) return true;

    // Check synonym expansion
    const expanded = SYNONYM_MAP[term];
    if (expanded && expanded.some((syn) => corpus.includes(syn))) {
      return true;
    }

    return false;
  });
};
