const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Locate .env path relative to __dirname
let envPath = path.resolve(__dirname, '../.env'); // local dev (backend/.env relative to backend/src/seed.js)

// Check if cPanel deployment structure is active (backend/.env is inside backend/ subfolder)
const cpanelEnvPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(cpanelEnvPath)) {
  envPath = cpanelEnvPath;
} else if (fs.existsSync(path.resolve(__dirname, './.env'))) {
  envPath = path.resolve(__dirname, './.env');
} else if (fs.existsSync(path.resolve(__dirname, '../../backend/.env'))) {
  envPath = path.resolve(__dirname, '../../backend/.env');
}

dotenv.config({ path: envPath });

const bcrypt = require('bcryptjs');
const { pool } = require('./database/db');

const seedData = async () => {
  try {
    console.log('[Seed] Connecting to MySQL...');

    // 1. Seed Super Admin
    const [adminRows] = await pool.execute('SELECT * FROM AdminUser WHERE email = ? LIMIT 1', ['admin@mess.com']);
    const existingAdmin = adminRows[0] || null;
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      await pool.execute(
        `INSERT INTO AdminUser (username, email, password_hash, role, is_active, is_verified)
         VALUES (?, ?, ?, ?, 1, 1)`,
        ['superadmin', 'admin@mess.com', passwordHash, 'super_admin']
      );
      console.log('✅ Super Admin created: admin@mess.com / Admin@123');
    } else {
      console.log('ℹ️ Super Admin already exists.');
    }

    // 2. Seed Meal Windows
    const [windowCountResult] = await pool.query('SELECT COUNT(*) AS count FROM MealWindow');
    const existingWindowsCount = windowCountResult[0].count;
    if (existingWindowsCount === 0) {
      const mealWindows = [
        { meal_type: 'grains_pulses', category_name: 'Grains & Pulses', start_time: '00:00', serving_start_time: '00:00', end_time: '23:59', is_active: true, is_full_day: true },
        { meal_type: 'breakfast', category_name: 'Breakfast Essentials', start_time: '07:30', serving_start_time: '08:30', end_time: '10:00', is_active: true, is_full_day: false },
        { meal_type: 'lunch', category_name: 'Lunch Essentials', start_time: '12:00', serving_start_time: '12:30', end_time: '14:30', is_active: true, is_full_day: false },
        { meal_type: 'snacks', category_name: 'Evening Snacks', start_time: '16:30', serving_start_time: '16:30', end_time: '18:00', is_active: true, is_full_day: false },
        { meal_type: 'dinner', category_name: 'Dinner Essentials', start_time: '19:30', serving_start_time: '19:30', end_time: '21:30', is_active: true, is_full_day: false },
      ];
      for (const w of mealWindows) {
        await pool.execute(
          `INSERT INTO MealWindow (meal_type, category_name, start_time, serving_start_time, end_time, is_active, is_full_day)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), is_full_day = VALUES(is_full_day)`,
          [w.meal_type, w.category_name, w.start_time, w.serving_start_time, w.end_time, w.is_active ? 1 : 0, w.is_full_day ? 1 : 0]
        );
      }
      console.log('✅ Default Meal Windows / Categories created (Grains & Pulses, Breakfast, Lunch, Snacks, Dinner).');
    } else {
      console.log('ℹ️ Meal Windows already exist — preserving database settings.');
    }

    // 3. Seed Menu Items
    const sampleItems = [
      // Grains & Pulses
      {
        name: 'Basmati Rice',
        category: 'Grains & Pulses',
        meal_type: 'grains_pulses',
        price: 120,
        image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        description: 'Premium-quality basmati rice, ideal for biryani and everyday meals.',
        is_active: true,
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
        category: 'Grains & Pulses',
        meal_type: 'grains_pulses',
        price: 150,
        image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
        description: 'Fresh and nutritious toor dal, perfect for traditional Indian dal.',
        is_active: true,
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
        category: 'Grains & Pulses',
        meal_type: 'grains_pulses',
        price: 130,
        image_url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
        description: 'High-quality moong dal, rich in protein and easy to digest.',
        is_active: true,
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
        category: 'Grains & Pulses',
        meal_type: 'grains_pulses',
        price: 45,
        image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
        description: 'Fresh whole wheat grains suitable for making nutritious flour.',
        is_active: true,
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
        category: 'Grains & Pulses',
        meal_type: 'grains_pulses',
        price: 90,
        image_url: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
        description: 'Premium chana dal, ideal for everyday Indian cooking.',
        is_active: true,
        has_variants: true,
        variants: [
          { id: 'opt_chanadal_500g', name: '500 g', quantity: 0.5, price: 45 },
          { id: 'opt_chanadal_1kg',  name: '1 kg',  quantity: 1,   price: 90 },
          { id: 'opt_chanadal_2kg',  name: '2 kg',  quantity: 2,   price: 180 },
          { id: 'opt_chanadal_5kg',  name: '5 kg',  quantity: 5,   price: 450 },
        ],
      },
      // Cooking Essentials
      {
        name: 'Sunflower Oil',
        category: 'Cooking Essentials',
        meal_type: 'cooking_essential',
        price: 150,
        image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
        description: 'Refined sunflower oil suitable for everyday cooking, frying, and preparing delicious meals.',
        is_active: true,
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
        category: 'Cooking Essentials',
        meal_type: 'cooking_essential',
        price: 190,
        image_url: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=600&q=80',
        description: 'Quality groundnut oil with a rich flavor, ideal for traditional Indian cooking and frying.',
        is_active: true,
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
        category: 'Cooking Essentials',
        meal_type: 'cooking_essential',
        price: 45,
        image_url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
        description: 'Fine-quality white sugar, perfect for preparing tea, coffee, sweets, desserts, and everyday recipes.',
        is_active: true,
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
        category: 'Cooking Essentials',
        meal_type: 'cooking_essential',
        price: 25,
        image_url: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?auto=format&fit=crop&w=600&q=80',
        description: 'Fine-quality iodized salt, an essential ingredient for everyday cooking and seasoning.',
        is_active: true,
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
        category: 'Cooking Essentials',
        meal_type: 'cooking_essential',
        price: 65,
        image_url: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=600&q=80',
        description: 'Traditional jaggery made from sugarcane, offering a rich natural sweetness for Indian sweets and everyday cooking.',
        is_active: true,
        has_variants: true,
        variants: [
          { id: 'opt_jaggery_500g', name: '500 g', quantity: 0.5, price: 32.5 },
          { id: 'opt_jaggery_1kg',  name: '1 kg',  quantity: 1,   price: 65 },
          { id: 'opt_jaggery_2kg',  name: '2 kg',  quantity: 2,   price: 130 },
          { id: 'opt_jaggery_5kg',  name: '5 kg',  quantity: 5,   price: 325 },
        ],
      },
      // Breakfast
      {
        name: 'Masala Dosa with Sambhar & Chutneys',
        meal_type: 'breakfast',
        price: 50,
        image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80',
        description: 'Crispy fermented rice-lentil crepe filled with spiced potato potato mash, served with coconut chutney & tangy sambhar.',
        is_active: true,
      },
      {
        name: 'Fluffy Puri Bhaji (4 Pcs)',
        meal_type: 'breakfast',
        price: 45,
        image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
        description: 'Deep-fried golden whole wheat puris served with flavorful aromatic potato curry.',
        is_active: true,
      },
      {
        name: 'Steamed Idli Vada Combo',
        meal_type: 'breakfast',
        price: 40,
        image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
        description: '2 Soft rice cakes and 1 crunchy medu vada served with piping hot sambhar & fresh mint chutney.',
        is_active: true,
      },
      {
        name: 'Kanda Poha with Fried Peanuts',
        meal_type: 'breakfast',
        price: 30,
        image_url: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=600&q=80',
        description: 'Flattened rice tempered with mustard seeds, curry leaves, onions, turmeric, and crispy peanuts.',
        is_active: true,
      },

      // Lunch
      {
        name: 'Deluxe Veg Thali',
        meal_type: 'lunch',
        price: 90,
        image_url: 'https://images.unsplash.com/photo-1613292443284-8d10ef9383fe?auto=format&fit=crop&w=600&q=80',
        description: 'Paneer Butter Masala, Dal Tadka, Seasonal Veggie, 3 Butter Chapatis, Steamed Basmati Rice, Gulab Jamun & Raita.',
        is_active: true,
      },
      {
        name: 'Hyderabadi Veg Dum Biryani',
        meal_type: 'lunch',
        price: 80,
        image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
        description: 'Fragrant long-grain basmati rice layered with slow-cooked marinated veggies and authentic saffron spices, served with Mirchi Ka Salan.',
        is_active: true,
      },
      {
        name: 'Dal Makhani & Jeera Rice Bowl',
        meal_type: 'lunch',
        price: 70,
        image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
        description: 'Creamy black lentils simmered overnight with butter and cream, served alongside aromatic cumin basmati rice.',
        is_active: true,
      },
      {
        name: 'Rajma Chawal Combo',
        meal_type: 'lunch',
        price: 65,
        image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
        description: 'Classic North Indian red kidney bean curry served over fluffy steamed rice with pickled onions.',
        is_active: true,
      },

      // Snacks
      {
        name: 'Samosa Pav with Spicy Chutney (2 Pcs)',
        meal_type: 'snacks',
        price: 30,
        image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
        description: 'Crispy fried potato pastries stuffed inside soft bun rolls with garlic & tamarind chutneys.',
        is_active: true,
      },
      {
        name: 'Crispy Paneer Pakoda Tray',
        meal_type: 'snacks',
        price: 55,
        image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80',
        description: 'Fresh cottage cheese cubes coated in spiced gram flour batter and deep fried until golden.',
        is_active: true,
      },
      {
        name: 'Cutting Masala Chai & Biscuit',
        meal_type: 'snacks',
        price: 15,
        image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
        description: 'Strong ginger-cardamom milk tea served hot with crunchy tea biscuits.',
        is_active: true,
      },

      // Dinner
      {
        name: 'Special Paneer Butter Masala Meal',
        meal_type: 'dinner',
        price: 95,
        image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        description: 'Rich tomato-cashew gravied soft paneer served with 2 Tandoori Butter Naan and salad.',
        is_active: true,
      },
      {
        name: 'Chole Bhature Special',
        meal_type: 'dinner',
        price: 75,
        image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
        description: 'Spicy chickpeas curry served with 2 large fluffy fried breads, fried green chili, and lemon.',
        is_active: true,
      },
      {
        name: 'Light Khichdi & Kadhi Bowl',
        meal_type: 'dinner',
        price: 60,
        image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
        description: 'Comforting Moong Dal & Rice dish tempered with ghee and cumin, served with Gujarati Kadhi & Papad.',
        is_active: true,
      },
    ];

    // Delete existing menu items (cascade will delete recipe items)
    await pool.query('DELETE FROM MenuItem');
    
    // Seed new menu items
    for (const item of sampleItems) {
      await pool.execute(
        `INSERT INTO MenuItem (name, category, meal_type, price, image_url, description, is_active, has_variants, variants)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          item.name,
          item.category || item.meal_type,
          item.meal_type,
          item.price,
          item.image_url,
          item.description,
          item.has_variants ? 1 : 0,
          item.variants ? JSON.stringify(item.variants) : null,
        ]
      );
    }
    console.log(`✅ Seeded ${sampleItems.length} menu items successfully.`);

    // 4. Seed Test Student Account
    const [studentRows] = await pool.execute('SELECT * FROM Student WHERE email = ? LIMIT 1', ['student@test.com']);
    const existingStudent = studentRows[0] || null;
    if (!existingStudent) {
      const studentPassHash = await bcrypt.hash('Student@123', 10);
      await pool.execute(
        `INSERT INTO Student (name, email, roll_no, password_hash, is_verified, is_active)
         VALUES (?, ?, ?, ?, 1, 1)`,
        ['Sanskar Dumbre', 'student@test.com', '2026-CS-042', studentPassHash]
      );
      console.log('✅ Test Student created: student@test.com / Student@123 (Verified)');
    }

    // 5. Seed Test Developer Account
    const [devRows] = await pool.execute('SELECT * FROM Developer WHERE email = ? LIMIT 1', ['developer@mess.com']);
    const existingDeveloper = devRows[0] || null;
    if (!existingDeveloper) {
      const devPassHash = await bcrypt.hash('Developer@123', 10);
      await pool.execute(
        `INSERT INTO Developer (name, email, password_hash)
         VALUES (?, ?, ?)`,
        ['Super Developer', 'developer@mess.com', devPassHash]
      );
      console.log('✅ Test Developer created: developer@mess.com / Developer@123');
    }

    console.log('\n🎉 Seeding completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    await pool.end();
    process.exit(1);
  }
};

seedData();
