const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/authMiddleware');
const {
  getAllMealSlots,
  getMealSlotsForType,
  saveMealSlotsForType,
  getStoreTiming,
  saveStoreTiming,
} = require('../services/mealSlotService');

/**
 * GET /api/admin/meal-slots/store-timing
 * Returns the unified store operating hours & timings.
 */
router.get('/store-timing', verifyAdmin, async (req, res) => {
  try {
    const timing = await getStoreTiming();
    return res.status(200).json({
      success: true,
      meal_type: 'store_hours',
      data: timing,
      timing,
    });
  } catch (error) {
    console.error('[MealSlotRoutes] GET /store-timing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch store timing: ' + error.message,
    });
  }
});

/**
 * PUT /api/admin/meal-slots/store-timing
 * Saves unified store operating hours and syncs across all categories.
 */
router.put('/store-timing', verifyAdmin, async (req, res) => {
  try {
    let { slot1, slot2, slots, custom_note, note_datetime, note_prefix, serving_note, is_full_day } = req.body;

    if (Array.isArray(slots) && slots.length > 0) {
      if (!slot1) slot1 = slots.find((s) => s.slot_number === 1) || slots[0];
      if (!slot2) slot2 = slots.find((s) => s.slot_number === 2) || slots[1];
    }

    if (!slot1 && !slot2 && is_full_day === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one slot payload or is_full_day toggle must be provided.',
      });
    }

    const updated = await saveStoreTiming(slot1, slot2, {
      custom_note: custom_note || serving_note,
      note_datetime,
      note_prefix,
      serving_note,
      is_full_day: Boolean(is_full_day),
    });

    // Broadcast real-time Socket.IO events to all connected clients
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('mealSlotsUpdated', {
          meal_type: 'store_hours',
          ...updated,
        });

        io.emit('store_timing:updated', updated);

        io.emit('meal_window:updated', {
          meal_type: 'store_hours',
          is_active: updated.isAvailableNow,
          is_full_day: updated.is_full_day,
          window: {
            meal_type: 'store_hours',
            is_active: updated.isAvailableNow,
            is_full_day: updated.is_full_day,
            is_currently_open: updated.isAvailableNow,
            isAvailableNow: updated.isAvailableNow,
            serving_note: updated.serving_note,
            custom_note: updated.custom_note,
          },
        });
      }
    } catch (socketErr) {
      console.warn('[MealSlotRoutes] Socket broadcast warning:', socketErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Store operating hours & timings saved successfully for the entire store!',
      data: updated,
    });
  } catch (error) {
    console.error('[MealSlotRoutes] PUT /store-timing error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update store timing.',
    });
  }
});

/**
 * GET /api/admin/meal-slots
 * Returns both slots for every meal type, evaluated with availability and status.
 */
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const slots = await getAllMealSlots();
    const mealsList = Array.isArray(slots)
      ? slots
      : Object.entries(slots || {}).map(([key, val]) => ({
          meal_type: val.meal_type || key,
          ...val,
        }));
    return res.status(200).json({
      success: true,
      meals: mealsList,
      data: slots,
    });
  } catch (error) {
    console.error('[MealSlotRoutes] GET / error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch meal serving slots: ' + error.message,
    });
  }
});

/**
 * GET /api/admin/meal-slots/:mealType
 * Returns slots for a single meal type or store timing.
 */
router.get('/:mealType', verifyAdmin, async (req, res) => {
  try {
    const { mealType } = req.params;
    if (mealType.toLowerCase() === 'store-timing' || mealType.toLowerCase() === 'store_hours') {
      const evaluation = await getStoreTiming();
      return res.status(200).json({
        success: true,
        meal_type: 'store_hours',
        data: evaluation,
      });
    }

    const evaluation = await getMealSlotsForType(mealType);
    return res.status(200).json({
      success: true,
      meal_type: mealType.toLowerCase(),
      data: evaluation,
    });
  } catch (error) {
    console.error('[MealSlotRoutes] GET /:mealType error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch slots for ' + req.params.mealType + ': ' + error.message,
    });
  }
});

/**
 * PUT /api/admin/meal-slots/:mealType
 * Saves slot 1 and slot 2 in one request with validation.
 * Accepts { slot1, slot2 } or { slots: [slot1, slot2] }.
 * Emits Socket.IO 'mealSlotsUpdated' & 'meal_window:updated' event.
 */
router.put('/:mealType', verifyAdmin, async (req, res) => {
  try {
    const { mealType } = req.params;
    let { slot1, slot2, slots, custom_note, note_datetime, note_prefix, serving_note, is_full_day } = req.body;

    if (Array.isArray(slots) && slots.length > 0) {
      if (!slot1) slot1 = slots.find((s) => s.slot_number === 1) || slots[0];
      if (!slot2) slot2 = slots.find((s) => s.slot_number === 2) || slots[1];
    }

    if (!slot1 && !slot2 && is_full_day === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one slot payload (slot1 or slot2 or slots array) or is_full_day toggle must be provided.',
      });
    }

    let updated;
    if (mealType.toLowerCase() === 'store_hours' || mealType.toLowerCase() === 'store' || mealType.toLowerCase() === 'store-timing') {
      updated = await saveStoreTiming(slot1, slot2, {
        custom_note: custom_note || serving_note,
        note_datetime,
        note_prefix,
        serving_note,
        is_full_day: Boolean(is_full_day),
      });
    } else {
      updated = await saveMealSlotsForType(mealType, slot1, slot2, {
        custom_note: custom_note || serving_note,
        note_datetime,
        note_prefix,
        serving_note,
        is_full_day: Boolean(is_full_day),
      });
    }

    // Broadcast real-time Socket.IO events to all connected clients
    try {
      const io = req.app.get('socketio');
      if (io) {
        // Required event name
        io.emit('mealSlotsUpdated', {
          meal_type: mealType.toLowerCase(),
          slots: updated.slots,
          isAvailableNow: updated.isAvailableNow,
          activeSlot: updated.activeSlot,
          nextSlot: updated.nextSlot,
          serving_note: updated.serving_note,
          custom_note: updated.custom_note,
          is_full_day: updated.is_full_day,
        });

        io.emit('store_timing:updated', updated);

        // Also emit legacy event for backward compatibility
        io.emit('meal_window:updated', {
          meal_type: mealType.toLowerCase(),
          is_active: updated.isAvailableNow,
          is_full_day: updated.is_full_day,
          window: {
            meal_type: mealType.toLowerCase(),
            is_active: updated.isAvailableNow,
            is_full_day: updated.is_full_day,
            is_currently_open: updated.isAvailableNow,
            isAvailableNow: updated.isAvailableNow,
            serving_note: updated.serving_note,
            custom_note: updated.custom_note,
          },
        });
      }
    } catch (socketErr) {
      console.warn('[MealSlotRoutes] Socket broadcast warning:', socketErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Operating hours for ${mealType.toUpperCase()} updated successfully.`,
      data: updated,
    });
  } catch (error) {
    console.error('[MealSlotRoutes] PUT /:mealType error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update meal slots.',
    });
  }
});

module.exports = router;
