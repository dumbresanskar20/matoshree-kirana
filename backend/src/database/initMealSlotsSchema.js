const { pool } = require('./db');

/**
 * Ensures that `meal_serving_slots` table exists in MySQL,
 * and migrates existing MealWindow time records into Slot 1 (and empty Slot 2)
 * so existing meals remain fully operational after deployment.
 */
const initMealSlotsSchema = async () => {
  // Legacy meal_serving_slots table removed for Kirana store
  return;
};

module.exports = { initMealSlotsSchema };
