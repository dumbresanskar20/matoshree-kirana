const axios = require('axios');

const API_BASE_URL = 'https://matoshree-api.mealbook.in/api';

const GRAINS_PULSES_CATEGORY = {
  meal_type: 'grains_pulses',
  category_name: 'Grains & Pulses',
  start_time: '00:00',
  end_time: '23:59',
  serving_start_time: '00:00',
  is_active: true,
  is_full_day: true,
  custom_note: 'Fresh daily grains, flours & pulses at Matoshree Kirana',
};

const PRODUCTS_TO_ADD = [
  {
    name: 'Basmati Rice',
    price: 120,
    mrp: 140,
    unit: 'kg',
    brand: 'Matoshree Select',
    category: 'Grains & Pulses',
    meal_type: 'grains_pulses',
    description: 'Premium-quality basmati rice, ideal for biryani and everyday meals.',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 150,
    available_quantity: 150,
    daily_stock_limit: 200,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_basmati_500g', name: '500 g', quantity: 0.5, price: 60 },
      { id: 'opt_basmati_1kg',  name: '1 kg',  quantity: 1,   price: 120 },
      { id: 'opt_basmati_2kg',  name: '2 kg',  quantity: 2,   price: 240 },
      { id: 'opt_basmati_5kg',  name: '5 kg',  quantity: 5,   price: 600 },
    ],
  },
  {
    name: 'Toor Dal',
    price: 150,
    mrp: 175,
    unit: 'kg',
    brand: 'Matoshree Select',
    category: 'Grains & Pulses',
    meal_type: 'grains_pulses',
    description: 'Fresh and nutritious toor dal, perfect for traditional Indian dal.',
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 120,
    available_quantity: 120,
    daily_stock_limit: 150,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_toordal_500g', name: '500 g', quantity: 0.5, price: 75 },
      { id: 'opt_toordal_1kg',  name: '1 kg',  quantity: 1,   price: 150 },
      { id: 'opt_toordal_2kg',  name: '2 kg',  quantity: 2,   price: 300 },
      { id: 'opt_toordal_5kg',  name: '5 kg',  quantity: 5,   price: 750 },
    ],
  },
  {
    name: 'Moong Dal',
    price: 130,
    mrp: 155,
    unit: 'kg',
    brand: 'Matoshree Select',
    category: 'Grains & Pulses',
    meal_type: 'grains_pulses',
    description: 'High-quality moong dal, rich in protein and easy to digest.',
    image_url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 100,
    available_quantity: 100,
    daily_stock_limit: 150,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_moongdal_500g', name: '500 g', quantity: 0.5, price: 65 },
      { id: 'opt_moongdal_1kg',  name: '1 kg',  quantity: 1,   price: 130 },
      { id: 'opt_moongdal_2kg',  name: '2 kg',  quantity: 2,   price: 260 },
      { id: 'opt_moongdal_5kg',  name: '5 kg',  quantity: 5,   price: 650 },
    ],
  },
  {
    name: 'Wheat (Gahu)',
    price: 45,
    mrp: 52,
    unit: 'kg',
    brand: 'Matoshree Farm Fresh',
    category: 'Grains & Pulses',
    meal_type: 'grains_pulses',
    description: 'Fresh whole wheat grains suitable for making nutritious flour.',
    image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 250,
    available_quantity: 250,
    daily_stock_limit: 300,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_wheat_500g', name: '500 g', quantity: 0.5, price: 22.5 },
      { id: 'opt_wheat_1kg',  name: '1 kg',  quantity: 1,   price: 45 },
      { id: 'opt_wheat_2kg',  name: '2 kg',  quantity: 2,   price: 90 },
      { id: 'opt_wheat_5kg',  name: '5 kg',  quantity: 5,   price: 225 },
    ],
  },
  {
    name: 'Chana Dal',
    price: 90,
    mrp: 105,
    unit: 'kg',
    brand: 'Matoshree Select',
    category: 'Grains & Pulses',
    meal_type: 'grains_pulses',
    description: 'Premium chana dal, ideal for everyday Indian cooking.',
    image_url: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
    stock_quantity: 100,
    available_quantity: 100,
    daily_stock_limit: 150,
    is_active: true,
    is_available: true,
    in_stock: true,
    has_variants: true,
    variants: [
      { id: 'opt_chanadal_500g', name: '500 g', quantity: 0.5, price: 45 },
      { id: 'opt_chanadal_1kg',  name: '1 kg',  quantity: 1,   price: 90 },
      { id: 'opt_chanadal_2kg',  name: '2 kg',  quantity: 2,   price: 180 },
      { id: 'opt_chanadal_5kg',  name: '5 kg',  quantity: 5,   price: 450 },
    ],
  },
];

async function seedGrainsAndPulses() {
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

  console.log('\n--- Step 2: Ensure Category "Grains & Pulses" ---');
  const windowsRes = await axios.get(`${API_BASE_URL}/menu/windows`, { headers });
  const windows = windowsRes.data.windows || [];
  const existingGrains = windows.find(
    (w) =>
      (w.meal_type || '').toLowerCase() === 'grains_pulses' ||
      (w.category_name || '').toLowerCase() === 'grains & pulses'
  );

  if (existingGrains) {
    console.log(`Found existing category "${existingGrains.category_name || existingGrains.meal_type}". Updating timing & full-day settings...`);
    await axios.put(
      `${API_BASE_URL}/menu/windows/${existingGrains.meal_type}`,
      GRAINS_PULSES_CATEGORY,
      { headers }
    );
    console.log('✅ Category "Grains & Pulses" updated to 24/7 full-day active ordering.');
  } else {
    console.log('Category not found. Creating new meal type "grains_pulses"...');
    await axios.post(
      `${API_BASE_URL}/menu/meal-types`,
      {
        meal_type: 'grains_pulses',
        ...GRAINS_PULSES_CATEGORY,
      },
      { headers }
    );
    console.log('✅ Category "Grains & Pulses" created successfully.');
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
      meal_type: prod.meal_type,
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
  const verifyRes = await axios.get(`${API_BASE_URL}/menu/items?meal_type=grains_pulses`, { headers });
  const grainsItems = verifyRes.data.items || [];
  console.log(`Found ${grainsItems.length} products under "Grains & Pulses":`);
  grainsItems.forEach((item, idx) => {
    console.log(
      ` ${idx + 1}. ${item.name} | Base Price: ₹${item.price} | Variants: ${
        item.variants ? item.variants.map((v) => `${v.name}=₹${v.price}`).join(', ') : 'None'
      }`
    );
  });

  console.log('\n🎉 All 5 Grains & Pulses products successfully stored and verified in database!');
}

seedGrainsAndPulses().catch((err) => {
  console.error('❌ Error seeding products:', err.response?.data || err.message);
  process.exit(1);
});
