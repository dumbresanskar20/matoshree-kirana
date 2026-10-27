import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Utensils,
  Info,
  Sparkles,
  MapPin,
  Edit2,
  Phone,
  Clock,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { loadRazorpayScript } from '../utils/loadRazorpay';
import CachedImage from './CachedImage';

export default function CartDrawer({ onOrderSuccess, onPaymentFailure }) {
  const {
    cartItems,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    selectedMealType,
    currentMealWindow,
    clearCart,
    discountInfo: contextDiscountInfo,
    fetchDiscountStatus,
    triggerStockAlert,
  } = useCart();
  const { student, isAuthenticated, openAuthModal } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const lastFailureDataRef = useRef(null);

  // Delivery Address State
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressFormMode, setAddressFormMode] = useState('add'); // 'add' | 'edit'
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressFormData, setAddressFormData] = useState({
    society_name: '',
    wing_name: '',
    flat_number: '',
    landmark: '',
    pincode: '',
    mobile_number: '',
  });
  const [addressFormError, setAddressFormError] = useState('');
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  const discountInfo = contextDiscountInfo || {
    is_discount_active: false,
    discount_percentage: 0,
    server_time: '',
  };

  useEffect(() => {
    if (isCartOpen && fetchDiscountStatus) {
      fetchDiscountStatus(selectedMealType);
    }
  }, [isCartOpen, selectedMealType, fetchDiscountStatus]);

  // Fetch student's saved delivery addresses
  const fetchAddresses = async () => {
    if (!isAuthenticated) return;
    setLoadingAddresses(true);
    try {
      const res = await api.get('/addresses');
      if (res.data?.success && Array.isArray(res.data.addresses)) {
        setAddresses(res.data.addresses);
        if (res.data.addresses.length > 0) {
          // Pre-select the most recently used/added address if none selected or existing is removed
          setSelectedAddressId((prev) => {
            const exists = res.data.addresses.some((a) => a.id === prev);
            return exists ? prev : res.data.addresses[0].id;
          });
        } else {
          setSelectedAddressId(null);
        }
      }
    } catch (err) {
      console.warn('Could not load user addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (isCartOpen && isAuthenticated) {
      fetchAddresses();
    }
  }, [isCartOpen, isAuthenticated]);

  const handleOpenAddAddress = () => {
    setAddressFormMode('add');
    setEditingAddressId(null);
    setAddressFormData({
      society_name: '',
      wing_name: '',
      flat_number: '',
      landmark: '',
      pincode: '',
      mobile_number: student?.phone || student?.mobile || '',
    });
    setAddressFormError('');
    setAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr, e) => {
    e.stopPropagation();
    setAddressFormMode('edit');
    setEditingAddressId(addr.id);
    setAddressFormData({
      society_name: addr.society_name || '',
      wing_name: addr.wing_name || '',
      flat_number: addr.flat_number || '',
      landmark: addr.landmark || '',
      pincode: addr.pincode || '',
      mobile_number: addr.mobile_number || '',
    });
    setAddressFormError('');
    setAddressModalOpen(true);
  };

  const handleDeleteAddress = async (addrId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this delivery address?')) {
      return;
    }
    try {
      const res = await api.delete(`/addresses/${addrId}`);
      if (res.data?.success) {
        setAddresses((prev) => {
          const remaining = prev.filter((a) => a.id !== addrId);
          if (selectedAddressId === addrId) {
            setSelectedAddressId(remaining[0]?.id || null);
          }
          return remaining;
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete address.');
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressFormError('');

    const society = (addressFormData.society_name || '').trim();
    const wing = (addressFormData.wing_name || '').trim();
    const flat = (addressFormData.flat_number || '').trim();
    const landmark = (addressFormData.landmark || '').trim();
    const pincode = (addressFormData.pincode || '').trim();
    const mobile = (addressFormData.mobile_number || '').trim();

    if (!society || !wing || !flat || !pincode || !mobile) {
      setAddressFormError('Please fill in all required fields (Society, Wing, Flat, Pincode, Mobile).');
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      setAddressFormError('Pincode must be exactly 6 digits.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setAddressFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setAddressSubmitting(true);
    try {
      if (addressFormMode === 'add') {
        const res = await api.post('/addresses', {
          society_name: society,
          wing_name: wing,
          flat_number: flat,
          landmark,
          pincode,
          mobile_number: mobile,
        });
        if (res.data?.success && res.data.address) {
          const newAddr = res.data.address;
          setAddresses((prev) => [newAddr, ...prev]);
          setSelectedAddressId(newAddr.id);
          setAddressModalOpen(false);
          setErrorMessage('');
        }
      } else {
        const res = await api.put(`/addresses/${editingAddressId}`, {
          society_name: society,
          wing_name: wing,
          flat_number: flat,
          landmark,
          pincode,
          mobile_number: mobile,
        });
        if (res.data?.success && res.data.address) {
          const updated = res.data.address;
          setAddresses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setAddressModalOpen(false);
        }
      }
    } catch (err) {
      setAddressFormError(err.response?.data?.message || 'Failed to save address.');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const isDiscountActive = Boolean(discountInfo?.is_discount_active) && Number(discountInfo?.discount_percentage) > 0;
  const discountAmount = isDiscountActive
    ? Math.round((cartTotal * (Number(discountInfo.discount_percentage) / 100)) * 100) / 100
    : 0;
  const finalPayable = Math.max(0, Math.round((cartTotal - discountAmount) * 100) / 100);

  if (!isCartOpen) return null;

  const handleBackToMenu = () => {
    setIsCartOpen(false);
    setTimeout(() => {
      const menuEl = document.getElementById('menu-section');
      if (menuEl) {
        menuEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleProceedToPay = async () => {
    setErrorMessage('');

    // Check auth boundary: If user is not logged in, prompt Auth Modal and preserve cart
    if (!isAuthenticated) {
      openAuthModal(true); // Passes forCheckout = true so login triggers payment on success
      return;
    }

    if (cartItems.length === 0) return;

    if (!selectedAddressId) {
      setErrorMessage('Please select a delivery address to continue.');
      return;
    }

    setCheckoutLoading(true);

    try {
      // 1. Verify Razorpay Checkout.js SDK script loading
      console.log('[Razorpay Diagnostics] 1. Verifying Razorpay Checkout SDK script presence...');
      const scriptReady = await loadRazorpayScript();

      if (!scriptReady || typeof window.Razorpay === 'undefined') {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        setErrorMessage('Razorpay SDK failed to load — check network connection or ad-blocker extension.');
        setCheckoutLoading(false);
        return;
      }

      // 2. Request backend Razorpay Order creation (Backend creates order with live .env credentials)
      console.log('[Razorpay Diagnostics] 2. Calling backend /orders/create-razorpay-order...', {
        itemsCount: cartItems.length,
        meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
        cartTotal,
        address_id: selectedAddressId,
      });

      const res = await api.post('/orders/create-razorpay-order', {
        items: cartItems,
        meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
        address_id: selectedAddressId,
      });

      console.log('[Razorpay Diagnostics] 3. Backend order creation response received:', res.data);

      const { razorpay_order_id, order_db_id, amount, currency, key_id } = res.data;

      if (!razorpay_order_id) {
        throw new Error('Backend response did not contain a valid Razorpay Order ID.');
      }

      // Dynamically use backend key_id (from .env), falling back to discountInfo or frontend env
      const activeKey = key_id || discountInfo?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      console.log('[Razorpay Diagnostics] 4. Active Razorpay Key ID:', activeKey ? `${activeKey.substring(0, 10)}...` : 'NOT FOUND');

      if (!activeKey) {
        throw new Error('Razorpay Key ID is not available. Please verify RAZORPAY_KEY_ID in backend .env.');
      }

      // Helper function to verify payment with automatic exponential retry
      const verifyWithRetry = async (payload, maxRetries = 3) => {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Razorpay Diagnostics] Verification attempt ${attempt}/${maxRetries}...`);
            const verifyRes = await api.post('/orders/verify-payment', payload);
            if (verifyRes.data?.success) {
              return verifyRes.data;
            }
            lastError = new Error(verifyRes.data?.message || 'Verification unsuccessful');
          } catch (err) {
            lastError = err;
            console.warn(`[Razorpay Diagnostics] Verification attempt ${attempt} failed:`, err.message);
          }

          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          }
        }

        // Final attempt: Try direct recovery endpoint
        try {
          console.log('[Razorpay Diagnostics] Attempting final recovery check via /orders/recover-payment...');
          const recoverRes = await api.post('/orders/recover-payment', {
            razorpay_order_id: payload.razorpay_order_id,
            razorpay_payment_id: payload.razorpay_payment_id,
            order_db_id: payload.order_db_id,
          });
          if (recoverRes.data?.success) {
            return recoverRes.data;
          }
        } catch (recErr) {
          console.warn('[Razorpay Diagnostics] Final recovery attempt failed:', recErr.message);
        }

        throw lastError;
      };

      // 3. Configure Razorpay SDK Checkout options
      const options = {
        key: activeKey,
        amount: amount,
        currency: currency || 'INR',
        name: 'Matoshree Kirana',
        description: `${selectedMealType.toUpperCase()} Order Token`,
        order_id: razorpay_order_id.startsWith('order_mock_') ? undefined : razorpay_order_id,
        webview_intent: true,
        handler: async function (response) {
          console.log('[Razorpay Diagnostics] Payment succeeded on client, backing up state and verifying...', response);

          const rzpPaymentId = response.razorpay_payment_id || `pay_mock_${Date.now()}`;
          const rzpOrderId = response.razorpay_order_id || razorpay_order_id;
          const rzpSig = response.razorpay_signature || 'mock_signature';

          // Critical: Immediately store proof of payment in localStorage to survive browser reloads/kills
          const pendingPayment = {
            razorpay_order_id: rzpOrderId,
            razorpay_payment_id: rzpPaymentId,
            razorpay_signature: rzpSig,
            order_db_id: order_db_id,
            address_id: selectedAddressId,
            items: cartItems,
            meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
            timestamp: Date.now(),
          };

          try {
            localStorage.setItem('mess_pending_payment', JSON.stringify(pendingPayment));
          } catch (e) {
            // Storage quota warning
          }

          try {
            const verifyPayload = {
              razorpay_order_id: rzpOrderId,
              razorpay_payment_id: rzpPaymentId,
              razorpay_signature: rzpSig,
              order_db_id: order_db_id,
              items: cartItems,
              meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
              address_id: selectedAddressId,
            };

            const verifyResult = await verifyWithRetry(verifyPayload, 3);

            console.log('[Razorpay Diagnostics] Payment verified and fulfilled:', verifyResult);

            // Clean up localStorage backup on confirmed fulfillment
            try {
              localStorage.removeItem('mess_pending_payment');
            } catch (e) {}

            clearCart();
            setIsCartOpen(false);
            setTimeout(() => {
              onOrderSuccess(verifyResult.token_number, verifyResult.order);
            }, 250);
          } catch (verifyErr) {
            console.error('[Razorpay Diagnostics] Payment verification error after retries:', verifyErr);

            // Since payment was already deducted on Razorpay, inform student that token is generating
            const failReason =
              verifyErr.response?.data?.message ||
              verifyErr.message ||
              'Payment received! We are confirming your token with Matoshree Kirana...';

            setErrorMessage(
              'Your payment was successful on Razorpay! If your token number does not appear immediately, check "My Orders" in the top bar.'
            );

            // Trigger recovery check in background after 2 seconds
            setTimeout(async () => {
              try {
                const rec = await api.post('/orders/recover-payment', {
                  razorpay_order_id: rzpOrderId,
                  razorpay_payment_id: rzpPaymentId,
                  order_db_id: order_db_id,
                });
                if (rec.data?.success && rec.data?.token_number) {
                  try {
                    localStorage.removeItem('mess_pending_payment');
                  } catch (e) {}
                  clearCart();
                  setIsCartOpen(false);
                  onOrderSuccess(rec.data.token_number, rec.data.order);
                }
              } catch (e) {}
            }, 2000);
          } finally {
            setCheckoutLoading(false);
          }
        },
        prefill: {
          name: student?.name || 'User',
          email: student?.email || 'user@mess.com',
        },
        theme: {
          color: '#ea580c',
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay Diagnostics] Checkout modal dismissed by user.');
            setCheckoutLoading(false);
          },
        },
      };

      // 5. Instantiate and launch Razorpay Checkout window
      if (typeof window.Razorpay !== 'undefined' && !razorpay_order_id.startsWith('order_mock_')) {
        console.log(`[Razorpay Diagnostics] 5. Instantiating Razorpay modal with Order ID: ${razorpay_order_id}`);
        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', function (failureResponse) {
          console.error('[Razorpay Diagnostics] Razorpay Payment Failed Event:', failureResponse.error);
          const failReason = failureResponse.error?.description || failureResponse.error?.reason || 'Transaction aborted.';
          setErrorMessage(`Payment failed: ${failReason}`);
          setCheckoutLoading(false);
          const failurePayload = {
            reason: failReason,
            orderId: razorpay_order_id,
            paymentId: failureResponse.error?.metadata?.payment_id,
            amount: finalPayable,
            mealType: selectedMealType,
            studentName: student?.name,
            studentRollNo: student?.roll_no,
          };
          lastFailureDataRef.current = failurePayload;
          if (onPaymentFailure) {
            onPaymentFailure(failurePayload);
          }
        });

        rzp.open();
      } else if (razorpay_order_id.startsWith('order_mock_')) {
        console.warn('[Razorpay Diagnostics] Local dev mock order ID received. Simulating sandbox fulfillment...');
        // Dev Sandbox Simulation fallback when test keys aren't live
        setTimeout(async () => {
          try {
            const verifyRes = await api.post('/orders/verify-payment', {
              razorpay_order_id: razorpay_order_id,
              razorpay_payment_id: `pay_sandbox_${Date.now()}`,
              razorpay_signature: 'sandbox_test_sig',
              items: cartItems,
              meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
              address_id: selectedAddressId,
            });

            if (verifyRes.data.success) {
              clearCart(); // Clear cart ONLY on successful checkout
              setIsCartOpen(false);
              setTimeout(() => {
                onOrderSuccess(verifyRes.data.token_number, verifyRes.data.order);
              }, 250);
            } else {
              const failReason = verifyRes.data.message || 'Sandbox order verification failed.';
              setErrorMessage(failReason);
              const failurePayload = {
                reason: failReason,
                orderId: razorpay_order_id,
                amount: finalPayable,
                mealType: selectedMealType,
                studentName: student?.name,
                studentRollNo: student?.roll_no,
              };
              lastFailureDataRef.current = failurePayload;
              if (onPaymentFailure) {
                onPaymentFailure(failurePayload);
              }
            }
          } catch (e) {
            const failReason = e.response?.data?.message || 'Sandbox order fulfillment failed.';
            setErrorMessage(failReason);
            const failurePayload = {
              reason: failReason,
              orderId: razorpay_order_id,
              amount: finalPayable,
              mealType: selectedMealType,
              studentName: student?.name,
              studentRollNo: student?.roll_no,
            };
            lastFailureDataRef.current = failurePayload;
            if (onPaymentFailure) {
              onPaymentFailure(failurePayload);
            }
          } finally {
            setCheckoutLoading(false);
          }
        }, 1000);
      } else {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        setErrorMessage('Razorpay SDK failed to load — check network connection or ad-blocker.');
        setCheckoutLoading(false);
      }
    } catch (err) {
      console.error('[Razorpay Diagnostics] Checkout initiation failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to initiate Razorpay order.';
      setErrorMessage(msg);
      if (typeof triggerStockAlert === 'function' && (err.response?.data?.is_insufficient_stock || err.response?.data?.is_out_of_stock || msg.includes('available right now') || msg.includes('out of stock'))) {
        triggerStockAlert(msg);
      }
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Desktop Backdrop Overlay (Hidden on mobile full screen) */}
      <div
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in hidden sm:block"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Main Tray Container: FULL SCREEN ON MOBILE (< 640px), Drawer on Desktop (sm: >= 640px) */}
      <div className="w-full h-full sm:h-auto sm:max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-amber-100 z-50 animate-in slide-in-from-bottom sm:slide-in-from-right duration-300 overflow-hidden">

        {/* Drawer Header */}
        <div className="p-3.5 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/90 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-2 bg-amber-100 text-brand-orange rounded-xl shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-sm sm:text-lg text-brand-dark leading-tight truncate">Your Meal Tray</h2>
              <p className="text-[10px] sm:text-[11px] text-stone-500 font-semibold uppercase tracking-wider truncate">
                Target: <span className="text-brand-orange">{selectedMealType}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Back to Menu Button */}
            <button
              onClick={handleBackToMenu}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-brand-terracotta bg-amber-100 hover:bg-amber-200/80 border border-amber-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
              aria-label="Back to Menu"
            >
              <Utensils className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span className="whitespace-nowrap">Back to Menu</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 sm:p-2 rounded-xl sm:rounded-full text-stone-500 hover:text-stone-800 bg-stone-200/60 hover:bg-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
              aria-label="Close Tray"
            >
              <span className="text-xs font-bold sm:hidden">Close</span>
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Note on top of the Tray Section */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-3.5 sm:px-4 py-2.5 flex items-start gap-2.5 text-amber-900 shrink-0">
          <div className="p-1 bg-amber-200/70 text-amber-800 rounded-lg shrink-0 mt-0.5">
            <Info className="w-3.5 h-3.5 text-brand-orange shrink-0" />
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-stone-800 leading-snug">
            <span className="font-extrabold text-brand-terracotta">Note:</span> Kindly wait for few seconds for the token generation after successful payment and the amount is non-refundable!
          </p>
        </div>

        {/* Drawer Items Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl text-red-800 text-xs font-medium space-y-1.5 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const dataToPass = lastFailureDataRef.current || {
                    reason: errorMessage,
                    amount: finalPayable,
                    mealType: selectedMealType,
                    studentName: student?.name,
                    studentRollNo: student?.roll_no,
                  };
                  if (onPaymentFailure) {
                    onPaymentFailure(dataToPass);
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-orange hover:text-amber-800 underline underline-offset-2 cursor-pointer pt-0.5"
              >
                <span>Money debited? Don't worry — tap here for store assistance</span>
              </button>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-4xl sm:text-5xl shadow-inner animate-bounce">
                🛍️
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-stone-800">Your cart is empty — let's fix that!</h3>
              <p className="text-xs sm:text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
                Explore today's grocery & essentials catalog below and tap 'Add to Cart'.
              </p>
              <button
                onClick={handleBackToMenu}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold text-xs shadow-warm hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Browse Store Items</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/80 hover:border-amber-300 transition-all shadow-xs"
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-100">
                    <CachedImage
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-brand-dark line-clamp-2 leading-snug">
                      {item.base_item_name || item.name}
                    </h4>
                    {item.variant_name && (
                      <span className="inline-block text-[10px] font-extrabold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200 mt-0.5">
                        {item.variant_name}
                      </span>
                    )}
                    <p className="text-xs font-display font-extrabold text-brand-orange mt-1">₹{item.price}</p>
                  </div>

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-xs">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 text-stone-500 hover:text-brand-orange transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-extrabold text-stone-800 w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 text-stone-500 hover:text-brand-orange transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer & Checkout CTA */}
        {cartItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-stone-100 bg-white space-y-3 shrink-0 shadow-lg max-h-[60vh] overflow-y-auto">

            {/* Dynamic Discount Banner (Welcome Discount or Early Order) */}
            {isDiscountActive && discountAmount > 0 && (
              <div className="p-3 bg-gradient-to-r from-emerald-50 via-amber-50 to-orange-50 border border-emerald-300/80 rounded-2xl flex items-center gap-2.5 animate-in fade-in">
                <span className="text-xl">🎉</span>
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-black text-emerald-800 tracking-tight flex items-center gap-1">
                    <span>
                      {discountInfo.discount_type === 'new_user'
                        ? `Welcome Discount: ${discountInfo.discount_percentage}% OFF!`
                        : discountInfo.discount_type === 'early_breakfast'
                          ? `Early Breakfast Discount: ${discountInfo.discount_percentage}% OFF!`
                          : discountInfo.discount_type === 'early_lunch'
                            ? `Early Lunch Discount: ${discountInfo.discount_percentage}% OFF!`
                            : discountInfo.discount_type === 'early_snacks'
                              ? `Early Snacks Discount: ${discountInfo.discount_percentage}% OFF!`
                              : discountInfo.discount_type === 'early_dinner'
                                ? `Early Dinner Discount: ${discountInfo.discount_percentage}% OFF!`
                                : `${discountInfo.discount_percentage}% Discount Applied!`}
                    </span>
                    <Sparkles className="w-3 h-3 text-emerald-600 fill-emerald-500" />
                  </h5>
                  <p className="text-[10px] text-emerald-700 font-semibold truncate">
                    {discountInfo.discount_type === 'new_user'
                      ? `Welcome perk: ${discountInfo.discount_percentage}% off all meals for your first ${discountInfo.new_user_discount_days || 5} days!`
                      : discountInfo.cutoffs?.[selectedMealType]
                        ? `Early bird ${selectedMealType} before ${discountInfo.cutoffs[selectedMealType]}`
                        : `Early bird discount applied!`}
                  </p>
                </div>
              </div>
            )}

            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs text-stone-600 font-medium">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>

              {isDiscountActive && discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    {discountInfo.discount_type === 'new_user'
                      ? `Welcome Discount (${discountInfo.discount_percentage}%)`
                      : discountInfo.discount_type === 'early_breakfast'
                        ? `Early Breakfast Discount (${discountInfo.discount_percentage}%)`
                        : discountInfo.discount_type === 'early_lunch'
                          ? `Early Lunch Discount (${discountInfo.discount_percentage}%)`
                          : discountInfo.discount_type === 'early_snacks'
                            ? `Early Snacks Discount (${discountInfo.discount_percentage}%)`
                            : discountInfo.discount_type === 'early_dinner'
                              ? `Early Dinner Discount (${discountInfo.discount_percentage}%)`
                              : `Discount (${discountInfo.discount_percentage}%)`}
                  </span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Taxes & Handling</span>
                <span className="text-emerald-600 font-bold">FREE</span>
              </div>

              <div className="flex justify-between items-center text-sm sm:text-base font-extrabold font-display text-brand-dark pt-2 border-t border-stone-100">
                <span>Total Payable</span>
                <div className="text-right">
                  {isDiscountActive && discountAmount > 0 && (
                    <span className="text-xs text-stone-400 line-through mr-2 font-medium">
                      ₹{cartTotal}
                    </span>
                  )}
                  <span className="text-brand-orange text-lg sm:text-xl">₹{finalPayable}</span>
                </div>
              </div>
            </div>

            {/* Delivery Address Section (Directly ABOVE Pay button) */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-stone-800">
                  <MapPin className="w-4 h-4 text-brand-orange shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">Delivery Address</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddAddress}
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-orange hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New</span>
                </button>
              </div>

              {loadingAddresses ? (
                <div className="p-3 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl animate-pulse">
                  Loading saved addresses...
                </div>
              ) : addresses.length === 0 ? (
                <div
                  onClick={handleOpenAddAddress}
                  className="p-3.5 bg-amber-50/50 border-2 border-dashed border-amber-300 rounded-2xl text-center cursor-pointer hover:bg-amber-50 transition-all"
                >
                  <MapPin className="w-5 h-5 text-brand-orange mx-auto mb-1 opacity-70" />
                  <p className="text-xs font-bold text-stone-800">No delivery address saved</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">Please add your flat, wing & society details</p>
                  <button
                    type="button"
                    className="mt-2 px-3 py-1 bg-brand-orange text-white text-[11px] font-extrabold rounded-xl shadow-xs"
                  >
                    + Add Address
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setErrorMessage('');
                        }}
                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-amber-50/90 border-brand-orange shadow-xs ring-1 ring-brand-orange'
                            : 'bg-stone-50/60 border-stone-200 hover:border-amber-200 hover:bg-stone-50'
                        }`}
                      >
                        {/* Radio indicator */}
                        <div className="pt-0.5">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected ? 'border-brand-orange bg-brand-orange text-white' : 'border-stone-400 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>

                        {/* Address Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-stone-900 leading-tight">
                            Flat {addr.flat_number}, {addr.wing_name} Wing
                          </p>
                          <p className="text-[11px] font-semibold text-stone-700 leading-snug truncate mt-0.5">
                            {addr.society_name}
                            {addr.landmark ? ` • Near ${addr.landmark}` : ''}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 mt-1">
                            <span>PIN: {addr.pincode}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {addr.mobile_number}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditAddress(addr, e)}
                            className="p-1 text-stone-400 hover:text-brand-orange hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Address"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAddress(addr.id, e)}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Address"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Address Missing Warning */}
            {!selectedAddressId && cartItems.length > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Please select a delivery address to continue</span>
              </div>
            )}

            {/* Single Online Checkout Action */}
            <div className="space-y-2">
              <button
                onClick={handleProceedToPay}
                disabled={
                  checkoutLoading ||
                  !selectedAddressId ||
                  !(currentMealWindow ? (currentMealWindow.isAvailableNow ?? currentMealWindow.is_currently_open) : true)
                }
                className={`w-full py-3.5 sm:py-4 font-extrabold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 ${
                  !selectedAddressId ||
                  !(currentMealWindow ? (currentMealWindow.isAvailableNow ?? currentMealWindow.is_currently_open) : true)
                    ? 'bg-stone-300 text-stone-500 border border-stone-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white shadow-warm hover:shadow-cardHover cursor-pointer active:scale-95'
                }`}
              >
                {checkoutLoading ? (
                  <span>Initiating Razorpay...</span>
                ) : !selectedAddressId ? (
                  <span>Select Delivery Address to Pay</span>
                ) : !(currentMealWindow ? (currentMealWindow.isAvailableNow ?? currentMealWindow.is_currently_open) : true) ? (
                  <>
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{currentMealWindow?.serving_note || 'Store Closed Right Now'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Pay via Razorpay (₹{finalPayable})</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-stone-400 font-medium">
                {!selectedAddressId
                  ? 'Please select a delivery address to continue'
                  : !(currentMealWindow ? (currentMealWindow.isAvailableNow ?? currentMealWindow.is_currently_open) : true)
                  ? 'Orders can only be placed during store operating hours'
                  : 'Pay online & get instant order token number'}
              </p>
            </div>
          </div>
        )}

        {/* Address Add / Edit Modal */}
        {addressModalOpen && (
          <div className="fixed inset-0 z-[70] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-brand-orange rounded-xl">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-extrabold text-base text-stone-800">
                    {addressFormMode === 'add' ? 'Add Delivery Address' : 'Edit Delivery Address'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAddress} className="p-4 sm:p-5 space-y-3.5">
                {addressFormError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{addressFormError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Society Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addressFormData.society_name}
                    onChange={(e) => setAddressFormData({ ...addressFormData, society_name: e.target.value })}
                    placeholder="e.g. Green Meadows Society"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden text-stone-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Wing Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addressFormData.wing_name}
                      onChange={(e) => setAddressFormData({ ...addressFormData, wing_name: e.target.value })}
                      placeholder="e.g. A Wing"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden text-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Flat / Room No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addressFormData.flat_number}
                      onChange={(e) => setAddressFormData({ ...addressFormData, flat_number: e.target.value })}
                      placeholder="e.g. 402"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden text-stone-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Landmark <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={addressFormData.landmark}
                    onChange={(e) => setAddressFormData({ ...addressFormData, landmark: e.target.value })}
                    placeholder="e.g. Near Main Gate / Club House"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden text-stone-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Pincode <span className="text-red-500">* (6 digits)</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={addressFormData.pincode}
                      onChange={(e) => setAddressFormData({ ...addressFormData, pincode: e.target.value.replace(/\D/g, '') })}
                      placeholder="411038"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden text-stone-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Mobile Number <span className="text-red-500">* (10 digits)</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={addressFormData.mobile_number}
                      onChange={(e) => setAddressFormData({ ...addressFormData, mobile_number: e.target.value.replace(/\D/g, '') })}
                      placeholder="9876543210"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden text-stone-800 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addressSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-amber-600 text-white font-extrabold text-xs shadow-warm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {addressSubmitting ? 'Saving...' : addressFormMode === 'add' ? 'Save Address' : 'Update Address'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
