-- =============================================================
-- Matoshree Kirana Store - Complete Unified Database Schema
-- Production Ready Schema for MySQL / cPanel phpMyAdmin Import
-- Contains all Kirana tables, default data seeds & compatibility views
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- -------------------------------------------------------------
-- Remove legacy canteen / mess tables and views if they exist
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `meal_serving_slots`;
DROP TABLE IF EXISTS `MealDiscountRule`;
DROP TABLE IF EXISTS `DailyTokenCounter`;
DROP TABLE IF EXISTS `RecipeItem`;
DROP VIEW IF EXISTS `meal_serving_slots`;
DROP VIEW IF EXISTS `MealDiscountRule`;
DROP VIEW IF EXISTS `DailyTokenCounter`;
DROP VIEW IF EXISTS `RecipeItem`;

-- -------------------------------------------------------------
-- 1. Table: Customer (Shoppers & Registered Mobile App Users)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Customer` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL UNIQUE,
  `roll_no` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `google_id` VARCHAR(255) NULL,
  `password_hash` VARCHAR(255) NULL,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `otp_code` VARCHAR(10) NULL,
  `otp_expires_at` DATETIME NULL,
  `failed_login_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `reset_token` VARCHAR(255) NULL,
  `reset_token_expires` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `address` VARCHAR(500) NULL,
  `city` VARCHAR(100) NULL,
  `pincode` VARCHAR(10) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_customer_email` (`email`),
  INDEX `idx_customer_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. Table: AdminUser (Store Managers, Admins & Staff)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `AdminUser` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'admin', 'staff') NOT NULL DEFAULT 'staff',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `verification_token` VARCHAR(255) NULL,
  `created_by_id` INT NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3. Table: Category (Kirana Store Categories)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Category` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(100) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `start_time` VARCHAR(10) NOT NULL DEFAULT '00:00',
  `end_time` VARCHAR(10) NOT NULL DEFAULT '23:59',
  `custom_note` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_full_day` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. Table: Product (Kirana Inventory & Product Catalog)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL DEFAULT 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
  `cloudinary_public_id` VARCHAR(255) NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'groceries',
  `meal_type` VARCHAR(50) NOT NULL DEFAULT 'groceries',
  `price` DECIMAL(10, 2) NOT NULL,
  `mrp` DECIMAL(10, 2) NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'piece',
  `brand` VARCHAR(100) NULL,
  `barcode` VARCHAR(100) NULL,
  `stock_quantity` DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  `available_quantity` INT NOT NULL DEFAULT 100,
  `daily_stock_limit` INT NOT NULL DEFAULT 100,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `in_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `description` TEXT NULL,
  `has_variants` TINYINT(1) NOT NULL DEFAULT 0,
  `variants` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_product_category` (`category`, `is_active`),
  INDEX `idx_product_meal_type` (`meal_type`, `is_active`),
  INDEX `idx_product_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. Table: user_addresses (Customer Delivery Addresses)
-- -------------------------------------------------------------
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
  INDEX `idx_user_addresses_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 6. Table: Order (Kirana Store Orders & Home Deliveries)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Order` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NULL,
  `student_id` INT NULL,
  `customer_name` VARCHAR(255) NULL,
  `token_number` VARCHAR(50) NOT NULL DEFAULT '',
  `formatted_token` VARCHAR(50) NULL DEFAULT '',
  `category` VARCHAR(50) NOT NULL DEFAULT 'groceries',
  `meal_type` VARCHAR(50) NOT NULL DEFAULT 'groceries',
  `status` VARCHAR(50) NOT NULL DEFAULT 'placed',
  `order_status` VARCHAR(50) NOT NULL DEFAULT 'placed',
  `order_type` VARCHAR(20) NOT NULL DEFAULT 'delivery',
  `delivery_type` VARCHAR(50) NOT NULL DEFAULT 'delivery',
  `date` VARCHAR(10) NOT NULL DEFAULT '',
  `daily_sequence` INT NOT NULL DEFAULT 1,
  `subtotal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_type` VARCHAR(50) NOT NULL DEFAULT 'none',
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `is_paid` TINYINT(1) NOT NULL DEFAULT 0,
  `payment_status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `razorpay_order_id` VARCHAR(255) NULL,
  `razorpay_payment_id` VARCHAR(255) NULL,
  `razorpay_signature` VARCHAR(255) NULL,
  `address_id` INT NULL,
  `society_name` VARCHAR(150) NULL,
  `wing_name` VARCHAR(50) NULL,
  `flat_number` VARCHAR(30) NULL,
  `landmark` VARCHAR(200) NULL,
  `pincode` CHAR(6) NULL,
  `mobile_number` VARCHAR(15) NULL,
  `collected_at` DATETIME NULL,
  `collected_by_admin_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL,
  INDEX `idx_order_status` (`order_status`),
  INDEX `idx_order_date` (`date`),
  INDEX `idx_order_customer` (`customer_id`),
  FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `user_addresses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`collected_by_admin_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 7. Table: OrderItem (Order Line Items)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_id` INT NULL,
  `menu_item_id` INT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `variant_name` VARCHAR(100) NULL,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 8. Table: ProductReview (Customer Product Reviews & Ratings)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ProductReview` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `student_id` INT NULL,
  `product_id` INT NULL,
  `menu_item_id` INT NULL,
  `product_name` VARCHAR(255) NOT NULL DEFAULT '',
  `menu_item_name` VARCHAR(255) NOT NULL DEFAULT '',
  `category` VARCHAR(50) NOT NULL DEFAULT 'groceries',
  `meal_type` VARCHAR(50) NOT NULL DEFAULT 'groceries',
  `rating` TINYINT NOT NULL DEFAULT 5,
  `review_text` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_review_order` (`order_id`),
  INDEX `idx_review_customer` (`customer_id`),
  INDEX `idx_review_product` (`product_id`),
  FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 9. Table: InventoryItem (Warehouse Stock & Bulk Items)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `unique_inventory_id` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `unit` ENUM('kg', 'g', 'litre', 'ml', 'piece', 'packet') NOT NULL,
  `quantity_in_stock` DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
  `low_stock_threshold` DECIMAL(10, 3) NOT NULL DEFAULT 5.000,
  `category` VARCHAR(100) NOT NULL DEFAULT 'groceries',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_inventory_name` (`name`),
  INDEX `idx_unique_inventory_id` (`unique_inventory_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 10. Table: InventoryLog (Inventory Movement Audit Log)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `inventory_item_id` INT NOT NULL,
  `action_type` VARCHAR(100) NOT NULL,
  `quantity_changed` DECIMAL(10, 3) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `admin_user_id` INT NULL,
  `order_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`inventory_item_id`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_user_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 11. Table: InventoryConfig (Inventory Configuration Key-Values)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryConfig` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key_name` VARCHAR(100) NOT NULL UNIQUE,
  `value_str` VARCHAR(255) NOT NULL,
  `enable_menu_stock_tracking` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 12. Table: InventoryCounter (Sequential Unique ID Tracker)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryCounter` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `last_value` INT NOT NULL DEFAULT 0,
  `item_type` VARCHAR(50) NULL UNIQUE,
  `last_count` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 13. Table: DiscountSettings (Promotional & Customer Discounts)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `DiscountSettings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `new_user_discount_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `new_user_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `new_user_discount_days` INT NOT NULL DEFAULT 5,
  `breakfast_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `breakfast_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `breakfast_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '09:00',
  `lunch_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `lunch_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `lunch_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '12:00',
  `snacks_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `snacks_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `snacks_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '17:00',
  `dinner_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `dinner_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `dinner_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '20:30',
  `breakfast_early_discount_start_time` VARCHAR(10) NULL,
  `lunch_early_discount_start_time` VARCHAR(10) NULL,
  `snacks_early_discount_start_time` VARCHAR(10) NULL,
  `dinner_early_discount_start_time` VARCHAR(10) NULL,
  `updated_by` INT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`updated_by`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 14. Table: DiscountAuditLog (Audit History for Discounts)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `DiscountAuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_user_id` INT NULL,
  `action` VARCHAR(50) NOT NULL DEFAULT 'update_settings',
  `changed_fields` TEXT NOT NULL,
  `previous_values` TEXT NOT NULL,
  `new_values` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_user_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 15. Table: Subscription & Multi-Tenant Management
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Subscription` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_type` VARCHAR(50) NOT NULL DEFAULT 'monthly',
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
  `subscription_start_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subscription_end_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('active', 'expired', 'trial') NOT NULL DEFAULT 'active',
  `last_payment_amount` DECIMAL(10, 2) NULL,
  `last_payment_date` DATETIME NULL,
  `razorpay_subscription_id` VARCHAR(255) NULL,
  `razorpay_payment_id` VARCHAR(255) NULL,
  `dev_razorpay_payment_id` VARCHAR(255) NULL,
  `is_superadmin_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SuperAdmin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Plan` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `billing_cycle` ENUM('monthly', 'quarterly', 'six_month', 'yearly') NOT NULL DEFAULT 'monthly',
  `duration_days` INT NOT NULL DEFAULT 30,
  `price` DECIMAL(10, 2) NOT NULL,
  `trial_days` INT NOT NULL DEFAULT 14,
  `features` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PlanPriceHistory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id` INT NOT NULL,
  `old_price` DECIMAL(10, 2) NOT NULL,
  `new_price` DECIMAL(10, 2) NOT NULL,
  `changed_by_admin_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`plan_id`) REFERENCES `Plan`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Client` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `contact_email` VARCHAR(255) NOT NULL,
  `contact_phone` VARCHAR(20) NULL,
  `address` VARCHAR(500) NULL,
  `plan_id` INT NULL,
  `status` ENUM('active', 'trial', 'suspended', 'expired') NOT NULL DEFAULT 'active',
  `trial_ends_at` DATETIME NULL,
  `subscription_price` DECIMAL(10, 2) NULL,
  `subscription_started_at` DATETIME NULL,
  `subscription_ends_at` DATETIME NULL,
  `suspended_at` DATETIME NULL,
  `is_admin_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `is_student_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`plan_id`) REFERENCES `Plan`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SuperAdminAuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `super_admin_id` INT NULL,
  `super_admin_email` VARCHAR(255) NULL,
  `target_client_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `metadata` JSON NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `module` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(100) NULL,
  `browser` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- SEED DATA SECTION
-- =============================================================

-- -------------------------------------------------------------
-- Seed: AdminUser
-- -------------------------------------------------------------
INSERT INTO `AdminUser` (`id`, `username`, `email`, `password_hash`, `role`, `is_active`, `is_verified`, `verification_token`, `created_by_id`, `last_login_at`, `created_at`) 
VALUES 
(1, 'admin', 'admin@dypcoei.edu.in', '$2a$10$w8T0U1B2jA5GZlY59/gBDe42rO1w0h/U6.hBq12Vj6B2L.m8K9f62', 'super_admin', 1, 1, NULL, NULL, NULL, '2026-10-12 11:11:10'),
(2, 'Matoshree Kirana', 'admin@mess.com', '$2a$10$tko3b3QY6tj244EnhK48G.b0YHYdHg.Ytvq8Geb63PRa2oOzN01Ui', 'admin', 1, 1, NULL, NULL, '2026-10-12 21:11:25', '2026-10-12 12:29:36')
ON DUPLICATE KEY UPDATE username = VALUES(username);

-- -------------------------------------------------------------
-- Seed: SuperAdmin
-- -------------------------------------------------------------
INSERT INTO `SuperAdmin` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`, `last_login_at`, `created_at`, `updated_at`) 
VALUES 
(1, 'Master Super Admin', 'superadmin@canteen.com', '$2a$10$TW3VcnGtH2NDuDupvMuDM.tT/G/TdTPkZ8DRFyTwocP6SxMim6AvG', 'super_admin', 1, NULL, '2026-10-12 11:11:16', '2026-10-12 11:11:16')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- -------------------------------------------------------------
-- Seed: SaaS Plans
-- -------------------------------------------------------------
INSERT INTO `Plan` (`id`, `name`, `code`, `billing_cycle`, `duration_days`, `price`, `trial_days`, `features`, `is_active`, `created_at`, `updated_at`) 
VALUES 
(1, 'Monthly Standard', 'monthly', 'monthly', 30, '1000.00', 14, 'Unlimited Orders,Live Dashboard Screen,Inventory Stock Management,Customer Delivery Tracking,Email Support', 1, '2026-10-12 11:11:15', '2026-10-12 11:11:15'),
(2, 'Quarterly Pro', 'quarterly', 'quarterly', 90, '2700.00', 14, 'All Monthly Features,10% Plan Discount,Full Stock Auditing,Order History & Analytics,Priority Support', 1, '2026-10-12 11:11:15', '2026-10-12 11:11:15'),
(3, 'Half-Yearly Elite', 'six_month', 'six_month', 180, '5000.00', 14, 'All Quarterly Features,16% Plan Discount,Automated Invoice Logging,Multi-Staff Roles,24/7 Dedicated Support', 1, '2026-10-12 11:11:15', '2026-10-12 11:11:15'),
(4, 'Annual Enterprise', 'yearly', 'yearly', 365, '9000.00', 30, 'All Half-Yearly Features,25% Discount (3 Months Free),Custom Store Branding,Unlimited Staff Accounts,Dedicated Manager', 1, '2026-10-12 11:11:15', '2026-10-12 11:11:15')
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price);

-- -------------------------------------------------------------
-- Seed: Client (Matoshree Kirana)
-- -------------------------------------------------------------
INSERT INTO `Client` (`id`, `name`, `slug`, `contact_email`, `contact_phone`, `address`, `plan_id`, `status`, `trial_ends_at`, `subscription_price`, `subscription_started_at`, `subscription_ends_at`, `suspended_at`, `is_admin_enabled`, `is_student_enabled`, `notes`, `created_at`, `updated_at`) 
VALUES 
(1, 'Matoshree Kirana', 'matoshree-kirana', 'contact@matoshree-kirana.mealbook.in', '+91 9876543210', 'Matoshree Kirana Store, Main Road', 1, 'active', '2026-11-11 16:41:16', '1000.00', '2026-10-12 16:41:16', '2027-10-12 16:41:16', NULL, 1, 1, 'Primary Kirana store client.', '2026-10-12 11:11:16', '2026-10-12 13:01:38')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- -------------------------------------------------------------
-- Seed: Subscription
-- -------------------------------------------------------------
INSERT INTO `Subscription` (`id`, `plan_type`, `subscription_start_date`, `subscription_end_date`, `status`, `last_payment_amount`, `last_payment_date`, `dev_razorpay_payment_id`, `created_at`, `updated_at`) 
VALUES 
(1, 'monthly', '2026-10-12 12:29:10', '2027-10-12 12:29:10', 'active', '1000.00', '2026-10-12 12:29:10', 'init_dev_seed', '2026-10-12 12:29:10', '2026-10-12 12:29:10')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- -------------------------------------------------------------
-- Seed: DiscountSettings
-- -------------------------------------------------------------
INSERT INTO `DiscountSettings` (`id`, `new_user_discount_enabled`, `new_user_discount_percentage`, `new_user_discount_days`, `breakfast_early_discount_enabled`, `breakfast_early_discount_percentage`, `breakfast_early_discount_cutoff_time`, `lunch_early_discount_enabled`, `lunch_early_discount_percentage`, `lunch_early_discount_cutoff_time`, `snacks_early_discount_enabled`, `snacks_early_discount_percentage`, `snacks_early_discount_cutoff_time`, `dinner_early_discount_enabled`, `dinner_early_discount_percentage`, `dinner_early_discount_cutoff_time`, `updated_by`, `updated_at`, `created_at`) 
VALUES 
(1, 1, '10.00', 5, 0, '0.00', '09:00', 0, '0.00', '12:00', 0, '0.00', '17:00', 0, '0.00', '20:30', NULL, '2026-10-12 11:11:10', '2026-10-12 11:11:10')
ON DUPLICATE KEY UPDATE id = id;

-- -------------------------------------------------------------
-- Seed: InventoryConfig & InventoryCounter
-- -------------------------------------------------------------
INSERT INTO `InventoryConfig` (`id`, `key_name`, `value_str`, `enable_menu_stock_tracking`) 
VALUES (1, 'menu_stock_tracking_enabled', 'false', 0)
ON DUPLICATE KEY UPDATE value_str = VALUES(value_str);

INSERT INTO `InventoryCounter` (`id`, `last_value`, `item_type`, `last_count`) 
VALUES (1, 0, 'inventory', 0)
ON DUPLICATE KEY UPDATE id = id;

-- -------------------------------------------------------------
-- Seed: Category (Kirana Product Categories)
-- -------------------------------------------------------------
INSERT INTO `Category` (`id`, `code`, `name`, `icon`, `display_order`, `is_active`, `is_full_day`) VALUES
(1,  'groceries',        'Groceries & Staples',   '🌾', 1, 1, 1),
(2,  'flours_grains',    'Atta, Flours & Grains', '🍞', 2, 1, 1),
(3,  'dals_pulses',      'Dals & Pulses',         '🥣', 3, 1, 1),
(4,  'oils_ghee',        'Edible Oils & Ghee',    '🛢️', 4, 1, 1),
(5,  'spices_masalas',   'Spices & Masalas',      '🌶️', 5, 1, 1),
(6,  'dairy_eggs',       'Dairy & Eggs',          '🥛', 6, 1, 1),
(7,  'snacks_beverages', 'Snacks & Beverages',    '☕', 7, 1, 1),
(8,  'personal_care',    'Personal Care',         '🧼', 8, 1, 1),
(9,  'household',        'Cleaning & Household',  '🧹', 9, 1, 1),
(10, 'daily_essentials', 'Daily Essentials',      '🛒', 10, 1, 1),
(11, 'breakfast',        'Breakfast Essentials',  '🍳', 11, 1, 1),
(12, 'lunch',            'Lunch Essentials',      '🍛', 12, 1, 1),
(13, 'snacks',           'Evening Snacks',        '🍪', 13, 1, 1),
(14, 'dinner',           'Dinner Essentials',     '🍲', 14, 1, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon);

-- -------------------------------------------------------------
-- Seed: Product (Essential Kirana Starter Catalog)
-- -------------------------------------------------------------
INSERT INTO `Product` (`id`, `name`, `image_url`, `category`, `meal_type`, `price`, `mrp`, `unit`, `brand`, `stock_quantity`, `available_quantity`, `daily_stock_limit`, `is_available`, `in_stock`, `discount_percentage`, `is_active`, `description`) VALUES
(1,  'Aashirvaad Superior MP Atta (10kg)', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 'flours_grains', 'flours_grains', 440.00, 480.00, 'packet', 'Aashirvaad', 50.00, 50, 100, 1, 1, 8.33, 1, '100% pure whole wheat flour processed with traditional chakki process.'),
(2,  'Fortune Sunlite Refined Sunflower Oil (1L)', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80', 'oils_ghee', 'oils_ghee', 135.00, 160.00, 'packet', 'Fortune', 60.00, 60, 100, 1, 1, 15.62, 1, 'Light and healthy refined sunflower oil enriched with vitamins A & D.'),
(3,  'Tata Salt Iodized (1kg)', 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?auto=format&fit=crop&w=600&q=80', 'groceries', 'groceries', 28.00, 30.00, 'packet', 'Tata', 120.00, 120, 200, 1, 1, 6.67, 1, 'Vacuum evaporated iodized salt. Desh Ka Namak.'),
(4,  'Tata Sampann Unpolished Toor Dal (1kg)', 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?auto=format&fit=crop&w=600&q=80', 'dals_pulses', 'dals_pulses', 165.00, 185.00, 'packet', 'Tata Sampann', 40.00, 40, 100, 1, 1, 10.81, 1, 'Wholesome unpolished arhar dal rich in natural protein.'),
(5,  'Everest Turmeric / Haldi Powder (200g)', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80', 'spices_masalas', 'spices_masalas', 62.00, 70.00, 'packet', 'Everest', 80.00, 80, 150, 1, 1, 11.43, 1, 'Pure and aromatic Indian turmeric ground from select Salem turmeric roots.'),
(6,  'Amul Taaza Fresh Homogenised Toned Milk (1L)', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80', 'dairy_eggs', 'dairy_eggs', 74.00, 76.00, 'packet', 'Amul', 90.00, 90, 150, 1, 1, 2.63, 1, 'UHT treated long life toned milk with zero preservatives.'),
(7,  'Parle-G Original Glucose Biscuits (800g Family Pack)', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80', 'snacks_beverages', 'snacks_beverages', 75.00, 85.00, 'packet', 'Parle', 100.00, 100, 200, 1, 1, 11.76, 1, 'India\'s favourite glucose biscuits packed with energy and taste.'),
(8,  'Brooke Bond Red Label Tea (500g)', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', 'snacks_beverages', 'snacks_beverages', 240.00, 270.00, 'packet', 'Brooke Bond', 45.00, 45, 100, 1, 1, 11.11, 1, 'Blend of leaves infused with red rich taste and refreshing aroma.'),
(9,  'Dettol Original Liquid Handwash Refill (750ml)', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80', 'personal_care', 'personal_care', 99.00, 119.00, 'packet', 'Dettol', 35.00, 35, 80, 1, 1, 16.81, 1, 'Antibacterial liquid hand soap refill with pine fragrance.'),
(10, 'Surf Excel Easy Wash Detergent Powder (1kg)', 'https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80', 'household', 'household', 140.00, 155.00, 'packet', 'Surf Excel', 50.00, 50, 100, 1, 1, 9.68, 1, 'Superior stain removal detergent powder for everyday clothes.'),
(11, 'India Gate Premium Basmati Rice (5kg)', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80', 'flours_grains', 'flours_grains', 420.00, 475.00, 'packet', 'India Gate', 30.00, 30, 80, 1, 1, 11.58, 1, 'Aged long grain aromatic Basmati rice for biryani and pulav.'),
(12, 'Madhur Pure & Hygienic Sugar / Sakhar (1kg)', 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80', 'groceries', 'groceries', 48.00, 55.00, 'packet', 'Madhur', 80.00, 80, 150, 1, 1, 12.73, 1, 'Untouched by hand, sparkling white sulfur-free refined sugar.'),
(13, 'Amul Pure Ghee (1L Tin)', 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=600&q=80', 'oils_ghee', 'oils_ghee', 590.00, 640.00, 'piece', 'Amul', 25.00, 25, 50, 1, 1, 7.81, 1, 'Traditional clarified butter made from fresh dairy milk cream.'),
(14, 'Maggi 2-Minute Masala Instant Noodles (420g Pack of 6)', 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80', 'snacks_beverages', 'snacks_beverages', 84.00, 96.00, 'packet', 'Nestle Maggi', 70.00, 70, 120, 1, 1, 12.50, 1, 'Classic Indian masala noodles seasoned with authentic spices.')
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price);

-- =============================================================
-- BACKWARD-COMPATIBILITY VIEWS
-- Guarantees that any legacy endpoints querying Student,
-- MenuItem, MealWindow, MenuItemReview or CustomerOrder continue working.
-- =============================================================
DROP VIEW IF EXISTS `Student`;
CREATE OR REPLACE VIEW `Student` AS 
SELECT * FROM `Customer`;

DROP VIEW IF EXISTS `MenuItem`;
CREATE OR REPLACE VIEW `MenuItem` AS 
SELECT * FROM `Product`;

DROP VIEW IF EXISTS `MealWindow`;
CREATE OR REPLACE VIEW `MealWindow` AS 
SELECT 
  `id`, 
  `code` AS `meal_type`, 
  `name` AS `category_name`, 
  `icon`, 
  `display_order`, 
  `start_time`, 
  `end_time`, 
  `custom_note`, 
  `is_active`, 
  `is_full_day`, 
  `updated_at` 
FROM `Category`;

DROP VIEW IF EXISTS `MenuItemReview`;
CREATE OR REPLACE VIEW `MenuItemReview` AS 
SELECT * FROM `ProductReview`;

DROP VIEW IF EXISTS `CustomerOrder`;
CREATE OR REPLACE VIEW `CustomerOrder` AS 
SELECT * FROM `Order`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- Schema Import Complete: Matoshree Kirana Store Ready!
-- =============================================================
