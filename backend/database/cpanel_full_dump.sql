-- Full Backup from Aiven for cPanel import
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES';

DROP TABLE IF EXISTS `AdminUser`;
CREATE TABLE "AdminUser" (
  "id" int NOT NULL AUTO_INCREMENT,
  "username" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" enum('super_admin','admin','staff') NOT NULL DEFAULT 'staff',
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "is_verified" tinyint(1) NOT NULL DEFAULT '1',
  "verification_token" varchar(255) DEFAULT NULL,
  "created_by_id" int DEFAULT NULL,
  "last_login_at" datetime DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "username" ("username"),
  UNIQUE KEY "email" ("email"),
  KEY "created_by_id" ("created_by_id"),
  CONSTRAINT "AdminUser_ibfk_1" FOREIGN KEY ("created_by_id") REFERENCES "AdminUser" ("id") ON DELETE SET NULL
);

INSERT INTO `AdminUser` (`id`, `username`, `email`, `password_hash`, `role`, `is_active`, `is_verified`, `verification_token`, `created_by_id`, `last_login_at`, `created_at`) VALUES (1, 'admin', 'admin@dypcoei.edu.in', '$2a$10$w8T0U1B2jA5GZlY59/gBDe42rO1w0h/U6.hBq12Vj6B2L.m8K9f62', 'super_admin', true, true, NULL, NULL, NULL, '2026-10-12 11:11:10');
INSERT INTO `AdminUser` (`id`, `username`, `email`, `password_hash`, `role`, `is_active`, `is_verified`, `verification_token`, `created_by_id`, `last_login_at`, `created_at`) VALUES (2, 'Matoshree Kirana', 'admin@mess.com', '$2a$10$tko3b3QY6tj244EnhK48G.b0YHYdHg.Ytvq8Geb63PRa2oOzN01Ui', 'admin', true, true, NULL, NULL, '2026-10-12 21:11:25', '2026-10-12 12:29:36');

DROP TABLE IF EXISTS `AuditLog`;
CREATE TABLE "AuditLog" (
  "id" int NOT NULL AUTO_INCREMENT,
  "user_email" varchar(255) NOT NULL,
  "action" varchar(255) NOT NULL,
  "module" varchar(255) NOT NULL,
  "ip_address" varchar(100) DEFAULT NULL,
  "browser" varchar(255) DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS `Client`;
CREATE TABLE "Client" (
  "id" int NOT NULL AUTO_INCREMENT,
  "name" varchar(255) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "contact_email" varchar(255) NOT NULL,
  "contact_phone" varchar(20) DEFAULT NULL,
  "address" varchar(500) DEFAULT NULL,
  "plan_id" int DEFAULT NULL,
  "status" enum('active','trial','suspended','expired') NOT NULL DEFAULT 'trial',
  "trial_ends_at" datetime DEFAULT NULL,
  "subscription_price" decimal(10,2) DEFAULT NULL,
  "subscription_started_at" datetime DEFAULT NULL,
  "subscription_ends_at" datetime DEFAULT NULL,
  "suspended_at" datetime DEFAULT NULL,
  "is_admin_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "is_student_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "notes" text,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "slug" ("slug"),
  KEY "plan_id" ("plan_id"),
  CONSTRAINT "Client_ibfk_1" FOREIGN KEY ("plan_id") REFERENCES "Plan" ("id") ON DELETE SET NULL
);

INSERT INTO `Client` (`id`, `name`, `slug`, `contact_email`, `contact_phone`, `address`, `plan_id`, `status`, `trial_ends_at`, `subscription_price`, `subscription_started_at`, `subscription_ends_at`, `suspended_at`, `is_admin_enabled`, `is_student_enabled`, `notes`, `created_at`, `updated_at`) VALUES (1, 'Matoshree Kirana', 'matoshree-kirana', 'contact@matoshree-kirana.mealbook.in', '+91 9876543210', 'Matoshree Kirana Store, Main Road', 1, 'active', '2026-11-11 16:41:16', '1000.00', '2026-10-12 16:41:16', '2027-10-12 16:41:16', NULL, true, true, 'Primary restaurant client.', '2026-10-12 11:11:16', '2026-10-12 13:01:38');

DROP TABLE IF EXISTS `DailyTokenCounter`;
CREATE TABLE "DailyTokenCounter" (
  "id" int NOT NULL AUTO_INCREMENT,
  "meal_type" varchar(50) NOT NULL,
  "date" varchar(10) NOT NULL,
  "last_token_number" int NOT NULL DEFAULT '0',
  PRIMARY KEY ("id"),
  UNIQUE KEY "meal_type_date" ("meal_type","date")
);

DROP TABLE IF EXISTS `DiscountAuditLog`;
CREATE TABLE "DiscountAuditLog" (
  "id" int NOT NULL AUTO_INCREMENT,
  "admin_user_id" int DEFAULT NULL,
  "action" varchar(50) NOT NULL DEFAULT 'update_settings',
  "changed_fields" text NOT NULL,
  "previous_values" text NOT NULL,
  "new_values" text NOT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "admin_user_id" ("admin_user_id"),
  CONSTRAINT "DiscountAuditLog_ibfk_1" FOREIGN KEY ("admin_user_id") REFERENCES "AdminUser" ("id") ON DELETE SET NULL
);

DROP TABLE IF EXISTS `DiscountSettings`;
CREATE TABLE "DiscountSettings" (
  "id" int NOT NULL AUTO_INCREMENT,
  "new_user_discount_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "new_user_discount_percentage" decimal(5,2) NOT NULL DEFAULT '10.00',
  "new_user_discount_days" int NOT NULL DEFAULT '5',
  "breakfast_early_discount_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "breakfast_early_discount_percentage" decimal(5,2) NOT NULL DEFAULT '10.00',
  "breakfast_early_discount_cutoff_time" varchar(10) NOT NULL DEFAULT '09:00',
  "lunch_early_discount_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "lunch_early_discount_percentage" decimal(5,2) NOT NULL DEFAULT '10.00',
  "lunch_early_discount_cutoff_time" varchar(10) NOT NULL DEFAULT '12:00',
  "snacks_early_discount_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "snacks_early_discount_percentage" decimal(5,2) NOT NULL DEFAULT '10.00',
  "snacks_early_discount_cutoff_time" varchar(10) NOT NULL DEFAULT '17:00',
  "dinner_early_discount_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "dinner_early_discount_percentage" decimal(5,2) NOT NULL DEFAULT '10.00',
  "dinner_early_discount_cutoff_time" varchar(10) NOT NULL DEFAULT '20:30',
  "updated_by" int DEFAULT NULL,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "breakfast_early_discount_start_time" varchar(10) DEFAULT NULL,
  "lunch_early_discount_start_time" varchar(10) DEFAULT NULL,
  "snacks_early_discount_start_time" varchar(10) DEFAULT NULL,
  "dinner_early_discount_start_time" varchar(10) DEFAULT NULL,
  PRIMARY KEY ("id"),
  KEY "updated_by" ("updated_by"),
  CONSTRAINT "DiscountSettings_ibfk_1" FOREIGN KEY ("updated_by") REFERENCES "AdminUser" ("id") ON DELETE SET NULL
);

INSERT INTO `DiscountSettings` (`id`, `new_user_discount_enabled`, `new_user_discount_percentage`, `new_user_discount_days`, `breakfast_early_discount_enabled`, `breakfast_early_discount_percentage`, `breakfast_early_discount_cutoff_time`, `lunch_early_discount_enabled`, `lunch_early_discount_percentage`, `lunch_early_discount_cutoff_time`, `snacks_early_discount_enabled`, `snacks_early_discount_percentage`, `snacks_early_discount_cutoff_time`, `dinner_early_discount_enabled`, `dinner_early_discount_percentage`, `dinner_early_discount_cutoff_time`, `updated_by`, `updated_at`, `created_at`, `breakfast_early_discount_start_time`, `lunch_early_discount_start_time`, `snacks_early_discount_start_time`, `dinner_early_discount_start_time`) VALUES (1, true, '10.00', 5, true, '10.00', '09:00', true, '10.00', '12:00', true, '10.00', '17:00', true, '10.00', '20:30', NULL, '2026-10-12 11:11:10', '2026-10-12 11:11:10', NULL, NULL, NULL, NULL);

DROP TABLE IF EXISTS `InventoryConfig`;
CREATE TABLE "InventoryConfig" (
  "key_name" varchar(100) NOT NULL,
  "value_str" varchar(255) NOT NULL,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("key_name")
);

INSERT INTO `InventoryConfig` (`key_name`, `value_str`, `updated_at`) VALUES ('menu_stock_tracking_enabled', 'false', '2026-10-12 11:11:14');

DROP TABLE IF EXISTS `InventoryCounter`;
CREATE TABLE "InventoryCounter" (
  "id" int NOT NULL AUTO_INCREMENT,
  "last_value" int NOT NULL DEFAULT '0',
  PRIMARY KEY ("id")
);

INSERT INTO `InventoryCounter` (`id`, `last_value`) VALUES (1, 0);

DROP TABLE IF EXISTS `InventoryItem`;
CREATE TABLE "InventoryItem" (
  "id" int NOT NULL AUTO_INCREMENT,
  "unique_inventory_id" varchar(100) NOT NULL,
  "name" varchar(255) NOT NULL,
  "unit" enum('kg','g','litre','ml','piece','packet') NOT NULL,
  "quantity_in_stock" decimal(10,3) NOT NULL,
  "low_stock_threshold" decimal(10,3) NOT NULL,
  "category" varchar(100) NOT NULL DEFAULT 'other',
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "unique_inventory_id" ("unique_inventory_id")
);

DROP TABLE IF EXISTS `InventoryLog`;
CREATE TABLE "InventoryLog" (
  "id" int NOT NULL AUTO_INCREMENT,
  "inventory_item_id" int NOT NULL,
  "action_type" varchar(100) NOT NULL,
  "quantity_changed" decimal(10,3) NOT NULL,
  "admin_user_id" int DEFAULT NULL,
  "order_id" int DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "inventory_item_id" ("inventory_item_id"),
  KEY "admin_user_id" ("admin_user_id"),
  KEY "order_id" ("order_id"),
  CONSTRAINT "InventoryLog_ibfk_1" FOREIGN KEY ("inventory_item_id") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "InventoryLog_ibfk_2" FOREIGN KEY ("admin_user_id") REFERENCES "AdminUser" ("id") ON DELETE SET NULL,
  CONSTRAINT "InventoryLog_ibfk_3" FOREIGN KEY ("order_id") REFERENCES "Order" ("id") ON DELETE SET NULL
);

DROP TABLE IF EXISTS `MealDiscountRule`;
CREATE TABLE "MealDiscountRule" (
  "id" int NOT NULL AUTO_INCREMENT,
  "meal_type" varchar(50) NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "discount_percentage" decimal(5,2) NOT NULL DEFAULT '10.00',
  "discount_start_time" varchar(10) DEFAULT NULL,
  "cutoff_time" varchar(10) NOT NULL DEFAULT '12:00',
  "is_enabled" tinyint(1) NOT NULL DEFAULT '1',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "meal_type" ("meal_type")
);

INSERT INTO `MealDiscountRule` (`id`, `meal_type`, `display_name`, `discount_percentage`, `discount_start_time`, `cutoff_time`, `is_enabled`, `created_at`, `updated_at`) VALUES (1, 'breakfast', 'Early Breakfast Discount', '10.00', NULL, '09:00', true, '2026-10-12 11:11:10', '2026-10-12 11:11:10');
INSERT INTO `MealDiscountRule` (`id`, `meal_type`, `display_name`, `discount_percentage`, `discount_start_time`, `cutoff_time`, `is_enabled`, `created_at`, `updated_at`) VALUES (2, 'lunch', 'Early Lunch Discount', '10.00', NULL, '12:00', true, '2026-10-12 11:11:10', '2026-10-12 11:11:10');
INSERT INTO `MealDiscountRule` (`id`, `meal_type`, `display_name`, `discount_percentage`, `discount_start_time`, `cutoff_time`, `is_enabled`, `created_at`, `updated_at`) VALUES (3, 'snacks', 'Early Snacks Discount', '10.00', NULL, '17:00', true, '2026-10-12 11:11:10', '2026-10-12 11:11:10');
INSERT INTO `MealDiscountRule` (`id`, `meal_type`, `display_name`, `discount_percentage`, `discount_start_time`, `cutoff_time`, `is_enabled`, `created_at`, `updated_at`) VALUES (4, 'dinner', 'Early Dinner Discount', '10.00', NULL, '20:30', true, '2026-10-12 11:11:10', '2026-10-12 11:11:10');

DROP TABLE IF EXISTS `MealWindow`;
CREATE TABLE "MealWindow" (
  "id" int NOT NULL AUTO_INCREMENT,
  "meal_type" varchar(50) NOT NULL,
  "start_time" varchar(10) NOT NULL,
  "end_time" varchar(10) NOT NULL,
  "serving_start_time" varchar(10) DEFAULT NULL,
  "custom_note" varchar(255) DEFAULT NULL,
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "is_full_day" tinyint(1) NOT NULL DEFAULT '0',
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "meal_type" ("meal_type")
);

INSERT INTO `MealWindow` (`id`, `meal_type`, `start_time`, `end_time`, `serving_start_time`, `custom_note`, `is_active`, `is_full_day`, `updated_at`) VALUES (1, 'breakfast', '07:30', '10:00', '08:30', NULL, true, false, '2026-10-12 11:11:09');
INSERT INTO `MealWindow` (`id`, `meal_type`, `start_time`, `end_time`, `serving_start_time`, `custom_note`, `is_active`, `is_full_day`, `updated_at`) VALUES (2, 'lunch', '12:00', '14:30', '12:30', NULL, true, false, '2026-10-12 11:11:09');
INSERT INTO `MealWindow` (`id`, `meal_type`, `start_time`, `end_time`, `serving_start_time`, `custom_note`, `is_active`, `is_full_day`, `updated_at`) VALUES (3, 'snacks', '16:30', '18:00', '16:30', NULL, true, false, '2026-10-12 11:11:09');
INSERT INTO `MealWindow` (`id`, `meal_type`, `start_time`, `end_time`, `serving_start_time`, `custom_note`, `is_active`, `is_full_day`, `updated_at`) VALUES (4, 'dinner', '19:30', '21:30', '19:30', NULL, true, false, '2026-10-12 11:11:09');

DROP TABLE IF EXISTS `MenuItem`;
CREATE TABLE "MenuItem" (
  "id" int NOT NULL AUTO_INCREMENT,
  "name" varchar(255) NOT NULL,
  "image_url" varchar(500) NOT NULL DEFAULT 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
  "cloudinary_public_id" varchar(255) DEFAULT NULL,
  "meal_type" varchar(50) NOT NULL,
  "price" decimal(10,2) NOT NULL,
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "description" text,
  "has_variants" tinyint(1) NOT NULL DEFAULT '0',
  "variants" json DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "available_quantity" int NOT NULL DEFAULT '100',
  "daily_stock_limit" int NOT NULL DEFAULT '100',
  "is_available" tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY ("id"),
  KEY "idx_meal_active" ("meal_type","is_active")
);

DROP TABLE IF EXISTS `MenuItemReview`;
CREATE TABLE "MenuItemReview" (
  "id" int NOT NULL AUTO_INCREMENT,
  "order_id" int NOT NULL,
  "student_id" int NOT NULL,
  "menu_item_id" int DEFAULT NULL,
  "menu_item_name" varchar(255) NOT NULL,
  "meal_type" varchar(50) NOT NULL,
  "rating" tinyint NOT NULL,
  "review_text" text,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "uniq_order_item_review" ("order_id","menu_item_id"),
  KEY "idx_review_menu_item" ("menu_item_id"),
  KEY "idx_review_order" ("order_id"),
  KEY "idx_review_student" ("student_id"),
  CONSTRAINT "MenuItemReview_ibfk_1" FOREIGN KEY ("order_id") REFERENCES "Order" ("id") ON DELETE CASCADE,
  CONSTRAINT "MenuItemReview_ibfk_2" FOREIGN KEY ("student_id") REFERENCES "Student" ("id") ON DELETE CASCADE
);

DROP TABLE IF EXISTS `Order`;
CREATE TABLE "Order" (
  "id" int NOT NULL AUTO_INCREMENT,
  "student_id" int DEFAULT NULL,
  "customer_name" varchar(255) DEFAULT NULL,
  "token_number" varchar(50) DEFAULT NULL,
  "formatted_token" varchar(50) DEFAULT '',
  "meal_type" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'booked',
  "order_status" varchar(50) NOT NULL DEFAULT 'placed',
  "order_type" varchar(20) NOT NULL DEFAULT 'dine_in',
  "date" varchar(10) NOT NULL DEFAULT '',
  "daily_sequence" int DEFAULT NULL,
  "subtotal_amount" decimal(10,2) NOT NULL DEFAULT '0.00',
  "discount_percentage" decimal(5,2) NOT NULL DEFAULT '0.00',
  "discount_amount" decimal(10,2) NOT NULL DEFAULT '0.00',
  "discount_type" varchar(50) NOT NULL DEFAULT 'none',
  "total_amount" decimal(10,2) NOT NULL DEFAULT '0.00',
  "is_paid" tinyint(1) NOT NULL DEFAULT '1',
  "payment_status" varchar(50) NOT NULL DEFAULT 'paid',
  "payment_method" varchar(50) NOT NULL DEFAULT 'cash',
  "razorpay_order_id" varchar(255) DEFAULT NULL,
  "razorpay_payment_id" varchar(255) DEFAULT NULL,
  "razorpay_signature" varchar(255) DEFAULT NULL,
  "address_id" int DEFAULT NULL,
  "society_name" varchar(150) DEFAULT NULL,
  "wing_name" varchar(50) DEFAULT NULL,
  "flat_number" varchar(30) DEFAULT NULL,
  "landmark" varchar(200) DEFAULT NULL,
  "pincode" char(6) DEFAULT NULL,
  "mobile_number" varchar(15) DEFAULT NULL,
  "collected_at" datetime DEFAULT NULL,
  "collected_by_admin_id" int DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" datetime DEFAULT NULL,
  PRIMARY KEY ("id"),
  KEY "idx_order_status_meal" ("order_status","meal_type"),
  KEY "idx_order_date" ("date"),
  KEY "idx_order_student" ("student_id"),
  KEY "address_id" ("address_id"),
  KEY "collected_by_admin_id" ("collected_by_admin_id"),
  KEY "idx_order_date_paid" ("date","payment_status"),
  KEY "idx_order_rzp_order_id" ("razorpay_order_id"),
  KEY "idx_order_rzp_payment_id" ("razorpay_payment_id"),
  CONSTRAINT "Order_ibfk_1" FOREIGN KEY ("student_id") REFERENCES "Student" ("id") ON DELETE CASCADE,
  CONSTRAINT "Order_ibfk_2" FOREIGN KEY ("address_id") REFERENCES "user_addresses" ("id") ON DELETE SET NULL,
  CONSTRAINT "Order_ibfk_3" FOREIGN KEY ("collected_by_admin_id") REFERENCES "AdminUser" ("id") ON DELETE SET NULL
);

DROP TABLE IF EXISTS `OrderItem`;
CREATE TABLE "OrderItem" (
  "id" int NOT NULL AUTO_INCREMENT,
  "order_id" int NOT NULL,
  "menu_item_id" int DEFAULT NULL,
  "item_name" varchar(255) NOT NULL,
  "price" decimal(10,2) NOT NULL,
  "quantity" int NOT NULL,
  "variant_name" varchar(100) DEFAULT NULL,
  PRIMARY KEY ("id"),
  KEY "order_id" ("order_id"),
  KEY "menu_item_id" ("menu_item_id"),
  CONSTRAINT "OrderItem_ibfk_1" FOREIGN KEY ("order_id") REFERENCES "Order" ("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_ibfk_2" FOREIGN KEY ("menu_item_id") REFERENCES "MenuItem" ("id") ON DELETE SET NULL
);

DROP TABLE IF EXISTS `Plan`;
CREATE TABLE "Plan" (
  "id" int NOT NULL AUTO_INCREMENT,
  "name" varchar(255) NOT NULL,
  "code" varchar(100) NOT NULL,
  "billing_cycle" enum('monthly','quarterly','six_month','yearly','custom') NOT NULL DEFAULT 'monthly',
  "price" decimal(10,2) NOT NULL,
  "trial_days" int NOT NULL DEFAULT '14',
  "features" json DEFAULT NULL,
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "code" ("code")
);

INSERT INTO `Plan` (`id`, `name`, `code`, `billing_cycle`, `price`, `trial_days`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (1, 'Monthly Standard', 'monthly', 'monthly', '1000.00', 14, 'Unlimited Student Meal Bookings,Live Kitchen Order Screen,Menu & Timing Controls,Basic Inventory Tracking,Email Support', true, '2026-10-12 11:11:15', '2026-10-12 11:11:15');
INSERT INTO `Plan` (`id`, `name`, `code`, `billing_cycle`, `price`, `trial_days`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (2, 'Quarterly Pro', 'quarterly', 'quarterly', '2700.00', 14, 'All Monthly Features,10% Discount on Plan,Full Inventory & Recipe Tracking,Order History & Analytics,Priority Support', true, '2026-10-12 11:11:15', '2026-10-12 11:11:15');
INSERT INTO `Plan` (`id`, `name`, `code`, `billing_cycle`, `price`, `trial_days`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (3, 'Half-Yearly Elite', 'six_month', 'six_month', '5000.00', 14, 'All Quarterly Features,16% Discount on Plan,Automated Token Cleanup,Multi-Staff Role Management,24/7 Dedicated Support', true, '2026-10-12 11:11:15', '2026-10-12 11:11:15');
INSERT INTO `Plan` (`id`, `name`, `code`, `billing_cycle`, `price`, `trial_days`, `features`, `is_active`, `created_at`, `updated_at`) VALUES (4, 'Annual Enterprise', 'yearly', 'yearly', '9000.00', 30, 'All Half-Yearly Features,25% Discount (3 Months Free),Custom Branding & Emblem,Unlimited Staff Accounts,Dedicated Account Manager', true, '2026-10-12 11:11:15', '2026-10-12 11:11:15');

DROP TABLE IF EXISTS `PlanPriceHistory`;
CREATE TABLE "PlanPriceHistory" (
  "id" int NOT NULL AUTO_INCREMENT,
  "plan_id" int NOT NULL,
  "old_price" decimal(10,2) NOT NULL,
  "new_price" decimal(10,2) NOT NULL,
  "changed_by_id" int DEFAULT NULL,
  "changed_by_name" varchar(255) DEFAULT NULL,
  "reason" varchar(500) DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "plan_id" ("plan_id"),
  CONSTRAINT "PlanPriceHistory_ibfk_1" FOREIGN KEY ("plan_id") REFERENCES "Plan" ("id") ON DELETE CASCADE
);

DROP TABLE IF EXISTS `RecipeItem`;
CREATE TABLE "RecipeItem" (
  "id" int NOT NULL AUTO_INCREMENT,
  "menu_item_id" int NOT NULL,
  "inventory_item_id" int NOT NULL,
  "quantity_required" decimal(10,3) NOT NULL,
  "quantity_unit" enum('kg','g','litre','ml','piece','packet') NOT NULL DEFAULT 'kg',
  PRIMARY KEY ("id"),
  UNIQUE KEY "menu_item_inventory_item" ("menu_item_id","inventory_item_id"),
  KEY "inventory_item_id" ("inventory_item_id"),
  CONSTRAINT "RecipeItem_ibfk_1" FOREIGN KEY ("menu_item_id") REFERENCES "MenuItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "RecipeItem_ibfk_2" FOREIGN KEY ("inventory_item_id") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE
);

DROP TABLE IF EXISTS `Student`;
CREATE TABLE "Student" (
  "id" int NOT NULL AUTO_INCREMENT,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "roll_no" varchar(255) DEFAULT NULL,
  "avatar_url" varchar(500) DEFAULT NULL,
  "google_id" varchar(255) DEFAULT NULL,
  "password_hash" varchar(255) DEFAULT NULL,
  "is_verified" tinyint(1) NOT NULL DEFAULT '0',
  "otp_code" varchar(10) DEFAULT NULL,
  "otp_expires_at" datetime DEFAULT NULL,
  "failed_login_attempts" int NOT NULL DEFAULT '0',
  "locked_until" datetime DEFAULT NULL,
  "reset_token" varchar(255) DEFAULT NULL,
  "reset_token_expires" datetime DEFAULT NULL,
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "email" ("email"),
  UNIQUE KEY "roll_no" ("roll_no"),
  UNIQUE KEY "phone" ("phone")
);

DROP TABLE IF EXISTS `Subscription`;
CREATE TABLE "Subscription" (
  "id" int NOT NULL AUTO_INCREMENT,
  "plan_type" enum('monthly','quarterly','six_month','yearly') NOT NULL DEFAULT 'monthly',
  "subscription_start_date" datetime NOT NULL,
  "subscription_end_date" datetime NOT NULL,
  "status" enum('active','expired','suspended') NOT NULL DEFAULT 'active',
  "last_payment_amount" decimal(10,2) DEFAULT NULL,
  "last_payment_date" datetime DEFAULT NULL,
  "dev_razorpay_payment_id" varchar(255) DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

INSERT INTO `Subscription` (`id`, `plan_type`, `subscription_start_date`, `subscription_end_date`, `status`, `last_payment_amount`, `last_payment_date`, `dev_razorpay_payment_id`, `created_at`, `updated_at`) VALUES (1, 'monthly', '2026-10-12 12:29:10', '2026-11-11 12:29:10', 'active', '1000.00', '2026-10-12 12:29:10', 'init_dev_seed', '2026-10-12 12:29:10', '2026-10-12 12:29:10');

DROP TABLE IF EXISTS `SuperAdmin`;
CREATE TABLE "SuperAdmin" (
  "id" int NOT NULL AUTO_INCREMENT,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" varchar(50) NOT NULL DEFAULT 'super_admin',
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "last_login_at" datetime DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "email" ("email")
);

INSERT INTO `SuperAdmin` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES (1, 'Master Super Admin', 'superadmin@canteen.com', '$2a$10$TW3VcnGtH2NDuDupvMuDM.tT/G/TdTPkZ8DRFyTwocP6SxMim6AvG', 'super_admin', true, NULL, '2026-10-12 11:11:16', '2026-10-12 11:11:16');

DROP TABLE IF EXISTS `SuperAdminAuditLog`;
CREATE TABLE "SuperAdminAuditLog" (
  "id" int NOT NULL AUTO_INCREMENT,
  "actor_id" int DEFAULT NULL,
  "actor_name" varchar(255) NOT NULL,
  "actor_email" varchar(255) NOT NULL,
  "action" varchar(100) NOT NULL,
  "client_id" int DEFAULT NULL,
  "client_name" varchar(255) DEFAULT NULL,
  "before_value" json DEFAULT NULL,
  "after_value" json DEFAULT NULL,
  "ip_address" varchar(100) DEFAULT NULL,
  "user_agent" varchar(255) DEFAULT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS `meal_serving_slots`;
CREATE TABLE "meal_serving_slots" (
  "id" int NOT NULL AUTO_INCREMENT,
  "meal_type" varchar(50) NOT NULL,
  "slot_number" tinyint NOT NULL,
  "start_datetime" datetime DEFAULT NULL,
  "end_datetime" datetime DEFAULT NULL,
  "is_active" tinyint(1) NOT NULL DEFAULT '0',
  "note" varchar(255) DEFAULT NULL,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "uq_meal_slot" ("meal_type","slot_number")
);

INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (1, 'breakfast', 1, '2026-10-12 02:00:00', '2026-10-12 04:30:00', true, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (2, 'lunch', 1, '2026-10-12 06:30:00', '2026-10-12 09:00:00', true, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (3, 'snacks', 1, '2026-10-12 11:00:00', '2026-10-12 12:30:00', true, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (4, 'dinner', 1, '2026-10-12 14:00:00', '2026-10-12 16:00:00', true, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (8, 'breakfast', 2, NULL, NULL, false, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (9, 'dinner', 2, NULL, NULL, false, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (10, 'lunch', 2, NULL, NULL, false, NULL, '2026-10-12 11:11:12');
INSERT INTO `meal_serving_slots` (`id`, `meal_type`, `slot_number`, `start_datetime`, `end_datetime`, `is_active`, `note`, `updated_at`) VALUES (11, 'snacks', 2, NULL, NULL, false, NULL, '2026-10-12 11:11:12');

DROP TABLE IF EXISTS `user_addresses`;
CREATE TABLE "user_addresses" (
  "id" int NOT NULL AUTO_INCREMENT,
  "user_id" int NOT NULL,
  "society_name" varchar(150) NOT NULL,
  "wing_name" varchar(50) NOT NULL,
  "flat_number" varchar(30) NOT NULL,
  "landmark" varchar(200) DEFAULT NULL,
  "pincode" char(6) NOT NULL,
  "mobile_number" varchar(15) NOT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "idx_user_addresses_user_id" ("user_id"),
  CONSTRAINT "user_addresses_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "Student" ("id") ON DELETE CASCADE
);

-- Kirana columns and compatibility
ALTER TABLE `MenuItem` ADD COLUMN `category` VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE `MenuItem` ADD COLUMN `unit` VARCHAR(50) NOT NULL DEFAULT 'piece';
ALTER TABLE `MenuItem` ADD COLUMN `mrp` DECIMAL(10, 2) NULL DEFAULT NULL;
ALTER TABLE `MenuItem` ADD COLUMN `brand` VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE `MenuItem` ADD COLUMN `barcode` VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE `MenuItem` ADD COLUMN `stock_quantity` DECIMAL(10, 2) NOT NULL DEFAULT 100.00;
ALTER TABLE `MenuItem` ADD COLUMN `in_stock` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `MenuItem` ADD COLUMN `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE `Student` MODIFY COLUMN `roll_no` VARCHAR(255) NULL;
ALTER TABLE `Student` ADD COLUMN `address` VARCHAR(500) NULL DEFAULT NULL;
ALTER TABLE `Student` ADD COLUMN `city` VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE `Student` ADD COLUMN `pincode` VARCHAR(10) NULL DEFAULT NULL;

ALTER TABLE `MealWindow` ADD COLUMN `category_name` VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE `MealWindow` ADD COLUMN `icon` VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE `MealWindow` ADD COLUMN `display_order` INT NOT NULL DEFAULT 0;

ALTER TABLE `Order` ADD COLUMN `customer_id` INT NULL DEFAULT NULL;
ALTER TABLE `Order` ADD COLUMN `delivery_type` VARCHAR(50) NOT NULL DEFAULT 'pickup';

ALTER TABLE `OrderItem` ADD COLUMN `product_id` INT NULL DEFAULT NULL;

-- Kirana Views
CREATE OR REPLACE VIEW `Product` AS
SELECT 
  `id`,
  `name`,
  `image_url`,
  `cloudinary_public_id`,
  COALESCE(`category`, `meal_type`) AS `category`,
  `meal_type`,
  `price`,
  COALESCE(`mrp`, `price`) AS `mrp`,
  `unit`,
  `brand`,
  `barcode`,
  `stock_quantity`,
  `in_stock`,
  `is_active`,
  `description`,
  `has_variants`,
  `variants`,
  `discount_percentage`,
  `created_at`
FROM `MenuItem`;

CREATE OR REPLACE VIEW `Customer` AS
SELECT 
  `id`,
  `name`,
  `email`,
  `phone`,
  `roll_no`,
  `password_hash`,
  `is_verified`,
  `otp_code`,
  `otp_expires_at`,
  `failed_login_attempts`,
  `locked_until`,
  `is_active`,
  `address`,
  `city`,
  `pincode`,
  `created_at`
FROM `Student`;

CREATE OR REPLACE VIEW `Category` AS
SELECT 
  `id`,
  `meal_type` AS `code`,
  COALESCE(`category_name`, `meal_type`) AS `name`,
  `icon`,
  `display_order`,
  `start_time`,
  `end_time`,
  `custom_note`,
  `is_active`,
  `is_full_day`,
  `updated_at`
FROM `MealWindow`;

CREATE OR REPLACE VIEW `CustomerOrder` AS
SELECT 
  `id`,
  COALESCE(`customer_id`, `student_id`) AS `customer_id`,
  `student_id`,
  `customer_name`,
  `token_number`,
  `formatted_token`,
  `meal_type` AS `category`,
  `status`,
  `order_status`,
  `order_type`,
  `delivery_type`,
  `date`,
  `daily_sequence`,
  `subtotal_amount`,
  `discount_percentage`,
  `discount_amount`,
  `discount_type`,
  `total_amount`,
  `is_paid`,
  `payment_status`,
  `payment_method`,
  `razorpay_order_id`,
  `razorpay_payment_id`,
  `address_id`,
  `society_name`,
  `wing_name`,
  `flat_number`,
  `landmark`,
  `pincode`,
  `mobile_number`,
  `created_at`
FROM `Order`;

SET FOREIGN_KEY_CHECKS = 1;
