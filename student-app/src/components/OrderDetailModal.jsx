import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, AlertCircle, MapPin, Truck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CAFE_D_CRUZE_LOGO from '../assets/logo';
import api from '../services/api';

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const orderId = order._id || order.id;
  const [currentStatus, setCurrentStatus] = useState(order.order_status || 'placed');

  useEffect(() => {
    setCurrentStatus(order.order_status || 'placed');
  }, [order.order_status]);

  // Fetch true, fresh order status from backend to prevent displaying stale status
  useEffect(() => {
    let isMounted = true;
    const fetchLatestStatus = async () => {
      try {
        const res = await api.get('/orders/my-orders');
        if (isMounted && res.data?.success && Array.isArray(res.data.orders)) {
          const fresh = res.data.orders.find(
            (o) =>
              (orderId && String(o.id || o._id) === String(orderId)) ||
              (order.token_number && String(o.token_number) === String(order.token_number))
          );
          if (fresh && fresh.order_status) {
            setCurrentStatus(fresh.order_status);
          }
        }
      } catch (err) {
        // Fall back gracefully to currentStatus
      }
    };

    fetchLatestStatus();
    return () => {
      isMounted = false;
    };
  }, [orderId, order.token_number]);

  const isDelivered = currentStatus === 'delivered';
  const isExpired = currentStatus === 'expired';
  const isOutForDelivery = currentStatus === 'out_for_delivery';
  const isReady = currentStatus === 'ready';
  const tokenNumber = order.token_number;

  const qrData = tokenNumber
    ? JSON.stringify({
        order_id: orderId || '',
        token_number: tokenNumber,
        meal_type: order.meal_type || '',
        payment_status: order.payment_status || 'paid',
        date: order.date || '',
      })
    : '';

  const address = order.delivery_address || (order.society_name ? {
    society_name: order.society_name,
    wing_name: order.wing_name,
    flat_number: order.flat_number,
    landmark: order.landmark,
    pincode: order.pincode,
    mobile_number: order.mobile_number,
  } : null);

  const getStatusBadge = () => {
    if (isDelivered) {
      return (
        <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="bg-rose-100 text-rose-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Expired (Past 35h)
        </span>
      );
    }
    if (isOutForDelivery) {
      return (
        <span className="bg-blue-100 text-blue-900 border border-blue-300 text-xs font-black px-3.5 py-1 rounded-full uppercase flex items-center gap-1.5 shadow-xs animate-pulse">
          <Truck className="w-3.5 h-3.5 text-blue-600" /> Out for Delivery
        </span>
      );
    }
    if (isReady) {
      return (
        <span className="bg-emerald-500 text-white text-xs font-black px-3.5 py-1 rounded-full uppercase flex items-center gap-1.5 shadow-sm animate-pulse">
          <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" /> Ready for Pickup
        </span>
      );
    }
    return (
      <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" /> {currentStatus || 'Placed'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-4 sm:p-6 text-center animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header info */}
        <div className="mb-3">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Matoshree Kirana Logo"
              className="w-7 h-7 rounded-xl object-contain bg-white p-0.5 shadow-sm border border-amber-200"
            />
            <span className="font-display font-extrabold text-sm text-brand-dark tracking-tight leading-none">
              Matoshree <span className="text-brand-orange">Kirana</span>
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Large Token & QR Box */}
        {tokenNumber && (
          <div className="my-3 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-2.5">
            <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-widest">
              Order Token Number
            </span>

            <div className={`text-4xl sm:text-5xl font-black font-display tracking-wider ${
              isExpired ? 'text-rose-600 line-through opacity-70' : 'text-brand-terracotta'
            }`}>
              {tokenNumber}
            </div>

            {/* Large Scannable QR Code */}
            <div className="relative my-1">
              <div
                className={`p-3 sm:p-4 bg-white rounded-3xl shadow-md border border-amber-200 inline-block transition-all ${
                  isDelivered || isExpired ? 'grayscale opacity-25 select-none' : ''
                }`}
              >
                <QRCodeSVG
                  value={qrData}
                  size={180}
                  level="M"
                  fgColor="#1c1917"
                  bgColor="#ffffff"
                />
              </div>

              {/* Overlay Badge for Delivered Orders */}
              {isDelivered && (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <div className="px-3.5 py-2 bg-emerald-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 tracking-wide animate-in zoom-in">
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    <span>ALREADY DELIVERED</span>
                  </div>
                </div>
              )}

              {/* Overlay Badge for Expired Orders */}
              {isExpired && (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <div className="px-3.5 py-2 bg-rose-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 tracking-wide animate-in zoom-in">
                    <AlertCircle className="w-4 h-4 text-white shrink-0" />
                    <span>TOKEN EXPIRED (35H)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Out for Delivery Notice */}
            {isOutForDelivery && (
              <div className="w-full p-2.5 bg-blue-50 border border-blue-300 rounded-2xl text-center space-y-0.5 animate-in zoom-in-95">
                <p className="text-xs font-black text-blue-900 flex items-center justify-center gap-1">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>🚚 Food is Out for Delivery!</span>
                </p>
                <p className="text-[11px] font-semibold text-blue-800">
                  Your meal has left the kitchen and is on its way to your address.
                </p>
              </div>
            )}

            {/* Ready for Pickup Alert */}
            {isReady && (
              <div className="w-full p-2.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-0.5 animate-in zoom-in-95">
                <p className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>🎉 Ready for Pickup!</span>
                </p>
                <p className="text-[11px] font-semibold text-emerald-700">
                  Your meal is prepared and ready.
                </p>
              </div>
            )}

            <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 max-w-xs leading-tight">
              {isDelivered
                ? 'This order has already been delivered.'
                : isExpired
                ? 'This token was not collected within 35 hours and has expired.'
                : isOutForDelivery
                ? 'Delivery partner is on the way to your doorstep.'
                : isReady
                ? 'Please collect your order at the counter immediately.'
                : 'Tokens remain valid for 35 hours from order creation.'}
            </p>
          </div>
        )}

        {/* Items Summary Breakdown */}
        <div className="text-left bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 space-y-2 mb-4 text-xs">
          <div className="flex justify-between font-bold text-stone-700 pb-2 border-b border-stone-200/80">
            <span>Order Date:</span>
            <span className="text-stone-800">{order.date}</span>
          </div>

          {/* Delivery Address Snapshot */}
          {address && (
            <div className="p-2.5 bg-white rounded-xl border border-amber-200/70 space-y-1">
              <div className="flex items-center gap-1 text-stone-700 font-bold text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                <span>Delivery Address</span>
              </div>
              <p className="text-[11px] font-semibold text-stone-800 leading-tight">
                Flat {address.flat_number}, {address.wing_name} Wing, {address.society_name}
                {address.landmark ? ` (Near ${address.landmark})` : ''}
              </p>
              <p className="text-[10px] text-stone-500 font-mono">
                PIN: {address.pincode} • Mobile: {address.mobile_number}
              </p>
            </div>
          )}

          <div className="space-y-1 pt-1">
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="flex justify-between text-stone-700 font-semibold min-w-0 gap-2">
                <span className="truncate">
                  {it.quantity}x {it.item_name}
                  {it.variant_name && !it.item_name.includes(it.variant_name) && (
                    <span className="ml-1.5 text-brand-orange font-bold text-[11px]">
                      ({it.variant_name})
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-bold">₹{it.price * it.quantity}</span>
              </div>
            ))}
          </div>

          {Number(order.discount_amount || 0) > 0 && (
            <div className="border-t border-stone-200/80 pt-2 space-y-1">
              <div className="flex justify-between text-stone-500 font-medium">
                <span>Subtotal</span>
                <span>₹{order.subtotal_amount || order.total_amount}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                <span>Discount ({order.discount_percentage}%)</span>
                <span>-₹{order.discount_amount}</span>
              </div>
            </div>
          )}

          <div className="border-t border-stone-200/80 pt-2 flex justify-between font-black text-sm text-stone-900">
            <span>Total Amount Paid</span>
            <span className="text-brand-orange">₹{order.total_amount}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-brand-dark text-white font-extrabold rounded-2xl text-xs hover:bg-stone-800 transition-all cursor-pointer shadow-md"
        >
          Close Details
        </button>

      </div>
    </div>
  );
}
