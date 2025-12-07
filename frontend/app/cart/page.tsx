"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/i18n';
import { getCart, updateCartItem, removeFromCart, clearCart, createOrder, verifyPayment } from '../../lib/api';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';

interface CartItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image?: string;
  price: number;
  unit: string;
  quantity: number;
  total: number;
  seller_name: string;
  seller_id: number;
  stock_available: number;
}


export default function CartPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCart();
      setItems(res.cart_items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);


  const totalAmount = items.reduce((sum, i) => sum + i.total, 0);

  const changeQty = async (item: CartItem, newQty: number) => {
    if (newQty < 1 || newQty > item.stock_available) return;
    setBusyId(item.id);
    try {
      await updateCartItem(item.id, newQty);
      await fetchCart();
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (item: CartItem) => {
    setBusyId(item.id);
    try {
      await removeFromCart(item.id);
      await fetchCart();
    } finally {
      setBusyId(null);
    }
  };

  const clear = async () => {
    setCheckingOut(true);
    try {
      await clearCart();
      await fetchCart();
    } finally {
      setCheckingOut(false);
    }
  };

  const ensureRazorpayScript = () => new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('window unavailable'));
    const existing = document.getElementById('razorpay-js');
    if (existing) return resolve();
    const s = document.createElement('script');
    s.id = 'razorpay-js';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });

  const checkout = async () => {
    setCheckingOut(true);
    setError(null);
    try {
      // 1) Create consolidated marketplace order on backend
      const order = await createOrder({ type: 'marketplace' });
      // Expected from backend: { success, razorpay_order_id, amount, currency, key }
      const orderId = order.razorpay_order_id;
      const amountRupees = order.amount ?? totalAmount;
      const currency = order.currency ?? 'INR';
      const key = order.key || (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string);

      if (!orderId || !key) {
        // Dev mode fallback or missing keys: just alert
        alert(`Order created. Amount: ₹${amountRupees}. Payment keys not configured.`);
        await fetchCart();
        return;
      }

      // 2) Load Razorpay script
      await ensureRazorpayScript();

      // 3) Open Razorpay Checkout
      const options: any = {
        key,
        amount: Math.round((amountRupees || 0) * 100),
        currency,
        name: 'AgriConnect',
        description: 'Marketplace Order',
        order_id: orderId,
        handler: async function (response: any) {
          try {
            // 4) Verify payment signature with backend
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            alert('Payment successful!');
            await fetchCart();
            // Redirect customer to Orders page
            router.push('/orders');
          } catch (err: any) {
            setError(err?.message || 'Payment verification failed');
            alert('Payment failed!');
          }
        },
        modal: {
          ondismiss: () => {
            setError('Payment cancelled');
            alert('Payment cancelled');
          }
        },
        prefill: {
          name: 'Customer',
          email: 'customer@example.com',
          contact: '9999999999',
        },
        theme: { color: '#0ea5e9' },
      };
      const rz = new (window as any).Razorpay(options);
      // Catch client-side payment failures
      if (rz && typeof rz.on === 'function') {
        rz.on('payment.failed', function () {
          setError('Payment failed');
          alert('Payment failed!');
        });
      }
      rz.open();
    } catch (e: any) {
      setError(e.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-[color:var(--foreground)]/70">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[color:var(--background)]">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <ShoppingBag className="w-16 h-16 text-[color:var(--foreground)]/20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">Cart</h1>
          <p className="text-[color:var(--foreground)]/60 mb-6">Your cart is empty.</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center space-x-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
          >
            <span>Go to Marketplace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[color:var(--foreground)] mb-6">Cart</h1>

        {error && (
          <div className="mb-4 p-3 border border-red-800/30 bg-red-900/20 rounded text-red-400">{error}</div>
        )}

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg p-4 flex items-center">
              <div className="w-20 h-20 bg-[color:var(--muted)] rounded mr-4 overflow-hidden flex items-center justify-center">
                {item.product_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🛍️</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[color:var(--foreground)] truncate">{item.product_name}</h3>
                  <div className="text-[color:var(--foreground)] font-bold">₹{item.total.toLocaleString()}</div>
                </div>
                <div className="text-sm text-[color:var(--foreground)]/60 mt-1">
                  ₹{item.price.toLocaleString()}/{item.unit} • Seller: {item.seller_name}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center border border-[color:var(--border)] rounded-md bg-[color:var(--muted)]">
                    <button
                      onClick={() => changeQty(item, item.quantity - 1)}
                      disabled={busyId === item.id || item.quantity <= 1}
                      className="px-2 py-1 hover:bg-[color:var(--border)]"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-12 text-center text-[color:var(--foreground)]">{item.quantity}</div>
                    <button
                      onClick={() => changeQty(item, item.quantity + 1)}
                      disabled={busyId === item.id || item.quantity >= item.stock_available}
                      className="px-2 py-1 hover:bg-[color:var(--border)]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item)}
                    disabled={busyId === item.id}
                    className="text-red-400 hover:text-red-300 px-3 py-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-[color:var(--card)] border border-[color:var(--border)] rounded-lg p-4 flex items-center justify-between">
          <div className="text-[color:var(--foreground)]/80">Total</div>
          <div className="text-2xl font-bold text-[color:var(--foreground)]">₹{totalAmount.toLocaleString()}</div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={clear}
            disabled={checkingOut}
            className="px-4 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]"
          >
            Clear Cart
          </button>
          <button
            onClick={checkout}
            disabled={checkingOut}
            className="inline-flex items-center space-x-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
          >
            {checkingOut && <Loader2 className="w-5 h-5 animate-spin" />}
            <span>Proceed to Checkout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
