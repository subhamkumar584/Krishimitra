"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "../../lib/i18n";
import { getOrders } from "../../lib/api";
import { Loader2, CheckCircle, Circle, Package, Truck, Clock, ArrowLeft, Filter, Search } from "lucide-react";

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
  status: "CREATED" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | string;
  payment_status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED" | string;
  subtotal: number;
  delivery_charges: number;
  total_amount: number;
  buyer_name?: string;
  seller_name?: string;
  delivery_address?: string | null;
  items: OrderItemSummary[];
}

const STATUS_STEPS = ["CREATED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

type FilterKey = "all" | "active" | "delivered" | "cancelled";

export default function OrdersPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrders("buyer");
      setOrders(res.orders || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (orders || [])
      .filter((o) => {
        if (filter === "active") return o.status !== "DELIVERED" && o.status !== "CANCELLED";
        if (filter === "delivered") return o.status === "DELIVERED";
        if (filter === "cancelled") return o.status === "CANCELLED";
        return true;
      })
      .filter((o) => {
        if (!term) return true;
        return (
          `${o.id}`.includes(term) ||
          (o.seller_name || "").toLowerCase().includes(term) ||
          (o.items || []).some((it) => (it.product_name || "").toLowerCase().includes(term))
        );
      });
  }, [orders, filter, q]);

  const renderBadge = (status: string) => {
    const base = "text-xs px-2 py-1 rounded-full border";
    switch (status) {
      case "DELIVERED":
        return <span className={`${base} border-emerald-700/40 bg-emerald-900/20 text-emerald-300`}>Delivered</span>;
      case "SHIPPED":
        return <span className={`${base} border-sky-700/40 bg-sky-900/20 text-sky-300`}>Shipped</span>;
      case "PROCESSING":
        return <span className={`${base} border-amber-700/40 bg-amber-900/20 text-amber-300`}>Processing</span>;
      case "CONFIRMED":
        return <span className={`${base} border-blue-700/40 bg-blue-900/20 text-blue-300`}>Confirmed</span>;
      case "CANCELLED":
        return <span className={`${base} border-red-700/40 bg-red-900/20 text-red-300`}>Cancelled</span>;
      default:
        return <span className={`${base} border-zinc-700/40 bg-zinc-900/20 text-zinc-300`}>{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Link href="/marketplace" className="inline-flex items-center px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back to Marketplace</span>
            </Link>
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">Orders</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--foreground)]/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by order, product or seller..."
                className="pl-9 pr-3 py-2 rounded-md bg-[color:var(--muted)] border border-[color:var(--border)] text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            {([
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "delivered", label: "Delivered" },
              { key: "cancelled", label: "Cancelled" },
            ] as { key: FilterKey; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  filter === key
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/20 text-[color:var(--primary)]"
                    : "border-[color:var(--border)] text-[color:var(--foreground)]/80 hover:bg-[color:var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchOrders}
            className="text-sm px-3 py-2 rounded-md border border-[color:var(--border)] hover:bg-[color:var(--muted)]"
            title="Refresh"
          >
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center space-x-3 text-[color:var(--foreground)]/70">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t("loading")}</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mb-4 p-3 border border-red-800/30 bg-red-900/20 rounded text-red-400">{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 border border-[color:var(--border)] rounded-lg bg-[color:var(--card)]">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">No orders found</h3>
            <p className="text-[color:var(--foreground)]/60 mb-6">Start shopping in the marketplace and your orders will appear here.</p>
            <Link
              href="/marketplace"
              className="inline-flex items-center space-x-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
            >
              <span>Go to Marketplace</span>
            </Link>
          </div>
        )}

        {/* Orders List */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-6">
            {filtered.map((o) => {
              const current = Math.max(0, STATUS_STEPS.indexOf((o.status as any) || "CREATED"));
              return (
                <div key={o.id} className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-[color:var(--foreground)]/70">Order</div>
                      <div className="text-[color:var(--foreground)] font-semibold">#{o.id}</div>
                      {renderBadge(o.status)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[color:var(--foreground)]/70">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(o.created_at).toLocaleString()}</span>
                      <span className="ml-2">Total:</span>
                      <span className="font-semibold text-[color:var(--foreground)]">₹{(o.total_amount ?? 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {o.status === 'CONFIRMED' && (
                    <div className="mb-4 p-3 border border-amber-800/30 bg-amber-900/20 rounded text-amber-300 text-sm">
                      Awaiting seller approval to ship.
                    </div>
                  )}

                  {/* Seller and address */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="text-sm text-[color:var(--foreground)]/70">Seller: <span className="text-[color:var(--foreground)]">{o.seller_name || "Farmer"}</span></div>
                    {o.delivery_address && (
                      <div className="text-sm text-[color:var(--foreground)]/70 truncate max-w-[50%]">Ship to: <span className="text-[color:var(--foreground)]">{o.delivery_address}</span></div>
                    )}
                  </div>

                  {/* Items */}
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

                  {/* Timeline */}
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {STATUS_STEPS.map((s, i) => (
                        <div key={s} className="flex items-center">
                          {i <= current ? (
                            <CheckCircle className="w-4 h-4 text-[color:var(--primary)]" />
                          ) : (
                            <Circle className="w-4 h-4 text-[color:var(--foreground)]/30" />
                          )}
                          <span className={`ml-2 text-xs ${i <= current ? "text-[color:var(--foreground)]" : "text-[color:var(--foreground)]/50"}`}>{s}</span>
                          {i < STATUS_STEPS.length - 1 && (
                            <div className={`mx-2 h-px w-8 ${i < current ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]"}`}></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
