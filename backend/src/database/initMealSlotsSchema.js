const { pool } = require('./db');

/**
 * Ensures that `meal_serving_slots` table exists in MySQL,
 * and migrates existing MealWindow time records into Slot 1 (and empty Slot 2)
 * so existing meals remain fully operational after deployment.
 */
const initMealSlotsSchema = async () => {
  try {
    // 1. Create table `meal_serving_slots`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`meal_serving_slots\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`meal_type\` VARCHAR(50) NOT NULL,
        \`slot_number\` TINYINT NOT NULL,            -- 1 or 2
        \`start_datetime\` DATETIME NULL,
        \`end_datetime\` DATETIME NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 0,
        \`note\` VARCHAR(255) NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_meal_slot\` (\`meal_type\`, \`slot_number\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Check if slots already exist
    const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM `meal_serving_slots`');
    const existingCount = countRows[0]?.cnt || 0;

    if (existingCount === 0) {
      console.log('[Database] Migrating MealWindow timings into meal_serving_slots table...');
      // Migrate Slot 1 from MealWindow
      await pool.query(`
        INSERT INTO \`meal_serving_slots\` (\`meal_type\`, \`slot_number\`, \`start_datetime\`, \`end_datetime\`, \`is_active\`, \`note\`)
        SELECT 
          LOWER(mw.meal_type) AS meal_type,
          1 AS slot_number,
          CONCAT(CURDATE(), ' ', mw.start_time, ':00') AS start_datetime,
          CASE 
            WHEN mw.end_time < mw.start_time THEN CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' ', mw.end_time, ':00')
            ELSE CONCAT(CURDATE(), ' ', mw.end_time, ':00')
          END AS end_datetime,
          CASE WHEN mw.is_active = 0 THEN 0 ELSE 1 END AS is_active,
          mw.custom_note AS note
        FROM \`MealWindow\` mw
        ON DUPLICATE KEY UPDATE \`updated_at\` = CURRENT_TIMESTAMP;
      `);

      // Migrate Slot 2 as inactive & empty
      await pool.query(`
        INSERT INTO \`meal_serving_slots\` (\`meal_type\`, \`slot_number\`, \`start_datetime\`, \`end_datetime\`, \`is_active\`, \`note\`)
        SELECT 
          LOWER(mw.meal_type) AS meal_type,
          2 AS slot_number,
          NULL AS start_datetime,
          NULL AS end_datetime,
          0 AS is_active,
          NULL AS note
        FROM \`MealWindow\` mw
        ON DUPLICATE KEY UPDATE \`updated_at\` = CURRENT_TIMESTAMP;
      `);
      console.log('✅ [Database] Initial meal serving slots seeded from MealWindow.');
    }

    console.log('✅ [Database] meal_serving_slots schema initialized.');
  } catch (error) {
    console.error('⚠️ [Database] Failed to initialize meal_serving_slots schema:', error.message);
  }
};

module.exports = { initMealSlotsSchema };
