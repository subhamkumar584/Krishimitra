"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Wrench, MapPin, Trash2, Edit, Loader2, Package } from "lucide-react";
import { getCurrentUser } from "../../../lib/api";
import { getAuth } from "../../../lib/auth";

interface User {
  id: number;
  role: "farmer" | "customer" | "admin" | "equipmetal" | string;
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

interface ProductItem {
  id: number;
  title: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  location?: string;
  image_url?: string;
  description?: string;
  status?: string;
}

export default function EquipmetalEquipmentManagePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [supplies, setSupplies] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    location: "",
    latitude: "",
    longitude: "",
    rate_per_hour: "",
    rate_per_day: "",
    contact_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

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
      if (!user || (user.role !== "equipmetal" && user.role !== "admin")) return;
      fetchMyEquipment();
      fetchMySupplies();
    }
  }, [loadingUser, user]);

  const fetchMyEquipment = async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth();
      const token = auth?.token;
      const res = await fetch(`/api/v1/equipment`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load equipment");
      const myId = user?.id;
      let list = data.equipment || [];
      // For equipmetal, show only own; for admin, show all
      if (user?.role === 'equipmetal') {
        list = list.filter((e: any) => e?.owner?.id === myId);
      }
      setEquipment(list);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load equipment");
    } finally {
      setLoading(false);
    }
  };

  const fetchMySupplies = async () => {
    try {
      const auth = getAuth();
      const token = auth?.token;
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/v1/marketplace/products/my', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load products');
      const normalize = (c: string) => {
        let s = (c || '').toLowerCase().trim();
        if (s === 'pesticide/medicine' || s === 'medicine') s = 'pesticide';
        if (s === 'machinery parts' || s === 'machineary parts' || s === 'machinaery parts') s = 'machinery_parts';
        if (s === 'seed') s = 'seeds';
        if (s === 'fertlizer') s = 'fertilizer';
        return s;
      };
      const allowed = new Set(['fertilizer','pesticide','seeds','tools','tool','machinery_parts','machinery']);
      const mine = (data.products || []).filter((p: any) => allowed.has(normalize(p.category)));
      setSupplies(mine);
    } catch (e) {
      setSupplies([]);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "", description: "", location: "", latitude: "", longitude: "", rate_per_hour: "", rate_per_day: "", contact_phone: "" });
    setFormOpen(true);
  };
  const openEdit = (it: EquipmentItem) => {
    setEditing(it);
    setForm({
      name: it.name || "",
      category: it.category || "",
      description: it.description || "",
      location: it.location || "",
      latitude: String(it.latitude ?? ""),
      longitude: String(it.longitude ?? ""),
      rate_per_hour: String(it.rate_per_hour ?? ""),
      rate_per_day: String(it.rate_per_day ?? ""),
      contact_phone: it.contact_phone || "",
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    try {
      setSubmitting(true);
      const auth = getAuth();
      const token = auth?.token;
      const payload: any = {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim(),
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        rate_per_hour: form.rate_per_hour ? Number(form.rate_per_hour) : undefined,
        rate_per_day: form.rate_per_day ? Number(form.rate_per_day) : undefined,
        contact_phone: form.contact_phone.trim() || undefined,
      };
      const url = editing ? `/api/v1/equipment/${editing.id}` : `/api/v1/equipment`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Save failed");
      setFormOpen(false);
      setEditing(null);
      await fetchMyEquipment();
    } catch (e: any) {
      alert(e?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Delete this equipment?")) return;
    try {
      const auth = getAuth();
      const token = auth?.token;
      const r = await fetch(`/api/v1/equipment/${id}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Delete failed");
      await fetchMyEquipment();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try {
      const auth = getAuth();
      const token = auth?.token;
      const r = await fetch(`/api/v1/marketplace/products/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || 'Delete failed');
      await fetchMySupplies();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center text-[color:var(--foreground)]/70">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="ml-2">Loading…</span>
      </div>
    );
  }
  if (!user || (user.role !== "equipmetal" && user.role !== "admin")) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">Access denied</h1>
          <p className="text-[color:var(--foreground)]/70 mb-4">Only equipment providers can manage equipment.</p>
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
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">Manage Equipment & Supplies</h1>
            <p className="text-[color:var(--foreground)]/70">Create or update your rental machinery and farm supply listings.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/equipmetal/products/new?type=rent" className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Equipment
            </Link>
            <Link href="/equipmetal/products/new" className="px-4 py-2 border border-[color:var(--border)] rounded-lg hover:bg-[color:var(--muted)] transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Supply
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-3 border border-red-800/30 bg-red-900/20 rounded text-red-400">{error}</div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-[color:var(--card)] border border-[color:var(--border)] rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)] flex items-center gap-2"><Wrench className="w-4 h-4" /> My Equipment</h2>
            <div className="grid md-grid-cols-1 md:grid-cols-2 gap-4">
            {equipment.map((it) => (
              <div key={it.id} className="p-4 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-[color:var(--foreground)] flex items-center gap-2">
                      <Wrench className="w-4 h-4" /> {it.name}
                    </div>
                    <div className="text-sm text-[color:var(--foreground)]/60 mt-1">{it.category}</div>
                    {it.description && <p className="text-sm text-[color:var(--foreground)]/70 mt-2 line-clamp-2">{it.description}</p>}
                  </div>
                  <div className="text-right text-sm text-[color:var(--foreground)]/70">
                    {it.rate_per_hour ? <div>₹{it.rate_per_hour}/hr</div> : null}
                    {it.rate_per_day ? <div>₹{it.rate_per_day}/day</div> : null}
                    <div className={it.availability ? "text-emerald-400" : "text-amber-400"}>
                      {it.availability ? "Available" : "Unavailable"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-[color:var(--foreground)]/70">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {it.location}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(it)} className="px-3 py-1 border rounded hover:bg-[color:var(--muted)] flex items-center gap-1"><Edit className="w-4 h-4" /> Edit</button>
                    <button onClick={() => deleteItem(it.id)} className="px-3 py-1 border border-red-500/40 text-red-400 rounded hover:bg-red-900/20 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Delete</button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Supplies section */}
          <div className="space-y-2 mt-8">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)] flex items-center gap-2"><Package className="w-4 h-4" /> My Supplies</h2>
            {supplies.length === 0 ? (
              <div className="text-sm text-[color:var(--foreground)]/60">No supplies yet. Use "New Supply" to create one.</div>
            ) : (
              <div className="grid md-grid-cols-1 md:grid-cols-2 gap-4">
                {supplies.map((p) => (
                  <div key={p.id} className="p-4 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-[color:var(--foreground)] truncate">{p.title}</div>
                        <div className="text-sm text-[color:var(--foreground)]/60 mt-1 truncate">{p.category}</div>
                        <div className="text-sm text-[color:var(--foreground)] mt-2">₹{Number(p.price || 0).toLocaleString()}/{p.unit}</div>
                        {p.description && <p className="text-sm text-[color:var(--foreground)]/70 mt-2 line-clamp-2">{p.description}</p>}
                      </div>
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.title} className="w-20 h-20 object-cover rounded ml-3" />
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-[color:var(--foreground)]/70">
                      <div>Stock: {p.stock}</div>
                      <div className="flex items-center gap-2">
                        <Link href={`/farmer/products/${p.id}/edit`} className="px-3 py-1 border rounded hover:bg-[color:var(--muted)] flex items-center gap-1"><Edit className="w-4 h-4" /> Edit</Link>
                        <button onClick={() => deleteProduct(p.id)} className="px-3 py-1 border border-red-500/40 text-red-400 rounded hover:bg-red-900/20 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}

        {formOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md p-4 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl">
              <h3 className="text-xl font-semibold text-[color:var(--foreground)]">{editing ? 'Edit' : 'New'} Equipment</h3>
              <div className="mt-3 grid gap-3">
                <label className="text-sm">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <label className="text-sm">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="tractor, harvester, drone..." />
                <label className="text-sm">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <label className="text-sm">Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Latitude</label>
                    <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm">Longitude</label>
                    <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Rate per hour (₹)</label>
                    <input value={form.rate_per_hour} onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm">Rate per day (₹)</label>
                    <input value={form.rate_per_day} onChange={(e) => setForm({ ...form, rate_per_day: e.target.value })} />
                  </div>
                </div>
                <label className="text-sm">Contact Phone</label>
                <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="px-3 py-2 text-[color:var(--foreground)]/70" onClick={() => setFormOpen(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-60" onClick={submitForm} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}