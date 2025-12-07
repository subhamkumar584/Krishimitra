"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Package, Plus, Timer, Wrench } from "lucide-react";

import { getCurrentUser, getProducts, createOrder, verifyPayment, addToCart } from "../../../lib/api";
import ProductCard from "../../../components/marketplace/ProductCard";
import { getAuth } from "../../../lib/auth";

interface User {
  id: number;
  role: "farmer" | "customer" | "admin" | string;
  name: string;
  email: string;
}

interface EquipmentItem {
  id: number;
  name: string;
  category: string;
  description?: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  rate_per_hour?: number | null;
  rate_per_day?: number | null;
  availability: boolean;
  images?: string[];
  contact_phone?: string;
  owner?: { id: number; name: string };
}

interface SupplyProduct {
  id: number;
  title: string;
  price: number;
  unit: string;
  stock: number;
  category: string;
  location: string;
  image_url?: string;
  seller_name: string;
  average_rating?: number;
  reviews_count?: number;
  is_available: boolean;
  created_at?: string;
}

export default function FarmerEquipmentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Supplies (fertilizers, pesticides, tools, etc.) visible to farmers
  const [supplies, setSupplies] = useState<SupplyProduct[]>([]);
  const [loadingSupplies, setLoadingSupplies] = useState(true);

  type CombinedItem = { kind: 'equip'; data: EquipmentItem } | { kind: 'supply'; data: SupplyProduct };
  const combinedItems: CombinedItem[] = useMemo(() => {
    return [
      ...equipment.map((e) => ({ kind: 'equip' as const, data: e })),
      ...supplies.map((p) => ({ kind: 'supply' as const, data: p })),
    ];
  }, [equipment, supplies]);

  const addSupplyToCart = async (productId: number, quantity: number) => {
    try {
      await addToCart(productId, quantity);
      alert('Added to cart');
    } catch (e: any) {
      alert(e?.message || 'Failed to add to cart');
    }
  };

  const [bookingFor, setBookingFor] = useState<EquipmentItem | null>(null);
  const [startDateTime, setStartDateTime] = useState<string>("");
  const [endDateTime, setEndDateTime] = useState<string>("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch (e) {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!loadingUser) {
      if (!user || (user.role !== "farmer" && user.role !== "admin")) return;
      // Fetch both equipment and supplies in parallel
      fetchEquipment();
      fetchSupplies();
    }
  }, [loadingUser, user]);

  const fetchEquipment = async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth();
      const token = auth?.token;
      const res = await fetch(`/api/v1/equipment`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load equipment");
      setEquipment(data.equipment || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load equipment");
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplies = async () => {
    setLoadingSupplies(true);
    try {
      // Pull supply categories commonly used by equipmetal (include common typos/variants)
      const supplyCategories = [
        'fertilizer', 'fertlizer',
        'pesticide', 'pesticide/medicine', 'medicine',
        'seeds', 'seed',
        'tools', 'tool',
        'machinery_parts', 'machinery parts', 'machinery', 'machineary parts', 'machinaery parts',
      ];
      const limit = 24;

      // NOTE: We intentionally call the products API WITHOUT auth headers here.
      // The backend filters farmers to only their own products when a farmer token is present.
      // Fetching anonymously bypasses that and returns marketplace supplies for viewing.
      const fetchPublicProducts = async (category: string) => {
        const u = new URL('/api/v1/marketplace/products', window.location.origin);
        u.searchParams.set('category', category);
        u.searchParams.set('limit', String(limit));
        try {
          const r = await fetch(u.toString());
          if (!r.ok) return [] as SupplyProduct[];
          const j = await r.json();
          return (j?.products || []) as SupplyProduct[];
        } catch {
          return [] as SupplyProduct[];
        }
      };

      // Fetch per category and merge unique products
      const results = await Promise.all(supplyCategories.map((cat) => fetchPublicProducts(cat)));
      const merged: Record<number, SupplyProduct> = {};
      for (const arr of results) {
        for (const p of arr) {
          merged[p.id] = p;
        }
      }
      // Convert to array and store
      setSupplies(Object.values(merged));
    } catch (e) {
      // Non-fatal for page
      setSupplies([]);
    } finally {
      setLoadingSupplies(false);
    }
  };

  const canBook = (item: EquipmentItem) => !!item.availability;


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

  const submitBooking = async () => {
    if (!bookingFor) return;
    if (!startDateTime || !endDateTime) {
      alert("Please select start and end date/time.");
      return;
    }
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert("Invalid date/time");
      return;
    }
    if (start >= end) {
      alert("Start must be before end");
      return;
    }

    try {
      setBookingSubmitting(true);
      // Create equipment payment order
      const order = await createOrder({ type: 'equipment', equipment_id: bookingFor.id, start_datetime: start.toISOString(), end_datetime: end.toISOString() });
      const orderId = order.razorpay_order_id;
      const amountRupees = order.amount;
      const currency = order.currency || 'INR';
      const key = order.key || (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string);

      if (!orderId || !key) {
        alert(`Order created. Amount: ₹${amountRupees}. Payment keys not configured.`);
        setBookingFor(null);
        setStartDateTime("");
        setEndDateTime("");
        return;
      }

      await ensureRazorpayScript();
      const options: any = {
        key,
        amount: Math.round((amountRupees || 0) * 100),
        currency,
        name: 'KrishiMittra',
        description: `Equipment booking: ${bookingFor.name}`,
        order_id: orderId,
        handler: async function (response: any) {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            alert('Payment successful! Booking created. Provider will be notified for approval.');
            setBookingFor(null);
            setStartDateTime("");
            setEndDateTime("");
          } catch (err: any) {
            alert(err?.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            alert('Payment cancelled');
          }
        }
      };
      const rz = new (window as any).Razorpay(options);
      if (rz && typeof rz.on === 'function') {
        rz.on('payment.failed', function () {
          alert('Payment failed!');
        });
      }
      rz.open();
    } catch (e: any) {
      alert(e?.message || "Booking failed");
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center text-[color:var(--foreground)]/70">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user || (user.role !== "farmer" && user.role !== "admin")) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">Access denied</h1>
          <p className="text-[color:var(--foreground)]/70 mb-4">Only farmers and admins can book equipment.</p>
          <Link href="/marketplace" className="underline">Go back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">Equipments</h1>
            <p className="text-[color:var(--foreground)]/70">Browse and book farm equipment from nearby providers.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/marketplace" className="px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]">Back to Marketplace</Link>
            <Link href="/cart" className="px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]">Open Cart</Link>
          </div>
        </div>

        {error && (
          <div className="p-3 border border-red-800/30 bg-red-900/20 rounded text-red-400">{error}</div>
        )}

        {loading && (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-[color:var(--card)] border border-[color:var(--border)] rounded animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !loadingSupplies && equipment.length === 0 && supplies.length === 0 && (
          <div className="text-center py-16 border border-[color:var(--border)] rounded-lg bg-[color:var(--card)]">
            <div className="text-6xl mb-4">🛠️</div>
            <h3 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">No equipment or supplies available</h3>
            <p className="text-[color:var(--foreground)]/60">Please check again later.</p>
          </div>
        )}

        {!loading && !loadingSupplies && combinedItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {combinedItems.map((item) => {
              if (item.kind === 'equip') {
                const it = item.data as EquipmentItem;
                return (
                  <div key={`eq-${it.id}`} className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] overflow-hidden hover:border-[color:var(--primary)]/50 transition-colors">
                    {/* Image */}
                    <div className="aspect-video relative bg-gray-100 dark:bg-gray-800">
                      {it.images && it.images.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.images[0]} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Wrench className="w-10 h-10 text-[color:var(--foreground)]/20" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-black/30 backdrop-blur-sm text-white/90">
                        {it.availability ? 'Available' : 'Unavailable'}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-[color:var(--foreground)] text-sm leading-tight line-clamp-2">
                          {it.name}
                        </h3>
                        <span className="text-xs text-[color:var(--foreground)]/60 ml-2 whitespace-nowrap">
                          {it.category}
                        </span>
                      </div>

                      {it.description && (
                        <p className="text-sm text-[color:var(--foreground)]/70 mb-3 line-clamp-2">{it.description}</p>
                      )}

                      <div className="flex items-center justify-between text-sm text-[color:var(--foreground)]/70 mb-3">
                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {it.location}</div>
                        <div className="text-right">
                          {it.rate_per_hour ? <div className="text-[color:var(--foreground)] font-semibold">₹{it.rate_per_hour}/hr</div> : null}
                          {it.rate_per_day ? <div className="text-[color:var(--foreground)]/80">₹{it.rate_per_day}/day</div> : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setBookingFor(it)}
                          disabled={!canBook(it)}
                          className={`px-4 py-2 rounded border ${canBook(it) ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90' : 'bg-transparent text-[color:var(--foreground)]/50 border-[color:var(--border)] cursor-not-allowed'}`}
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const product = item.data as SupplyProduct;
                return (
                  <ProductCard key={`sp-${product.id}`} product={product as any} onAddToCart={addSupplyToCart} showPurchaseButton={true} />
                );
              }
            })}
          </div>
        )}


        {bookingFor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md p-4 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl">
              <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Book {bookingFor.name}</h3>
              <div className="mt-3 grid gap-3">
                <label className="text-sm">Start date/time</label>
                <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--foreground)]" />
                <label className="text-sm">End date/time</label>
                <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="px-3 py-2 rounded border border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--foreground)]" />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="px-3 py-2 text-[color:var(--foreground)]/70" onClick={() => setBookingFor(null)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-60" onClick={submitBooking} disabled={bookingSubmitting}>{bookingSubmitting ? 'Booking…' : 'Confirm Booking'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}