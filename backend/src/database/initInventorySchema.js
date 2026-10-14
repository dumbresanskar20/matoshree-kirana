const { pool } = require('./db');

/**
 * Ensures all Inventory-related tables and counters exist in the database.
 * Runs automatically on backend startup to ensure compatibility with
 * cPanel MySQL, local dev, and fresh production deployments.
 */
const initInventorySchema = async () => {
  try {
    // 1. Create InventoryItem table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryItem\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`unique_inventory_id\` VARCHAR(100) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`unit\` ENUM('kg', 'g', 'litre', 'ml', 'piece', 'packet') NOT NULL,
        \`quantity_in_stock\` DECIMAL(10, 3) NOT NULL,
        \`low_stock_threshold\` DECIMAL(10, 3) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'other',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // RecipeItem table skipped (Kirana store manages product stock directly)

    // 3. Create InventoryLog table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryLog\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`inventory_item_id\` INT NOT NULL,
        \`action_type\` VARCHAR(100) NOT NULL,
        \`quantity_changed\` DECIMAL(10, 3) NOT NULL,
        \`admin_user_id\` INT NULL,
        \`order_id\` INT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`inventory_item_id\`) REFERENCES \`InventoryItem\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`admin_user_id\`) REFERENCES \`AdminUser\`(\`id\`) ON DELETE SET NULL,
        FOREIGN KEY (\`order_id\`) REFERENCES \`Order\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Create InventoryCounter table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryCounter\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`last_value\` INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Initialize InventoryCounter row if not present
    await pool.query(`
      INSERT INTO \`InventoryCounter\` (\`id\`, \`last_value\`)
      VALUES (1, 0)
      ON DUPLICATE KEY UPDATE id=id;
    `);

    // 6. Synchronize InventoryCounter.last_value with maximum existing INV-XXXX id
    const [maxRows] = await pool.query(`
      SELECT MAX(CAST(SUBSTRING(unique_inventory_id, 5) AS UNSIGNED)) AS max_inv_num 
      FROM \`InventoryItem\` 
      WHERE unique_inventory_id LIKE 'INV-%'
    `);
    const maxNum = maxRows[0]?.max_inv_num || 0;
    if (maxNum > 0) {
      await pool.query(`
        UPDATE \`InventoryCounter\` 
        SET \`last_value\` = GREATEST(\`last_value\`, ?) 
        WHERE id = 1
      `, [maxNum]);
    }

    // 7. Ensure Product / MenuItem has available_quantity, daily_stock_limit, and is_available
    try {
      const [tableInfo] = await pool.query(
        `SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Product', 'MenuItem')`
      );
      const isProductBase = tableInfo.some((t) => t.TABLE_NAME === 'Product' && t.TABLE_TYPE === 'BASE TABLE');
      const targetStockTable = isProductBase ? 'Product' : 'MenuItem';

      const [menuItemCols] = await pool.query(`SHOW COLUMNS FROM \`${targetStockTable}\` LIKE 'available_quantity'`);
      if (menuItemCols.length === 0) {
        await pool.query(`ALTER TABLE \`${targetStockTable}\` ADD COLUMN \`available_quantity\` INT NOT NULL DEFAULT 100`);
      }

      const [dailyStockCols] = await pool.query(`SHOW COLUMNS FROM \`${targetStockTable}\` LIKE 'daily_stock_limit'`);
      if (dailyStockCols.length === 0) {
        await pool.query(`ALTER TABLE \`${targetStockTable}\` ADD COLUMN \`daily_stock_limit\` INT NOT NULL DEFAULT 100`);
      }

      const [availCols] = await pool.query(`SHOW COLUMNS FROM \`${targetStockTable}\` LIKE 'is_available'`);
      if (availCols.length === 0) {
        await pool.query(`ALTER TABLE \`${targetStockTable}\` ADD COLUMN \`is_available\` TINYINT(1) NOT NULL DEFAULT 1`);
      }
    } catch (_stockColErr) {
      // Column alteration warning handled
    }

    // 8. Create InventoryConfig table for global settings (e.g. menu_stock_tracking_enabled)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryConfig\` (
        \`key_name\` VARCHAR(100) PRIMARY KEY,
        \`value_str\` VARCHAR(255) NOT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      INSERT INTO \`InventoryConfig\` (\`key_name\`, \`value_str\`)
      VALUES ('menu_stock_tracking_enabled', 'false')
      ON DUPLICATE KEY UPDATE key_name = key_name;
    `);

    // 9. Ensure InventoryItem has product_id column linking directly to Product Catalog
    try {
      const [prodIdCols] = await pool.query("SHOW COLUMNS FROM `InventoryItem` LIKE 'product_id'");
      if (prodIdCols.length === 0) {
        await pool.query('ALTER TABLE `InventoryItem` ADD COLUMN `product_id` INT NULL AFTER `unique_inventory_id`');
        try {
          await pool.query('ALTER TABLE `InventoryItem` ADD INDEX `idx_inv_product_id` (`product_id`)');
        } catch (_) {}
        console.log('✅ [Database] Added `product_id` column & index to `InventoryItem`.');
      }
    } catch (_colErr) {
      console.warn('⚠️ [Database] InventoryItem product_id column check warning:', _colErr.message);
    }

    // 10. Automatically sync all products in Product Catalog into Total Inventory
    try {
      await syncCatalogToInventory(pool);
    } catch (syncErr) {
      console.warn('⚠️ [Database] Initial catalog-to-inventory sync warning:', syncErr.message);
    }

    console.log('✅ [Database] Inventory tables, MenuItem stock columns & config verified successfully.');
  } catch (error) {
    console.error('⚠️ [Database] Failed to verify inventory tables:', error.message);
  }
};

const normalizeInventoryUnit = (u) => {
  if (!u) return 'piece';
  const clean = String(u).toLowerCase().trim();
  if (['kg', 'kilo', 'kilogram', 'kgs'].includes(clean)) return 'kg';
  if (['g', 'gm', 'gram', 'grams', 'gms'].includes(clean)) return 'g';
  if (['l', 'litre', 'liter', 'litres', 'liters'].includes(clean)) return 'litre';
  if (['ml', 'millilitre', 'milliliter'].includes(clean)) return 'ml';
  if (['packet', 'pkt', 'packets', 'pack', 'packs'].includes(clean)) return 'packet';
  return 'piece';
};

/**
 * Ensures all items currently in Product Catalog exist in InventoryItem table
 * under the exact same category/section.
 */
const syncCatalogToInventory = async (dbPool = pool) => {
  try {
    const [products] = await dbPool.query('SELECT * FROM Product');
    if (!products || products.length === 0) return;

    const [invItems] = await dbPool.query('SELECT id, product_id, name, unique_inventory_id FROM InventoryItem');
    const invByProdId = new Map();
    const invByName = new Map();

    for (const inv of invItems) {
      if (inv.product_id) invByProdId.set(Number(inv.product_id), inv);
      if (inv.name) invByName.set(inv.name.toLowerCase().trim(), inv);
    }

    const [maxRows] = await dbPool.query(
      "SELECT MAX(CAST(SUBSTRING(unique_inventory_id, 5) AS UNSIGNED)) AS max_id FROM InventoryItem WHERE unique_inventory_id LIKE 'INV-%'"
    );
    let nextNum = (maxRows[0]?.max_id || 0) + 1;

    for (const prod of products) {
      const prodCategory = (prod.meal_type || prod.category || 'groceries').toString().toLowerCase().trim();
      const prodUnit = normalizeInventoryUnit(prod.unit);
      const prodStock = Number(prod.stock_quantity !== undefined ? prod.stock_quantity : (prod.available_quantity || 100));

      const existingByProdId = invByProdId.get(Number(prod.id));
      const existingByName = invByName.get(prod.name.toLowerCase().trim());
      const existing = existingByProdId || existingByName;

      if (existing) {
        // Keep category section and product_id synchronized
        await dbPool.query(
          `UPDATE InventoryItem 
           SET product_id = COALESCE(product_id, ?),
               category = ?,
               is_active = ?
           WHERE id = ?`,
          [prod.id, prodCategory, prod.is_active ? 1 : 0, existing.id]
        );
      } else {
        // Create matching inventory item
        const uniqueId = `INV-${String(nextNum).padStart(4, '0')}`;
        nextNum += 1;

        const [insertRes] = await dbPool.query(
          `INSERT INTO InventoryItem (unique_inventory_id, product_id, name, unit, quantity_in_stock, low_stock_threshold, category, is_active)
           VALUES (?, ?, ?, ?, ?, 5.000, ?, ?)`,
          [uniqueId, prod.id, prod.name.trim(), prodUnit, prodStock, prodCategory, prod.is_active ? 1 : 0]
        );

        if (prodStock > 0) {
          try {
            await dbPool.query(
              `INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, reason)
               VALUES (?, 'restock', ?, 'Initial Sync from Product Catalog')`,
              [insertRes.insertId, prodStock]
            );
          } catch (_) {}
        }
      }
    }

    // Update InventoryCounter to latest sequence value
    await dbPool.query(
      'UPDATE `InventoryCounter` SET `last_value` = GREATEST(`last_value`, ?) WHERE id = 1',
      [nextNum]
    );
  } catch (err) {
    console.warn('[Database] syncCatalogToInventory warning:', err.message);
  }
};

module.exports = { initInventorySchema, syncCatalogToInventory, normalizeInventoryUnit };

