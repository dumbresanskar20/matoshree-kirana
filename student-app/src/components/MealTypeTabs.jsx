import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MealTypeTabs({ navbarHeight = 64 }) {
  const { selectedMealType, setSelectedMealType, activeMealWindows, loadingWindows } = useCart();
  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);
  const mobileDropdownRef = useRef(null);

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Close mobile dropdown on click outside
  useEffect(() => {
    if (!isMobileExpanded) return;
    const handleClickOutside = (e) => {
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target)) {
        setIsMobileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileExpanded]);

  // Collapse mobile expanded state when selectedMealType changes
  useEffect(() => {
    setIsMobileExpanded(false);
  }, [selectedMealType]);

  const MEAL_CONFIG = {
    grains_pulses: { label: 'Grains & Pulses', icon: '🌾' },
    'grains & pulses': { label: 'Grains & Pulses', icon: '🌾' },
    cooking_essential: { label: 'Cooking Essentials', icon: '🍳' },
    'cooking essential': { label: 'Cooking Essentials', icon: '🍳' },
    cooking_essentials: { label: 'Cooking Essentials', icon: '🍳' },
    'cooking essentials': { label: 'Cooking Essentials', icon: '🍳' },
    groceries: { label: 'Groceries & Staples', icon: '🌾' },
    flours_grains: { label: 'Atta & Flours', icon: '🍞' },
    dals_pulses: { label: 'Dals & Pulses', icon: '🥣' },
    oils_ghee: { label: 'Edible Oils & Ghee', icon: '🛢️' },
    spices_masalas: { label: 'Spices & Masalas', icon: '🌶️' },
    dairy_eggs: { label: 'Dairy & Eggs', icon: '🥛' },
    snacks_beverages: { label: 'Snacks & Beverages', icon: '☕' },
    personal_care: { label: 'Personal Care', icon: '🧼' },
    household: { label: 'Cleaning & Household', icon: '🧹' },
    daily_essentials: { label: 'Daily Essentials', icon: '🛒' },
    breakfast: { label: 'Breakfast Essentials', icon: '🍳' },
    lunch: { label: 'Lunch Essentials', icon: '🍛' },
    snacks: { label: 'Evening Snacks', icon: '🍪' },
    dinner: { label: 'Dinner Essentials', icon: '🍲' },
  };

  const getMealMeta = (rawType, windowItem = null) => {
    const type = (rawType || '').toLowerCase().trim();
    if (MEAL_CONFIG[type]) {
      return MEAL_CONFIG[type];
    }
    if (windowItem && windowItem.category_name && windowItem.category_name.toLowerCase() !== type) {
      return { label: windowItem.category_name, icon: windowItem.icon || MEAL_CONFIG[type]?.icon || '🛒' };
    }
    if (type === 'grains_pulses' || type === 'grains & pulses') {
      return { label: 'Grains & Pulses', icon: '🌾' };
    }
    if (type === 'cooking_essential' || type === 'cooking_essentials' || type === 'cooking essentials') {
      return { label: 'Cooking Essentials', icon: '🍳' };
    }

    // Clean formatted label: e.g. milk_shake -> Milk Shake
    const formattedLabel = type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Context-sensitive icon mapping
    let icon = '🛒';
    if (type.includes('shake') || type.includes('smoothie')) icon = '🥤';
    else if (type.includes('coffee') || type.includes('cafe')) icon = '🧋';
    else if (type.includes('tea') || type.includes('chai')) icon = '🍵';
    else if (type.includes('oil') || type.includes('ghee')) icon = '🛢️';
    else if (type.includes('atta') || type.includes('flour') || type.includes('grain')) icon = '🍞';
    else if (type.includes('dal') || type.includes('pulse')) icon = '🥣';
    else if (type.includes('spice') || type.includes('masala')) icon = '🌶️';
    else if (type.includes('soap') || type.includes('wash') || type.includes('shampoo')) icon = '🧼';
    else if (type.includes('biscuit') || type.includes('cookie') || type.includes('snack')) icon = '🍪';

    return { label: formattedLabel, icon };
  };

  // Build list of active meal type buttons dynamically
  const availableMealTypes = (activeMealWindows && activeMealWindows.length > 0)
    ? activeMealWindows.map((w) => {
        const type = (w.meal_type || '').toLowerCase();
        const meta = getMealMeta(type, w);
        return {
          id: type,
          label: w.category_name || meta.label,
          icon: w.icon || meta.icon,
          isCurrentlyOpen: Boolean(w.is_currently_open),
          startTime: w.formatted_start_time,
          endTime: w.formatted_end_time,
        };
      })
    : [];

  const isCollapsible = availableMealTypes.length > 4;
  const currentSelectedMeal = availableMealTypes.find((m) => m.id === selectedMealType) || availableMealTypes[0];

  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  // Collapse expanded dropdown state when selectedMealType changes
  useEffect(() => {
    setIsExpanded(false);
  }, [selectedMealType]);

  // Auto-scroll active tab into center view if container overflows horizontally
  useEffect(() => {
    if (activeTabRef.current && tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const tab = activeTabRef.current;

      const containerWidth = container.offsetWidth;
      const tabOffsetLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;

      const scrollTo = tabOffsetLeft - (containerWidth / 2) + (tabWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollTo),
        behavior: 'smooth',
      });
    }
  }, [selectedMealType]);

  const handleMealSelect = (typeId) => {
    setSelectedMealType(typeId);
  };

  if (loadingWindows) {
    return (
      <div
        style={{ top: `${navbarHeight}px` }}
        className="sticky z-30 bg-[#fffbf5]/95 backdrop-blur-md border-b border-amber-200/80 shadow-xs py-2.5 sm:py-3 transition-all w-full"
      >
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="flex items-center gap-2 sm:gap-3 animate-pulse">
            <div className="h-10 w-28 bg-amber-100/80 rounded-2xl" />
            <div className="h-10 w-28 bg-amber-100/80 rounded-2xl hidden sm:block" />
            <div className="h-10 w-28 bg-amber-100/80 rounded-2xl hidden sm:block" />
          </div>
        </div>
      </div>
    );
  }

  if (availableMealTypes.length === 0) {
    return null;
  }

  return (
    <div
      style={{ top: `${navbarHeight}px` }}
      className="sticky z-30 bg-[#fffbf5]/95 backdrop-blur-md border-b border-amber-200/80 shadow-xs py-2.5 sm:py-3 transition-all w-full"
    >
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
        {!isCollapsible ? (
          /* Case 1: <= 4 meal types -> Render normally in a responsive row */
          <div
            ref={tabsContainerRef}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto px-1 w-full"
          >
            {availableMealTypes.map((meal) => {
              const isSelected = selectedMealType === meal.id;
              const isOpen = meal.isCurrentlyOpen;

              return (
                <button
                  key={meal.id}
                  ref={isSelected ? activeTabRef : null}
                  onClick={() => handleMealSelect(meal.id)}
                  className={`min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 shadow-xs border cursor-pointer shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-brand-dark text-white border-brand-dark shadow-md ring-2 ring-brand-orange/40 scale-[1.03]'
                      : isOpen
                      ? 'bg-white text-stone-700 border-amber-200/90 hover:border-amber-400 hover:bg-amber-50/50'
                      : 'bg-stone-100/90 text-stone-500 border-stone-200 hover:bg-stone-200/60'
                  }`}
                >
                  {/* Status Light Indicator */}
                  <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0">
                    {isOpen ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500" />
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-rose-500" />
                    )}
                  </span>

                  <span className="text-sm sm:text-base">{meal.icon}</span>
                  <span>{meal.label}</span>

                  {!isOpen && (
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      Closed
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* Case 2: > 4 meal types -> Minimized button with dropdown for desktop and mobile */
          <div ref={dropdownRef} className="w-full max-w-md sm:max-w-lg mx-auto relative">
            {/* Minimized Pill Bar */}
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="w-full min-h-[46px] sm:min-h-[50px] px-4 sm:px-5 py-2 sm:py-2.5 bg-brand-dark text-white rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-between shadow-md hover:shadow-lg border border-brand-dark ring-2 ring-brand-orange/40 hover:ring-brand-orange/60 active:scale-[0.99] transition-all duration-200 cursor-pointer"
              aria-expanded={isExpanded}
              aria-haspopup="true"
              aria-label="Toggle meal categories dropdown"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0">
                  {currentSelectedMeal?.isCurrentlyOpen ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-rose-500" />
                  )}
                </span>
                <span className="text-base sm:text-lg shrink-0">{currentSelectedMeal?.icon}</span>
                <span className="text-xs sm:text-sm font-black tracking-tight truncate">
                  {currentSelectedMeal?.label}
                </span>
                {!currentSelectedMeal?.isCurrentlyOpen && (
                  <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/30 shrink-0">
                    Closed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-amber-200 text-xs sm:text-sm font-black shrink-0 transition-colors">
                <span>All ({availableMealTypes.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {/* Dropdown Menu Overlay */}
            {isExpanded && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-amber-300/90 shadow-2xl p-3 sm:p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-2.5 sm:mb-3 pb-2 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-stone-900 tracking-wide uppercase">
                      Meal Categories
                    </span>
                    <span className="bg-amber-100 text-amber-900 text-[10px] sm:text-xs font-extrabold px-2 sm:px-2.5 py-0.5 rounded-full">
                      {availableMealTypes.length} Available
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="px-2.5 sm:px-3 py-1 rounded-xl text-stone-600 hover:text-stone-900 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1 text-xs sm:text-sm font-black"
                  >
                    <span>Close</span>
                    <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-2.5 max-h-[55vh] sm:max-h-[60vh] overflow-y-auto pr-0.5">
                  {availableMealTypes.map((meal) => {
                    const isSelected = selectedMealType === meal.id;
                    const isOpen = meal.isCurrentlyOpen;

                    return (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => {
                          handleMealSelect(meal.id);
                          setIsExpanded(false);
                        }}
                        className={`min-h-[46px] sm:min-h-[50px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all duration-150 flex items-center justify-between gap-1.5 shadow-2xs border cursor-pointer active:scale-95 text-left ${
                          isSelected
                            ? 'bg-brand-dark text-white border-brand-dark shadow-md ring-2 ring-brand-orange/40'
                            : isOpen
                            ? 'bg-amber-50/50 text-stone-700 border-amber-200/90 hover:border-amber-400 hover:bg-amber-100/60'
                            : 'bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                            {isOpen ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500" />
                              </>
                            ) : (
                              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-rose-500" />
                            )}
                          </span>
                          <span className="text-base sm:text-lg shrink-0">{meal.icon}</span>
                          <span className="truncate">{meal.label}</span>
                        </div>

                        {isSelected ? (
                          <span className="text-brand-orange text-xs sm:text-sm font-black shrink-0">●</span>
                        ) : !isOpen ? (
                          <span className="text-[8px] sm:text-[9px] font-black uppercase text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                            Closed
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
