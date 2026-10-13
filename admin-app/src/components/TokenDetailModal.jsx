import React, { useEffect } from 'react';
import {
  X,
  Check,
  Truck,
  MapPin,
  Phone,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ShoppingBag,
} from 'lucide-react';

export default function TokenDetailModal({
  order,
  isOpen,
  onClose,
  onMarkOutForDelivery,
  onMarkDelivered,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const orderId = order.id || order._id;
  const status = order.order_status || 'placed';
  const isDelivered = status === 'delivered';
  const isOutForDelivery = status === 'out_for_delivery';
  const isExpired = status === 'expired';
  const isCancelled = status === 'cancelled';

  const address = order.delivery_address || (order.society_name ? {
    society_name: order.society_name,
    wing_name: order.wing_name,
    flat_number: order.flat_number,
    landmark: order.landmark,
    pincode: order.pincode,
    mobile_number: order.mobile_number,
  } : null);

  const studentName = order.customer_name || order.student_name || order.student?.name || 'Walk-in Customer';
  const mobileNumber = address?.mobile_number || order.student_phone || order.phone || 'Not provided';

  const formattedTime = order.created_at
    ? new Date(order.created_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : order.date || 'Today';

  const renderStatusBadge = () => {
    if (isDelivered) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>DELIVERED</span>
        </span>
      );
    }
    if (isOutForDelivery) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 animate-pulse">
          <Truck className="w-3.5 h-3.5 text-blue-600" />
          <span>OUT FOR DELIVERY</span>
        </span>
      );
    }
    if (status === 'ready') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>READY FOR PICKUP</span>
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>EXPIRED (35H)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
        <Clock className="w-3.5 h-3.5 text-amber-700" />
        <span className="uppercase">{status}</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/70 backdrop-blur-xs animate-in fade-in overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500 text-white font-black font-mono text-xl sm:text-2xl shadow-sm">
              #{order.token_number || orderId}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-stone-900 leading-tight">
                  Token Details
                </h3>
                <span className="text-[11px] font-bold text-stone-500 uppercase bg-stone-200 px-2 py-0.5 rounded-md">
                  {order.meal_type}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                Created: {formattedTime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {renderStatusBadge()}
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Customer & Contact Details Card */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Customer Name</span>
                <span className="font-extrabold text-stone-900 truncate block text-sm">{studentName}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Mobile Number</span>
                <span className="font-bold text-stone-900 truncate block font-mono text-sm">{mobileNumber}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address Section */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-brand-orange shrink-0" />
              <span>Full Delivery Address</span>
            </div>

            {address ? (
              <div className="space-y-1 text-xs">
                <p className="font-extrabold text-stone-900 text-sm">
                  Flat {address.flat_number}, {address.wing_name} Wing
                </p>
                <p className="font-semibold text-stone-700">
                  {address.society_name}
                  {address.landmark ? ` (Near ${address.landmark})` : ''}
                </p>
                <div className="flex items-center gap-3 text-[11px] font-bold text-stone-500 font-mono pt-0.5">
                  <span>Pincode: {address.pincode}</span>
                  <span>•</span>
                  <span>Contact: {address.mobile_number}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic py-1">
                No delivery address attached (Counter walk-in / order without address).
              </p>
            )}
          </div>

          {/* Ordered Products Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-stone-800">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-brand-orange" />
                <span>Ordered Products</span>
              </span>
              <span className="text-[11px] font-bold text-stone-500">
                {(order.items || []).length} product{(order.items || []).length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 font-extrabold text-[11px] border-b border-stone-200">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {(order.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/30">
                      <td className="py-2.5 px-3 font-bold text-stone-900">
                        {it.item_name}
                        {it.variant_name && !it.item_name.includes(it.variant_name) && (
                          <span className="ml-1 text-[10px] text-brand-orange font-extrabold">
                            ({it.variant_name})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-stone-700">
                        {it.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-stone-600 font-mono">
                        ₹{it.price}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-stone-900 font-mono">
                        ₹{Number(it.price) * Number(it.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Amount Summary */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600 font-medium">
              <span>Subtotal Amount</span>
              <span className="font-mono">₹{order.subtotal_amount || order.total_amount}</span>
            </div>

            {Number(order.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                <span>Discount ({order.discount_percentage || 0}%)</span>
                <span className="font-mono">-₹{order.discount_amount}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-sm font-extrabold text-stone-900">
              <span>Total Amount</span>
              <span className="text-base text-brand-orange font-mono font-black">
                ₹{order.total_amount}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-stone-500 pt-1">
              <span>Payment Status / Method</span>
              <span className="font-bold flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${String(order.payment_status || '').toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {String(order.payment_status || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
                <span className="text-stone-500 uppercase text-[10px] font-bold">• {order.payment_method || 'counter'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-100 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {/* Out for Delivery Action */}
            {!isOutForDelivery && !isDelivered && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  onMarkOutForDelivery(orderId);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Truck className="w-4 h-4" />
                <span>Out for Delivery</span>
              </button>
            )}

            {/* Delivered Action */}
            {!isDelivered && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  onMarkDelivered(orderId);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Mark Delivered</span>
              </button>
            )}

            {isDelivered && (
              <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Order Completed</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
