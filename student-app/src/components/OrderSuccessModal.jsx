import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, X, Clock, Utensils, MapPin, Truck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function OrderSuccessModal({ tokenNumber, order, onClose }) {
  const [currentStatus, setCurrentStatus] = useState(order?.order_status || 'placed');

  const orderId = order?._id || order?.id;

  useEffect(() => {
    if (order?.order_status) {
      setCurrentStatus(order.order_status);
    }
  }, [order?.order_status]);

  useEffect(() => {
    if (tokenNumber) {
      // Fire confetti burst upon confirmed token reveal
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ea580c', '#f59e0b', '#10b981', '#ffffff'],
        });
      } catch (e) {
        console.log('Confetti error:', e);
      }
    }
  }, [tokenNumber]);

  if (!tokenNumber && !order) return null;

  const qrPayload = tokenNumber
    ? JSON.stringify({
        order_id: orderId || '',
        token_number: tokenNumber,
        meal_type: order?.meal_type || '',
        payment_status: order?.payment_status || 'paid',
        date: order?.date || '',
      })
    : '';

  const address = order?.delivery_address || (order?.society_name ? {
    society_name: order.society_name,
    wing_name: order.wing_name,
    flat_number: order.flat_number,
    landmark: order.landmark,
    pincode: order.pincode,
    mobile_number: order.mobile_number,
  } : null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-4 sm:p-6 text-center animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Paid Token Icon */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 animate-bounce">
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold font-display text-brand-dark">Payment Confirmed!</h2>
        <p className="text-xs text-stone-500 mt-1">Show this token or QR code at the canteen counter</p>

        {/* Prominent Token & QR Card */}
        <div className="my-4 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-2.5">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
            Your Order Token Number
          </span>
          
          <div className="text-4xl sm:text-5xl font-extrabold font-display text-brand-terracotta tracking-wider animate-pulse">
            {tokenNumber}
          </div>

          {/* QR Code */}
          {qrPayload && (
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-amber-200 inline-block my-1">
              <QRCodeSVG
                value={qrPayload}
                size={120}
                level="M"
                fgColor="#1c1917"
                bgColor="#ffffff"
              />
            </div>
          )}
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
            Token valid for 35 hours
          </span>

          {/* Real-time Order Status Badge */}
          {currentStatus === 'delivered' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>DELIVERED</span>
            </span>
          ) : currentStatus === 'out_for_delivery' ? (
            <div className="space-y-1 w-full flex flex-col items-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-900 bg-blue-100 px-4 py-1.5 rounded-full border border-blue-300 animate-pulse">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>🚚 OUT FOR DELIVERY</span>
              </span>
              <p className="text-[11px] font-bold text-blue-900 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 text-center w-full">
                Your meal is on the way to your delivery address!
              </p>
            </div>
          ) : currentStatus === 'ready' ? (
            <div className="space-y-1 w-full flex flex-col items-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300 animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>🎉 READY FOR PICKUP</span>
              </span>
              <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-center w-full">
                Your food is prepared and ready!
              </p>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-3.5 py-1.5 rounded-full border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-brand-orange animate-spin" style={{ animationDuration: '4s' }} />
              <span>Preparing in Kitchen</span>
            </span>
          )}
        </div>

        {/* Order Details Brief */}
        {order && (
          <div className="text-left text-xs bg-stone-50 p-3 sm:p-3.5 rounded-2xl border border-stone-100 space-y-2 mb-4">
            <div className="flex justify-between text-stone-500">
              <span>Meal Type:</span>
              <span className="font-bold text-stone-800 uppercase">{order.meal_type}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Status:</span>
              <span className={`font-extrabold uppercase px-2 py-0.5 rounded text-[10px] ${
                currentStatus === 'delivered'
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentStatus === 'out_for_delivery'
                  ? 'bg-blue-100 text-blue-800'
                  : currentStatus === 'ready'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {currentStatus === 'delivered'
                  ? 'Delivered'
                  : currentStatus === 'out_for_delivery'
                  ? 'Out for Delivery'
                  : currentStatus === 'ready'
                  ? 'Ready'
                  : 'Paid & In Queue'}
              </span>
            </div>

            {/* Delivery Address Snapshot */}
            {address && (
              <div className="pt-2 border-t border-stone-200/80">
                <div className="flex items-center gap-1 text-stone-600 font-bold mb-1 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                  <span>Delivery Address:</span>
                </div>
                <p className="text-[11px] font-semibold text-stone-800 leading-snug">
                  Flat {address.flat_number}, {address.wing_name} Wing, {address.society_name}
                  {address.landmark ? ` (Near ${address.landmark})` : ''}
                </p>
                <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                  PIN: {address.pincode} • Mobile: {address.mobile_number}
                </p>
              </div>
            )}

            {Number(order.discount_amount || 0) > 0 && (
              <>
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-stone-700">₹{order.subtotal_amount || order.total_amount}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg text-[11px]">
                  <span>Discount ({order.discount_percentage}%):</span>
                  <span>-₹{order.discount_amount}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-stone-500 font-bold pt-1 border-t border-stone-200/80">
              <span>Total Paid:</span>
              <span className="text-brand-orange text-sm font-extrabold">₹{order.total_amount}</span>
            </div>
            
            {/* Itemized list */}
            {order.items && order.items.length > 0 && (
              <div className="border-t border-stone-200/80 pt-1.5 space-y-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-stone-700 font-semibold min-w-0 gap-2">
                    <span className="truncate">
                      {it.quantity}x {it.item_name}
                      {it.variant_name && !it.item_name.includes(it.variant_name) && (
                        <span className="ml-1.5 text-brand-orange font-bold text-[10px]">
                          ({it.variant_name})
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold">₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-brand-dark text-white font-bold rounded-2xl text-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-warm"
        >
          <Utensils className="w-4 h-4" />
          <span>Done & Back to Menu</span>
        </button>

      </div>
    </div>
  );
}
