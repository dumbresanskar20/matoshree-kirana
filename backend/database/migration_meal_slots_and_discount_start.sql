-- ============================================================================
-- Migration: Meal Serving Slots (Two-Slot Date+Time) & Discount Start Time
-- Database: MySQL / MariaDB (Safe for phpMyAdmin & cPanel)
-- ============================================================================

-- 1. Create table `meal_serving_slots`
CREATE TABLE IF NOT EXISTS `meal_serving_slots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meal_type` VARCHAR(50) NOT NULL,
  `slot_number` TINYINT NOT NULL,            -- 1 or 2
  `start_datetime` DATETIME NULL,
  `end_datetime` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `note` VARCHAR(255) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_meal_slot` (`meal_type`, `slot_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Migrate existing time-only settings from MealWindow into meal_serving_slots
-- Slot 1: Today's date + existing start_time and end_time, is_active = MealWindow.is_active
INSERT INTO `meal_serving_slots` (`meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`)
SELECT 
  LOWER(mw.meal_type) AS meal_type,
  1 AS slot_number,
  CONCAT(CURDATE(), ' ', COALESCE(mw.start_time, '08:00'), ':00') AS start_datetime,
  CASE 
    WHEN mw.end_time < mw.start_time THEN CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' ', COALESCE(mw.end_time, '20:00'), ':00')
    ELSE CONCAT(CURDATE(), ' ', COALESCE(mw.end_time, '20:00'), ':00')
  END AS end_datetime,
  CASE WHEN mw.is_active = 0 THEN 0 ELSE 1 END AS is_active,
  mw.custom_note AS note
FROM `MealWindow` mw
ON DUPLICATE KEY UPDATE
  `updated_at` = CURRENT_TIMESTAMP;

-- Slot 2: Default inactive & empty for every meal type
INSERT INTO `meal_serving_slots` (`meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`)
SELECT 
  LOWER(mw.meal_type) AS meal_type,
  2 AS slot_number,
  NULL AS start_datetime,
  NULL AS end_datetime,
  0 AS is_active,
  NULL AS note
FROM `MealWindow` mw
ON DUPLICATE KEY UPDATE
  `updated_at` = CURRENT_TIMESTAMP;

-- 3. Add `discount_start_time` column to `MealDiscountRule` and `DiscountSettings`
-- Stored procedure checks column existence without PREPARE (avoids MySQL error 1295):
DELIMITER $$

DROP PROCEDURE IF EXISTS AddMealDiscountColumns$$

CREATE PROCEDURE AddMealDiscountColumns()
BEGIN
  -- Check and add discount_start_time to MealDiscountRule
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'MealDiscountRule'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'MealDiscountRule' AND column_name = 'discount_start_time'
    ) THEN
      ALTER TABLE `MealDiscountRule` ADD COLUMN `discount_start_time` VARCHAR(10) NULL DEFAULT NULL AFTER `discount_percentage`;
    END IF;
  END IF;

  -- Check and add start time columns to DiscountSettings
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'DiscountSettings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'DiscountSettings' AND column_name = 'breakfast_early_discount_start_time'
    ) THEN
      ALTER TABLE `DiscountSettings` ADD COLUMN `breakfast_early_discount_start_time` VARCHAR(10) NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'DiscountSettings' AND column_name = 'lunch_early_discount_start_time'
    ) THEN
      ALTER TABLE `DiscountSettings` ADD COLUMN `lunch_early_discount_start_time` VARCHAR(10) NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'DiscountSettings' AND column_name = 'snacks_early_discount_start_time'
    ) THEN
      ALTER TABLE `DiscountSettings` ADD COLUMN `snacks_early_discount_start_time` VARCHAR(10) NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'DiscountSettings' AND column_name = 'dinner_early_discount_start_time'
    ) THEN
      ALTER TABLE `DiscountSettings` ADD COLUMN `dinner_early_discount_start_time` VARCHAR(10) NULL DEFAULT NULL;
    END IF;
  END IF;

  -- Check and add note_datetime to MealWindow
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'MealWindow'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'MealWindow' AND column_name = 'note_datetime'
    ) THEN
      ALTER TABLE `MealWindow` ADD COLUMN `note_datetime` DATETIME NULL DEFAULT NULL;
    END IF;
  END IF;
END$$

DELIMITER ;

CALL AddMealDiscountColumns();
DROP PROCEDURE IF EXISTS AddMealDiscountColumns;
