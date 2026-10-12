import React from 'react';
import { Tag, Sparkles, Clock, Gift, Flame, Percent, Coffee, Moon } from 'lucide-react';
import { useCart } from '../context/CartContext';

const format12Hour = (hhmm) => {
  if (!hhmm) return '';
  const parts = String(hhmm).split(':');
  if (parts.length < 2) return hhmm;
  const h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, '0');
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export default function MealDiscountNote() {
  const { selectedMealType, discountInfo, currentMealWindow } = useCart();
  const meal = (selectedMealType || 'breakfast').toLowerCase();
  const prettyMealName = meal.charAt(0).toUpperCase() + meal.slice(1);

  const isDiscountActive = Boolean(discountInfo?.is_discount_active);
  const isBeforeStart = Boolean(discountInfo?.is_before_start);
  const discountPercent = Number(discountInfo?.discount_percentage || 0);
  const discountAmount = Number(discountInfo?.discount_amount || 0);
  const isNewUserDiscount = discountInfo?.discount_type === 'new_user';

  const rawStartTime = discountInfo?.discount_start_time || '';
  const rawCutoff = discountInfo?.cutoff_time || discountInfo?.cutoffs?.[meal] || '';
  const formattedStartTime = rawStartTime ? format12Hour(rawStartTime) : '';
  const formattedCutoff = rawCutoff ? format12Hour(rawCutoff) : '';

  // 1. If discount window has not started yet, show "Discount starts at {time}" hint
  if (isBeforeStart && rawStartTime) {
    return (
      <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-100/50 border-2 border-amber-300/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              <Clock className="w-5 h-5 fill-white/20" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-amber-950">
                  ⏳ Early Discount Starts Soon
                </span>
                <span className="bg-amber-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                  Upcoming Window
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900 font-medium">
                {prettyMealName} discount starts at <strong className="font-bold text-amber-950">{formattedStartTime}</strong>. Place your order between <strong className="font-bold text-amber-950">{formattedStartTime}</strong> and <strong className="font-bold text-amber-950">{formattedCutoff || 'cutoff time'}</strong> to receive discount!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white text-amber-950 text-xs font-black border border-amber-300 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-brand-orange" />
              Starts at {formattedStartTime}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Strict requirement: When NO discount rule is currently active, show nothing
  if (!isDiscountActive || discountPercent <= 0) {
    return null;
  }

  // 2. New User Welcome Discount Banner
  if (isNewUserDiscount) {
    return (
      <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-50 via-indigo-50/70 to-pink-50 border-2 border-purple-400 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-purple-950">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20 animate-pulse">
              <Gift className="w-5 h-5 fill-white" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-purple-950">
                  🎉 Welcome Deal: {discountPercent}% OFF Active Now!
                </span>
                <span className="bg-purple-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                  New User Perk
                </span>
              </div>
              <p className="text-xs sm:text-sm text-purple-900 font-medium">
                As a new user, enjoy flat <strong className="font-bold text-purple-950">{discountPercent}% OFF</strong> on <strong className="font-bold text-purple-950">ALL meal categories</strong> for your first <strong className="font-bold text-purple-950">{discountInfo?.new_user_discount_days || 5} days</strong>!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-purple-100 text-purple-950 text-xs font-black border border-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
              All Meals Eligible
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Meal-Specific Discount Banner with Start-to-Cutoff Window
  let Icon = Flame;
  let bgClasses = 'from-emerald-50 via-teal-50/70 to-amber-50 border-emerald-400 text-emerald-950';
  let badgeColor = 'bg-emerald-600';
  let iconBg = 'bg-emerald-500 text-white shadow-emerald-500/20';

  if (meal === 'snacks') {
    Icon = Coffee;
    bgClasses = 'from-teal-50 via-emerald-50/70 to-cyan-50 border-emerald-400 text-emerald-950';
  } else if (meal === 'dinner') {
    Icon = Moon;
    bgClasses = 'from-indigo-50 via-purple-50/70 to-blue-50 border-indigo-400 text-indigo-950';
    badgeColor = 'bg-indigo-600';
    iconBg = 'bg-indigo-600 text-white shadow-indigo-600/20';
  }

  const discountBadgeText = discountAmount > 0 
    ? `₹${discountAmount} OFF` 
    : `${discountPercent}% OFF`;

  const windowText = formattedStartTime && formattedCutoff
    ? `valid ${formattedStartTime} to ${formattedCutoff}`
    : formattedCutoff
    ? `valid before ${formattedCutoff}`
    : 'valid now';

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-r ${bgClasses} border-2 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 shadow-md animate-pulse`}>
            <Icon className="w-5 h-5 fill-white" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base tracking-tight">
                🎉 Early Bird {discountBadgeText} Active Now!
              </span>
              <span className={`${badgeColor} text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs`}>
                Live Deal
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium opacity-90">
              Order {prettyMealName} ({windowText}) to get <strong className="font-bold">{discountBadgeText}</strong> automatically applied at checkout!
            </p>
          </div>
        </div>

        {rawCutoff && (
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/90 text-stone-800 text-xs font-black border border-stone-300/80 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-brand-orange" />
              {formattedStartTime ? `${formattedStartTime} – ${formattedCutoff}` : `Cutoff: ${formattedCutoff}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
