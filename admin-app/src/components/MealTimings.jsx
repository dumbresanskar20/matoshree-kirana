import React, { useState, useEffect } from 'react';
import { 
  Clock, Save, Check, AlertCircle, Sparkles, CheckCircle, 
  Bell, Calendar, Store, ArrowRight, ShieldCheck, Tag, Info
} from 'lucide-react';
import api from '../services/api';
import { createAdminSocketClient } from '../services/socket';

const CATEGORY_ICONS = {
  store_hours: '🏬',
  groceries: '🛒',
  grocery: '🛒',
  grains_pulses: '🌾',
  'grains & pulses': '🌾',
  grains: '🌾',
  flours_grains: '🍞',
  dals_pulses: '🥣',
  oils_ghee: '🛢️',
  spices_masalas: '🌶️',
  spices: '🌶️',
  dairy_eggs: '🥛',
  dairy: '🥛',
  snacks_beverages: '☕',
  beverages: '🧃',
  personal_care: '🧼',
  household: '🧹',
  daily_essentials: '🛒',
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
const getSlotStatus = (slot, isFullDay) => {
  if (isFullDay) {
    return { label: '24/7 Always Open', color: 'bg-purple-100 text-purple-900 border-purple-300 font-black' };
  }
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
    return { label: 'Store Open Now', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black' };
  }
  if (now < start) {
    return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  }
  return { label: 'Closed (Expired)', color: 'bg-rose-100 text-rose-700 border-rose-200' };
};

const buildDefaultStoreTiming = () => ({
  meal_type: 'store_hours',
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
const getComputedUserNote = (timing, slot, isRunningNow, isUpcoming) => {
  if (timing.is_full_day) {
    if (timing.note_datetime) {
      const formattedDt = formatISTHuman(timing.note_datetime);
      if (timing.note_prefix === 'Custom Note') {
        return timing.custom_note ? `${timing.custom_note} (${formattedDt})` : `Notice: ${formattedDt}`;
      }
      return `🟢 ${timing.note_prefix || 'Store open 24/7'} ${formattedDt}`;
    }
    if (timing.custom_note && timing.note_prefix === 'Custom Note') {
      return `📢 ${timing.custom_note}`;
    }
    return '🟢 Accepting orders 24/7 (Always Open)';
  }

  if (timing.note_datetime) {
    const formattedDt = formatISTHuman(timing.note_datetime);
    if (timing.note_prefix === 'Custom Note') {
      return timing.custom_note ? `${timing.custom_note} (${formattedDt})` : `Notice: ${formattedDt}`;
    }
    const prefix = timing.note_prefix || (isRunningNow ? 'Store open now until' : 'Store opens at');
    const icon = prefix.toLowerCase().includes('open') ? '🟢' : '⏳';
    return `${icon} ${prefix} ${formattedDt}`;
  }

  if (timing.custom_note && timing.note_prefix === 'Custom Note') {
    return `📢 ${timing.custom_note}`;
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
  const [storeTiming, setStoreTiming] = useState(buildDefaultStoreTiming());
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [errors, setErrors] = useState({});
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

  const fetchStoreTimingData = async () => {
    setLoading(true);
    try {
      let resolvedTiming = null;

      // 1. Fetch unified store timing from /admin/meal-slots/store-timing
      try {
        const res = await api.get('/admin/meal-slots/store-timing');
        if (res.data && res.data.success && res.data.data) {
          resolvedTiming = res.data.data;
        }
      } catch (err) {
        console.warn('GET /admin/meal-slots/store-timing notice:', err?.message);
      }

      // 2. Fallback: check /admin/meal-slots
      if (!resolvedTiming || (!resolvedTiming.is_full_day && (!resolvedTiming.slots || !resolvedTiming.slots.some(s => s.start_datetime || s.is_active)))) {
        try {
          const resAll = await api.get('/admin/meal-slots');
          if (resAll.data && resAll.data.success) {
            const raw = resAll.data.data || resAll.data.meals;
            if (raw && typeof raw === 'object' && raw.store_hours) {
              resolvedTiming = raw.store_hours;
            } else if (Array.isArray(raw)) {
              resolvedTiming = raw.find((m) => (m.meal_type || '').toLowerCase() === 'store_hours') || raw[0];
            }
          }
        } catch (adminErr) {
          console.warn('GET /admin/meal-slots notice:', adminErr?.message);
        }
      }

      // 3. Fallback: check /menu/windows for store_hours
      let windowItems = [];
      try {
        const resWin = await api.get('/menu/windows');
        if (resWin.data && resWin.data.success && Array.isArray(resWin.data.windows)) {
          windowItems = resWin.data.windows;
          if (!resolvedTiming && resWin.data.store_timing) {
            resolvedTiming = resWin.data.store_timing;
          }
          if (!resolvedTiming) {
            const foundStore = windowItems.find((w) => (w.meal_type || '').toLowerCase() === 'store_hours');
            if (foundStore) {
              resolvedTiming = foundStore;
            }
          }
        }
      } catch (winErr) {
        console.warn('GET /menu/windows notice:', winErr?.message);
      }

      // 4. Discover all product categories in the store to display as governed categories
      let categoryList = [];
      try {
        const resItems = await api.get('/menu/items');
        if (resItems.data && resItems.data.success && Array.isArray(resItems.data.items)) {
          const names = new Set();
          resItems.data.items.forEach((item) => {
            const cName = item.category_name || item.category || item.meal_type;
            if (cName && cName.toLowerCase() !== 'store_hours') {
              names.add(cName);
            }
          });
          categoryList = Array.from(names);
        }
      } catch (itemErr) {
        console.warn('GET /menu/items notice:', itemErr?.message);
      }

      if (categoryList.length === 0 && windowItems.length > 0) {
        categoryList = windowItems
          .map((w) => w.category_name || w.name || w.meal_type)
          .filter((n) => n && n.toLowerCase() !== 'store_hours');
      }

      if (categoryList.length === 0) {
        categoryList = [
          'Groceries & Staples',
          'Grains & Pulses',
          'Atta, Flours & Grains',
          'Dals & Pulses',
          'Edible Oils & Ghee',
          'Spices & Masalas',
          'Dairy & Eggs',
          'Snacks & Beverages',
          'Personal Care',
          'Cleaning & Household',
          'Daily Essentials',
        ];
      }
      setCategories(categoryList);

      // Build consolidated Store Timing object
      const base = resolvedTiming || {};
      const slot1 = base.slots?.find((s) => s.slot_number === 1) || base.slots?.[0] || {
        slot_number: 1,
        is_active: Boolean(base.is_active),
        start_datetime: base.start_time ? `${new Date().toISOString().split('T')[0]}T${base.start_time}` : '',
        end_datetime: base.end_time ? `${new Date().toISOString().split('T')[0]}T${base.end_time}` : '',
        note: '',
      };

      const cleanStart = formatForInput(slot1.start_datetime);
      const cleanEnd = formatForInput(slot1.end_datetime);

      setStoreTiming({
        meal_type: 'store_hours',
        is_full_day: Boolean(base.is_full_day),
        slots: [
          {
            ...slot1,
            slot_number: 1,
            start_datetime: cleanStart,
            end_datetime: cleanEnd,
            is_active: Boolean(slot1.is_active),
          },
          {
            ...slot1,
            slot_number: 2,
            start_datetime: cleanStart,
            end_datetime: cleanEnd,
            is_active: Boolean(slot1.is_active),
          },
        ],
        note_datetime: base.note_datetime ? formatForInput(base.note_datetime) : '',
        note_prefix: base.note_prefix || 'Available from',
        custom_note: base.custom_note || '',
        isAvailableNow: Boolean(base.isAvailableNow ?? base.is_currently_open),
      });
    } catch (err) {
      console.error('Error fetching store operating hours:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreTimingData();

    const token = localStorage.getItem('token');
    let socket = null;
    if (token) {
      try {
        socket = createAdminSocketClient(token);
        socket.on('mealSlotsUpdated', () => {
          fetchStoreTimingData();
        });
        socket.on('store_timing:updated', () => {
          fetchStoreTimingData();
        });
      } catch (e) {
        console.warn('Socket error in MealTimings:', e);
      }
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Update field for the store operating hours slot (syncs slot 1 & 2)
  const handleSlotChange = (field, value) => {
    setStoreTiming((prev) => {
      const currentSlots = prev.slots || [];
      const baseSlot = currentSlots[0] || {
        slot_number: 1,
        is_active: false,
        start_datetime: '',
        end_datetime: '',
        note: '',
      };

      const updatedSlot = { ...baseSlot, [field]: value };
      return {
        ...prev,
        slots: [
          { ...updatedSlot, slot_number: 1 },
          { ...updatedSlot, slot_number: 2 },
        ],
      };
    });

    if (errors.slot) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.slot;
        return next;
      });
    }
  };

  // Update top-level timing field (is_full_day, note_datetime, note_prefix, custom_note)
  const handleFieldChange = (field, value) => {
    setStoreTiming((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Validate store operating hours
  const validateTiming = () => {
    const errs = {};
    const slot = (storeTiming.slots || [])[0];

    if (!storeTiming.is_full_day && slot && slot.is_active) {
      if (!slot.start_datetime || !slot.end_datetime) {
        errs.slot = 'Store opening and closing date & time are required when Store Timing is active.';
        return errs;
      }

      const start = new Date(slot.start_datetime).getTime();
      const end = new Date(slot.end_datetime).getTime();

      if (isNaN(start) || isNaN(end)) {
        errs.slot = 'Invalid date or time format.';
        return errs;
      }

      if (end <= start) {
        errs.slot = 'Store closing time must be strictly after store opening time.';
        return errs;
      }
    }

    return errs;
  };

  // Save unified store operating hours
  const handleSaveStoreTiming = async () => {
    const validationErrors = validateTiming();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('Please fix validation errors before saving.', 'error');
      return;
    }

    setSaving(true);
    try {
      const slotObj = (storeTiming.slots || [])[0] || { slot_number: 1, is_active: false };
      const status = getSlotStatus(slotObj, storeTiming.is_full_day);
      const isRunningNow = storeTiming.is_full_day || status.label === 'Store Open Now';
      const isUpcoming = !storeTiming.is_full_day && status.label === 'Upcoming';

      const userNoteText = getComputedUserNote(storeTiming, slotObj, isRunningNow, isUpcoming);

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

      const slotPayload = {
        slot_number: 1,
        start_datetime: startIso,
        end_datetime: endIso,
        is_active: Boolean(slotObj.is_active) ? 1 : 0,
        note: slotObj.note || '',
      };

      const payload = {
        is_full_day: Boolean(storeTiming.is_full_day),
        slots: [slotPayload, { ...slotPayload, slot_number: 2 }],
        slot1: slotPayload,
        slot2: { ...slotPayload, slot_number: 2 },
        note_datetime: storeTiming.note_datetime ? new Date(storeTiming.note_datetime).toISOString() : null,
        note_prefix: storeTiming.note_prefix || 'Available from',
        custom_note: userNoteText,
        serving_note: userNoteText,
      };

      let res;
      try {
        res = await api.put('/admin/meal-slots/store-timing', payload);
      } catch (putErr) {
        // Fallback to /admin/meal-slots/store_hours
        try {
          res = await api.put('/admin/meal-slots/store_hours', payload);
        } catch (putErr2) {
          const sTime = slotObj?.start_datetime ? new Date(slotObj.start_datetime).toTimeString().substring(0, 5) : '08:00';
          const eTime = slotObj?.end_datetime ? new Date(slotObj.end_datetime).toTimeString().substring(0, 5) : '20:00';
          res = await api.put('/menu/windows/store_hours', {
            start_time: sTime,
            end_time: eTime,
            is_active: Boolean(storeTiming.is_full_day || slotObj?.is_active),
            is_full_day: Boolean(storeTiming.is_full_day),
            custom_note: userNoteText,
          });
        }
      }

      if (res.data && res.data.success) {
        showToast('Store operating hours saved successfully! All categories updated.');
        fetchStoreTimingData();
      } else {
        showToast(res.data?.message || 'Failed to save store timing.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving store operating hours.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const slot = (storeTiming.slots || [])[0] || {
    slot_number: 1,
    is_active: false,
    start_datetime: '',
    end_datetime: '',
    note: '',
  };

  const status = getSlotStatus(slot, storeTiming.is_full_day);
  const isRunningNow = storeTiming.is_full_day || status.label === 'Store Open Now';
  const isUpcoming = !storeTiming.is_full_day && status.label === 'Upcoming';

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-5xl mx-auto">
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-200">
              Unified Store Schedule
            </span>
            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-blue-200">
              All Categories Included
            </span>
            <span className="text-slate-400 text-xs font-bold">IST (Asia/Kolkata)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1.5 flex items-center gap-2.5">
            <span>Store Operating Hours &amp; Timings</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1 max-w-2xl">
            Configure the opening and closing hours for the entire store or enable 24/7 ordering. All product categories share this store schedule so customers can order everything together in one unified window.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-700">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>IST Live: {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Information Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-2xl border border-emerald-200/90 text-xs text-emerald-950 flex items-start gap-3 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
          🏬
        </div>
        <div className="space-y-0.5">
          <h4 className="font-extrabold text-emerald-950 text-xs sm:text-sm">
            Unified Store Timing Active
          </h4>
          <p className="text-emerald-800 leading-relaxed font-medium">
            Instead of giving separate time settings to each product category, Matoshree Kirana operates under a single store timing. When the store is open, all products across all categories can be ordered together without individual category restrictions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold flex flex-col items-center gap-3 bg-white rounded-3xl border border-slate-200">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading store operating hours...</span>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:border-slate-300">
          
          {/* Card Top Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                🏬
              </span>
              <div>
                <h3 className="font-black text-xl sm:text-2xl text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Matoshree Kirana Store Hours</span>
                </h3>
                <span className="text-xs text-slate-500 font-bold block mt-0.5">
                  Applies to all products across all categories
                </span>
              </div>
            </div>

            {/* Overall Orderable Status Badge */}
            <span
              className={`px-4 py-1.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xs border ${
                storeTiming.is_full_day
                  ? 'bg-purple-600 text-white border-purple-500 animate-pulse'
                  : isRunningNow
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isUpcoming
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {storeTiming.is_full_day ? '⚡ 24/7 Always Open' : isRunningNow ? '🟢 Store Open Now' : isUpcoming ? '⏳ Upcoming Slot' : '🚫 Store Closed'}
            </span>
          </div>

          {/* Form Settings Content */}
          <div className="p-4 sm:p-7 space-y-6">

            {/* 1. 24/7 Ordering Toggle Banner */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
              storeTiming.is_full_day
                ? 'bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border-purple-300 shadow-sm'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                  storeTiming.is_full_day ? 'bg-purple-600 text-white shadow-purple-500/20 shadow-sm' : 'bg-slate-200 text-slate-500'
                }`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-sm sm:text-base text-slate-900">
                      Accept Orders 24/7 (Always Open)
                    </h4>
                    {storeTiming.is_full_day && (
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-purple-200">
                        Active Round the Clock
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {storeTiming.is_full_day
                      ? 'The entire store is always open for ordering without time slot restrictions. Customers can order any product 24 hours a day.'
                      : 'Enable this to accept orders 24 hours a day continuously across all categories.'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(storeTiming.is_full_day)}
                  onChange={(e) => handleFieldChange('is_full_day', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 shadow-inner"></div>
              </label>
            </div>

            {/* 2. Store Operating Hours (Opening & Closing) */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                slot.is_active
                  ? 'bg-emerald-50/30 border-emerald-200 shadow-xs'
                  : 'bg-slate-50/80 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Store Operating Hours
                  </h4>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {/* Active / Closed Toggle Switch */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className={`text-xs font-bold ${slot.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {slot.is_active ? 'Store Status: Open' : 'Store Status: Closed'}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(slot.is_active)}
                    onChange={(e) => handleSlotChange('is_active', e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Store Opening Time (IST)
                  </label>
                  <input
                    type="datetime-local"
                    disabled={!slot.is_active}
                    value={formatForInput(slot.start_datetime)}
                    onChange={(e) => handleSlotChange('start_datetime', e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                      !slot.is_active
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-emerald-500 shadow-2xs'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Store Closing Time (IST)
                  </label>
                  <input
                    type="datetime-local"
                    disabled={!slot.is_active}
                    value={formatForInput(slot.end_datetime)}
                    onChange={(e) => handleSlotChange('end_datetime', e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition ${
                      !slot.is_active
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-900 border-slate-300 focus:ring-2 focus:ring-emerald-500 shadow-2xs'
                    }`}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium mt-3">
                This schedule applies to all orders (pre-orders and same-day delivery). Customers can place orders for all categories during these hours.
              </p>

              {errors.slot && (
                <p className="text-xs text-red-600 font-bold mt-2.5 flex items-center gap-1.5 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errors.slot}</span>
                </p>
              )}
            </div>

            {/* 3. Customer App Store Notice & Announcement */}
            <div className="p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-4 transition-all">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Customer App Store Notice &amp; Announcement
                  </h4>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300/60">
                  Customer Banner
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Date &amp; Time for Customer Note (IST)
                  </label>
                  <input
                    type="datetime-local"
                    value={formatForInput(storeTiming.note_datetime || '')}
                    onChange={(e) => handleFieldChange('note_datetime', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300/80 bg-white text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Optional custom date &amp; time to display in the customer app notice banner.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Notice Display Type
                  </label>
                  <select
                    value={storeTiming.note_prefix || 'Available from'}
                    onChange={(e) => handleFieldChange('note_prefix', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300/80 bg-white text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  >
                    <option value="Available from">Store open from [Date &amp; Time]</option>
                    <option value="Serving now until">Store open now until [Date &amp; Time]</option>
                    <option value="Pre-orders open until">Orders open until [Date &amp; Time]</option>
                    <option value="Orders closing at">Orders closing at [Date &amp; Time]</option>
                    <option value="Custom Note">Custom Announcement Message</option>
                  </select>

                  {storeTiming.note_prefix === 'Custom Note' && (
                    <input
                      type="text"
                      placeholder="e.g. Same-day deliveries placed before 6 PM will be dispatched today!"
                      value={storeTiming.custom_note || ''}
                      onChange={(e) => handleFieldChange('custom_note', e.target.value)}
                      className="w-full mt-2.5 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>
              </div>

              {/* Live Customer App Note Preview */}
              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 text-xs shadow-2xs space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                    <span>Customer App Banner Preview:</span>
                  </span>
                  {storeTiming.note_datetime && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange('note_datetime', '');
                        handleFieldChange('note_prefix', 'Available from');
                      }}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                    >
                      Reset to auto timing
                    </button>
                  )}
                </div>
                <p className="text-stone-800 font-semibold text-xs sm:text-sm leading-relaxed">
                  {getComputedUserNote(storeTiming, slot, isRunningNow, isUpcoming)}
                </p>
              </div>
            </div>

            {/* 4. Product Categories Governed by this Timing */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-800">
                    Product Categories Governed by this Timing
                  </h4>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-200">
                  {categories.length} Categories
                </span>
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                All products across the categories below will be ordered within this single store schedule. No separate category timings need to be configured.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {categories.map((catName) => {
                  const cleanKey = catName.toLowerCase().replace(/[\s&]+/g, '_');
                  const icon = CATEGORY_ICONS[cleanKey] || '🛒';
                  return (
                    <span
                      key={catName}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs"
                    >
                      <span>{icon}</span>
                      <span>{catName}</span>
                      <Check className="w-3 h-3 text-emerald-600 ml-0.5" />
                    </span>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Save Footer CTA */}
          <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Saves unified schedule across all catalog products immediately.</span>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveStoreTiming}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 min-h-[46px]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Store Schedule...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Store Operating Hours</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
