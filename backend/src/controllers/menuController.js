const { pool } = require('../database/db');
const { deleteLocalImage, formatPublicImageUrl } = require('../config/storage');
const { isMenuStockTrackingEnabled, normalizeInventoryUnit, normalizeInventoryCategory } = require('./inventoryController');
const { getAllMealSlots, getNowIST } = require('../services/mealSlotService');

const getCurrentTimeHHMM = () => {
  const ist = getNowIST();
  return ist.str.substring(11, 16);
};

const format12HourTime = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  const minutes = String(m || 0).padStart(2, '0');
  return `${hours12}:${minutes} ${period}`;
};

const DEFAULT_SERVING_START_TIMES = {
  breakfast: '08:30',
  lunch: '12:30',
  snacks: '16:30',
  dinner: '19:30',
};

// Canonical category slug normalizer
const normalizeCategoryCode = (cat) => {
  if (!cat) return 'groceries';
  const lower = String(cat).toLowerCase().trim();
  if (lower === 'grains & pulses' || lower === 'grains_pulses' || lower === 'grain_pulses' || lower === 'grains and pulses' || lower === 'grains') {
    return 'grains_pulses';
  }
  if (lower === 'cooking essentials' || lower === 'cooking_essential' || lower === 'cooking_essentials' || lower === 'cooking essential') {
    return 'cooking_essentials';
  }
  if (lower === 'groceries & staples' || lower === 'groceries_staples' || lower === 'groceries' || lower === 'grocery') {
    return 'groceries';
  }
  if (lower === 'atta, flours & grains' || lower === 'atta flours grains' || lower === 'flours_grains' || lower === 'flours & grains') {
    return 'flours_grains';
  }
  if (lower === 'dals & pulses' || lower === 'dals_pulses' || lower === 'dal_pulses') {
    return 'dals_pulses';
  }
  if (lower === 'edible oils & ghee' || lower === 'oils_ghee' || lower === 'oil_ghee' || lower === 'oils & ghee') {
    return 'oils_ghee';
  }
  if (lower === 'spices & masalas' || lower === 'spices_masalas' || lower === 'spice_masala') {
    return 'spices_masalas';
  }
  if (lower === 'dairy & eggs' || lower === 'dairy_eggs' || lower === 'dairy and eggs') {
    return 'dairy_eggs';
  }
  if (lower === 'snacks & beverages' || lower === 'snacks_beverages' || lower === 'snack_beverages') {
    return 'snacks_beverages';
  }
  if (lower === 'personal care' || lower === 'personal_care') {
    return 'personal_care';
  }
  if (lower === 'cleaning & household' || lower === 'cleaning_household' || lower === 'household') {
    return 'household';
  }
  if (lower === 'daily essentials' || lower === 'daily_essentials' || lower === 'daily essential') {
    return 'daily_essentials';
  }
  return lower.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'groceries';
};

// Display name formatter for Kirana store categories
const formatCategoryTitle = (code) => {
  if (!code) return '';
  const lower = String(code).toLowerCase().trim();
  const titleMap = {
    grains_pulses: 'Grains & Pulses',
    cooking_essentials: 'Cooking Essentials',
    cooking_essential: 'Cooking Essentials',
    groceries: 'Groceries & Staples',
    flours_grains: 'Atta, Flours & Grains',
    dals_pulses: 'Dals & Pulses',
    oils_ghee: 'Edible Oils & Ghee',
    spices_masalas: 'Spices & Masalas',
    dairy_eggs: 'Dairy & Eggs',
    snacks_beverages: 'Snacks & Beverages',
    personal_care: 'Personal Care',
    household: 'Cleaning & Household',
    daily_essentials: 'Daily Essentials',
    breakfast: 'Breakfast Essentials',
    lunch: 'Lunch Essentials',
    snacks: 'Evening Snacks',
    dinner: 'Dinner Essentials',
  };
  if (titleMap[lower]) return titleMap[lower];
  return lower.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Aliases generator to ensure backward compatibility across query variations
const getCategoryAliases = (cat) => {
  if (!cat) return ['groceries'];
  const clean = normalizeCategoryCode(cat);
  const aliases = new Set([clean, String(cat).toLowerCase().trim()]);
  if (clean === 'grains_pulses') {
    aliases.add('grains & pulses');
    aliases.add('grains and pulses');
    aliases.add('grain_pulses');
    aliases.add('grains_pulses');
    aliases.add('grains');
  } else if (clean === 'cooking_essentials') {
    aliases.add('cooking_essential');
    aliases.add('cooking_essentials');
    aliases.add('cooking essentials');
    aliases.add('cooking essential');
  } else if (clean === 'oils_ghee') {
    aliases.add('edible oils & ghee');
    aliases.add('oils_ghee');
    aliases.add('oil_ghee');
    aliases.add('oils & ghee');
  } else if (clean === 'flours_grains') {
    aliases.add('atta, flours & grains');
    aliases.add('atta flours grains');
    aliases.add('flours_grains');
    aliases.add('flours & grains');
  } else if (clean === 'dals_pulses') {
    aliases.add('dals & pulses');
    aliases.add('dals_pulses');
  } else if (clean === 'spices_masalas') {
    aliases.add('spices & masalas');
    aliases.add('spices_masalas');
  } else if (clean === 'dairy_eggs') {
    aliases.add('dairy & eggs');
    aliases.add('dairy_eggs');
    aliases.add('dairy and eggs');
  } else if (clean === 'snacks_beverages') {
    aliases.add('snacks & beverages');
    aliases.add('snacks_beverages');
  } else if (clean === 'personal_care') {
    aliases.add('personal care');
    aliases.add('personal_care');
  } else if (clean === 'household') {
    aliases.add('cleaning & household');
    aliases.add('household');
    aliases.add('cleaning_household');
  } else if (clean === 'daily_essentials') {
    aliases.add('daily essentials');
    aliases.add('daily_essentials');
  } else if (clean === 'groceries') {
    aliases.add('groceries & staples');
    aliases.add('groceries');
    aliases.add('grocery');
  }
  return Array.from(aliases);
};


const computeMealStatus = (w, currentTime = getCurrentTimeHHMM()) => {
  const isActive = Boolean(
    w.is_active === 1 ||
    w.is_active === true ||
    w.is_active === '1' ||
    (w.is_active !== 0 && w.is_active !== '0' && w.is_active !== false)
  );
  const isFullDay = Boolean(w.is_full_day === 1 || w.is_full_day === true || w.is_full_day === '1');
  let isCurrentlyOpen = false;

  if (isActive) {
    if (isFullDay) {
      isCurrentlyOpen = true;
    } else {
      isCurrentlyOpen = Boolean(
        w.start_time && w.end_time && currentTime >= w.start_time && currentTime <= w.end_time
      );
    }
  }

  const mealTypeLower = (w.meal_type || '').toLowerCase();
  const servingStartTime = w.serving_start_time || DEFAULT_SERVING_START_TIMES[mealTypeLower] || w.start_time || '12:30';
  // Note is visible whenever serving_start_time is configured and meal is active
  const isNoteVisible = Boolean(servingStartTime && isActive);
  const isServingStarted = Boolean(servingStartTime && currentTime >= servingStartTime);

  return {
    _id: w.id || w._id,
    id: w.id || w._id,
    meal_type: w.meal_type,
    category_name: w.category_name || w.name || w.meal_type,
    icon: w.icon || '🛒',
    display_order: w.display_order || 0,
    start_time: w.start_time || '08:00',
    end_time: w.end_time || '20:00',
    serving_start_time: servingStartTime,
    formatted_start_time: format12HourTime(w.start_time || '08:00'),
    formatted_end_time: format12HourTime(w.end_time || '20:00'),
    formatted_serving_start_time: format12HourTime(servingStartTime),
    custom_note: w.custom_note || null,
    is_note_visible: isNoteVisible,
    is_serving_started: isServingStarted,
    is_active: isActive,
    is_full_day: Boolean(w.is_full_day),
    is_currently_open: isCurrentlyOpen,
  };
};

// Helper: add _id alias to a database record
const withId = (record) => ({ ...record, _id: record.id });

const convertToInventoryBaseUnit = (quantity, recipeUnit, inventoryUnit) => {
  const q = Number(quantity);
  const rUnit = String(recipeUnit).toLowerCase();
  const iUnit = String(inventoryUnit).toLowerCase();

  if (rUnit === iUnit) return q;

  // kg vs g
  if (rUnit === 'g' && iUnit === 'kg') return q / 1000;
  if (rUnit === 'kg' && iUnit === 'g') return q * 1000;

  // litre vs ml
  if (rUnit === 'ml' && iUnit === 'litre') return q / 1000;
  if (rUnit === 'litre' && iUnit === 'ml') return q * 1000;

  return q;
};

const mapMenuItem = (record, req, trackingEnabled = false, categoryNameMap = {}) => {
  let isInStock = Boolean(record.is_available !== 0);
  let outOfStockReason = null;
  const outOfStockIngredients = [];

  const availableQty = record.available_quantity !== undefined ? Number(record.available_quantity) : 100;
  if (trackingEnabled) {
    if (availableQty <= 0 || record.is_available === 0) {
      isInStock = false;
      outOfStockReason = 'Out of Stock (0 portions left)';
    }
  }

  if (record.recipe_items && record.recipe_items.length > 0) {
    record.recipe_items.forEach((ri) => {
      if (!ri.inventory_item || !ri.inventory_item.is_active) {
        isInStock = false;
        outOfStockIngredients.push(ri.inventory_item?.name || 'Inactive ingredient');
        return;
      }
      const neededInBase = convertToInventoryBaseUnit(
        ri.quantity_required,
        ri.quantity_unit || ri.inventory_item.unit,
        ri.inventory_item.unit
      );
      if (Number(ri.inventory_item.quantity_in_stock) < neededInBase) {
        isInStock = false;
        outOfStockIngredients.push(
          `${ri.inventory_item.name} (Stock: ${Number(ri.inventory_item.quantity_in_stock)} ${ri.inventory_item.unit}, needed: ${neededInBase} ${ri.inventory_item.unit})`
        );
      }
    });
  }

  if (outOfStockIngredients.length > 0 && !outOfStockReason) {
    outOfStockReason = `Low stock on: ${outOfStockIngredients.join(', ')}`;
  }

  let parsedVariants = [];
  if (record.variants) {
    try {
      parsedVariants = typeof record.variants === 'string' ? JSON.parse(record.variants) : record.variants;
    } catch (e) {
      parsedVariants = [];
    }
  }
  const hasVariants = Boolean(
    (record.has_variants === 1 || record.has_variants === true || record.has_variants === '1') &&
    Array.isArray(parsedVariants) &&
    parsedVariants.length > 0
  );

  const rawCat = record.category || record.meal_type || 'groceries';
  const cleanCat = normalizeCategoryCode(rawCat);
  const resolvedCategoryName = categoryNameMap[cleanCat] || formatCategoryTitle(cleanCat);

  return {
    ...record,
    _id: record.id,
    image_url: formatPublicImageUrl(record.image_url, req),
    price: Number(record.price),
    mrp: record.mrp ? Number(record.mrp) : Number(record.price),
    category: cleanCat,
    meal_type: cleanCat,
    category_name: resolvedCategoryName,
    unit: record.unit || 'piece',
    brand: record.brand || null,
    barcode: record.barcode || null,
    stock_quantity: Number(record.stock_quantity !== undefined ? record.stock_quantity : availableQty),
    in_stock: isInStock,
    discount_percentage: Number(record.discount_percentage || 0),
    has_variants: hasVariants,
    variants: Array.isArray(parsedVariants)
      ? parsedVariants.map((v) => ({
          ...v,
          price: Number(v.price),
        }))
      : [],
    available_quantity: availableQty,
    daily_stock_limit: Number(record.daily_stock_limit || 100),
    track_stock: Boolean(trackingEnabled),
    avg_rating: Number(record.avg_rating) || 0,
    rating_count: Number(record.rating_count) || 0,
    total_sold: Number(record.total_sold) || 0,
    is_in_stock: isInStock,
    out_of_stock_reason: outOfStockReason,
    recipe_items: undefined,
  };
};

/**
 * Sorts menu items:
 * 1. In-stock items prioritized over out-of-stock items.
 * 2. Highest rated items (avg_rating DESC) at the top.
 * 3. Highest selling items (total_sold DESC) prioritized for equal ratings or unrated items.
 * 4. Rating count (rating_count DESC) as tie-breaker.
 * 5. Newest items (id DESC) as final tie-breaker.
 */
const sortMenuItemsByRatingAndSales = (items) => {
  return items.sort((a, b) => {
    // 1. In-stock items first
    const aStock = a.is_in_stock ? 1 : 0;
    const bStock = b.is_in_stock ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    const aRating = Number(a.avg_rating) || 0;
    const bRating = Number(b.avg_rating) || 0;
    const aSold = Number(a.total_sold) || 0;
    const bSold = Number(b.total_sold) || 0;
    const aCount = Number(a.rating_count) || 0;
    const bCount = Number(b.rating_count) || 0;

    // 2. Highest rated first
    if (bRating !== aRating) {
      return bRating - aRating;
    }

    // 3. Highest selling first (for equal rating or both unrated)
    if (bSold !== aSold) {
      return bSold - aSold;
    }

    // 4. Rating count tie-breaker
    if (bCount !== aCount) {
      return bCount - aCount;
    }

    // 5. ID tie-breaker
    return b.id - a.id;
  });
};

// Get all menu items (Students & Admin)
const getMenuItems = async (req, res) => {
  try {
    const { meal_type, active_only } = req.query;
    const isStudentFetch = active_only === 'true';
    const trackingEnabled = await isMenuStockTrackingEnabled();

    const [windows] = await pool.query('SELECT * FROM MealWindow');
    const currentTime = getCurrentTimeHHMM();
    let allSlots = {};
    try {
      allSlots = await getAllMealSlots();
    } catch (slotErr) {
      console.warn('[MenuController] getAllMealSlots warning:', slotErr.message);
    }

    const storeSlot = allSlots['store_hours'] || Object.values(allSlots).find((s) => s.is_full_day || (s.slots && s.slots.some((x) => x.start_datetime || x.is_active)));

    const windowMap = {};
    const categoryNameMap = {};
    windows.forEach((w) => {
      const code = normalizeCategoryCode(w.meal_type);
      categoryNameMap[code] = w.category_name || formatCategoryTitle(code);

      const formatted = computeMealStatus(w, currentTime);
      const slotData = storeSlot || allSlots[w.meal_type.toLowerCase()];
      if (slotData && (slotData.is_full_day || (slotData.slots && slotData.slots.some((s) => s.start_datetime || s.is_active)) || slotData.custom_note)) {
        formatted.isAvailableNow = slotData.isAvailableNow;
        formatted.activeSlot = slotData.activeSlot;
        formatted.nextSlot = slotData.nextSlot;
        formatted.slots = slotData.slots;
        formatted.serving_note = slotData.serving_note;
        formatted.is_currently_open = slotData.isAvailableNow;
        formatted.is_full_day = slotData.is_full_day;
      } else {
        formatted.isAvailableNow = formatted.is_currently_open;
        formatted.activeSlot = null;
        formatted.nextSlot = null;
        formatted.slots = [];
        formatted.serving_note = formatted.is_currently_open
          ? `Serving now until ${formatted.formatted_end_time}`
          : 'Not available right now';
      }
      windowMap[w.meal_type.toLowerCase()] = formatted;
      windowMap[code] = formatted;
    });

    const windowMealTypes = windows.map((w) => (w.meal_type || '').toLowerCase().trim()).filter(Boolean);
    const combinedTypes = Array.from(new Set([...['breakfast', 'lunch', 'snacks', 'dinner'], ...windowMealTypes]));
    const activeTypes = combinedTypes.filter(
      (t) => (windowMap[t] ? windowMap[t].is_active : true)
    );

    const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    if (searchQuery) {
      let itemsSql = 'SELECT * FROM MenuItem WHERE is_active = 1';
      const itemsParams = [];

      const searchTerms = [searchQuery];
      if (searchQuery === 'serials' || searchQuery === 'serial' || searchQuery === 'cereal' || searchQuery === 'cereals') {
        searchTerms.push('grain', 'grains', 'pulses', 'pulse', 'atta', 'flour', 'dal');
      } else if (searchQuery.includes('dairy') || searchQuery.includes('milk')) {
        searchTerms.push('dairy', 'milk', 'ghee', 'paneer', 'cheese', 'butter', 'curd', 'dahi');
      } else if (searchQuery.includes('oil')) {
        searchTerms.push('oil', 'ghee', 'sunflower');
      }

      const clauses = searchTerms.map((term) => {
        itemsParams.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`);
        return `(
          LOWER(name) LIKE ? OR 
          LOWER(COALESCE(category, meal_type, '')) LIKE ? OR 
          LOWER(COALESCE(brand, '')) LIKE ? OR 
          LOWER(COALESCE(description, '')) LIKE ?
        )`;
      });

      itemsSql += ` AND (${clauses.join(' OR ')})`;
      itemsSql += ' ORDER BY created_at DESC';

      const [items] = await pool.execute(itemsSql, itemsParams);

      if (items.length > 0) {
        const menuItemIds = items.map((it) => it.id);
        const placeholders = menuItemIds.map(() => '?').join(', ');
        
        let recipeRows = [];
        try {
          const [rows] = await pool.query(
            `SELECT ri.*, ii.name AS inventory_item_name, ii.unit AS inventory_item_unit, 
                    ii.quantity_in_stock AS inventory_item_quantity_in_stock, 
                    ii.low_stock_threshold AS inventory_item_low_stock_threshold,
                    ii.category AS inventory_item_category, ii.is_active AS inventory_item_is_active
             FROM RecipeItem ri
             INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
             WHERE ri.menu_item_id IN (${placeholders})`,
            menuItemIds
          );
          recipeRows = rows;
        } catch (_) {
          recipeRows = [];
        }

        let ratingMap = {};
        try {
          const [ratingRows] = await pool.query(
            `SELECT menu_item_id, COUNT(*) AS rating_count, ROUND(AVG(rating), 1) AS avg_rating
             FROM MenuItemReview
             WHERE menu_item_id IN (${placeholders})
             GROUP BY menu_item_id`,
            menuItemIds
          );
          ratingRows.forEach((r) => {
            ratingMap[r.menu_item_id] = {
              avg_rating: Number(r.avg_rating) || 0,
              rating_count: Number(r.rating_count) || 0,
            };
          });
        } catch (e) {}

        let salesMap = {};
        try {
          const [salesRows] = await pool.query(
            `SELECT oi.menu_item_id, SUM(oi.quantity) AS total_sold
             FROM OrderItem oi
             LEFT JOIN \`Order\` o ON oi.order_id = o.id
             WHERE oi.menu_item_id IN (${placeholders})
               AND (o.id IS NULL OR o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
             GROUP BY oi.menu_item_id`,
            menuItemIds
          );
          salesRows.forEach((s) => {
            salesMap[s.menu_item_id] = Number(s.total_sold) || 0;
          });
        } catch (e) {}

        const recipeItemsByMenuId = {};
        recipeRows.forEach((row) => {
          if (!recipeItemsByMenuId[row.menu_item_id]) {
            recipeItemsByMenuId[row.menu_item_id] = [];
          }
          recipeItemsByMenuId[row.menu_item_id].push({
            id: row.id,
            menu_item_id: row.menu_item_id,
            inventory_item_id: row.inventory_item_id,
            quantity_required: row.quantity_required,
            quantity_unit: row.quantity_unit,
            inventory_item: {
              id: row.inventory_item_id,
              name: row.inventory_item_name,
              unit: row.inventory_item_unit,
              quantity_in_stock: row.inventory_item_quantity_in_stock,
              low_stock_threshold: row.inventory_item_low_stock_threshold,
              category: row.inventory_item_category,
              is_active: row.inventory_item_is_active,
            },
          });
        });

        items.forEach((item) => {
          item.recipe_items = recipeItemsByMenuId[item.id] || [];
          item.avg_rating = ratingMap[item.id]?.avg_rating || 0;
          item.rating_count = ratingMap[item.id]?.rating_count || 0;
          item.total_sold = salesMap[item.id] || 0;
        });
      } else {
        items.forEach((item) => {
          item.recipe_items = [];
          item.avg_rating = 0;
          item.rating_count = 0;
          item.total_sold = 0;
        });
      }

      const mappedItems = items.map((it) => mapMenuItem(it, req, trackingEnabled, categoryNameMap));
      const sortedItems = sortMenuItemsByRatingAndSales(mappedItems);

      return res.status(200).json({
        success: true,
        count: sortedItems.length,
        items: sortedItems,
        tracking_enabled: Boolean(trackingEnabled),
        is_active: true,
        is_currently_open: true,
        search_query: searchQuery,
      });
    }

    if (meal_type) {
      const targetType = meal_type.toLowerCase();
      const cleanTarget = normalizeCategoryCode(targetType);
      const status = storeSlot
        ? { is_active: storeSlot.isAvailableNow || storeSlot.is_full_day, is_currently_open: storeSlot.isAvailableNow }
        : (windowMap[cleanTarget] || windowMap[targetType] || { is_active: true, is_currently_open: true });

      if (isStudentFetch && !status.is_active) {
        return res.status(200).json({
          success: true,
          count: 0,
          items: [],
          is_active: false,
          is_currently_open: false,
          message: `The meal type '${targetType}' is currently not offered by Canteen Management.`,
        });
      }

      const aliases = getCategoryAliases(targetType);
      const placeholders = aliases.map(() => '?').join(', ');
      let itemsSql = `SELECT * FROM MenuItem WHERE (LOWER(meal_type) IN (${placeholders}) OR LOWER(category) IN (${placeholders}))`;
      let itemsParams = [...aliases, ...aliases];
      if (isStudentFetch) {
        itemsSql += ' AND is_active = 1';
      }
      itemsSql += ' ORDER BY created_at DESC';

      const [items] = await pool.execute(itemsSql, itemsParams);

      if (items.length > 0) {
        const menuItemIds = items.map((it) => it.id);
        const placeholders = menuItemIds.map(() => '?').join(', ');
        
        let recipeRows = [];
        try {
          const [rows] = await pool.query(
            `SELECT ri.*, ii.name AS inventory_item_name, ii.unit AS inventory_item_unit, 
                    ii.quantity_in_stock AS inventory_item_quantity_in_stock, 
                    ii.low_stock_threshold AS inventory_item_low_stock_threshold,
                    ii.category AS inventory_item_category, ii.is_active AS inventory_item_is_active
             FROM RecipeItem ri
             INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
             WHERE ri.menu_item_id IN (${placeholders})`,
            menuItemIds
          );
          recipeRows = rows;
        } catch (_) {
          recipeRows = [];
        }

        let ratingMap = {};
        try {
          const [ratingRows] = await pool.query(
            `SELECT menu_item_id, COUNT(*) AS rating_count, ROUND(AVG(rating), 1) AS avg_rating
             FROM MenuItemReview
             WHERE menu_item_id IN (${placeholders})
             GROUP BY menu_item_id`,
            menuItemIds
          );
          ratingRows.forEach((r) => {
            ratingMap[r.menu_item_id] = {
              avg_rating: Number(r.avg_rating) || 0,
              rating_count: Number(r.rating_count) || 0,
            };
          });
        } catch (e) {
          // If table not yet created
        }

        let salesMap = {};
        try {
          const [salesRows] = await pool.query(
            `SELECT oi.menu_item_id, SUM(oi.quantity) AS total_sold
             FROM OrderItem oi
             LEFT JOIN \`Order\` o ON oi.order_id = o.id
             WHERE oi.menu_item_id IN (${placeholders})
               AND (o.id IS NULL OR o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
             GROUP BY oi.menu_item_id`,
            menuItemIds
          );
          salesRows.forEach((s) => {
            salesMap[s.menu_item_id] = Number(s.total_sold) || 0;
          });
        } catch (e) {
          // If table not yet created
        }

        const recipeItemsByMenuId = {};
        recipeRows.forEach((row) => {
          if (!recipeItemsByMenuId[row.menu_item_id]) {
            recipeItemsByMenuId[row.menu_item_id] = [];
          }
          recipeItemsByMenuId[row.menu_item_id].push({
            id: row.id,
            menu_item_id: row.menu_item_id,
            inventory_item_id: row.inventory_item_id,
            quantity_required: row.quantity_required,
            quantity_unit: row.quantity_unit,
            inventory_item: {
              id: row.inventory_item_id,
              name: row.inventory_item_name,
              unit: row.inventory_item_unit,
              quantity_in_stock: row.inventory_item_quantity_in_stock,
              low_stock_threshold: row.inventory_item_low_stock_threshold,
              category: row.inventory_item_category,
              is_active: row.inventory_item_is_active,
            },
          });
        });

        items.forEach((item) => {
          item.recipe_items = recipeItemsByMenuId[item.id] || [];
          item.avg_rating = ratingMap[item.id]?.avg_rating || 0;
          item.rating_count = ratingMap[item.id]?.rating_count || 0;
          item.total_sold = salesMap[item.id] || 0;
        });
      } else {
        items.forEach((item) => {
          item.recipe_items = [];
          item.avg_rating = 0;
          item.rating_count = 0;
          item.total_sold = 0;
        });
      }

      const mappedItems = items.map((it) => mapMenuItem(it, req, trackingEnabled, categoryNameMap));
      const sortedItems = sortMenuItemsByRatingAndSales(mappedItems);

      return res.status(200).json({
        success: true,
        count: sortedItems.length,
        items: sortedItems,
        tracking_enabled: Boolean(trackingEnabled),
        is_active: status.is_active,
        is_currently_open: status.is_currently_open,
        meal_window: status,
      });
    } else {
      let itemsSql = 'SELECT * FROM MenuItem';
      const itemsParams = [];
      
      if (isStudentFetch) {
        itemsSql += ' WHERE is_active = 1';
      }
      
      itemsSql += ' ORDER BY created_at DESC';

      const [items] = await pool.execute(itemsSql, itemsParams);

      if (items.length > 0) {
        const menuItemIds = items.map((it) => it.id);
        const placeholders = menuItemIds.map(() => '?').join(', ');
        
        let recipeRows = [];
        try {
          const [rows] = await pool.query(
            `SELECT ri.*, ii.name AS inventory_item_name, ii.unit AS inventory_item_unit, 
                    ii.quantity_in_stock AS inventory_item_quantity_in_stock, 
                    ii.low_stock_threshold AS inventory_item_low_stock_threshold,
                    ii.category AS inventory_item_category, ii.is_active AS inventory_item_is_active
             FROM RecipeItem ri
             INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
             WHERE ri.menu_item_id IN (${placeholders})`,
            menuItemIds
          );
          recipeRows = rows;
        } catch (_) {
          recipeRows = [];
        }

        let ratingMap = {};
        try {
          const [ratingRows] = await pool.query(
            `SELECT menu_item_id, COUNT(*) AS rating_count, ROUND(AVG(rating), 1) AS avg_rating
             FROM MenuItemReview
             WHERE menu_item_id IN (${placeholders})
             GROUP BY menu_item_id`,
            menuItemIds
          );
          ratingRows.forEach((r) => {
            ratingMap[r.menu_item_id] = {
              avg_rating: Number(r.avg_rating) || 0,
              rating_count: Number(r.rating_count) || 0,
            };
          });
        } catch (e) {
          // If table not yet created
        }

        let salesMap = {};
        try {
          const [salesRows] = await pool.query(
            `SELECT oi.menu_item_id, SUM(oi.quantity) AS total_sold
             FROM OrderItem oi
             LEFT JOIN \`Order\` o ON oi.order_id = o.id
             WHERE oi.menu_item_id IN (${placeholders})
               AND (o.id IS NULL OR o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
             GROUP BY oi.menu_item_id`,
            menuItemIds
          );
          salesRows.forEach((s) => {
            salesMap[s.menu_item_id] = Number(s.total_sold) || 0;
          });
        } catch (e) {
          // If table not yet created
        }

        const recipeItemsByMenuId = {};
        recipeRows.forEach((row) => {
          if (!recipeItemsByMenuId[row.menu_item_id]) {
            recipeItemsByMenuId[row.menu_item_id] = [];
          }
          recipeItemsByMenuId[row.menu_item_id].push({
            id: row.id,
            menu_item_id: row.menu_item_id,
            inventory_item_id: row.inventory_item_id,
            quantity_required: row.quantity_required,
            quantity_unit: row.quantity_unit,
            inventory_item: {
              id: row.inventory_item_id,
              name: row.inventory_item_name,
              unit: row.inventory_item_unit,
              quantity_in_stock: row.inventory_item_quantity_in_stock,
              low_stock_threshold: row.inventory_item_low_stock_threshold,
              category: row.inventory_item_category,
              is_active: row.inventory_item_is_active,
            },
          });
        });

        items.forEach((item) => {
          item.recipe_items = recipeItemsByMenuId[item.id] || [];
          item.avg_rating = ratingMap[item.id]?.avg_rating || 0;
          item.rating_count = ratingMap[item.id]?.rating_count || 0;
          item.total_sold = salesMap[item.id] || 0;
        });
      } else {
        items.forEach((item) => {
          item.recipe_items = [];
          item.avg_rating = 0;
          item.rating_count = 0;
          item.total_sold = 0;
        });
      }

      const mappedItems = items.map((it) => mapMenuItem(it, req, trackingEnabled, categoryNameMap));
      const sortedItems = sortMenuItemsByRatingAndSales(mappedItems);

      return res.status(200).json({
        success: true,
        count: sortedItems.length,
        items: sortedItems,
        tracking_enabled: Boolean(trackingEnabled),
      });
    }
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return res.status(500).json({ success: false, message: 'Error fetching menu items.' });
  }
};

// Create a new menu item (Admin)
const createMenuItem = async (req, res) => {
  try {
    const {
      name,
      image_url,
      meal_type,
      category,
      price,
      mrp,
      unit,
      brand,
      barcode,
      stock_quantity,
      discount_percentage,
      description,
      is_active,
      recipe,
      has_variants,
      variants,
    } = req.body;

    const cleanCat = normalizeCategoryCode(category || meal_type || 'groceries');
    const resolvedCategory = cleanCat;
    const resolvedMealType = cleanCat;

    if (!name || price === undefined) {
      if (req.file && req.file.relativeUrl) {
        await deleteLocalImage(req.file.relativeUrl);
      }
      return res.status(400).json({ success: false, message: 'Name and price are required fields.' });
    }

    // Default placeholder image or uploaded image
    let finalImageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

    if (req.file && req.file.relativeUrl) {
      finalImageUrl = req.file.relativeUrl;
    } else if (image_url && (image_url.startsWith('https://') || image_url.startsWith('http://'))) {
      finalImageUrl = image_url;
    }

    let parsedIsActive = true;
    if (is_active !== undefined) {
      if (typeof is_active === 'string') {
        parsedIsActive = is_active.toLowerCase() === 'true' || is_active === '1';
      } else {
        parsedIsActive = Boolean(is_active);
      }
    }

    let recipeData = [];
    if (recipe) {
      try {
        recipeData = JSON.parse(recipe);
      } catch (err) {
        console.error('Error parsing recipe JSON:', err);
      }
    }

    let variantsData = [];
    if (variants) {
      try {
        variantsData = typeof variants === 'string' ? JSON.parse(variants) : variants;
      } catch (err) {
        console.error('Error parsing variants JSON:', err);
      }
    }

    let parsedHasVariants = Boolean(
      has_variants === true || has_variants === 'true' || has_variants === 1 || has_variants === '1'
    );
    if (Array.isArray(variantsData) && variantsData.length > 0) {
      parsedHasVariants = true;
    }
    const finalVariantsJson = (parsedHasVariants && Array.isArray(variantsData) && variantsData.length > 0)
      ? JSON.stringify(variantsData)
      : null;

    const finalUnit = unit || 'piece';
    const finalMrp = mrp !== undefined ? Number(mrp) : Number(price);
    const finalBrand = brand || null;
    const finalBarcode = barcode || null;
    const finalStockQty = stock_quantity !== undefined ? Number(stock_quantity) : 100;
    const finalDiscount = discount_percentage !== undefined ? Number(discount_percentage) : 0;

    const connection = await pool.getConnection();
    let menuItemId;
    try {
      await connection.beginTransaction();

      const [menuResult] = await connection.execute(
        `INSERT INTO MenuItem (
          name, image_url, meal_type, category, price, mrp, unit, brand, barcode, 
          stock_quantity, in_stock, discount_percentage, description, is_active, has_variants, variants
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          finalImageUrl,
          resolvedMealType,
          resolvedCategory,
          Number(price),
          finalMrp,
          finalUnit,
          finalBrand,
          finalBarcode,
          finalStockQty,
          parsedIsActive ? 1 : 0,
          finalDiscount,
          description || '',
          parsedIsActive ? 1 : 0,
          parsedHasVariants ? 1 : 0,
          finalVariantsJson,
        ]
      );
      menuItemId = menuResult.insertId;

      // AUTOMATICALLY ADD PRODUCT TO TOTAL INVENTORY in the SAME SECTION (CATEGORY)
      try {
        const cleanInvCategory = normalizeInventoryCategory(resolvedCategory || resolvedMealType || 'groceries');
        const cleanInvUnit = normalizeInventoryUnit(finalUnit);

        // Check if an inventory item already exists by name
        const [existingInv] = await connection.execute(
          'SELECT id, quantity_in_stock FROM InventoryItem WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [name.trim()]
        );

        let invItemId = null;
        if (existingInv && existingInv.length > 0) {
          invItemId = existingInv[0].id;
          await connection.execute(
            `UPDATE InventoryItem 
             SET product_id = ?, category = ?, unit = ?, is_active = ?, quantity_in_stock = ?
             WHERE id = ?`,
            [menuItemId, cleanInvCategory, cleanInvUnit, parsedIsActive ? 1 : 0, finalStockQty, invItemId]
          );
        } else {
          // Generate next unique INV-XXXX sequence atomically
          const [maxRows] = await connection.execute(
            `SELECT MAX(CAST(SUBSTRING(unique_inventory_id, 5) AS UNSIGNED)) AS max_id 
             FROM InventoryItem 
             WHERE unique_inventory_id LIKE 'INV-%'`
          );
          const nextVal = (maxRows[0]?.max_id || 0) + 1;
          const uniqueId = `INV-${String(nextVal).padStart(4, '0')}`;

          await connection.execute(
            `INSERT INTO \`InventoryCounter\` (\`id\`, \`last_value\`)
             VALUES (1, ?)
             ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, ?)`,
            [nextVal, nextVal]
          );

          const [invInsert] = await connection.execute(
            `INSERT INTO InventoryItem (unique_inventory_id, product_id, name, unit, quantity_in_stock, low_stock_threshold, category, is_active)
             VALUES (?, ?, ?, ?, ?, 5.000, ?, ?)`,
            [uniqueId, menuItemId, name.trim(), cleanInvUnit, finalStockQty, cleanInvCategory, parsedIsActive ? 1 : 0]
          );
          invItemId = invInsert.insertId;

          if (finalStockQty > 0) {
            try {
              await connection.execute(
                `INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, admin_user_id, reason)
                 VALUES (?, 'restock', ?, ?, 'Initial Stock from Product Catalog')`,
                [invItemId, finalStockQty, req.adminId || null]
              );
            } catch (_) {}
          }
        }
      } catch (invErr) {
        console.warn('[createMenuItem] Auto-inventory registration notice:', invErr.message);
      }

      if (recipeData.length > 0) {
        try {
          for (const r of recipeData) {
            await connection.execute(
              `INSERT INTO RecipeItem (menu_item_id, inventory_item_id, quantity_required, quantity_unit)
               VALUES (?, ?, ?, ?)`,
              [menuItemId, Number(r.inventory_item_id), Number(r.quantity_required), r.quantity_unit]
            );
          }
        } catch (_riErr) {
          // RecipeItem table omitted for Kirana store
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      // Clean up orphaned uploaded file on DB failure
      if (req.file && req.file.relativeUrl) {
        await deleteLocalImage(req.file.relativeUrl);
      }
      throw error;
    } finally {
      connection.release();
    }

    const [newRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [menuItemId]);
    const item = newRows[0];

    // Real-time broadcast so student-app & admin screens immediately reflect new item
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('menu:updated', { item_id: menuItemId, is_active: item.is_active });
        io.emit('inventory:stock_updated', { product_id: menuItemId });
      }
    } catch (socketErr) {
      console.warn('[createMenuItem] Socket emit warning:', socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully!',
      item: {
        ...item,
        _id: item.id,
        category: cleanCat,
        meal_type: cleanCat,
        category_name: formatCategoryTitle(cleanCat),
        image_url: formatPublicImageUrl(item.image_url, req),
      },
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    if (req.file && req.file.relativeUrl) {
      await deleteLocalImage(req.file.relativeUrl);
    }
    return res.status(500).json({ success: false, message: error.message || 'Error creating menu item.' });
  }
};

// Update menu item or toggle active state (Admin)
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);
    const updates = { ...req.body };

    const [existingRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [targetId]);
    const existingItem = existingRows[0] || null;
    if (!existingItem) {
      if (req.file && req.file.relativeUrl) {
        await deleteLocalImage(req.file.relativeUrl);
      }
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    if (updates.meal_type !== undefined || updates.category !== undefined) {
      const targetCategory = normalizeCategoryCode(
        updates.category || updates.meal_type || existingItem.category || existingItem.meal_type
      );
      updates.meal_type = targetCategory;
      updates.category = targetCategory;
    }
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.is_active !== undefined) {
      if (typeof updates.is_active === 'string') {
        updates.is_active = updates.is_active.toLowerCase() === 'true' || updates.is_active === '1' ? 1 : 0;
      } else {
        updates.is_active = updates.is_active ? 1 : 0;
      }
    }

    const oldImageUrl = existingItem.image_url;

    if (req.file && req.file.relativeUrl) {
      updates.image_url = req.file.relativeUrl;
      console.log(`[updateMenuItem] New local image path: ${req.file.relativeUrl}`);
    } else {
      // Preserve existing image if no new file is uploaded
      delete updates.image_url;
    }

    let recipeData = [];
    const hasRecipe = updates.recipe !== undefined;
    if (hasRecipe) {
      try {
        recipeData = JSON.parse(updates.recipe);
      } catch (err) {
        console.error('Error parsing recipe JSON:', err);
      }
    }

    if (updates.variants !== undefined || updates.has_variants !== undefined) {
      let variantsData = [];
      if (updates.variants) {
        try {
          variantsData = typeof updates.variants === 'string' ? JSON.parse(updates.variants) : updates.variants;
        } catch (err) {
          console.error('Error parsing variants JSON:', err);
        }
      }

      let parsedHasVariants = updates.has_variants !== undefined
        ? Boolean(updates.has_variants === true || updates.has_variants === 'true' || updates.has_variants === 1 || updates.has_variants === '1')
        : (Array.isArray(variantsData) && variantsData.length > 0);

      if (Array.isArray(variantsData) && variantsData.length > 0) {
        parsedHasVariants = true;
      }

      updates.has_variants = parsedHasVariants ? 1 : 0;
      updates.variants = (parsedHasVariants && Array.isArray(variantsData) && variantsData.length > 0)
        ? JSON.stringify(variantsData)
        : null;
    }

    // Remove fields that shouldn't be passed directly to SQL update
    delete updates.id;
    delete updates._id;
    delete updates.recipe;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const keys = Object.keys(updates);
      if (keys.length > 0) {
        const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
        const vals = Object.values(updates);
        vals.push(targetId);
        await connection.execute(
          `UPDATE MenuItem SET ${setClause} WHERE id = ?`,
          vals
        );

        // Also ensure Product table has both category and meal_type updated
        try {
          if (updates.meal_type || updates.category) {
            await connection.execute(
              'UPDATE `Product` SET meal_type = ?, category = ? WHERE id = ?',
              [updates.meal_type, updates.category, targetId]
            );
          }
        } catch (_) {}
      }

      if (hasRecipe) {
        try {
          await connection.execute('DELETE FROM RecipeItem WHERE menu_item_id = ?', [targetId]);

          if (recipeData.length > 0) {
            for (const r of recipeData) {
              await connection.execute(
                `INSERT INTO RecipeItem (menu_item_id, inventory_item_id, quantity_required, quantity_unit)
                 VALUES (?, ?, ?, ?)`,
                [targetId, Number(r.inventory_item_id), Number(r.quantity_required), r.quantity_unit]
              );
            }
          }
        } catch (_riErr) {
          // RecipeItem table omitted for Kirana store
        }
      }

      // Synchronize changes to InventoryItem
      try {
        const invSet = [];
        const invVals = [];
        if (updates.name) {
          invSet.push('name = ?');
          invVals.push(updates.name.trim());
        }
        if (updates.category || updates.meal_type) {
          const newCat = normalizeInventoryCategory(updates.category || updates.meal_type);
          invSet.push('category = ?');
          invVals.push(newCat);
        }
        if (updates.unit) {
          invSet.push('unit = ?');
          invVals.push(normalizeInventoryUnit(updates.unit));
        }
        if (updates.is_active !== undefined) {
          invSet.push('is_active = ?');
          invVals.push(updates.is_active);
        }
        if (updates.stock_quantity !== undefined) {
          invSet.push('quantity_in_stock = ?');
          invVals.push(Number(updates.stock_quantity));
        }

        if (invSet.length > 0) {
          invVals.push(targetId);
          invVals.push(existingItem.name.trim().toLowerCase());
          await connection.execute(
            `UPDATE InventoryItem SET ${invSet.join(', ')} WHERE product_id = ? OR LOWER(TRIM(name)) = ?`,
            invVals
          );
        }
      } catch (invSyncErr) {
        console.warn('[updateMenuItem] InventoryItem sync notice:', invSyncErr.message);
      }

      await connection.commit();

      // On successful database update, delete old local image if a new image was uploaded
      if (req.file && oldImageUrl && oldImageUrl !== updates.image_url) {
        await deleteLocalImage(oldImageUrl);
      }
    } catch (error) {
      await connection.rollback();
      // On failure, delete the newly uploaded file and preserve the old image
      if (req.file && req.file.relativeUrl) {
        await deleteLocalImage(req.file.relativeUrl);
      }
      throw error;
    } finally {
      connection.release();
    }

    const [updatedRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [targetId]);
    const item = updatedRows[0];
    const categoryCode = normalizeCategoryCode(item.category || item.meal_type);
    const categoryName = formatCategoryTitle(categoryCode);

    // Real-time broadcast so student-app & other admin screens immediately reflect the status change
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('menu:updated', { 
          item_id: targetId, 
          is_active: item.is_active, 
          meal_type: categoryCode, 
          category: categoryCode 
        });
        io.emit('inventory:stock_updated', { product_id: targetId });
      }
    } catch (socketErr) {
      console.warn('[updateMenuItem] Socket emit warning:', socketErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully.',
      item: {
        ...item,
        _id: item.id,
        category: categoryCode,
        meal_type: categoryCode,
        category_name: categoryName,
        image_url: formatPublicImageUrl(item.image_url, req),
      },
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return res.status(500).json({ success: false, message: 'Error updating menu item.' });
  }
};

// Get recipe for a specific menu item
const getMenuItemRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const [recipeRows] = await pool.execute(
      `SELECT ri.*, ii.name AS ii_name, ii.unit AS ii_unit, ii.quantity_in_stock AS ii_stock, 
              ii.low_stock_threshold AS ii_threshold, ii.category AS ii_category, ii.is_active AS ii_active
       FROM RecipeItem ri
       INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
       WHERE ri.menu_item_id = ?`,
      [targetId]
    );

    const recipe = recipeRows.map((row) => ({
      id: row.id,
      menu_item_id: row.menu_item_id,
      inventory_item_id: row.inventory_item_id,
      quantity_required: Number(row.quantity_required),
      quantity_unit: row.quantity_unit,
      inventory_item: {
        id: row.inventory_item_id,
        name: row.ii_name,
        unit: row.ii_unit,
        quantity_in_stock: Number(row.ii_stock),
        low_stock_threshold: Number(row.ii_threshold),
        category: row.ii_category,
        is_active: row.ii_active,
      },
    }));

    return res.status(200).json({
      success: true,
      recipe,
    });
  } catch (error) {
    console.error('Error getting menu item recipe:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve recipe.' });
  }
};

// Delete menu item (Admin)
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [targetId]);
    const item = menuRows[0] || null;
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    // Delete associated local image from disk if present
    if (item.image_url) {
      await deleteLocalImage(item.image_url);
    }

    await pool.execute('DELETE FROM MenuItem WHERE id = ?', [targetId]);

    // Deactivate corresponding inventory item
    try {
      await pool.execute('UPDATE InventoryItem SET is_active = 0 WHERE product_id = ? OR LOWER(TRIM(name)) = ?', [targetId, item.name.trim().toLowerCase()]);
    } catch (_) {}

    // Real-time broadcast so student-app & other screens immediately reflect deleted item
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('menu:updated', { item_id: targetId, deleted: true });
        io.emit('inventory:stock_updated', { product_id: targetId, is_active: 0 });
      }
    } catch (socketErr) {
      console.warn('[deleteMenuItem] Socket emit warning:', socketErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return res.status(500).json({ success: false, message: 'Error deleting menu item.' });
  }
};

// Ensure MealWindow table exists and is populated with default meal types
const ensureMealWindowTable = async () => {
  try {
    // Auto-heal and sync existing product records where category and meal_type differ
    try {
      await pool.query(`
        UPDATE \`Product\` 
        SET category = meal_type 
        WHERE meal_type IS NOT NULL AND meal_type != '' AND category != meal_type
      `);
    } catch (_) {}

    // In Kirana store schema, Category is the primary table and MealWindow is a compatibility VIEW
    const [catTables] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Category' LIMIT 1`
    );
    if (catTables && catTables.length > 0) {
      return;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`MealWindow\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`meal_type\` VARCHAR(50) NOT NULL UNIQUE,
        \`start_time\` VARCHAR(10) NOT NULL,
        \`end_time\` VARCHAR(10) NOT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`is_full_day\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Verify existing columns in case MealWindow was created by an older migration
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MealWindow'
    `);
    const colNames = (cols || []).map((c) => c.COLUMN_NAME.toLowerCase());

    if (!colNames.includes('is_active')) {
      if (colNames.includes('is_enabled')) {
        await pool.query('ALTER TABLE `MealWindow` CHANGE `is_enabled` `is_active` TINYINT(1) NOT NULL DEFAULT 1');
      } else {
        await pool.query('ALTER TABLE `MealWindow` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `end_time`');
      }
    }

    if (!colNames.includes('is_full_day')) {
      await pool.query('ALTER TABLE `MealWindow` ADD COLUMN `is_full_day` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`');
    }

    if (!colNames.includes('serving_start_time')) {
      await pool.query('ALTER TABLE `MealWindow` ADD COLUMN `serving_start_time` VARCHAR(10) NULL DEFAULT NULL AFTER `end_time`');
      console.log('✅ [Database] Added `serving_start_time` column to `MealWindow`.');
    }

    if (!colNames.includes('custom_note')) {
      await pool.query('ALTER TABLE `MealWindow` ADD COLUMN `custom_note` VARCHAR(255) NULL DEFAULT NULL AFTER `is_full_day`');
      console.log('✅ [Database] Added `custom_note` column to `MealWindow`.');
    }

    // Backfill default serving_start_time for standard meal categories if NULL or empty
    try {
      await pool.query("UPDATE `MealWindow` SET `serving_start_time` = '08:30' WHERE `meal_type` = 'breakfast' AND (`serving_start_time` IS NULL OR `serving_start_time` = '')");
      await pool.query("UPDATE `MealWindow` SET `serving_start_time` = '12:30' WHERE `meal_type` = 'lunch' AND (`serving_start_time` IS NULL OR `serving_start_time` = '')");
      await pool.query("UPDATE `MealWindow` SET `serving_start_time` = '16:30' WHERE `meal_type` = 'snacks' AND (`serving_start_time` IS NULL OR `serving_start_time` = '')");
      await pool.query("UPDATE `MealWindow` SET `serving_start_time` = '19:30' WHERE `meal_type` = 'dinner' AND (`serving_start_time` IS NULL OR `serving_start_time` = '')");
      await pool.query("UPDATE `MealWindow` SET `serving_start_time` = `start_time` WHERE (`serving_start_time` IS NULL OR `serving_start_time` = '')");
    } catch (bfErr) {
      console.warn('[Database] Backfill serving_start_time notice:', bfErr.message);
    }

    // Ensure MenuItem.meal_type and Order.meal_type are VARCHAR(50) so custom meal types can be saved
    try {
      const [miCols] = await pool.query(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MenuItem' AND COLUMN_NAME = 'meal_type'`
      );
      if (miCols[0] && miCols[0].DATA_TYPE.toLowerCase() === 'enum') {
        await pool.query('ALTER TABLE `MenuItem` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL');
        console.log('✅ [Database] Altered MenuItem.meal_type from ENUM to VARCHAR(50).');
      }
    } catch (miErr) {
      console.warn('[Database] MenuItem.meal_type migration check:', miErr.message);
    }

    try {
      const [ordCols] = await pool.query(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'meal_type'`
      );
      if (ordCols[0] && ordCols[0].DATA_TYPE.toLowerCase() === 'enum') {
        await pool.query('ALTER TABLE `Order` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL');
        console.log('✅ [Database] Altered Order.meal_type from ENUM to VARCHAR(50).');
      }
    } catch (ordErr) {
      console.warn('[Database] Order.meal_type migration check:', ordErr.message);
    }

    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM `MealWindow`');
    if (!countResult || countResult[0]?.count === 0) {
      const defaultWindows = [
        ['breakfast', '07:30', '10:00', 1, 0],
        ['lunch',     '12:00', '14:30', 1, 0],
        ['snacks',    '16:30', '18:00', 1, 0],
        ['dinner',    '19:30', '21:30', 1, 0],
      ];
      for (const [meal_type, start_time, end_time, is_active, is_full_day] of defaultWindows) {
        await pool.execute(
          `INSERT INTO \`MealWindow\` (meal_type, start_time, end_time, is_active, is_full_day)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id=id`,
          [meal_type, start_time, end_time, is_active, is_full_day]
        );
      }
    }
  } catch (err) {
    console.warn('[MenuController] ensureMealWindowTable warning:', err.message);
  }
};

// Get Meal Timings / Windows
const getMealWindows = async (req, res) => {
  try {
    await ensureMealWindowTable();
    let [windows] = await pool.query('SELECT * FROM `MealWindow` ORDER BY id ASC');

    const currentTime = getCurrentTimeHHMM();
    let allSlots = {};
    try {
      allSlots = await getAllMealSlots();
    } catch (slotErr) {
      console.warn('[MenuController] getMealWindows getAllMealSlots warning:', slotErr.message);
    }

    const storeSlot = allSlots['store_hours'] || Object.values(allSlots).find((s) => s.is_full_day || (s.slots && s.slots.some((x) => x.start_datetime || x.is_active)));

    const formattedWindows = windows.map((w) => {
      const formatted = computeMealStatus(w, currentTime);
      const slotData = storeSlot || allSlots[w.meal_type.toLowerCase()];
      if (slotData && (slotData.is_full_day || (slotData.slots && slotData.slots.some((s) => s.start_datetime || s.is_active)) || slotData.custom_note)) {
        formatted.isAvailableNow = slotData.isAvailableNow;
        formatted.activeSlot = slotData.activeSlot;
        formatted.nextSlot = slotData.nextSlot;
        formatted.slots = slotData.slots;
        formatted.serving_note = slotData.serving_note;
        formatted.is_currently_open = slotData.isAvailableNow;
        formatted.is_full_day = slotData.is_full_day;
      } else {
        formatted.isAvailableNow = formatted.is_currently_open;
        formatted.activeSlot = null;
        formatted.nextSlot = null;
        formatted.slots = [];
        formatted.serving_note = formatted.is_currently_open
          ? `Serving now until ${formatted.formatted_end_time}`
          : 'Not available right now';
      }
      return formatted;
    });

    return res.status(200).json({
      success: true,
      windows: formattedWindows,
      store_timing: storeSlot || null,
      current_time: currentTime,
    });
  } catch (error) {
    console.error('[MenuController] Error fetching meal timings:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error fetching meal timings.', 
      error: error.message 
    });
  }
};

// Update Meal Window Timing (Admin)
const updateMealWindow = async (req, res) => {
  try {
    await ensureMealWindowTable();
    const { start_time, end_time, serving_start_time, custom_note, is_active, is_full_day, category_name, icon } = req.body;

    const updateData = {};
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (serving_start_time !== undefined) updateData.serving_start_time = serving_start_time;
    if (custom_note !== undefined) updateData.custom_note = custom_note;
    if (is_active !== undefined) updateData.is_active = is_active === true || is_active === 'true' ? 1 : 0;
    if (is_full_day !== undefined) updateData.is_full_day = is_full_day === true || is_full_day === 'true' ? 1 : 0;
    if (category_name !== undefined) updateData.category_name = category_name;
    if (icon !== undefined) updateData.icon = icon;

    const cleanMealType = meal_type.toLowerCase();

    const [existing] = await pool.execute(
      'SELECT id FROM MealWindow WHERE meal_type = ? LIMIT 1',
      [cleanMealType]
    );

    if (existing.length > 0) {
      const keys = Object.keys(updateData);
      if (keys.length > 0) {
        const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
        const vals = Object.values(updateData);
        vals.push(cleanMealType);
        await pool.execute(
          `UPDATE MealWindow SET ${setClause} WHERE meal_type = ?`,
          vals
        );
      }
    } else {
      await pool.execute(
        `INSERT INTO MealWindow (meal_type, start_time, end_time, serving_start_time, custom_note, is_active, is_full_day)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanMealType,
          start_time || '08:00',
          end_time || '20:00',
          serving_start_time || '12:30',
          custom_note || null,
          updateData.is_active !== undefined ? updateData.is_active : 1,
          updateData.is_full_day !== undefined ? updateData.is_full_day : 0,
        ]
      );
    }

    const [updatedRows] = await pool.execute(
      'SELECT * FROM MealWindow WHERE meal_type = ? LIMIT 1',
      [cleanMealType]
    );
    const window = updatedRows[0];
    const formatted = computeMealStatus(window);

    // Broadcast real-time update
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('meal_window:updated', { meal_type: cleanMealType, window: formatted });
      }
    } catch (socketErr) {
      console.warn('[updateMealWindow] Socket emit warning:', socketErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Meal window for ${meal_type} updated successfully.`,
      window: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating meal window: ' + error.message });
  }
};

/**
 * POST /api/menu/meal-types
 * Create a brand new meal type (Admin & Super Admin)
 * Automatically registers the meal window and creates its dynamic discount rule.
 */
const createMealType = async (req, res) => {
  try {
    await ensureMealWindowTable();
    const {
      meal_type,
      start_time = '08:00',
      end_time = '20:00',
      serving_start_time = '12:30',
      custom_note = null,
      is_active = true,
      is_full_day = false,
      discount_percentage = 10.0,
      discount_cutoff_time = '18:00',
    } = req.body;

    if (!meal_type || typeof meal_type !== 'string' || !meal_type.trim()) {
      return res.status(400).json({ success: false, message: 'Meal type name is required.' });
    }

    const cleanMealType = meal_type.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
    if (cleanMealType.length < 2) {
      return res.status(400).json({ success: false, message: 'Meal type name must be at least 2 characters.' });
    }

    // 1. Insert or update MealWindow
    await pool.execute(
      `INSERT INTO \`MealWindow\` (meal_type, start_time, end_time, serving_start_time, custom_note, is_active, is_full_day)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), serving_start_time = VALUES(serving_start_time), custom_note = VALUES(custom_note), is_active = VALUES(is_active), is_full_day = VALUES(is_full_day)`,
      [
        cleanMealType,
        start_time,
        end_time,
        serving_start_time,
        custom_note,
        is_active ? 1 : 0,
        is_full_day ? 1 : 0,
      ]
    );

    // 2. Automatically register / sync with MealDiscountRule
    const words = meal_type.trim().split(/[\s_-]+/);
    const prettyType = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const displayName = `Early ${prettyType} Discount`;

    try {
      await pool.execute(
        `INSERT INTO \`MealDiscountRule\` (meal_type, display_name, discount_percentage, cutoff_time, is_enabled)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [
          cleanMealType,
          displayName,
          Number(discount_percentage) || 10.0,
          discount_cutoff_time || end_time || '18:00',
        ]
      );
    } catch (ruleErr) {
      console.warn('[createMealType] MealDiscountRule auto-create warning:', ruleErr.message);
    }

    // 3. Emit real-time socket events
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('meal_window:updated', { meal_type: cleanMealType });
        io.emit('discount_settings:updated', { meal_type: cleanMealType });
      }
    } catch (socketErr) {
      console.warn('[createMealType] Socket emit warning:', socketErr.message);
    }

    const [rows] = await pool.execute('SELECT * FROM `MealWindow` WHERE meal_type = ? LIMIT 1', [cleanMealType]);
    const created = computeMealStatus(rows[0]);

    return res.status(201).json({
      success: true,
      message: `Meal type '${cleanMealType}' created successfully and synchronized with discount rules.`,
      window: created,
      meal_type: cleanMealType,
    });
  } catch (error) {
    console.error('[MenuController] createMealType error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create meal type: ' + error.message });
  }
};

/**
 * PUT /api/menu/meal-types/:meal_type/rename
 * Rename an existing meal type (Admin & Super Admin)
 * Atomically cascades rename to MealWindow, MealDiscountRule, MenuItem, Order, and DailyTokenCounter
 */
const renameMealType = async (req, res) => {
  let connection;
  try {
    await ensureMealWindowTable();
    const { meal_type: oldMealTypeParam } = req.params;
    const { new_meal_type } = req.body;

    if (!oldMealTypeParam || typeof oldMealTypeParam !== 'string' || !oldMealTypeParam.trim()) {
      return res.status(400).json({ success: false, message: 'Current meal type is required.' });
    }

    if (!new_meal_type || typeof new_meal_type !== 'string' || !new_meal_type.trim()) {
      return res.status(400).json({ success: false, message: 'New meal type name is required.' });
    }

    const cleanOldType = oldMealTypeParam.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
    const cleanNewType = new_meal_type.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');

    if (cleanNewType.length < 2) {
      return res.status(400).json({ success: false, message: 'New meal type name must be at least 2 characters.' });
    }

    if (cleanOldType === cleanNewType) {
      return res.json({
        success: true,
        message: `No changes required. Meal type is already '${cleanNewType}'.`,
        old_meal_type: cleanOldType,
        new_meal_type: cleanNewType,
      });
    }

    // Verify current meal type exists
    const [existingOld] = await pool.execute('SELECT * FROM `MealWindow` WHERE meal_type = ? LIMIT 1', [cleanOldType]);
    if (existingOld.length === 0) {
      return res.status(404).json({ success: false, message: `Meal type '${cleanOldType}' does not exist.` });
    }

    // Verify new meal type name is not already in use
    const [existingNew] = await pool.execute('SELECT id FROM `MealWindow` WHERE meal_type = ? LIMIT 1', [cleanNewType]);
    if (existingNew.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Meal type '${cleanNewType}' already exists. Please choose a different name.`,
      });
    }

    // Atomic database update across all referencing tables
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Update MealWindow
    try {
      await connection.execute('UPDATE `MealWindow` SET meal_type = ? WHERE meal_type = ?', [cleanNewType, cleanOldType]);
    } catch (mwErr) {
      console.warn('[renameMealType] MealWindow update warning:', mwErr.message);
    }

    // 2. Update Category table if present in Kirana schema
    const words = new_meal_type.trim().split(/[\s_-]+/);
    const prettyType = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    try {
      await connection.execute('UPDATE `Category` SET code = ?, name = ? WHERE code = ?', [cleanNewType, prettyType, cleanOldType]);
    } catch (catErr) {
      // Category table skipped if not present or MealWindow is base table
    }

    // 3. Update MealDiscountRule if table exists (omitted/dropped in Kirana store schema)
    try {
      const displayName = `Early ${prettyType} Discount`;
      await connection.execute(
        'UPDATE `MealDiscountRule` SET meal_type = ?, display_name = ? WHERE meal_type = ?',
        [cleanNewType, displayName, cleanOldType]
      );
    } catch (ruleErr) {
      // MealDiscountRule table removed for Kirana store
      console.warn('[renameMealType] MealDiscountRule update skipped:', ruleErr.message);
    }

    // 4. Update MenuItem catalog (both meal_type and category fields)
    try {
      await connection.execute('UPDATE `MenuItem` SET meal_type = ? WHERE meal_type = ?', [cleanNewType, cleanOldType]);
    } catch (miErr) {
      console.warn('[renameMealType] MenuItem meal_type update warning:', miErr.message);
    }
    try {
      await connection.execute('UPDATE `MenuItem` SET category = ? WHERE category = ?', [cleanNewType, cleanOldType]);
    } catch (miCatErr) {
      // category column might not exist on legacy MenuItem table
    }

    // 5. Update Product table directly if it exists as a separate base table
    try {
      await connection.execute(
        'UPDATE `Product` SET meal_type = CASE WHEN meal_type = ? THEN ? ELSE meal_type END, category = CASE WHEN category = ? THEN ? ELSE category END WHERE meal_type = ? OR category = ?',
        [cleanOldType, cleanNewType, cleanOldType, cleanNewType, cleanOldType, cleanOldType]
      );
    } catch (prodErr) {
      // Product table skipped if not present or view
    }

    // 6. Update Order records
    try {
      await connection.execute('UPDATE `Order` SET meal_type = ? WHERE meal_type = ?', [cleanNewType, cleanOldType]);
    } catch (orderErr) {
      console.warn('[renameMealType] Order update skipped/warning:', orderErr.message);
    }

    // 7. Update DailyTokenCounter if table exists
    try {
      await connection.execute('UPDATE `DailyTokenCounter` SET meal_type = ? WHERE meal_type = ?', [cleanNewType, cleanOldType]);
    } catch (tokenErr) {
      console.warn('[renameMealType] DailyTokenCounter update skipped/warning:', tokenErr.message);
    }

    // 8. Update meal_serving_slots if table exists
    try {
      await connection.execute('UPDATE `meal_serving_slots` SET meal_type = ? WHERE meal_type = ?', [cleanNewType, cleanOldType]);
    } catch (slotErr) {
      // meal_serving_slots skipped if not present
    }

    // 9. Update ProductReview / MenuItemReview if table exists
    try {
      await connection.execute(
        'UPDATE `ProductReview` SET meal_type = CASE WHEN meal_type = ? THEN ? ELSE meal_type END, category = CASE WHEN category = ? THEN ? ELSE category END WHERE meal_type = ? OR category = ?',
        [cleanOldType, cleanNewType, cleanOldType, cleanNewType, cleanOldType, cleanOldType]
      );
    } catch (prErr) {
      // ProductReview skipped if not present
    }

    await connection.commit();

    // 10. Emit real-time socket events for connected clients
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('meal_window:updated', { old_meal_type: cleanOldType, new_meal_type: cleanNewType });
        io.emit('meal_type:renamed', { old_meal_type: cleanOldType, new_meal_type: cleanNewType });
        io.emit('menu:updated');
        io.emit('discount_settings:updated');
      }
    } catch (socketErr) {
      console.warn('[renameMealType] Socket emit warning:', socketErr.message);
    }

    const [updatedRow] = await pool.execute('SELECT * FROM `MealWindow` WHERE meal_type = ? LIMIT 1', [cleanNewType]);
    const updatedWindow = updatedRow.length > 0 ? computeMealStatus(updatedRow[0]) : null;

    return res.json({
      success: true,
      message: `Category '${cleanOldType}' was successfully renamed to '${cleanNewType}'.`,
      old_meal_type: cleanOldType,
      new_meal_type: cleanNewType,
      window: updatedWindow,
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) { console.error('[renameMealType] Rollback error:', rbErr); }
    }
    console.error('[MenuController] renameMealType error:', error);
    return res.status(500).json({ success: false, message: 'Failed to rename category: ' + error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMealWindows,
  updateMealWindow,
  createMealType,
  renameMealType,
  computeMealStatus,
  getMenuItemRecipe,
  convertToInventoryBaseUnit,
  ensureMealWindowTable,
};

