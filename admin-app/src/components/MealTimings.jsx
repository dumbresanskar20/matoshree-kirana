import React, { useState, useEffect } from 'react';
import { 
  Clock, Save, Check, AlertCircle, Sparkles, CheckCircle, 
  Bell, Calendar, Store, ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { createAdminSocketClient } from '../services/socket';

const LEGACY_MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'];

const STORE_CATEGORY_ICONS = {
  store_hours: '🏬',
  groceries: '🛒',
  grocery: '🛒',
  grains: '🌾',
  spices: '🌶️',
  oils: '🛢️',
  dairy: '🥛',
  beverages: '🧃',
  packaged_food: '📦',
  general: '🏬',
};

// Formats ISO string (or Date) to input 'YYYY-MM-DDTHH:mm' in local/IST
const formatForInput = (dt) => {
  if (!dt) return '';
  if (typeof dt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dt)) {
    return dt.substring(0, 16);
  }
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = d.getHours();
  const minutes = d.getMinutes();
  return `${year}-${month}-${day}T${pad(hours)}:${pad(minutes)}`;
};

// Format human-readable date & time in IST: "Sat, 4 Oct, 12:30 PM"
const formatISTHuman = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Calculates live status badge for the store operating hours slot
const getSlotStatus = (slot) => {
  if (!slot || !slot.is_active) {
    return { label: 'Closed / Inactive', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  if (!slot.start_datetime || !slot.end_datetime) {
    return { label: 'Incomplete', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  const now = new Date();
  const start = new Date(slot.start_datetime);
  const end = new Date(slot.end_datetime);
  if (now >= start && now <= end) {
    return { label: 'Open Now', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black' };
  }
  if (now < start) {
    return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  }
  return { label: 'Closed (Expired)', color: 'bg-rose-100 text-rose-700 border-rose-200' };
};

const buildDefaultMeal = (type) => ({
  meal_type: type,
  is_full_day: false,
  slots: [
    { slot_number: 1, is_active: false, start_datetime: '', end_datetime: '', note: '' },
    { slot_number: 2, is_active: false, start_datetime: '', end_datetime: '', note: '' },
  ],
  note_datetime: '',
  note_prefix: 'Available from',
  custom_note: '',
  isAvailableNow: false,
  activeSlot: null,
  nextSlot: null,
  serving_note: 'Store closed right now',
});

// Computes the dynamic note to show on the Customer app
const getComputedUserNote = (meal, slot, isRunningNow, isUpcoming) => {
  if (meal.is_full_day) {
    if (meal.note_datetime) {
      const formattedDt = formatISTHuman(meal.note_datetime);
      if (meal.note_prefix === 'Custom Note') {
        return meal.custom_note ? `${meal.custom_note} (${formattedDt})` : `Notice: ${formattedDt}`;
      }
      return `🟢 ${meal.note_prefix || 'Orders open 24/7'} ${formattedDt}`;
    }
    if (meal.custom_note && meal.note_prefix === 'Custom Note') {
      return `📢 ${meal.custom_note}`;
    }
    return '🟢 Accepting orders 24/7 (Always Open)';
  }

  if (meal.note_datetime) {
    const formattedDt = formatISTHuman(meal.note_datetime);
    if (meal.note_prefix === 'Custom Note') {
      return meal.custom_note ? `${meal.custom_note} (${formattedDt})` : `Notice: ${formattedDt}`;
    }
    const prefix = meal.note_prefix || (isRunningNow ? 'Store open now until' : 'Store opens at');
    const icon = prefix.toLowerCase().includes('open') ? '🟢' : '⏳';
    return `${icon} ${prefix} ${formattedDt}`;
  }

  if (meal.custom_note && meal.note_prefix === 'Custom Note') {
    return `📢 ${meal.custom_note}`;
  }

  if (isRunningNow && slot?.end_datetime) {
    return `🟢 Store open now until ${formatISTHuman(slot.end_datetime)}`;
  }
  if (isUpcoming && slot?.start_datetime) {
    return `⏳ Store opening at ${formatISTHuman(slot.start_datetime)}`;
  }
  return '🚫 Store closed right now';
};

export default function MealTimings() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState({});
  const [notification, setNotification] = useState(null);
  const [errorsMap, setErrorsMap] = useState({});
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Clock ticker for live status calculation every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchMealSlots = async () => {
    setLoading(true);
    try {
      let rawMeals = [];

      // 1. Try primary endpoint: /admin/meal-slots
      try {
        const res = await api.get('/admin/meal-slots');
        if (res.data && res.data.success) {
          const raw = res.data.meals || res.data.data;
          if (Array.isArray(raw)) {
            rawMeals = raw;
          } else if (raw && typeof raw === 'object') {
            rawMeals = Object.entries(raw).map(([key, val]) => ({
              meal_type: val.meal_type || key,
              ...val,
            }));
          }
        }
      } catch (adminErr) {
        console.warn('GET /admin/meal-slots notice:', adminErr?.message);
      }

      // 2. Fetch /menu/windows
      let windows = [];
      try {
        const resWin = await api.get('/menu/windows');
        if (resWin.data && resWin.data.success && Array.isArray(resWin.data.windows)) {
          windows = resWin.data.windows;
        }
      } catch (winErr) {
        console.warn('GET /menu/windows notice:', winErr?.message);
      }

      // 3. Discover categories from /menu/items
      let itemCategories = [];
      try {
        const resItems = await api.get('/menu/items');
        if (resItems.data && resItems.data.success && Array.isArray(resItems.data.items)) {
          itemCategories = resItems.data.items
            .map((i) => (i.meal_type || i.category || '').toLowerCase().trim())
            .filter((c) => Boolean(c) && !LEGACY_MEAL_TYPES.includes(c));
        }
      } catch (itemErr) {
        console.warn('GET /menu/items notice:', itemErr?.message);
      }

      // Collect all non-legacy category names
      const allCategoryNames = new Set();
      rawMeals.forEach((m) => {
        const t = (m.meal_type || '').toLowerCase().trim();
        if (t && !LEGACY_MEAL_TYPES.includes(t)) allCategoryNames.add(t);
      });
      windows.forEach((w) => {
        const t = (w.meal_type || '').toLowerCase().trim();
        if (t && !LEGACY_MEAL_TYPES.includes(t)) allCategoryNames.add(t);
      });
      itemCategories.forEach((c) => allCategoryNames.add(c));

      // Fallback: If no custom category exists yet, provide a primary "Store Operating Hours" window
      if (allCategoryNames.size === 0) {
        allCategoryNames.add('store_hours');
      }

      const assembled = Array.from(allCategoryNames).map((type) => {
        const found = rawMeals.find((m) => (m.meal_type || '').toLowerCase().trim() === type);
        const foundWin = windows.find((w) => (w.meal_type || '').toLowerCase().trim() === type);

        // Find primary slot or build from window
        const slot1 = found?.slots?.find((s) => s.slot_number === 1) || foundWin?.slots?.[0] || {
          slot_number: 1,
          is_active: Boolean(foundWin?.is_active),
          start_datetime: foundWin?.start_time ? `${new Date().toISOString().split('T')[0]}T${foundWin.start_time}` : '',
          end_datetime: foundWin?.end_time ? `${new Date().toISOString().split('T')[0]}T${foundWin.end_time}` : '',
          note: '',
        };

        const cleanStart = formatForInput(slot1.start_datetime);
        const cleanEnd = formatForInput(slot1.end_datetime);

        return {
          meal_type: type,
          is_full_day: Boolean(found?.is_full_day ?? foundWin?.is_full_day),
          slots: [
            {
              ...slot1,
              slot_number: 1,
              start_datetime: cleanStart,
              end_datetime: cleanEnd,
            },
            {
              ...slot1,
              slot_number: 2,
              start_datetime: cleanStart,
              end_datetime: cleanEnd,
            },
          ],
          note_datetime: found?.note_datetime || '',
          note_prefix: found?.note_prefix || 'Available from',
          custom_note: found?.custom_note || foundWin?.custom_note || '',
          isAvailableNow: Boolean(found?.isAvailableNow ?? foundWin?.isAvailableNow ?? foundWin?.is_currently_open),
        };
      });

      setMeals(assembled);
    } catch (err) {
      console.error('Error fetching store timings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMealSlots();

    const token = localStorage.getItem('token');
    let socket = null;
    if (token) {
      try {
        socket = createAdminSocketClient(token);
        socket.on('mealSlotsUpdated', () => {
          fetchMealSlots();
        });
      } catch (e) {
        console.warn('Socket error in MealTimings:', e);
      }
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Update field for the single store timing slot (synchronizes slot 1 and slot 2)
  const handleSlotChange = (mealIndex, field, value) => {
    setMeals((prev) => {
      const copy = [...prev];
      const targetMeal = { ...copy[mealIndex] };
      const currentSlots = targetMeal.slots || [];
      const baseSlot = currentSlots[0] || {
        slot_number: 1,
        is_active: false,
        start_datetime: '',
        end_datetime: '',
        note: '',
      };

      const updatedSlot = { ...baseSlot, [field]: value };
      targetMeal.slots = [
        { ...updatedSlot, slot_number: 1 },
        { ...updatedSlot, slot_number: 2 },
      ];

      copy[mealIndex] = targetMeal;
      return copy;
    });

    // Clear inline error on change
    const errKey = `${meals[mealIndex]?.meal_type}_slot`;
    if (errorsMap[errKey]) {
      setErrorsMap((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  // Update top-level field for category (note_datetime, note_prefix, custom_note, is_full_day)
  const handleMealFieldChange = (mealIndex, field, value) => {
    setMeals((prev) => {
      const copy = [...prev];
      copy[mealIndex] = { ...copy[mealIndex], [field]: value };
      return copy;
    });
  };

  // Validate single slot before sending
  const validateSlot = (meal) => {
    const errors = {};
    const slot = (meal.slots || [])[0];
    const key = `${meal.meal_type}_slot`;

    if (slot && slot.is_active) {
      if (!slot.start_datetime || !slot.end_datetime) {
        errors[key] = 'Store opening and closing date & time are required when Store Timing is Active.';
        return errors;
      }

      const start = new Date(slot.start_datetime).getTime();
      const end = new Date(slot.end_datetime).getTime();

      if (isNaN(start) || isNaN(end)) {
        errors[key] = 'Invalid date or time format.';
        return errors;
      }

      if (end <= start) {
        errors[key] = 'Store closing time must be strictly after store opening time.';
        return errors;
      }
    }

    return errors;
  };

  // Save single store timing slot (applies identically to pre-order and same-day order)
  const handleSaveMeal = async (mealIndex) => {
    const meal = meals[mealIndex];
    const validationErrors = validateSlot(meal);

    if (Object.keys(validationErrors).length > 0) {
      setErrorsMap((prev) => ({ ...prev, ...validationErrors }));
      showToast('Please fix validation errors before saving.', 'error');
      return;
    }

    setSavingMap((prev) => ({ ...prev, [meal.meal_type]: true }));

    try {
      const slotObj = (meal.slots || [])[0] || { slot_number: 1, is_active: false };
      const status = getSlotStatus(slotObj);
      const isRunningNow = meal.is_full_day || status.label === 'Open Now';
      const isUpcoming = !meal.is_full_day && status.label === 'Upcoming';

      const userNoteText = getComputedUserNote(meal, slotObj, isRunningNow, isUpcoming);

      let startIso = null;
      let endIso = null;
      if (slotObj.start_datetime) {
        const d = new Date(slotObj.start_datetime);
        startIso = isNaN(d.getTime()) ? slotObj.start_datetime : d.toISOString();
      }
      if (slotObj.end_datetime) {
        const d = new Date(slotObj.end_datetime);
        endIso = isNaN(d.getTime()) ? slotObj.end_datetime : d.toISOString();
      }

      // Same timing for both slot 1 (pre-order) and slot 2 (same-day)
      const slot1Payload = {
        slot_number: 1,
        start_datetime: startIso,
        end_datetime: endIso,
        is_active: Boolean(slotObj.is_active) ? 1 : 0,
        note: slotObj.note || '',
      };
      const slot2Payload = {
        slot_number: 2,
        start_datetime: startIso,
        end_datetime: endIso,
        is_active: Boolean(slotObj.is_active) ? 1 : 0,
        note: slotObj.note || '',
      };

      const payload = {
        is_full_day: Boolean(meal.is_full_day),
        slots: [slot1Payload, slot2Payload],
        slot1: slot1Payload,
        slot2: slot2Payload,
        note_datetime: meal.note_datetime ? new Date(meal.note_datetime).toISOString() : null,
        note_prefix: meal.note_prefix || 'Available from',
        custom_note: userNoteText,
        serving_note: userNoteText,
      };

      let res;
      try {
        res = await api.put(`/admin/meal-slots/${meal.meal_type}`, payload);
      } catch (putErr) {
        if (putErr.response?.status === 404) {
          const sTime = slotObj?.start_datetime ? new Date(slotObj.start_datetime).toTimeString().substring(0, 5) : '08:00';
          const eTime = slotObj?.end_datetime ? new Date(slotObj.end_datetime).toTimeString().substring(0, 5) : '20:00';
          res = await api.put(`/menu/windows/${meal.meal_type}`, {
            start_time: sTime,
            end_time: eTime,
            is_active: Boolean(meal.is_full_day || slotObj?.is_active),
            is_full_day: Boolean(meal.is_full_day),
            custom_note: userNoteText,
          });
        } else {
          throw putErr;
        }
      }

      if (res.data && res.data.success) {
        showToast(`Store timings for ${meal.meal_type.replace(/_/g, ' ').toUpperCase()} saved successfully!`);
        fetchMealSlots();
      } else {
        showToast(res.data?.message || 'Failed to save store timing.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving store timing.';
      showToast(msg, 'error');
    } finally {
      setSavingMap((prev) => ({ ...prev, [meal.meal_type]: false }));
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600" /> : <Check className="w-5 h-5 text-emerald-600" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
              Single Store Operating Hours
            </span>
            <span className="text-slate-400 text-xs font-bold">IST (Asia/Kolkata)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Store Operating Hours &amp; Timings
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Configure store opening and closing times or enable 24/7 ordering with live status, customer notice, and active toggles. The same timing applies to both pre-orders and same-day orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-700">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>IST Live: {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading store operating hours...</span>
        </div>
      ) : meals.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700">No Store Categories Found</h3>
          <p className="text-sm text-slate-400 mt-1">Add items or categories in Store Catalog to configure timings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {meals.map((meal, mealIdx) => {
            const rawName = meal.meal_type.replace(/_/g, ' ');
            const displayName = rawName === 'store hours' ? 'Store Operating Hours' : rawName.charAt(0).toUpperCase() + rawName.slice(1);
            const isSaving = Boolean(savingMap[meal.meal_type]);

            const slot = (meal.slots || [])[0] || {
              slot_number: 1,
              is_active: false,
              start_datetime: '',
              end_datetime: '',
              note: '',
            };

            const status = getSlotStatus(slot);
            const isRunningNow = meal.is_full_day || status.label === 'Open Now';
            const isUpcoming = !meal.is_full_day && status.label === 'Upcoming';
            const errSlot = errorsMap[`${meal.meal_type}_slot`];

            return (
              <div
                key={meal.meal_type}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300"
              >
                {/* Card Top Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl">{STORE_CATEGORY_ICONS[meal.meal_type.toLowerCase()] || '🏬'}</span>
                    <div>
                      <h3 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight flex items-center gap-2">
                        <span>{displayName}</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Store Opening &amp; Closing Schedule
                      </span>
                    </div>
                  </div>

                  {/* Overall Orderable Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-xs ${
                      meal.is_full_day
                        ? 'bg-purple-600 text-white animate-pulse'
                        : isRunningNow
                        ? 'bg-emerald-600 text-white'
                        : isUpcoming
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {meal.is_full_day ? '⚡ 24/7 Always Open' : isRunningNow ? '🟢 Store Open Now' : isUpcoming ? '⏳ Upcoming Slot' : '🚫 Store Closed'}
                  </span>
                </div>

                {/* Slots Configuration Section */}
                <div className="p-4 sm:p-6 space-y-5 flex-1">
                  
                  {/* 24/7 Ordering Toggle Banner */}
                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    meal.is_full_day
                      ? 'bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border-purple-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                        meal.is_full_day ? 'bg-purple-600 text-white shadow-purple-500/20 shadow-sm' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs sm:text-sm text-slate-900">
                            Accept Orders 24/7
                          </h4>
                          {meal.is_full_day && (
                            <span className="bg-purple-100 text-purple-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-purple-200">
                              Active Round the Clock
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {meal.is_full_day
                            ? 'Always open for ordering without slot time restrictions.'
                            : 'Enable to accept orders 24 hours a day continuously.'}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(meal.is_full_day)}
                        onChange={(e) => handleMealFieldChange(mealIdx, 'is_full_day', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 shadow-inner"></div>
                    </label>
                  </div>

                  {/* Single Slot: Store Opening & Closing Hours */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      slot.is_active
                        ? 'bg-emerald-50/30 border-emerald-200 shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80 mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-extrabold text-sm text-slate-900">Store Operating Hours</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Active / Inactive Toggle Switch */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className={`text-xs font-bold ${slot.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {slot.is_active ? 'Store Open' : 'Store Closed'}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(slot.is_active)}
                          onChange={(e) => handleSlotChange(mealIdx, 'is_active', e.target.checked)}
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Store Opening Time (IST)
                        </label>
                        <input
                          type="datetime-local"
                          disabled={!slot.is_active}
                          value={formatForInput(slot.start_datetime)}
                          onChange={(e) => handleSlotChange(mealIdx, 'start_datetime', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                            !slot.is_active
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Store Closing Time (IST)
                        </label>
                        <input
                          type="datetime-local"
                          disabled={!slot.is_active}
                          value={formatForInput(slot.end_datetime)}
                          onChange={(e) => handleSlotChange(mealIdx, 'end_datetime', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                            !slot.is_active
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium mt-2.5">
                      This timing applies to both pre-orders and same-day orders. Customers can place orders during these hours.
                    </p>

                    {errSlot && (
                      <p className="text-xs text-red-600 font-bold mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{errSlot}</span>
                      </p>
                    )}
                  </div>

                  {/* Customer App Note Settings */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-amber-200/90 bg-amber-50/50 space-y-3.5 transition-all">
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-700" />
                        <h4 className="font-extrabold text-sm text-slate-900">Customer App Note Settings</h4>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300/60">
                        Customer Notice
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Date &amp; Time for Customer Note (IST)
                        </label>
                        <input
                          type="datetime-local"
                          value={formatForInput(meal.note_datetime || '')}
                          onChange={(e) => handleMealFieldChange(mealIdx, 'note_datetime', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-300/80 bg-white text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                          Optional custom date &amp; time to display on the Customer app notice.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Note Display Type
                        </label>
                        <select
                          value={meal.note_prefix || 'Available from'}
                          onChange={(e) => handleMealFieldChange(mealIdx, 'note_prefix', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-300/80 bg-white text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        >
                          <option value="Available from">Store open from [Date &amp; Time]</option>
                          <option value="Serving now until">Store open now until [Date &amp; Time]</option>
                          <option value="Pre-orders open until">Orders open until [Date &amp; Time]</option>
                          <option value="Orders closing at">Orders closing at [Date &amp; Time]</option>
                          <option value="Custom Note">Custom Announcement Message</option>
                        </select>

                        {meal.note_prefix === 'Custom Note' && (
                          <input
                            type="text"
                            placeholder="e.g. Orders placed today will be delivered between 4 PM - 7 PM"
                            value={meal.custom_note || ''}
                            onChange={(e) => handleMealFieldChange(mealIdx, 'custom_note', e.target.value)}
                            className="w-full mt-2 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* Live Customer App Note Preview */}
                    <div className="p-3 bg-white/95 rounded-xl border border-amber-200/90 text-xs shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          <span>Customer App Note Preview:</span>
                        </span>
                        {meal.note_datetime && (
                          <button
                            type="button"
                            onClick={() => {
                              handleMealFieldChange(mealIdx, 'note_datetime', '');
                              handleMealFieldChange(mealIdx, 'note_prefix', 'Available from');
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                          >
                            Reset to auto timing
                          </button>
                        )}
                      </div>
                      <p className="text-stone-800 font-semibold text-xs leading-relaxed">
                        {getComputedUserNote(meal, slot, isRunningNow, isUpcoming)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save CTA */}
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveMeal(mealIdx)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving {displayName}...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save {displayName} Schedule</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
