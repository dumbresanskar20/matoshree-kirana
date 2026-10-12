-- ============================================================================
-- Migration: MealBook - Remove "Pack as Parcel" & Add Delivery Address Support
-- Target Database: mealbook_messdb (or local mess management db)
-- Safe & Idempotent: Does not lose order data, safely checks column existence
-- ============================================================================

-- 1. Create table `user_addresses` if not exists
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `society_name` VARCHAR(150) NOT NULL,
  `wing_name` VARCHAR(50) NOT NULL,
  `flat_number` VARCHAR(30) NOT NULL,
  `landmark` VARCHAR(200) NULL,
  `pincode` CHAR(6) NOT NULL,
  `mobile_number` VARCHAR(15) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_addresses_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add Foreign Key to Student table for user_addresses if not exists
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'user_addresses' 
    AND COLUMN_NAME = 'user_id' 
    AND REFERENCED_TABLE_NAME = 'Student'
);
SET @sql = IF(@fk_exists = 0, 
  'ALTER TABLE `user_addresses` ADD CONSTRAINT `fk_user_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `Student`(`id`) ON DELETE CASCADE;', 
  'SELECT "FK fk_user_addresses_user already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Drop `is_parcel` column from `Order` table if exists
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'is_parcel'
);
SET @sql = IF(@col_exists > 0, 
  'ALTER TABLE `Order` DROP COLUMN `is_parcel`;', 
  'SELECT "Column is_parcel does not exist";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add delivery address snapshot columns to `Order` table
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'address_id'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `address_id` INT NULL;', 
  'SELECT "Column address_id already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'society_name'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `society_name` VARCHAR(150) NULL;', 
  'SELECT "Column society_name already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'wing_name'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `wing_name` VARCHAR(50) NULL;', 
  'SELECT "Column wing_name already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'flat_number'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `flat_number` VARCHAR(30) NULL;', 
  'SELECT "Column flat_number already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'landmark'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `landmark` VARCHAR(200) NULL;', 
  'SELECT "Column landmark already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'pincode'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `pincode` CHAR(6) NULL;', 
  'SELECT "Column pincode already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'mobile_number'
);
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `mobile_number` VARCHAR(15) NULL;', 
  'SELECT "Column mobile_number already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add foreign key for address_id referencing user_addresses
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Order' 
    AND COLUMN_NAME = 'address_id' 
    AND REFERENCED_TABLE_NAME = 'user_addresses'
);
SET @sql = IF(@fk_exists = 0, 
  'ALTER TABLE `Order` ADD CONSTRAINT `fk_order_address` FOREIGN KEY (`address_id`) REFERENCES `user_addresses`(`id`) ON DELETE SET NULL;', 
  'SELECT "FK fk_order_address already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Ensure order_status is VARCHAR(50) so 'out_for_delivery' is fully supported without ENUM constraint errors
ALTER TABLE `Order` MODIFY COLUMN `order_status` VARCHAR(50) NOT NULL DEFAULT 'placed';
