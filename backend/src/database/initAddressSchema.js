const { pool } = require('./db');

/**
 * Initializes the `user_addresses` table and indexes.
 * Supports multiple delivery addresses per student/user.
 * Idempotent: safe to run on every startup.
 */
const initAddressSchema = async () => {
  try {
    // 1. Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_addresses\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`society_name\` VARCHAR(150) NOT NULL,
        \`wing_name\` VARCHAR(50) NOT NULL,
        \`flat_number\` VARCHAR(30) NOT NULL,
        \`landmark\` VARCHAR(200) NULL,
        \`pincode\` CHAR(6) NOT NULL,
        \`mobile_number\` VARCHAR(15) NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user_addresses_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Safely add Foreign Key constraint to Student(id) if not already added
    try {
      const [fkRows] = await pool.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'user_addresses' 
          AND COLUMN_NAME = 'user_id' 
          AND REFERENCED_TABLE_NAME = 'Student'
      `);
      if (!fkRows || fkRows.length === 0) {
        await pool.query(`
          ALTER TABLE \`user_addresses\` 
          ADD CONSTRAINT \`fk_user_addresses_user\` 
          FOREIGN KEY (\`user_id\`) REFERENCES \`Student\`(\`id\`) ON DELETE CASCADE
        `);
      }
    } catch (fkErr) {
      // FK may already exist or table engine differs, log and continue
      console.warn('[Database] Notice on user_addresses FK:', fkErr.message);
    }

    console.log('✅ [Database] user_addresses table initialized.');
  } catch (error) {
    console.error('❌ [Database] Failed to initialize user_addresses schema:', error.message);
  }
};

module.exports = { initAddressSchema };
