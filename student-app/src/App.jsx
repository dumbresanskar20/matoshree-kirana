import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero3D from './components/Hero3D';
import MealTypeTabs from './components/MealTypeTabs';
import MealDiscountNote from './components/MealDiscountNote';
import MealTimingNote from './components/MealTimingNote';
import MenuCard from './components/MenuCard';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import OrderSuccessModal from './components/OrderSuccessModal';
import PaymentFailureModal from './components/PaymentFailureModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import OrderDetailModal from './components/OrderDetailModal';
import SubscriptionExpiredScreen from './components/SubscriptionExpiredScreen';
import { useCart } from './context/CartContext';
import { useAuth } from './context/AuthContext';
import { Utensils, Clock, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import CAFE_D_CRUZE_LOGO from './assets/logo';
import api from './services/api';
import { createSocketClient } from './services/socket';
import { preloadImages } from './utils/imageCache';

export default function App() {
  const {
    selectedMealType,
    setSelectedMealType,
    activeMealWindows,
    currentMealWindow,
    loadingWindows,
    allMealsInactive,
    redirectNotice,
    clearCart,
    discountInfo,
    fetchDiscountStatus,
    fetchMealWindows,
    setIsCartOpen,
  } = useCart();

  const { student, isAuthenticated, logout, openAuthModal } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [backendStatus, setBackendStatus] = useState({ is_active: true, is_currently_open: true });
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState(64);

  // Modals state
  const [successToken, setSuccessToken] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [paymentFailureData, setPaymentFailureData] = useState(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [detailModalOrder, setDetailModalOrder] = useState(null);



  // Dynamically measure navbar height for sticky positioning
  useEffect(() => {
    const updateNavbarHeight = () => {
      const headerEl = document.querySelector('header');
      if (headerEl) {
        setNavbarHeight(headerEl.offsetHeight);
      }
    };

    updateNavbarHeight();
    window.addEventListener('resize', updateNavbarHeight);

    let observer;
    const headerEl = document.querySelector('header');
    if (headerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateNavbarHeight());
      observer.observe(headerEl);
    }

    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      if (observer) observer.disconnect();
    };
  }, []);

  const selectedMealTypeRef = React.useRef(selectedMealType);
  useEffect(() => {
    selectedMealTypeRef.current = selectedMealType;
  }, [selectedMealType]);

  const activeMealWindowsRef = React.useRef(activeMealWindows);
  useEffect(() => {
    activeMealWindowsRef.current = activeMealWindows;
  }, [activeMealWindows]);

  const fetchMenuItems = React.useCallback(async (mealTypeToFetch, isSilent = false) => {
    const meal = mealTypeToFetch || selectedMealTypeRef.current || 'breakfast';
    if (!isSilent) {
      setLoadingMenu(true);
    }
    try {
      const res = await api.get(`/menu/items?meal_type=${meal}&active_only=true`);
      if (res.data.success) {
        const isActive = res.data.is_active !== false;
        setBackendStatus({
          is_active: isActive,
          is_currently_open: res.data.is_currently_open !== false,
        });

        // If this meal category is reported inactive on the backend, auto-switch to active meal category
        if (!isActive && activeMealWindowsRef.current && activeMealWindowsRef.current.length > 0) {
          const alternate = activeMealWindowsRef.current.find((w) => w.is_currently_open) || activeMealWindowsRef.current[0];
          if (alternate?.meal_type && alternate.meal_type.toLowerCase() !== meal.toLowerCase()) {
            setSelectedMealType(alternate.meal_type.toLowerCase());
            return;
          }
        }

        const items = res.data.items || [];
        setMenuItems(items);
        preloadImages(items.map((i) => i.image_url));
      } else {
        if (!isSilent) {
          setMenuItems([]);
        }
      }
    } catch (err) {
      if (err.response?.status === 402) {
        setSubscriptionExpired(true);
      } else {
        console.warn('API error fetching menu items:', err?.message || err);
        if (!isSilent) {
          setMenuItems([]);
        }
      }
    } finally {
      if (!isSilent) {
        setLoadingMenu(false);
      }
    }
  }, [setSelectedMealType]);

  const checkSub = async () => {
    try {
      const res = await api.get('/subscription/status');
      const isExp = res.data.subscription?.is_expired || res.data.subscription?.status !== 'active';
      setSubscriptionExpired(Boolean(isExp));
    } catch (err) {
      if (err.response?.status === 402) {
        setSubscriptionExpired(true);
      }
    }
  };

  // Check subscription status on mount, via periodic polling, and listen for 402 event
  useEffect(() => {
    checkSub();
    const interval = setInterval(checkSub, 15000); // Polling every 15s to keep state synchronized

    const handleExpired = () => setSubscriptionExpired(true);
    window.addEventListener('subscription_expired', handleExpired);
    return () => {
      clearInterval(interval);
      window.removeEventListener('subscription_expired', handleExpired);
    };
  }, []);

  // Global socket listener for live subscription, rating updates, and menu sales re-ranking
  useEffect(() => {
    const socket = createSocketClient();

    socket.on('subscription:status_changed', (payload) => {
      console.log('[Student Socket] Subscription status changed:', payload);
      const isExp = payload.is_expired || payload.status !== 'active';
      setSubscriptionExpired(Boolean(isExp));
      if (!isExp) {
        fetchMenuItems(selectedMealTypeRef.current, true);
      }
    });

    // Real-time live re-ranking when students rate items or new orders occur
    const handleLiveMenuUpdate = (data) => {
      console.log('[Student Socket] Live menu rating/sales update received:', data);
      fetchMenuItems(selectedMealTypeRef.current, true);
    };

    socket.on('menu:rating_updated', handleLiveMenuUpdate);
    socket.on('menu:sales_updated', handleLiveMenuUpdate);
    socket.on('menu:updated', handleLiveMenuUpdate);
    socket.on('menu:stock_updated', handleLiveMenuUpdate);
    socket.on('inventory:tracking_toggled', handleLiveMenuUpdate);
    socket.on('review:new', handleLiveMenuUpdate);

    // Live meal window timing updates broadcast from admin panel
    socket.on('meal_window:updated', (data) => {
      console.log('[Student Socket] Meal window update received:', data);
      if (typeof fetchMealWindows === 'function') {
        fetchMealWindows(true);
      }
    });

    // Live discount settings updates broadcast from admin panel
    socket.on('discount_settings:updated', (data) => {
      console.log('[Student Socket] Discount settings update received:', data);
      if (typeof fetchDiscountStatus === 'function') {
        fetchDiscountStatus(selectedMealType);
      }
    });

    // Listen for local rating submission event
    const handleLocalRating = () => {
      console.log('[Student Event] Local rating submitted, refreshing ranked menu...');
      fetchMenuItems(selectedMealTypeRef.current, true);
    };

    window.addEventListener('rating_submitted', handleLocalRating);

    return () => {
      socket.disconnect();
      window.removeEventListener('rating_submitted', handleLocalRating);
    };
  }, [fetchMenuItems]);

  // Real-time Socket.IO listener for live student order updates
  useEffect(() => {
    if (!isAuthenticated || !student) return;

    const studentId = student._id || student.id;
    const socket = createSocketClient();

    socket.on('connect', () => {
      if (studentId) {
        socket.emit('join:student', studentId);
      }
    });

    socket.on('student:order_updated', (payload) => {
      console.log('[Student Socket] Live order update received:', payload);
      if (payload.token_number && payload.payment_status === 'paid') {
        clearCart();
        setSuccessToken(payload.token_number);
        setSuccessOrder(payload.order || { token_number: payload.token_number, payment_status: 'paid' });
      }

      if (payload.order_status) {
        setSuccessOrder((prev) => {
          if (prev && ((prev._id || prev.id) === payload.orderId || prev.token_number === payload.token_number)) {
            return { ...prev, order_status: payload.order_status };
          }
          return prev;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, student, clearCart]);

  // Check for reset_token in URL query parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenVal = params.get('reset_token') || params.get('token');
      if (tokenVal) {
        openAuthModal(false, 'reset-password', tokenVal);
      }
    }
  }, []);

  // Event listener to allow triggering the Payment Failure Modal for testing / support
  useEffect(() => {
    const handleSimulate = (e) => {
      setPaymentFailureData(e.detail || {
        reason: 'Payment transaction failed or token pending verification.',
        orderId: 'order_test_987654321',
        paymentId: 'pay_test_123456789',
        amount: 80,
        mealType: selectedMealType || 'lunch',
        studentName: student?.name || 'Student',
        studentRollNo: student?.roll_no || 'CS-2024',
      });
    };
    window.addEventListener('test_payment_failure_modal', handleSimulate);
    return () => window.removeEventListener('test_payment_failure_modal', handleSimulate);
  }, [selectedMealType, student]);

  const prevMealTypeRef = React.useRef(null);
  useEffect(() => {
    if (selectedMealType && !loadingWindows) {
      const isCategorySwitch = prevMealTypeRef.current !== selectedMealType;
      prevMealTypeRef.current = selectedMealType;
      // Show skeleton loader on first load or when switching meal categories; silent background update otherwise
      fetchMenuItems(selectedMealType, !isCategorySwitch);
    }
  }, [selectedMealType, loadingWindows, fetchMenuItems]);

  // Auto-recovery: If student switched to UPI app (GPay/PhonePe) and returned, or reloaded after payment
  useEffect(() => {
    const recoverPendingPayment = async () => {
      try {
        const stored = localStorage.getItem('mess_pending_payment');
        if (!stored) return;
        const pending = JSON.parse(stored);
        if (!pending || !pending.razorpay_order_id) {
          localStorage.removeItem('mess_pending_payment');
          return;
        }

        // Discard if older than 24 hours
        if (pending.timestamp && Date.now() - pending.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('mess_pending_payment');
          return;
        }

        console.log('[Auto-Recovery] Found pending payment in localStorage, verifying...', pending);
        const res = await api.post('/orders/recover-payment', {
          razorpay_order_id: pending.razorpay_order_id,
          razorpay_payment_id: pending.razorpay_payment_id,
          order_db_id: pending.order_db_id,
        });

        if (res.data?.success && res.data?.token_number) {
          console.log('[Auto-Recovery] Payment successfully verified & token issued:', res.data.token_number);
          localStorage.removeItem('mess_pending_payment');
          clearCart();
          setSuccessToken(res.data.token_number);
          setSuccessOrder(res.data.order);
        }
      } catch (e) {
        console.warn('[Auto-Recovery] Payment recovery check:', e.response?.data?.message || e.message);
      }
    };

    recoverPendingPayment();

    const handleFocus = () => {
      recoverPendingPayment();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [clearCart]);

  const handleOrderSuccess = (tokenNumber, order) => {
    clearCart();
    setSuccessToken(tokenNumber);
    setSuccessOrder(order);
  };

  const mealNameCapitalized = selectedMealType
    ? (selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)).replace(/_/g, ' ')
    : '';
  const isCurrentlyOpen = currentMealWindow ? currentMealWindow.is_currently_open : backendStatus.is_currently_open;
  const isFullDay = currentMealWindow ? currentMealWindow.is_full_day : false;
  const formattedStartTime = currentMealWindow?.formatted_start_time || '08:00 AM';
  const formattedEndTime = currentMealWindow?.formatted_end_time || '08:00 PM';

  if (subscriptionExpired) {
    return <SubscriptionExpiredScreen onRetry={checkSub} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-warmBg w-full max-w-full overflow-x-clip pt-16 sm:pt-20">

      {/* Top Header with Persistent Top-Right Auth Control & Dynamic Navbar */}
      <Header onOpenOrders={() => setOrdersModalOpen(true)} />

      {/* Redirect Notice Toast Banner */}
      {redirectNotice && (
        <div className="bg-amber-500 text-white font-bold text-xs py-2.5 px-3 text-center flex items-center justify-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 w-full">
          <Info className="w-4 h-4 shrink-0" />
          <span className="truncate">{redirectNotice}</span>
        </div>
      )}

      {/* Hero Section */}
      <Hero3D />

      {/* Sticky Meal Category Tabs directly below navbar */}
      <MealTypeTabs navbarHeight={navbarHeight} />

      {/* Main Menu Section */}
      <main id="menu-section" className="flex-1 max-w-screen-2xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ALL MEAL TYPES INACTIVE EDGE CASE (CANTEEN CLOSED FOR HOLIDAY) */}
        {allMealsInactive ? (
          <div className="text-center py-16 sm:py-20 px-4 bg-white/80 backdrop-blur-md rounded-3xl border border-amber-200 shadow-sm max-w-2xl mx-auto my-6 space-y-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-100/80 text-brand-orange flex items-center justify-center text-4xl sm:text-5xl mx-auto shadow-inner animate-bounce">
              🍱
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-brand-dark tracking-tight">
              We're closed right now — check back soon!
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 font-medium max-w-md mx-auto">
              Matoshree Kirana store management has temporarily paused all orders today. Please check back during standard operating hours.
            </p>
          </div>
        ) : (
          <>
            {/* TIME-CLOSED BROWSING BANNER */}
            {!isCurrentlyOpen && (
              <div className="mb-6 sm:mb-8 p-3.5 sm:p-4 bg-amber-50 border border-amber-300 rounded-3xl shadow-sm text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-in fade-in">
                <div className="p-2 sm:p-2.5 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-950">
                    🕐 {mealNameCapitalized} ordering opens at {formattedStartTime} and closes at {formattedEndTime}.
                  </p>
                  <p className="text-amber-800 text-xs mt-0.5 font-medium">
                    You can browse today's menu items below, but ordering is currently closed until the next window opening.
                  </p>
                </div>
              </div>
            )}

            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-3 sm:pb-4 border-b border-amber-200/60 gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold text-brand-orange uppercase tracking-wider bg-orange-100/80 px-2.5 sm:px-3 py-1 rounded-full mb-2">
                  <Utensils className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
                  <span>Campus Mess Kitchen</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold font-display text-brand-dark tracking-tight">
                  Today's <span className="text-brand-orange capitalize">{selectedMealType?.replace(/_/g, ' ')}</span> Menu
                </h2>

                {/* Operating Window Badge */}
                {currentMealWindow && (
                  <div className="mt-1.5 inline-flex items-center gap-2 text-xs font-bold flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="text-stone-600">
                      {isFullDay ? '24/7 Full-Day Ordering' : `Window: ${formattedStartTime} – ${formattedEndTime}`}
                    </span>

                    {isCurrentlyOpen ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                        Ordering Open
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                        Ordering Closed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Meal Service / Distribution Notice (Visible only before set time) */}
            <MealTimingNote />

            {/* 24/7 Meal Discount Note */}
            <MealDiscountNote />

            {/* Menu Cards Grid */}
            {loadingMenu || loadingWindows ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-80 bg-white/70 rounded-3xl border border-stone-200" />
                ))}
              </div>
            ) : !backendStatus.is_active ? (
              <div className="text-center py-12 sm:py-16 bg-amber-50/60 rounded-3xl border border-amber-200 space-y-2 px-4">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                <p className="font-display font-bold text-stone-800 text-base sm:text-lg">
                  {(selectedMealType?.replace(/_/g, ' ') || '').toUpperCase()} is currently not offered by Matoshree Kirana.
                </p>
                <p className="text-xs text-stone-500">Please select another active category above.</p>
              </div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-12 sm:py-16 bg-white/60 rounded-3xl border border-dashed border-amber-200 px-4">
                <p className="font-display font-bold text-stone-700 text-base sm:text-lg">No active items in this category right now.</p>
                <p className="text-xs text-stone-500 mt-1">Please select another category above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                {menuItems.map((item) => (
                  <MenuCard key={item._id || item.id} item={item} isCurrentlyOpen={isCurrentlyOpen} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-300 py-3 sm:py-3.5 border-t border-stone-800 w-full">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Matoshree Kirana Logo"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-contain bg-white p-0.5"
            />
            <span className="font-display font-bold text-sm sm:text-base text-white tracking-tight">
              Matoshree <span className="text-brand-orange">Kirana</span>
            </span>
          </div>

          <p className="text-xs text-stone-400">
            Made by{' '}
            <a
              href="https://dypcoeiincubationcentre.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-200 hover:text-brand-orange font-medium underline underline-offset-2 transition-colors"
            >
              DYPCOEI incubation Centre
            </a>{' '}
            and{' '}
            <a
              href="https://mealbook.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-200 hover:text-brand-orange font-medium underline underline-offset-2 transition-colors"
            >
              MealBook
            </a>
          </p>
        </div>
      </footer>

      {/* Global Modals & Drawers */}
      <AuthModal />
      <CartDrawer
        onOrderSuccess={handleOrderSuccess}
        onPaymentFailure={(data) => setPaymentFailureData(data)}
      />
      <OrderSuccessModal
        tokenNumber={successToken}
        order={successOrder}
        onClose={() => {
          setSuccessToken(null);
          setSuccessOrder(null);
        }}
      />
      <PaymentFailureModal
        isOpen={Boolean(paymentFailureData)}
        failureData={paymentFailureData}
        onClose={() => setPaymentFailureData(null)}
        onOpenOrderHistory={() => {
          setPaymentFailureData(null);
          setOrdersModalOpen(true);
        }}
        onRetry={() => {
          setPaymentFailureData(null);
          setIsCartOpen(true);
        }}
        onSuccess={(token, order) => {
          setPaymentFailureData(null);
          handleOrderSuccess(token, order);
        }}
      />
      <OrderHistoryModal
        isOpen={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
      />
      {detailModalOrder && (
        <OrderDetailModal
          order={detailModalOrder}
          onClose={() => setDetailModalOrder(null)}
        />
      )}
    </div>
  );
}

