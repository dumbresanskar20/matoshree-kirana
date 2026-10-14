import React from 'react';
import { Clock, Utensils, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { useCart } from '../context/CartContext';

/**
 * MealTimingNote Component
 * ────────────────────────
 * Displays slot-aware dynamic food service / ordering window notice configured by Admin.
 *
 * Rules:
 * - Meal available now: "Serving now until {end date-time}"
 * - Meal not available but a future slot is active: "Available from {start date-time}"
 * - No active slots or all expired: "Not available right now"
 * - Computed directly from API response (`currentMealWindow.serving_note`, `isAvailableNow`, `activeSlot`, `nextSlot`)
 */
export default function MealTimingNote() {
  const { currentMealWindow, selectedMealType } = useCart();

  if (!currentMealWindow) return null;

  const mealKey = (selectedMealType || currentMealWindow.meal_type || 'lunch').toLowerCase();
  const capitalizedMeal = mealKey.charAt(0).toUpperCase() + mealKey.slice(1);

  const isFullDay = Boolean(currentMealWindow.is_full_day);
  const isAvailableNow = isFullDay || Boolean(currentMealWindow.isAvailableNow ?? currentMealWindow.is_currently_open);
  const servingNote = currentMealWindow.serving_note;
  const activeSlot = currentMealWindow.activeSlot;
  const nextSlot = currentMealWindow.nextSlot;
  const customNote = currentMealWindow.custom_note && currentMealWindow.custom_note.trim();

  // If no serving_note was pre-calculated, build standard fallback
  let displayNote = servingNote;
  let statusBadge = '';
  let theme = 'available'; // 'available' | 'upcoming' | 'closed'

  if (isFullDay) {
    theme = 'available';
    statusBadge = '24/7 Open';
    if (!displayNote) {
      displayNote = customNote || 'Accepting orders 24/7 (Always Open)';
    }
  } else if (isAvailableNow) {
    theme = 'available';
    statusBadge = 'Store Open';
    if (!displayNote) {
      displayNote = activeSlot?.end_datetime 
        ? `Store open now until ${new Date(activeSlot.end_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`
        : 'Store open for orders';
    }
  } else if (nextSlot) {
    theme = 'upcoming';
    statusBadge = 'Upcoming Opening';
    if (!displayNote) {
      displayNote = nextSlot.start_datetime
        ? `Store opens at ${new Date(nextSlot.start_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`
        : 'Store opening soon';
    }
  } else {
    theme = 'closed';
    statusBadge = 'Store Closed';
    if (!displayNote) {
      displayNote = 'Store closed right now';
    }
  }

  return (
    <div className="mb-5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`p-4 sm:p-5 rounded-3xl border-2 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        theme === 'available'
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50/70 to-amber-50 border-emerald-400 text-emerald-950'
          : theme === 'upcoming'
          ? 'bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-100/60 border-amber-400 text-amber-950'
          : 'bg-gradient-to-r from-slate-100 via-stone-100 to-rose-50 border-stone-300 text-stone-800'
      }`}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
            theme === 'available'
              ? 'bg-emerald-600 text-white shadow-emerald-600/20 animate-pulse'
              : theme === 'upcoming'
              ? 'bg-amber-500 text-white shadow-amber-500/20'
              : 'bg-stone-500 text-white'
          }`}>
            {theme === 'available' ? (
              <Utensils className="w-5 h-5 fill-white/20" />
            ) : theme === 'upcoming' ? (
              <Clock className="w-5 h-5 fill-white/20" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                <span>{theme === 'available' ? '🟢' : theme === 'upcoming' ? '⏳' : '🚫'}</span>
                <span>Store Operating Hours</span>
              </span>
              <span className={`text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs ${
                theme === 'available'
                  ? 'bg-emerald-600'
                  : theme === 'upcoming'
                  ? 'bg-amber-600'
                  : 'bg-stone-600'
              }`}>
                {statusBadge}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold leading-relaxed">
              <strong className="font-extrabold mr-1">Status:</strong>
              <span className="font-bold underline decoration-current/30 underline-offset-2">
                {displayNote}
              </span>
              {customNote && customNote !== displayNote && (
                <span className="block mt-0.5 opacity-90 text-[11px] font-medium">
                  {customNote}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white/90 text-stone-800 text-xs font-black border border-stone-300 shadow-2xs">
            {theme === 'available' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open for Orders</span>
              </>
            ) : theme === 'upcoming' ? (
              <>
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span>Upcoming Service</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Ordering Closed</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
