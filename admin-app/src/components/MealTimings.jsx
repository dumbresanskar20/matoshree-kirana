import React, { useState, useEffect } from 'react';
import { 
  Clock, Save, Check, AlertCircle, Sparkles, Sun, CheckCircle, 
  Bell, Eye, EyeOff, Utensils, Edit2, X, Calendar, ArrowRight, ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { createAdminSocketClient } from '../services/socket';

const DEFAULT_MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'];

const MEAL_ICONS = {
  breakfast: '🌅',
  lunch: '☀️',
  snacks: '☕',
  dinner: '🌙',
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
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

// Calculates live status badge for a single slot
const getSlotStatus = (slot) => {
  if (!slot || !slot.is_active) {
    return { label: 'Inactive', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  if (!slot.start_datetime || !slot.end_datetime) {
    return { label: 'Incomplete', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  const now = new Date();
  const start = new Date(slot.start_datetime);
  const end = new Date(slot.end_datetime);
  if (now >= start && now <= end) {
    return { label: 'Running now', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black' };
  }
  if (now < start) {
    return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  }
  return { label: 'Expired', color: 'bg-rose-100 text-rose-700 border-rose-200' };
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
  serving_note: 'Not available right now',
});

// Computes the dynamic note to show on the User app
const getComputedUserNote = (meal, slot1, slot2, isRunningNow, isUpcoming, status1) => {
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
    const prefix = meal.note_prefix || (isRunningNow ? 'Serving now until' : 'Available from');
    const icon = prefix.toLowerCase().includes('serving') ? '🟢' : '⏳';
    return `${icon} ${prefix} ${formattedDt}`;
  }

  if (meal.custom_note && meal.note_prefix === 'Custom Note') {
    return `📢 ${meal.custom_note}`;
  }

  if (isRunningNow) {
    const runEnd = status1.label === 'Running now' ? slot1.end_datetime : slot2.end_datetime;
    return `🟢 Serving now until ${formatISTHuman(runEnd)}`;
  }
  if (isUpcoming) {
    const upStart = status1.label === 'Upcoming' ? slot1.start_datetime : slot2.start_datetime;
    return `⏳ Available from ${formatISTHuman(upStart)}`;
  }
  return '🚫 Not available right now';
};

export default function MealTimings() {
  const [meals, setMeals] = useState(() => DEFAULT_MEAL_TYPES.map(buildDefaultMeal));
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
      let rawMeals = null;

      // 1. Try primary endpoint: /admin/meal-slots
      try {
        const res = await api.get('/admin/meal-slots');
        if (res.data && res.data.success) {
          const raw = res.data.meals || res.data.data;
          if (Array.isArray(raw) && raw.length > 0) {
            rawMeals = raw;
          } else if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
            rawMeals = Object.entries(raw).map(([key, val]) => ({
              meal_type: val.meal_type || key,
              ...val,
            }));
          }
        }
      } catch (adminErr) {
        console.warn('GET /admin/meal-slots notice:', adminErr?.message);
      }

      // 2. Fallback to /menu/windows (which already has slots data)
      if (!rawMeals || rawMeals.length === 0) {
        try {
          const resWin = await api.get('/menu/windows');
          if (resWin.data && resWin.data.success && Array.isArray(resWin.data.windows) && resWin.data.windows.length > 0) {
            rawMeals = resWin.data.windows.map((w) => {
              const type = (w.meal_type || '').toLowerCase();
              let slots = w.slots || [];
              if (!Array.isArray(slots) || slots.length === 0) {
                const today = new Date().toISOString().split('T')[0];
                const sTime = w.start_time || '08:00';
                const eTime = w.end_time || '20:00';
                slots = [
                  {
                    slot_number: 1,
                    is_active: Boolean(w.is_active),
                    start_datetime: `${today}T${sTime}`,
                    end_datetime: `${today}T${eTime}`,
                    note: w.custom_note || '',
                  },
                  {
                    slot_number: 2,
                    is_active: false,
                    start_datetime: '',
                    end_datetime: '',
                    note: '',
                  },
                ];
              }
              return {
                ...w,
                meal_type: type,
                slots,
                isAvailableNow: Boolean(w.isAvailableNow ?? w.is_currently_open),
                activeSlot: w.activeSlot || null,
                nextSlot: w.nextSlot || null,
                serving_note: w.serving_note || '',
                custom_note: w.custom_note || '',
              };
            });
          }
        } catch (winErr) {
          console.warn('GET /menu/windows fallback notice:', winErr?.message);
        }
      }

      // 3. Assemble complete meal list guaranteeing all 4 default meal types exist
      const assembled = DEFAULT_MEAL_TYPES.map((type) => {
        const found = rawMeals?.find((m) => (m.meal_type || '').toLowerCase() === type);
        if (found) {
          const s1 = found.slots?.find((s) => s.slot_number === 1) || {
            slot_number: 1,
            is_active: false,
            start_datetime: '',
            end_datetime: '',
            note: '',
          };
          const s2 = found.slots?.find((s) => s.slot_number === 2) || {
            slot_number: 2,
            is_active: false,
            start_datetime: '',
            end_datetime: '',
            note: '',
          };
          return {
            ...found,
            meal_type: type,
            is_full_day: Boolean(found.is_full_day),
            slots: [s1, s2],
            note_datetime: found.note_datetime || '',
            note_prefix: found.note_prefix || 'Available from',
            custom_note: found.custom_note || '',
          };
        }
        return buildDefaultMeal(type);
      });

      // Also append any additional meal categories from DB (e.g. 'coffee')
      if (Array.isArray(rawMeals)) {
        rawMeals.forEach((m) => {
          const type = (m.meal_type || '').toLowerCase();
          if (type && !DEFAULT_MEAL_TYPES.includes(type)) {
            const s1 = m.slots?.find((s) => s.slot_number === 1) || {
              slot_number: 1,
              is_active: false,
              start_datetime: '',
              end_datetime: '',
              note: '',
            };
            const s2 = m.slots?.find((s) => s.slot_number === 2) || {
              slot_number: 2,
              is_active: false,
              start_datetime: '',
              end_datetime: '',
              note: '',
            };
            assembled.push({
              ...m,
              meal_type: type,
              is_full_day: Boolean(m.is_full_day),
              slots: [s1, s2],
              note_datetime: m.note_datetime || '',
              note_prefix: m.note_prefix || 'Available from',
              custom_note: m.custom_note || '',
            });
          }
        });
      }

      setMeals(assembled);
    } catch (err) {
      console.error('Error fetching meal slots:', err);
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

  // Update a specific field for a slot (1 or 2)
  const handleSlotChange = (mealIndex, slotNumber, field, value) => {
    setMeals((prev) => {
      const copy = [...prev];
      const targetMeal = { ...copy[mealIndex] };
      const slotIndex = slotNumber === 1 ? 0 : 1;
      const targetSlots = [...(targetMeal.slots || [])];

      if (!targetSlots[slotIndex]) {
        targetSlots[slotIndex] = {
          slot_number: slotNumber,
          is_active: false,
          start_datetime: '',
          end_datetime: '',
          note: '',
        };
      } else {
        targetSlots[slotIndex] = { ...targetSlots[slotIndex], [field]: value };
      }

      targetMeal.slots = targetSlots;
      copy[mealIndex] = targetMeal;
      return copy;
    });

    // Clear inline error on change
    const errKey = `${meals[mealIndex].meal_type}_slot${slotNumber}`;
    if (errorsMap[errKey]) {
      setErrorsMap((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  // Update top-level field for a meal (e.g. note_datetime, note_prefix, custom_note, is_full_day)
  const handleMealFieldChange = (mealIndex, field, value) => {
    setMeals((prev) => {
      const copy = [...prev];
      copy[mealIndex] = { ...copy[mealIndex], [field]: value };
      return copy;
    });
  };

  // Validate slots before sending
  const validateSlots = (meal) => {
    const errors = {};
    const slots = meal.slots || [];

    slots.forEach((s) => {
      const sNum = s.slot_number || 1;
      const slotLabel = sNum === 1 ? 'Pre Order Slot' : 'Same day Slot';
      const key = `${meal.meal_type}_slot${sNum}`;

      if (s.is_active) {
        if (!s.start_datetime || !s.end_datetime) {
          errors[key] = `Start and end date & time are required when ${slotLabel} is Active.`;
          return;
        }

        const start = new Date(s.start_datetime).getTime();
        const end = new Date(s.end_datetime).getTime();

        if (isNaN(start) || isNaN(end)) {
          errors[key] = 'Invalid date or time format.';
          return;
        }

        if (end <= start) {
          errors[key] = `${slotLabel}: End date-time must be strictly after start date-time.`;
          return;
        }
      }
    });

    return errors;
  };

  // Save both Pre Order Slot & Same day Slot in one request
  const handleSaveMeal = async (mealIndex) => {
    const meal = meals[mealIndex];
    const validationErrors = validateSlots(meal);

    if (Object.keys(validationErrors).length > 0) {
      setErrorsMap((prev) => ({ ...prev, ...validationErrors }));
      showToast('Please fix validation errors before saving.', 'error');
      return;
    }

    setSavingMap((prev) => ({ ...prev, [meal.meal_type]: true }));

    try {
      const slot1Obj = (meal.slots || []).find((s) => s.slot_number === 1) || null;
      const slot2Obj = (meal.slots || []).find((s) => s.slot_number === 2) || null;
      const status1 = getSlotStatus(slot1Obj);
      const isRunningNow = meal.is_full_day || status1.label === 'Running now' || getSlotStatus(slot2Obj).label === 'Running now';
      const isUpcoming = !meal.is_full_day && (status1.label === 'Upcoming' || getSlotStatus(slot2Obj).label === 'Upcoming');

      const userNoteText = getComputedUserNote(meal, slot1Obj, slot2Obj, isRunningNow, isUpcoming, status1);

      const formatSlotForPayload = (s) => {
        if (!s) return null;
        let startIso = null;
        let endIso = null;
        if (s.start_datetime) {
          const d = new Date(s.start_datetime);
          startIso = isNaN(d.getTime()) ? s.start_datetime : d.toISOString();
        }
        if (s.end_datetime) {
          const d = new Date(s.end_datetime);
          endIso = isNaN(d.getTime()) ? s.end_datetime : d.toISOString();
        }
        return {
          slot_number: s.slot_number,
          start_datetime: startIso,
          end_datetime: endIso,
          is_active: Boolean(s.is_active) ? 1 : 0,
          note: s.note || '',
        };
      };

      const s1Formatted = formatSlotForPayload(slot1Obj);
      const s2Formatted = formatSlotForPayload(slot2Obj);

      const payload = {
        is_full_day: Boolean(meal.is_full_day),
        slots: [s1Formatted, s2Formatted].filter(Boolean),
        slot1: s1Formatted,
        slot2: s2Formatted,
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
          const s1 = slot1Obj;
          const sTime = s1?.start_datetime ? new Date(s1.start_datetime).toTimeString().substring(0, 5) : '08:00';
          const eTime = s1?.end_datetime ? new Date(s1.end_datetime).toTimeString().substring(0, 5) : '20:00';
          res = await api.put(`/menu/windows/${meal.meal_type}`, {
            start_time: sTime,
            end_time: eTime,
            is_active: Boolean(meal.is_full_day || slot1Obj?.is_active || slot2Obj?.is_active),
            is_full_day: Boolean(meal.is_full_day),
            custom_note: userNoteText,
          });
        } else {
          throw putErr;
        }
      }

      if (res.data && res.data.success) {
        showToast(`Timing slots for ${meal.meal_type.toUpperCase()} saved successfully!`);
        fetchMealSlots();
      } else {
        showToast(res.data?.message || 'Failed to save meal slots.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving meal timing windows.';
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
              2-Slot Date &amp; Time System (Pre Order &amp; Same Day)
            </span>
            <span className="text-slate-400 text-xs font-bold">IST (Asia/Kolkata)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Meal Timing Windows
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Configure two serving windows (Pre Order Slot &amp; Same day Slot) or enable 24/7 ordering per meal type with dates, times, custom user notice date/time, and live Active toggles.
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
          <span>Loading meal configuration slots...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {meals.map((meal, mealIdx) => {
            const capitalizedMeal = meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1);
            const isSaving = Boolean(savingMap[meal.meal_type]);

            const slot1 = (meal.slots || []).find((s) => s.slot_number === 1) || {
              slot_number: 1,
              is_active: false,
              start_datetime: '',
              end_datetime: '',
              note: '',
            };

            const slot2 = (meal.slots || []).find((s) => s.slot_number === 2) || {
              slot_number: 2,
              is_active: false,
              start_datetime: '',
              end_datetime: '',
              note: '',
            };

            const status1 = getSlotStatus(slot1);
            const status2 = getSlotStatus(slot2);
            const isRunningNow = meal.is_full_day || status1.label === 'Running now' || status2.label === 'Running now';
            const isUpcoming = !meal.is_full_day && (status1.label === 'Upcoming' || status2.label === 'Upcoming');

            const errSlot1 = errorsMap[`${meal.meal_type}_slot1`];
            const errSlot2 = errorsMap[`${meal.meal_type}_slot2`];

            return (
              <div
                key={meal.meal_type}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300"
              >
                {/* Meal Card Top Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl">{MEAL_ICONS[meal.meal_type.toLowerCase()] || '🍱'}</span>
                    <div>
                      <h3 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight flex items-center gap-2">
                        <span>{capitalizedMeal}</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Pre Order &amp; Same Day Slots
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
                    {meal.is_full_day ? '⚡ 24/7 Always Open' : isRunningNow ? '🟢 Serving Now' : isUpcoming ? '⏳ Upcoming Slot' : '🚫 Unavailable'}
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

                  {/* Pre Order Slot (Slot 1) Block */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      slot1.is_active
                        ? 'bg-emerald-50/30 border-emerald-200 shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                          1
                        </span>
                        <h4 className="font-extrabold text-sm text-slate-900">Pre Order Slot</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${status1.color}`}>
                          {status1.label}
                        </span>
                      </div>

                      {/* Active / Inactive Toggle Switch */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className={`text-xs font-bold ${slot1.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {slot1.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(slot1.is_active)}
                          onChange={(e) => handleSlotChange(mealIdx, 1, 'is_active', e.target.checked)}
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Start Date &amp; Time (IST)
                        </label>
                        <input
                          type="datetime-local"
                          disabled={!slot1.is_active}
                          value={formatForInput(slot1.start_datetime)}
                          onChange={(e) => handleSlotChange(mealIdx, 1, 'start_datetime', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                            !slot1.is_active
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          End Date &amp; Time (IST)
                        </label>
                        <input
                          type="datetime-local"
                          disabled={!slot1.is_active}
                          value={formatForInput(slot1.end_datetime)}
                          onChange={(e) => handleSlotChange(mealIdx, 1, 'end_datetime', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                            !slot1.is_active
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-emerald-500'
                          }`}
                        />
                      </div>
                    </div>

                    {errSlot1 && (
                      <p className="text-xs text-red-600 font-bold mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{errSlot1}</span>
                      </p>
                    )}
                  </div>

                  {/* Same day Slot (Slot 2) Block */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      slot2.is_active
                        ? 'bg-indigo-50/30 border-indigo-200 shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                          2
                        </span>
                        <h4 className="font-extrabold text-sm text-slate-900">Same day Slot</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${status2.color}`}>
                          {status2.label}
                        </span>
                      </div>

                      {/* Active / Inactive Toggle Switch */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className={`text-xs font-bold ${slot2.is_active ? 'text-indigo-700' : 'text-slate-400'}`}>
                          {slot2.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(slot2.is_active)}
                          onChange={(e) => handleSlotChange(mealIdx, 2, 'is_active', e.target.checked)}
                          className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Start Date &amp; Time (IST)
                        </label>
                        <input
                          type="datetime-local"
                          disabled={!slot2.is_active}
                          value={formatForInput(slot2.start_datetime)}
                          onChange={(e) => handleSlotChange(mealIdx, 2, 'start_datetime', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                            !slot2.is_active
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          End Date &amp; Time (IST)
                        </label>
                        <input
                          type="datetime-local"
                          disabled={!slot2.is_active}
                          value={formatForInput(slot2.end_datetime)}
                          onChange={(e) => handleSlotChange(mealIdx, 2, 'end_datetime', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                            !slot2.is_active
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                          }`}
                        />
                      </div>
                    </div>

                    {errSlot2 && (
                      <p className="text-xs text-red-600 font-bold mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{errSlot2}</span>
                      </p>
                    )}
                  </div>

                  {/* Option to select Date & Time for User App Note (Below Same day Slot) */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-amber-200/90 bg-amber-50/50 space-y-3.5 transition-all">
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-700" />
                        <h4 className="font-extrabold text-sm text-slate-900">User App Note Settings</h4>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300/60">
                        User Notice
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Date &amp; Time for User Note (IST)
                        </label>
                        <input
                          type="datetime-local"
                          value={formatForInput(meal.note_datetime || '')}
                          onChange={(e) => handleMealFieldChange(mealIdx, 'note_datetime', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-300/80 bg-white text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                          Select custom date &amp; time to display on the User app note.
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
                          <option value="Available from">Available from [Date &amp; Time]</option>
                          <option value="Serving now until">Serving now until [Date &amp; Time]</option>
                          <option value="Pre-orders open until">Pre-orders open until [Date &amp; Time]</option>
                          <option value="Orders closing at">Orders closing at [Date &amp; Time]</option>
                          <option value="Custom Note">Custom Announcement Message</option>
                        </select>

                        {meal.note_prefix === 'Custom Note' && (
                          <input
                            type="text"
                            placeholder="e.g. Pre-order tomorrow's lunch now"
                            value={meal.custom_note || ''}
                            onChange={(e) => handleMealFieldChange(mealIdx, 'custom_note', e.target.value)}
                            className="w-full mt-2 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* Live User App Note Preview */}
                    <div className="p-3 bg-white/95 rounded-xl border border-amber-200/90 text-xs shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          <span>User App Note Preview:</span>
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
                        {getComputedUserNote(meal, slot1, slot2, isRunningNow, isUpcoming, status1)}
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
                        <span>Saving {capitalizedMeal}...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save {capitalizedMeal} Timings</span>
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
