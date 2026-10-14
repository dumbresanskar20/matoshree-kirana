const axios = require('axios');

const API_BASE_URL = 'https://matoshree-api.mealbook.in/api';

const COOKING_ESSENTIALS_CATEGORY = {
  meal_type: 'cooking_essential',
  category_name: 'Cooking Essentials',
  icon: '🍳',
  start_time: '00:00',
  end_time: '23:59',
  serving_start_time: '00:00',
  is_active: true,
  is_full_day: true,
  custom_note: 'Daily cooking oils, sugar, salt & kitchen essentials at Matoshree Kirana',
};

const PRODUCTS_TO_ADD = [
  {
    name: 'Sunflower Oil',
    price: 150,
    mrp: 175,
    unit: 'L',
    brand: 'Matoshree Select',
    category: 'Cooking Essentials',
    meal_type: 'cooking_essential',
    description: 'Refined sunflower oil suitable for everyday cooking, frying, and preparing delicious meals.',
    image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 120,
    available_quantity: 120,
    daily_stock_limit: 150,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_sunfloweroil_500ml', name: '500 ml', quantity: 0.5, price: 75 },
      { id: 'opt_sunfloweroil_1l',     name: '1 L',    quantity: 1,   price: 150 },
      { id: 'opt_sunfloweroil_2l',     name: '2 L',    quantity: 2,   price: 300 },
      { id: 'opt_sunfloweroil_5l',     name: '5 L',    quantity: 5,   price: 750 },
    ],
  },
  {
    name: 'Groundnut Oil',
    price: 190,
    mrp: 220,
    unit: 'L',
    brand: 'Matoshree Select',
    category: 'Cooking Essentials',
    meal_type: 'cooking_essential',
    description: 'Quality groundnut oil with a rich flavor, ideal for traditional Indian cooking and frying.',
    image_url: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 100,
    available_quantity: 100,
    daily_stock_limit: 120,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_groundnutoil_500ml', name: '500 ml', quantity: 0.5, price: 95 },
      { id: 'opt_groundnutoil_1l',     name: '1 L',    quantity: 1,   price: 190 },
      { id: 'opt_groundnutoil_2l',     name: '2 L',    quantity: 2,   price: 380 },
      { id: 'opt_groundnutoil_5l',     name: '5 L',    quantity: 5,   price: 950 },
    ],
  },
  {
    name: 'Sugar',
    price: 45,
    mrp: 50,
    unit: 'kg',
    brand: 'Matoshree Farm Fresh',
    category: 'Cooking Essentials',
    meal_type: 'cooking_essential',
    description: 'Fine-quality white sugar, perfect for preparing tea, coffee, sweets, desserts, and everyday recipes.',
    image_url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 200,
    available_quantity: 200,
    daily_stock_limit: 250,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_sugar_500g', name: '500 g', quantity: 0.5, price: 22.5 },
      { id: 'opt_sugar_1kg',  name: '1 kg',  quantity: 1,   price: 45 },
      { id: 'opt_sugar_2kg',  name: '2 kg',  quantity: 2,   price: 90 },
      { id: 'opt_sugar_5kg',  name: '5 kg',  quantity: 5,   price: 225 },
    ],
  },
  {
    name: 'Iodized Salt',
    price: 25,
    mrp: 28,
    unit: 'kg',
    brand: 'Matoshree Pure',
    category: 'Cooking Essentials',
    meal_type: 'cooking_essential',
    description: 'Fine-quality iodized salt, an essential ingredient for everyday cooking and seasoning.',
    image_url: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 250,
    available_quantity: 250,
    daily_stock_limit: 300,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_salt_500g', name: '500 g', quantity: 0.5, price: 12.5 },
      { id: 'opt_salt_1kg',  name: '1 kg',  quantity: 1,   price: 25 },
      { id: 'opt_salt_2kg',  name: '2 kg',  quantity: 2,   price: 50 },
      { id: 'opt_salt_5kg',  name: '5 kg',  quantity: 5,   price: 125 },
    ],
  },
  {
    name: 'Jaggery (Gul)',
    price: 65,
    mrp: 75,
    unit: 'kg',
    brand: 'Matoshree Pure Desi',
    category: 'Cooking Essentials',
    meal_type: 'cooking_essential',
    description: 'Traditional jaggery made from sugarcane, offering a rich natural sweetness for Indian sweets and everyday cooking.',
    image_url: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 150,
    available_quantity: 150,
    daily_stock_limit: 180,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_jaggery_500g', name: '500 g', quantity: 0.5, price: 32.5 },
      { id: 'opt_jaggery_1kg',  name: '1 kg',  quantity: 1,   price: 65 },
      { id: 'opt_jaggery_2kg',  name: '2 kg',  quantity: 2,   price: 130 },
      { id: 'opt_jaggery_5kg',  name: '5 kg',  quantity: 5,   price: 325 },
    ],
  },
];

async function seedCookingEssentials() {
  console.log('--- Step 1: Admin Authentication ---');
  const loginRes = await axios.post(`${API_BASE_URL}/auth/admin/login`, {
    usernameOrEmail: 'admin@mess.com',
    password: 'Admin@123',
  });

  const token = loginRes.data.token;
  if (!token) {
    throw new Error('Failed to obtain admin token.');
  }
  console.log('✅ Admin authenticated successfully.');
  const headers = { Authorization: `Bearer ${token}` };

  console.log('\n--- Step 2: Ensure Category "Cooking Essentials" ---');
  const windowsRes = await axios.get(`${API_BASE_URL}/menu/windows`, { headers });
  const windows = windowsRes.data.windows || [];
  const existingCategory = windows.find(
    (w) =>
      (w.meal_type || '').toLowerCase() === 'cooking_essential' ||
      (w.meal_type || '').toLowerCase() === 'cooking_essentials' ||
      (w.category_name || '').toLowerCase() === 'cooking essentials'
  );

  const targetMealType = existingCategory ? existingCategory.meal_type : 'cooking_essential';

  if (existingCategory) {
    console.log(`Found existing category "${existingCategory.category_name || existingCategory.meal_type}". Updating timing & full-day settings...`);
    await axios.put(
      `${API_BASE_URL}/menu/windows/${targetMealType}`,
      {
        ...COOKING_ESSENTIALS_CATEGORY,
        meal_type: targetMealType,
      },
      { headers }
    );
    console.log(`✅ Category "${COOKING_ESSENTIALS_CATEGORY.category_name}" updated to 24/7 full-day active ordering.`);
  } else {
    console.log(`Category not found. Creating new meal type "${targetMealType}"...`);
    await axios.post(
      `${API_BASE_URL}/menu/meal-types`,
      {
        meal_type: targetMealType,
        ...COOKING_ESSENTIALS_CATEGORY,
      },
      { headers }
    );
    console.log(`✅ Category "${COOKING_ESSENTIALS_CATEGORY.category_name}" created successfully.`);
  }

  console.log('\n--- Step 3: Fetch Existing Products & Prevent Duplicates ---');
  const itemsRes = await axios.get(`${API_BASE_URL}/menu/items`, { headers });
  const existingItems = itemsRes.data.items || [];
  console.log(`Currently found ${existingItems.length} products in catalog.`);

  for (const prod of PRODUCTS_TO_ADD) {
    const existing = existingItems.find(
      (item) => item.name.trim().toLowerCase() === prod.name.trim().toLowerCase()
    );

    const payload = {
      name: prod.name,
      price: prod.price,
      mrp: prod.mrp,
      unit: prod.unit,
      brand: prod.brand,
      category: prod.category,
      meal_type: targetMealType,
      description: prod.description,
      image_url: prod.image_url,
      stock_quantity: prod.stock_quantity,
      available_quantity: prod.available_quantity,
      daily_stock_limit: prod.daily_stock_limit,
      is_active: prod.is_active,
      is_available: prod.is_available,
      in_stock: prod.in_stock,
      has_variants: prod.has_variants,
      variants: JSON.stringify(prod.variants),
    };

    if (existing) {
      const targetId = existing.id || existing._id;
      console.log(`Updating existing product "${prod.name}" (ID: ${targetId})...`);
      await axios.put(`${API_BASE_URL}/menu/items/${targetId}`, payload, { headers });
      console.log(`✅ Updated "${prod.name}" with quantity-based pricing.`);
    } else {
      console.log(`Creating new product "${prod.name}"...`);
      const createRes = await axios.post(`${API_BASE_URL}/menu/items`, payload, { headers });
      console.log(`✅ Created "${prod.name}" (ID: ${createRes.data.item?.id}).`);
    }
  }

  console.log('\n--- Step 4: Verification of Seeded Products ---');
  const verifyRes = await axios.get(`${API_BASE_URL}/menu/items?meal_type=${targetMealType}`, { headers });
  const cookingItems = verifyRes.data.items || [];
  console.log(`Found ${cookingItems.length} products under "${COOKING_ESSENTIALS_CATEGORY.category_name}":`);
  cookingItems.forEach((item, idx) => {
    console.log(
      ` ${idx + 1}. ${item.name} | Base Price: ₹${item.price} | Variants: ${
        item.variants ? item.variants.map((v) => `${v.name}=₹${v.price}`).join(', ') : 'None'
      }`
    );
  });

  console.log('\n🎉 All 5 Cooking Essentials products successfully stored and verified in database!');
}

seedCookingEssentials().catch((err) => {
  console.error('❌ Error seeding products:', err.response?.data || err.message);
  process.exit(1);
});
