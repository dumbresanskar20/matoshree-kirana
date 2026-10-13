const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

/**
 * Automatically initializes base MySQL tables from database/schema.sql
 * if they do not yet exist in the configured database (e.g. freshly created cPanel MySQL database).
 */
const initBaseSchema = async () => {
  try {
    // Check if core Subscription table already exists
    const [tables] = await pool.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Subscription' 
       LIMIT 1`
    );

    if (tables.length > 0) {
      // Core tables are already in place, ensure Kirana columns & views exist
      await ensureKiranaProductSchema();
      return;
    }

    console.log('[Database Auto-Init] Empty database detected. Initializing all base tables from database/schema.sql...');

    // Locate schema.sql across possible runtime working directories
    const candidatePaths = [
      path.resolve(__dirname, '../../database/schema.sql'),
      path.resolve(__dirname, '../database/schema.sql'),
      path.resolve(__dirname, './schema.sql'),
      path.resolve(__dirname, '../../../database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'),
      path.resolve(process.cwd(), 'backend/database/schema.sql'),
      path.resolve(process.cwd(), 'src/database/schema.sql'),
    ];

    let schemaPath = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }

    if (!schemaPath) {
      console.warn('⚠️ [Database Auto-Init] schema.sql not found in candidate paths. Please import database/schema.sql manually.');
      return;
    }

    console.log(`[Database Auto-Init] Loading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Strip comments
    const sqlClean = schemaSql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*--.*$/gm, '')
      .replace(/^[ \t]*#.*$/gm, '');

    // Split into individual SQL statements
    const statements = sqlClean
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[Database Auto-Init] Executing ${statements.length} schema DDL statements...`);

    // Disable foreign key checks during batch table creation
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
      } catch (stmtErr) {
        console.warn(`[Database Auto-Init Warning] Statement ${i + 1}: ${stmtErr.message}`);
      }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ [Database Auto-Init] All base tables, meal windows, and default settings created successfully!');

    // Synchronize Kirana Product schema and views
    await ensureKiranaProductSchema();
  } catch (err) {
    console.error('⚠️ [Database Auto-Init Error]:', err.message);
  }
};

const addColumnIfNotExists = async (table, column, definition) => {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [table, column]
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`[Kirana Schema] Added column \`${table}\`.\`${column}\``);
    }
  } catch (err) {
    console.warn(`[Kirana Schema Warning] Column ${table}.${column}:`, err.message);
  }
};

const ensureKiranaProductSchema = async () => {
  try {
    // 1. If Product is already a base table (new unified Kirana schema), ensure views point to primary tables
    const [productTables] = await pool.query(
      `SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Product' LIMIT 1`
    );
    if (productTables.length > 0 && productTables[0].TABLE_TYPE === 'BASE TABLE') {
      await pool.query('CREATE OR REPLACE VIEW `Student` AS SELECT * FROM `Customer`').catch(() => {});
      await pool.query('CREATE OR REPLACE VIEW `MenuItem` AS SELECT * FROM `Product`').catch(() => {});
      await pool.query('CREATE OR REPLACE VIEW `MealWindow` AS SELECT `id`, `code` AS `meal_type`, `name` AS `category_name`, `icon`, `display_order`, `start_time`, `end_time`, `custom_note`, `is_active`, `is_full_day`, `updated_at` FROM `Category`').catch(() => {});
      await pool.query('CREATE OR REPLACE VIEW `MenuItemReview` AS SELECT * FROM `ProductReview`').catch(() => {});
      await pool.query('CREATE OR REPLACE VIEW `CustomerOrder` AS SELECT * FROM `Order`').catch(() => {});
      console.log('✅ [Kirana Schema] Base tables verified; compatibility views refreshed.');
      return;
    }

    // Otherwise check legacy MenuItem table
    const [menuTables] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MenuItem' LIMIT 1`
    );
    if (menuTables.length === 0) return;

    // 2. Add Kirana Product fields to MenuItem
    await addColumnIfNotExists('MenuItem', 'category', 'VARCHAR(100) NULL DEFAULT NULL');
    await addColumnIfNotExists('MenuItem', 'unit', 'VARCHAR(50) NOT NULL DEFAULT "piece"');
    await addColumnIfNotExists('MenuItem', 'mrp', 'DECIMAL(10, 2) NULL DEFAULT NULL');
    await addColumnIfNotExists('MenuItem', 'brand', 'VARCHAR(100) NULL DEFAULT NULL');
    await addColumnIfNotExists('MenuItem', 'barcode', 'VARCHAR(100) NULL DEFAULT NULL');
    await addColumnIfNotExists('MenuItem', 'stock_quantity', 'DECIMAL(10, 2) NOT NULL DEFAULT 100.00');
    await addColumnIfNotExists('MenuItem', 'in_stock', 'TINYINT(1) NOT NULL DEFAULT 1');
    await addColumnIfNotExists('MenuItem', 'discount_percentage', 'DECIMAL(5, 2) NOT NULL DEFAULT 0.00');

    // Sync existing category values from meal_type if category is null
    try {
      await pool.query('UPDATE `MenuItem` SET `category` = `meal_type` WHERE `category` IS NULL OR `category` = ""');
      await pool.query('UPDATE `MenuItem` SET `mrp` = `price` WHERE `mrp` IS NULL');
    } catch (_) {}

    // 3. Add Kirana Customer fields to Student
    await addColumnIfNotExists('Student', 'address', 'VARCHAR(500) NULL DEFAULT NULL');
    await addColumnIfNotExists('Student', 'city', 'VARCHAR(100) NULL DEFAULT NULL');
    await addColumnIfNotExists('Student', 'pincode', 'VARCHAR(10) NULL DEFAULT NULL');
    try {
      await pool.query('ALTER TABLE `Student` MODIFY COLUMN `roll_no` VARCHAR(255) NULL');
    } catch (_) {}

    // 4. Add Kirana fields to MealWindow (Category)
    await addColumnIfNotExists('MealWindow', 'category_name', 'VARCHAR(100) NULL DEFAULT NULL');
    await addColumnIfNotExists('MealWindow', 'icon', 'VARCHAR(100) NULL DEFAULT NULL');
    await addColumnIfNotExists('MealWindow', 'display_order', 'INT NOT NULL DEFAULT 0');
    try {
      await pool.query('UPDATE `MealWindow` SET `category_name` = `meal_type` WHERE `category_name` IS NULL');
    } catch (_) {}

    // 5. Add Kirana fields to Order & OrderItem
    await addColumnIfNotExists('Order', 'customer_id', 'INT NULL DEFAULT NULL');
    await addColumnIfNotExists('Order', 'delivery_type', 'VARCHAR(50) NOT NULL DEFAULT "pickup"');
    try {
      await pool.query('UPDATE `Order` SET `customer_id` = `student_id` WHERE `customer_id` IS NULL AND `student_id` IS NOT NULL');
    } catch (_) {}
    await addColumnIfNotExists('OrderItem', 'product_id', 'INT NULL DEFAULT NULL');
    try {
      await pool.query('UPDATE `OrderItem` SET `product_id` = `menu_item_id` WHERE `product_id` IS NULL AND `menu_item_id` IS NOT NULL');
    } catch (_) {}

    // 6. Create or Replace Kirana Views
    await pool.query(`
      CREATE OR REPLACE VIEW \`Product\` AS
      SELECT 
        \`id\`,
        \`name\`,
        \`image_url\`,
        \`cloudinary_public_id\`,
        COALESCE(\`category\`, \`meal_type\`) AS \`category\`,
        \`meal_type\`,
        \`price\`,
        COALESCE(\`mrp\`, \`price\`) AS \`mrp\`,
        \`unit\`,
        \`brand\`,
        \`barcode\`,
        \`stock_quantity\`,
        \`in_stock\`,
        \`is_active\`,
        \`description\`,
        \`has_variants\`,
        \`variants\`,
        \`discount_percentage\`,
        \`created_at\`
      FROM \`MenuItem\`
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW \`Customer\` AS
      SELECT 
        \`id\`,
        \`name\`,
        \`email\`,
        \`phone\`,
        \`roll_no\`,
        \`password_hash\`,
        \`is_verified\`,
        \`otp_code\`,
        \`otp_expires_at\`,
        \`failed_login_attempts\`,
        \`locked_until\`,
        \`is_active\`,
        \`address\`,
        \`city\`,
        \`pincode\`,
        \`created_at\`
      FROM \`Student\`
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW \`Category\` AS
      SELECT 
        \`id\`,
        \`meal_type\` AS \`code\`,
        COALESCE(\`category_name\`, \`meal_type\`) AS \`name\`,
        \`icon\`,
        \`display_order\`,
        \`start_time\`,
        \`end_time\`,
        \`custom_note\`,
        \`is_active\`,
        \`is_full_day\`,
        \`updated_at\`
      FROM \`MealWindow\`
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW \`CustomerOrder\` AS
      SELECT 
        \`id\`,
        COALESCE(\`customer_id\`, \`student_id\`) AS \`customer_id\`,
        \`student_id\`,
        \`customer_name\`,
        \`token_number\`,
        \`formatted_token\`,
        \`meal_type\` AS \`category\`,
        \`status\`,
        \`order_status\`,
        \`order_type\`,
        \`delivery_type\`,
        \`date\`,
        \`daily_sequence\`,
        \`subtotal_amount\`,
        \`discount_percentage\`,
        \`discount_amount\`,
        \`discount_type\`,
        \`total_amount\`,
        \`is_paid\`,
        \`payment_status\`,
        \`payment_method\`,
        \`razorpay_order_id\`,
        \`razorpay_payment_id\`,
        \`address_id\`,
        \`society_name\`,
        \`wing_name\`,
        \`flat_number\`,
        \`landmark\`,
        \`pincode\`,
        \`mobile_number\`,
        \`created_at\`
      FROM \`Order\`
    `);

    console.log('✅ [Kirana Schema] Product, Category, Customer, and CustomerOrder schema & views synchronized successfully!');
  } catch (err) {
    console.warn('[Kirana Schema Warning]:', err.message);
  }
};

module.exports = { initBaseSchema, ensureKiranaProductSchema };
