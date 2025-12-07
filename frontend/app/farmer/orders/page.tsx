"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCurrentUser, getOrders, approveOrder } from "../../../lib/api";
import { Loader2, Check, X, ArrowLeft, User as UserIcon, Package, Truck } from "lucide-react";

interface User {
  id: number;
  role: "farmer" | "customer" | "admin";
  name: string;
  email: string;
}

interface OrderItemSummary {
  product_id: number;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
}

interface OrderSummary {
  id: number;
  created_at: string;
  status: string;
  payment_status: string;
  subtotal: number;
  delivery_charges: number;
  total_amount: number;
  buyer_name?: string;
  seller_name?: string;
  delivery_address?: string | null;
  items: OrderItemSummary[];
}

export default function FarmerOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<number | null>(null);

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

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrders("seller");
      setOrders(res.orders || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingUser && user && (user.role === "farmer" || user.role === "admin")) {
      fetchOrders();
    }
  }, [loadingUser, user]);

  const canApprove = (o: OrderSummary) => {
    if (!o) return false;
    return (
      (o.payment_status === "CAPTURED") &&
      !["SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status)
    );
  };

  const handleApprove = async (orderId: number) => {
    if (approving) return;
    setApproving(orderId);
    try {
      await approveOrder(orderId);
      await fetchOrders();
    } catch (e) {
      alert("Failed to approve order.");
    } finally {
      setApproving(null);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center text-[color:var(--foreground)]/70">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!user || (user.role !== "farmer" && user.role !== "equipmetal" && user.role !== "admin")) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">Access denied</h1>
          <p className="text-[color:var(--foreground)]/70 mb-4">Only farmers and admins can view seller orders.</p>
          <Link href="/marketplace" className="underline">Go back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Link href="/marketplace" className="px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]">Back</Link>
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">Seller Orders</h1>
          </div>
        </div>

        {loading && (
          <div className="flex items-center space-x-3 text-[color:var(--foreground)]/70">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading orders...</span>
          </div>
        )}
        {!loading && error && (
          <div className="mb-4 p-3 border border-red-800/30 bg-red-900/20 rounded text-red-400">{error}</div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-16 border border-[color:var(--border)] rounded-lg bg-[color:var(--card)]">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">No orders yet</h3>
            <p className="text-[color:var(--foreground)]/60">You will receive order requests here once customers pay.</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-6">
            {orders.map((o) => (
              <div key={o.id} className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-[color:var(--foreground)]/70">Order</div>
                    <div className="text-[color:var(--foreground)] font-semibold">#{o.id}</div>
                    <span className="text-xs px-2 py-1 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)]/80">{o.status}</span>
                  </div>
                  <div className="text-sm text-[color:var(--foreground)]/70">Total: <span className="text-[color:var(--foreground)] font-semibold">₹{(o.total_amount ?? 0).toLocaleString()}</span></div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center text-sm text-[color:var(--foreground)]/70">
                    <UserIcon className="w-4 h-4 mr-2" /> Buyer: <span className="ml-2 text-[color:var(--foreground)]">{o.buyer_name || "Customer"}</span>
                  </div>
                  {o.delivery_address && (
                    <div className="text-sm text-[color:var(--foreground)]/70 truncate max-w-[50%]">Ship to: <span className="text-[color:var(--foreground)]">{o.delivery_address}</span></div>
                  )}
                </div>

                <div className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
                  {o.items?.map((it) => (
                    <div key={`${o.id}-${it.product_id}`} className="flex items-center justify-between p-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[color:var(--foreground)] truncate">{it.product_name}</div>
                        <div className="text-xs text-[color:var(--foreground)]/60">Qty: {it.quantity} × ₹{it.price_per_unit.toLocaleString()}</div>
                      </div>
                      <div className="text-[color:var(--foreground)] font-semibold">₹{it.total_price.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <button
                    onClick={() => handleApprove(o.id)}
                    disabled={!canApprove(o) || approving === o.id}
                    className={`inline-flex items-center px-4 py-2 rounded-md border ${canApprove(o) ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90' : 'bg-transparent text-[color:var(--foreground)]/50 border-[color:var(--border)] cursor-not-allowed'}`}
                  >
                    {approving === o.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Truck className="w-4 h-4 mr-2" />
                        Approve & Ship
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
