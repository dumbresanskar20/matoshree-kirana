const { pool } = require('../database/db');

/**
 * Service: MealSlotService
 * Provides IST-consistent (Asia/Kolkata) date/time evaluation for two-slot meal serving windows.
 */

// Format current time in Asia/Kolkata
const getNowIST = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const str = `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
  const date = new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+05:30`);
  return {
    str,
    date,
    timestamp: date.getTime(),
  };
};

/**
 * Parse any date string into an IST epoch timestamp (ms).
 * Accepts 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DDTHH:mm', Date objects, or ISO strings.
 */
const parseToISTTimestamp = (dt) => {
  if (!dt) return null;
  if (dt instanceof Date) return dt.getTime();
  const clean = String(dt).trim().replace(' ', 'T');
  if (!clean) return null;

  // If already contains timezone specifier (Z or +HH:mm)
  if (clean.includes('Z') || /[+-]\d{2}:\d{2}$/.test(clean)) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // Treat as IST (+05:30)
  const full = clean.length <= 16 ? `${clean}:00` : clean;
  const d = new Date(`${full}+05:30`);
  return isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * Format datetime to human-readable format in IST: "Sat, 4 Oct, 12:30 PM"
 */
const formatISTHuman = (dt) => {
  if (!dt) return '';
  const ts = parseToISTTimestamp(dt);
  if (!ts) return '';
  const date = new Date(ts);
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch (e) {
    return date.toLocaleString();
  }
};

/**
 * Format datetime for HTML5 datetime-local input: 'YYYY-MM-DDTHH:mm'
 */
const formatForInput = (dt) => {
  if (!dt) return '';
  const ts = parseToISTTimestamp(dt);
  if (!ts) return '';
  const date = new Date(ts);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
};

/**
 * Format datetime for MySQL DATETIME column: 'YYYY-MM-DD HH:mm:ss'
 */
const formatForMySQL = (dt) => {
  if (!dt) return null;
  const ts = parseToISTTimestamp(dt);
  if (!ts) return null;
  const date = new Date(ts);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
};

/**
 * Evaluates the status of Slot 1 and Slot 2 for a meal against current IST time.
 * Returns evaluated slots, isAvailableNow, activeSlot, nextSlot, and serving_note.
 */
const evaluateMealSlots = (slots = [], nowIST = getNowIST().timestamp, customNote = null, isFullDay = false) => {
  const normalizedSlots = [1, 2].map((num) => {
    const raw = slots.find((s) => Number(s.slot_number) === num) || {
      slot_number: num,
      start_datetime: null,
      end_datetime: null,
      is_active: 0,
      note: null,
    };

    const isActive = Boolean(raw.is_active === 1 || raw.is_active === true || raw.is_active === '1');
    const startTs = parseToISTTimestamp(raw.start_datetime);
    const endTs = parseToISTTimestamp(raw.end_datetime);

    let status = 'inactive'; // 'running' | 'upcoming' | 'expired' | 'inactive'
    if (isActive && startTs && endTs) {
      if (nowIST >= startTs && nowIST <= endTs) {
        status = 'running';
      } else if (nowIST < startTs) {
        status = 'upcoming';
      } else {
        status = 'expired';
      }
    } else {
      status = 'inactive';
    }

    return {
      id: raw.id,
      meal_type: (raw.meal_type || '').toLowerCase(),
      slot_number: num,
      start_datetime: raw.start_datetime,
      end_datetime: raw.end_datetime,
      formatted_start_datetime: formatISTHuman(raw.start_datetime),
      formatted_end_datetime: formatISTHuman(raw.end_datetime),
      input_start_datetime: formatForInput(raw.start_datetime),
      input_end_datetime: formatForInput(raw.end_datetime),
      is_active: isActive,
      note: raw.note || null,
      status, // 'running' | 'upcoming' | 'expired' | 'inactive'
      start_timestamp: startTs,
      end_timestamp: endTs,
    };
  });

  // Find running slots
  const runningSlots = normalizedSlots.filter((s) => s.status === 'running');
  const isAvailableNow = Boolean(isFullDay) || runningSlots.length > 0;

  // If multiple slots are running (overlapping), pick the one with later end time
  const activeSlot = runningSlots.length > 0
    ? runningSlots.sort((a, b) => (b.end_timestamp || 0) - (a.end_timestamp || 0))[0]
    : null;

  // Find next upcoming active slot
  const upcomingSlots = normalizedSlots
    .filter((s) => s.status === 'upcoming')
    .sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));
  const nextSlot = !isAvailableNow && upcomingSlots.length > 0 ? upcomingSlots[0] : null;

  // Compute user-facing serving note
  let servingNote = 'Not available right now';
  if (customNote && String(customNote).trim()) {
    servingNote = String(customNote).trim();
  } else if (isFullDay) {
    servingNote = '🟢 Accepting orders 24/7 (Always Open)';
  } else if (isAvailableNow && activeSlot) {
    servingNote = `Serving now until ${activeSlot.formatted_end_datetime}`;
  } else if (nextSlot) {
    servingNote = `Available from ${nextSlot.formatted_start_datetime}`;
  } else {
    servingNote = 'Not available right now';
  }

  return {
    slots: normalizedSlots,
    isAvailableNow,
    activeSlot,
    nextSlot,
    serving_note: servingNote,
    custom_note: customNote || null,
    is_full_day: Boolean(isFullDay),
  };
};

/**
 * Validate slot input payload from admin.
 * Throws an Error with human-readable message if invalid.
 */
const validateSlotPayload = (slot, slotNumber = 1) => {
  const isActive = Boolean(slot.is_active === true || slot.is_active === 1 || slot.is_active === '1');
  if (!isActive) {
    return {
      slot_number: slotNumber,
      start_datetime: slot.start_datetime ? formatForMySQL(slot.start_datetime) : null,
      end_datetime: slot.end_datetime ? formatForMySQL(slot.end_datetime) : null,
      is_active: 0,
      note: slot.note ? String(slot.note).trim() : null,
    };
  }

  // Slot is ACTIVE: start and end are strictly required
  if (!slot.start_datetime) {
    throw new Error(`Slot ${slotNumber} is Active: Start date and time are required.`);
  }
  if (!slot.end_datetime) {
    throw new Error(`Slot ${slotNumber} is Active: End date and time are required.`);
  }

  const startTs = parseToISTTimestamp(slot.start_datetime);
  const endTs = parseToISTTimestamp(slot.end_datetime);

  if (!startTs || isNaN(startTs)) {
    throw new Error(`Slot ${slotNumber} has an invalid start date-time.`);
  }
  if (!endTs || isNaN(endTs)) {
    throw new Error(`Slot ${slotNumber} has an invalid end date-time.`);
  }
  if (endTs <= startTs) {
    throw new Error(`Slot ${slotNumber}: End date-time must be strictly after Start date-time.`);
  }

  return {
    slot_number: slotNumber,
    start_datetime: formatForMySQL(slot.start_datetime),
    end_datetime: formatForMySQL(slot.end_datetime),
    is_active: 1,
    note: slot.note ? String(slot.note).trim() : null,
  };
};

const DEFAULT_MEAL_TYPES = ['store_hours'];

/**
 * Get all meal slots grouped by meal_type
 */
const getAllMealSlots = async () => {
  let rows = [];
  try {
    const [resultRows] = await pool.query('SELECT * FROM `meal_serving_slots` ORDER BY meal_type ASC, slot_number ASC');
    rows = resultRows || [];
  } catch (dbErr) {
    console.warn('[mealSlotService] getAllMealSlots query error:', dbErr.message);
  }

  // Load custom_notes and is_full_day from MealWindow
  const mwMetaMap = {};
  try {
    const [mwRows] = await pool.query('SELECT LOWER(meal_type) as meal_type, custom_note, is_full_day FROM `MealWindow`');
    (mwRows || []).forEach((r) => {
      if (r.meal_type) {
        mwMetaMap[r.meal_type] = {
          custom_note: r.custom_note,
          is_full_day: Boolean(r.is_full_day === 1 || r.is_full_day === true || r.is_full_day === '1'),
        };
      }
    });
  } catch (mwErr) {
    // Ignore if table not present
  }

  const grouped = {};
  rows.forEach((r) => {
    const type = (r.meal_type || '').toLowerCase();
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  });

  // Guarantee default meal types are always present even if DB table is empty
  DEFAULT_MEAL_TYPES.forEach((type) => {
    if (!grouped[type]) {
      grouped[type] = [];
    }
  });

  const nowIST = getNowIST().timestamp;
  const result = {};
  Object.keys(grouped).forEach((type) => {
    const meta = mwMetaMap[type] || {};
    const customNote = meta.custom_note || null;
    const isFullDay = Boolean(meta.is_full_day);
    const evaluated = evaluateMealSlots(grouped[type], nowIST, customNote, isFullDay);
    evaluated.meal_type = type;
    evaluated.custom_note = customNote;
    evaluated.is_full_day = isFullDay;
    result[type] = evaluated;
  });
  return result;
};

/**
 * Get slots for a specific meal_type
 */
const getMealSlotsForType = async (mealType) => {
  const cleanType = String(mealType || '').toLowerCase().trim();
  let rows = [];
  try {
    const [resultRows] = await pool.execute(
      'SELECT * FROM `meal_serving_slots` WHERE LOWER(meal_type) = ? ORDER BY slot_number ASC',
      [cleanType]
    );
    rows = resultRows || [];
  } catch (_slotErr) {
    // meal_serving_slots table removed for Kirana store
  }

  let customNote = null;
  let isFullDay = false;
  try {
    const [mwRows] = await pool.execute(
      'SELECT custom_note, is_full_day FROM `MealWindow` WHERE LOWER(meal_type) = ? LIMIT 1',
      [cleanType]
    );
    if (mwRows && mwRows[0]) {
      customNote = mwRows[0].custom_note;
      isFullDay = Boolean(mwRows[0].is_full_day === 1 || mwRows[0].is_full_day === true || mwRows[0].is_full_day === '1');
    }
  } catch (mwErr) {
    // Ignore
  }

  const nowIST = getNowIST().timestamp;
  const evaluated = evaluateMealSlots(rows || [], nowIST, customNote, isFullDay);
  evaluated.meal_type = cleanType;
  evaluated.custom_note = customNote;
  evaluated.is_full_day = isFullDay;
  return evaluated;
};

/**
 * Get unified store operating hours & timings for Matoshree Kirana
 */
const getStoreTiming = async () => {
  // 1. Check 'store_hours'
  const storeEvaluation = await getMealSlotsForType('store_hours');
  const hasConfiguredSlots = storeEvaluation.slots && storeEvaluation.slots.some((s) => s.start_datetime || s.is_active);
  if (storeEvaluation.is_full_day || hasConfiguredSlots || storeEvaluation.custom_note) {
    return storeEvaluation;
  }

  // 2. Check if any category has configured slots or windows to inherit
  const allSlots = await getAllMealSlots();
  const configured = Object.values(allSlots).find(
    (ev) => ev.is_full_day || (ev.slots && ev.slots.some((s) => s.start_datetime || s.is_active)) || ev.custom_note
  );
  if (configured) {
    return {
      ...configured,
      meal_type: 'store_hours',
    };
  }

  // 3. Fallback to MealWindow or default
  return storeEvaluation;
};

/**
 * Save unified store timing and synchronize across all categories
 */
const saveStoreTiming = async (slot1Data, slot2Data, options = {}) => {
  const customNote = options.custom_note || options.serving_note || null;
  const isFullDay = Boolean(options.is_full_day === true || options.is_full_day === 1 || options.is_full_day === 'true');

  const validated1 = validateSlotPayload(slot1Data || {}, 1);
  const validated2 = validateSlotPayload(slot2Data || {}, 2);

  if (customNote) {
    validated1.note = customNote;
    validated2.note = customNote;
  }

  // 1. Upsert store_hours in meal_serving_slots
  try {
    await pool.execute(
      `INSERT INTO \`meal_serving_slots\` (meal_type, slot_number, start_datetime, end_datetime, is_active, note)
       VALUES ('store_hours', 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_datetime = VALUES(start_datetime),
         end_datetime = VALUES(end_datetime),
         is_active = VALUES(is_active),
         note = VALUES(note),
         updated_at = CURRENT_TIMESTAMP`,
      [validated1.start_datetime, validated1.end_datetime, validated1.is_active, validated1.note]
    );

    await pool.execute(
      `INSERT INTO \`meal_serving_slots\` (meal_type, slot_number, start_datetime, end_datetime, is_active, note)
       VALUES ('store_hours', 2, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_datetime = VALUES(start_datetime),
         end_datetime = VALUES(end_datetime),
         is_active = VALUES(is_active),
         note = VALUES(note),
         updated_at = CURRENT_TIMESTAMP`,
      [validated2.start_datetime, validated2.end_datetime, validated2.is_active, validated2.note]
    );
  } catch (_slotsErr) {
    // meal_serving_slots table removed for Kirana store
  }

  // 2. Synchronize to MealWindow and Category tables
  const anyActive = isFullDay || validated1.is_active === 1 || validated2.is_active === 1;
  let sTime = '08:00';
  let eTime = '20:00';
  if (validated1.start_datetime) {
    sTime = validated1.start_datetime.substring(11, 16);
  }
  if (validated1.end_datetime) {
    eTime = validated1.end_datetime.substring(11, 16);
  }

  // Update/insert store_hours in MealWindow
  try {
    await pool.execute(
      `INSERT INTO \`MealWindow\` (meal_type, start_time, end_time, is_active, is_full_day, custom_note)
       VALUES ('store_hours', ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_time = VALUES(start_time),
         end_time = VALUES(end_time),
         is_active = VALUES(is_active),
         is_full_day = VALUES(is_full_day),
         custom_note = VALUES(custom_note)`,
      [sTime, eTime, anyActive ? 1 : 0, isFullDay ? 1 : 0, customNote]
    );
  } catch (mwErr) {
    // Ignore
  }

  // Synchronize ALL product categories in Category table to share this store timing
  try {
    await pool.execute(
      `UPDATE \`Category\` SET start_time = ?, end_time = ?, is_active = ?, is_full_day = ?, custom_note = ?`,
      [sTime, eTime, anyActive ? 1 : 0, isFullDay ? 1 : 0, customNote]
    );
  } catch (_catErr) {
    // Ignore if view or not present
  }

  // Synchronize all category rows in MealWindow as well
  try {
    await pool.execute(
      `UPDATE \`MealWindow\` SET start_time = ?, end_time = ?, is_active = ?, is_full_day = ?, custom_note = ? WHERE meal_type != 'store_hours'`,
      [sTime, eTime, anyActive ? 1 : 0, isFullDay ? 1 : 0, customNote]
    );
  } catch (_mwSyncErr) {
    // Ignore
  }

  return getStoreTiming();
};

/**
 * Save Slot 1 & Slot 2 for a meal type in a single transaction
 * If saving for store_hours or store, synchronizes to all categories.
 */
const saveMealSlotsForType = async (mealType, slot1Data, slot2Data, options = {}) => {
  const cleanType = String(mealType || '').toLowerCase().trim();
  if (!cleanType) {
    throw new Error('Meal type is required.');
  }

  if (cleanType === 'store_hours' || cleanType === 'store') {
    return saveStoreTiming(slot1Data, slot2Data, options);
  }

  const customNote = options.custom_note || options.serving_note || null;
  const isFullDay = Boolean(options.is_full_day === true || options.is_full_day === 1 || options.is_full_day === 'true');

  const validated1 = validateSlotPayload(slot1Data || {}, 1);
  const validated2 = validateSlotPayload(slot2Data || {}, 2);

  if (customNote) {
    validated1.note = customNote;
    validated2.note = customNote;
  }

  // Upsert slots if meal_serving_slots table exists
  try {
    await pool.execute(
      `INSERT INTO \`meal_serving_slots\` (meal_type, slot_number, start_datetime, end_datetime, is_active, note)
       VALUES (?, 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_datetime = VALUES(start_datetime),
         end_datetime = VALUES(end_datetime),
         is_active = VALUES(is_active),
         note = VALUES(note),
         updated_at = CURRENT_TIMESTAMP`,
      [cleanType, validated1.start_datetime, validated1.end_datetime, validated1.is_active, validated1.note]
    );

    await pool.execute(
      `INSERT INTO \`meal_serving_slots\` (meal_type, slot_number, start_datetime, end_datetime, is_active, note)
       VALUES (?, 2, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_datetime = VALUES(start_datetime),
         end_datetime = VALUES(end_datetime),
         is_active = VALUES(is_active),
         note = VALUES(note),
         updated_at = CURRENT_TIMESTAMP`,
      [cleanType, validated2.start_datetime, validated2.end_datetime, validated2.is_active, validated2.note]
    );
  } catch (_slotsErr) {
    // meal_serving_slots table removed for Kirana store
  }

  // Backwards compatibility: keep MealWindow in sync
  try {
    const anyActive = isFullDay || validated1.is_active === 1 || validated2.is_active === 1;
    let sTime = '08:00';
    let eTime = '20:00';
    if (validated1.start_datetime) {
      sTime = validated1.start_datetime.substring(11, 16);
    }
    if (validated1.end_datetime) {
      eTime = validated1.end_datetime.substring(11, 16);
    }
    await pool.execute(
      `INSERT INTO \`MealWindow\` (meal_type, start_time, end_time, is_active, is_full_day, custom_note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_time = VALUES(start_time),
         end_time = VALUES(end_time),
         is_active = VALUES(is_active),
         is_full_day = VALUES(is_full_day),
         custom_note = VALUES(custom_note)`,
      [cleanType, sTime, eTime, anyActive ? 1 : 0, isFullDay ? 1 : 0, customNote]
    );
  } catch (syncErr) {
    console.warn('[mealSlotService] MealWindow sync notice:', syncErr.message);
  }

  return getMealSlotsForType(cleanType);
};

/**
 * Server-side order verification:
 * Checks whether the STORE is currently open for ordering so all category products can be ordered.
 * Evaluates unified store operating hours first.
 */
const checkMealOrderableNow = async (mealType) => {
  const cleanType = String(mealType || '').toLowerCase().trim();

  // 1. Evaluate unified Store Timing
  const storeTiming = await getStoreTiming();

  // If 24/7 store ordering is enabled
  if (storeTiming && storeTiming.is_full_day) {
    return {
      isOrderable: true,
      message: 'Matoshree Kirana Store is open 24/7 for ordering.',
      evaluation: storeTiming,
    };
  }

  // If store timing has configured slots in meal_serving_slots
  if (storeTiming && storeTiming.slots && storeTiming.slots.some((s) => s.start_datetime || s.is_active)) {
    return {
      isOrderable: Boolean(storeTiming.isAvailableNow),
      message: storeTiming.isAvailableNow
        ? `Store ordering is open. ${storeTiming.serving_note || ''}`
        : `Matoshree Kirana Store is currently closed for orders. ${storeTiming.serving_note || ''}`,
      evaluation: storeTiming,
    };
  }

  // 2. Fallback to MealWindow for store_hours or the specific category
  const [mwRows] = await pool.execute(
    'SELECT * FROM `MealWindow` WHERE LOWER(meal_type) = ? OR LOWER(meal_type) = ? ORDER BY (LOWER(meal_type) = "store_hours") DESC LIMIT 1',
    ['store_hours', cleanType]
  );
  if (mwRows && mwRows.length > 0) {
    const mw = mwRows[0];
    const isActive = Boolean(mw.is_active);
    const isFullDay = Boolean(mw.is_full_day);
    const now = getNowIST();
    const curHHMM = now.str.substring(11, 16);
    const isOpen = isActive && (isFullDay || (mw.start_time && mw.end_time && curHHMM >= mw.start_time && curHHMM <= mw.end_time));
    return {
      isOrderable: isOpen,
      message: isOpen
        ? `Store ordering is open until ${mw.end_time}`
        : `Matoshree Kirana Store is currently closed. Operating hours: ${mw.start_time} - ${mw.end_time}`,
      evaluation: null,
    };
  }

  // If no restrictive window configured, default to open
  return {
    isOrderable: true,
    message: 'Store ordering is open.',
    evaluation: null,
  };
};

module.exports = {
  getNowIST,
  parseToISTTimestamp,
  formatISTHuman,
  formatForInput,
  formatForMySQL,
  evaluateMealSlots,
  validateSlotPayload,
  getAllMealSlots,
  getMealSlotsForType,
  getStoreTiming,
  saveStoreTiming,
  saveMealSlotsForType,
  checkMealOrderableNow,
};
