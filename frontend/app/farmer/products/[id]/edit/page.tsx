"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, AlertCircle, Upload as UploadIcon, Image as ImageIcon, Sparkles, MapPin } from "lucide-react";

import { toNumber } from "../../../../../lib/product";

interface ProductForm {
  title: string;
  category: string;
  description: string;
  price: string; // keep as string in form, convert on submit
  unit: string;
  stock: string; // keep as string in form
  location: string;
  image_url: string;
}

export default function EditProductPage() {
  const params = useParams();
  const id = useMemo(() => Number(params?.id), [params]);
  const router = useRouter();

  const [form, setForm] = useState<ProductForm>({
    title: "",
    category: "",
    description: "",
    price: "",
    unit: "",
    stock: "",
    location: "",
    image_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [confirmNotRotten, setConfirmNotRotten] = useState(false);

  const setField = (k: keyof ProductForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Read token
        const auth = localStorage.getItem("km_auth");
        let token: string | null = null;
        if (auth) {
          try { token = JSON.parse(auth)?.token || null; } catch {}
        }
        if (!token) throw new Error("Authentication required");

        // Fetch farmer's products and find target by id so edit works even if product isn't 'active'
        const res = await fetch(`http://localhost:5000/api/v1/marketplace/products/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to load product (HTTP ${res.status})`);
        const data = await res.json();
        const prod = (data?.products || []).find((p: any) => Number(p.id) === id);
        if (!prod) throw new Error("Product not found in your listings");

        setForm({
          title: prod.title || "",
          category: prod.category || "",
          description: prod.description || "",
          price: prod.price != null ? String(prod.price) : "",
          unit: prod.unit || "",
          stock: prod.stock != null ? String(prod.stock) : "",
          location: prod.location || "",
          image_url: prod.image_url || "",
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };
    if (Number.isFinite(id)) load();
  }, [id]);

  const onUpload = async () => {
    setUploadError(null);
    try {
      if (!file) throw new Error("Please choose an image file");
      // Token
      const auth = localStorage.getItem("km_auth");
      let token: string | null = null;
      if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
      if (!token) throw new Error("Authentication required");

      const fd = new FormData();
      fd.append("image", file);
      fd.append("folder", "krishimitra/products");

      setUploading(true);
      const res = await fetch("http://localhost:5000/api/v1/media/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        let message = `Upload failed (HTTP ${res.status})`;
        try { const err = await res.json(); if (err?.error) message = err.error; } catch {}
        throw new Error(message);
      }
      const data = await res.json();
      setField("image_url", data.url);
      // Trigger AI analysis with the uploaded file if present
      if (file) await analyzeWithGemini(file);
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (f: File | null) => {
    setFile(f);
    setUploadError(null);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result || ""));
      reader.readAsDataURL(f);
      // Pre-analyze with selected file (before upload)
      analyzeWithGemini(f);
    } else {
      setPreview(null);
      setAiResult(null);
    }
  };

  async function analyzeWithGemini(file: File | null) {
    try {
      setAiLoading(true);
      setAiResult(null);
      const auth = localStorage.getItem("km_auth");
      let token: string | null = null;
      if (auth) { try { token = JSON.parse(auth)?.token || null; } catch {} }
      if (!token) throw new Error("Authentication required");

      const fd = new FormData();
      if (file) {
        fd.append("image", file);
      } else if (form.image_url) {
        // fallback analyze by image URL
        const res = await fetch("http://localhost:5000/api/v1/media/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            image_url: form.image_url,
            title: form.title,
            category: form.category,
            unit: form.unit,
            location: form.location,
            current_price: form.price,
          }),
        });
        if (!res.ok) throw new Error("AI analysis failed");
        const data = await res.json();
        setAiResult(data.ai || null);
        setAiLoading(false);
        return;
      }
      fd.append("title", form.title);
      fd.append("category", form.category);
      fd.append("unit", form.unit);
      fd.append("location", form.location);
      fd.append("current_price", form.price);

      const res = await fetch("http://localhost:5000/api/v1/media/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("AI analysis failed");
      const data = await res.json();
      setAiResult(data.ai || null);
    } catch (e) {
      setAiResult(null);
    } finally {
      setAiLoading(false);
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // If AI flagged potential rot, require confirmation before allowing save
      const aiCondition = String(aiResult?.condition || '').toLowerCase();
      const aiNotes = String(aiResult?.notes || '').toLowerCase();
      const aiScore = typeof aiResult?.quality_score === 'number' ? aiResult.quality_score : undefined;
      const maybeRotten = !!aiResult && (
        aiCondition.includes('rotten') || aiNotes.includes('rotten') || aiCondition === 'poor' || (typeof aiScore === 'number' && aiScore < 0.3)
      );
      if (maybeRotten && !confirmNotRotten) {
        setSaving(false);
        setError('AI detected possible rot. Please confirm the crop is not rotten and safe to sell, or avoid listing it.');
        return;
      }
      // Validate
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.category) throw new Error("Category is required");
      if (!form.unit) throw new Error("Unit is required");

      const priceNum = toNumber(form.price, NaN);
      const stockNum = toNumber(form.stock, NaN);
      if (!Number.isFinite(priceNum) || priceNum < 0) throw new Error("Invalid price");
      if (!Number.isFinite(stockNum) || stockNum < 0) throw new Error("Invalid stock");

      // Token
      const auth = localStorage.getItem("km_auth");
      let token: string | null = null;
      if (auth) {
        try { token = JSON.parse(auth)?.token || null; } catch {}
      }
      if (!token) throw new Error("Authentication required");

      // Submit update
      const payload: Record<string, any> = {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        price: priceNum,
        unit: form.unit,
        stock: stockNum,
        location: form.location.trim(),
        image_url: form.image_url.trim() || undefined,
      };

      const res = await fetch(`http://localhost:5000/api/v1/marketplace/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = `Failed to update (HTTP ${res.status})`;
        try { const err = await res.json(); if (err?.error) message = err.error; } catch {}
        throw new Error(message);
      }

      // Optionally read AI from server if provided
      try {
        const resp = await res.json();
        if (resp?.ai) setAiResult(resp.ai);
      } catch {}
      // Success -> go back to My Products
      router.push("/farmer/products");
    } catch (e: any) {
      setError(e?.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  if (!Number.isFinite(id)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">Invalid product id.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/farmer/products"
            className="flex items-center text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Products
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-4">Edit Product</h1>

        {error && (
          <div className="mb-4 p-3 border border-red-900/40 bg-red-900/20 rounded text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6 bg-[color:var(--card)] p-6 rounded border border-[color:var(--border)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Title *</label>
              <input value={form.title} onChange={(e) => setField("title", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Category *</label>
              <input value={form.category} onChange={(e) => setField("category", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Unit *</label>
              <input value={form.unit} onChange={(e) => setField("unit", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Price *</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField("price", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Stock *</label>
              <input type="number" step="0.01" min="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Location</label>
              <div className="flex items-center gap-2">
                <input value={form.location} onChange={(e) => setField("location", e.target.value)} className="flex-1 px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
                <button
                  type="button"
                  onClick={async () => {
                    if (!('geolocation' in navigator)) return;
                    try {
                      const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
                      const { latitude, longitude } = pos.coords;
                      let human = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                      try {
                        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
                        if (r.ok) {
                          const j = await r.json();
                          const parts = j?.address || {};
                          const city = parts.city || parts.town || parts.village || parts.hamlet;
                          const state = parts.state; const country = parts.country;
                          human = [city, state, country].filter(Boolean).join(', ') || human;
                        }
                      } catch {}
                      setField('location', human);
                      // Re-run AI suggestion if image exists
                      if (file) await analyzeWithGemini(file); else if (form.image_url) await analyzeWithGemini(null);
                    } catch {}
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)]"
                  title="Use my current location"
                >
                  <MapPin className="w-4 h-4" />
                  Use my location
                </button>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm mb-1">Product Image</label>
              {/* Current/Uploaded preview */}
              <div className="flex items-center gap-4">
                {preview ? (
                  <img src={preview} alt="Preview" className="w-24 h-24 object-cover rounded border border-[color:var(--border)]" />
                ) : form.image_url ? (
                  <img src={form.image_url} alt="Current" className="w-24 h-24 object-cover rounded border border-[color:var(--border)]" />
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center rounded border border-dashed border-[color:var(--border)] text-[color:var(--foreground)]/40">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onUpload}
                      disabled={uploading || !file}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadIcon className="w-4 h-4" />}
                      <span>Upload</span>
                    </button>
                    <span className="text-xs text-[color:var(--foreground)]/60">After upload, the image link will be set automatically.</span>
                  </div>
                  {uploadError && (
                    <div className="text-xs text-red-400">{uploadError}</div>
                  )}
                  <input value={form.image_url} onChange={(e) => setField("image_url", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" placeholder="Image URL (auto-filled after upload)" />
                </div>
              </div>
            </div>

            {/* AI Suggestion Card (below image section) */}
            {(aiLoading || aiResult) && (
              <div className="md:col-span-2 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[color:var(--primary)]" />
                  <h3 className="font-medium text-[color:var(--foreground)]">Gemini analysis for quality and suggested price</h3>
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-[color:var(--foreground)]/70">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing image…</span>
                  </div>
                ) : aiResult ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-[color:var(--card)]/50 rounded p-3 border border-[color:var(--border)]">
                        <div className="text-[color:var(--foreground)]/60">Condition</div>
                        <div className="text-[color:var(--foreground)] font-semibold capitalize">{aiResult.condition || '-'}</div>
                      </div>
                      <div className="bg-[color:var(--card)]/50 rounded p-3 border border-[color:var(--border)]">
                        <div className="text-[color:var(--foreground)]/60">Quality score</div>
                        <div className="text-[color:var(--foreground)] font-semibold">{(aiResult.quality_score ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="bg-[color:var(--card)]/50 rounded p-3 border border-[color:var(--border)]">
                        <div className="text-[color:var(--foreground)]/60">Suggested price</div>
                        <div className="text-[color:var(--foreground)] font-semibold">₹{(aiResult.suggested_price_in_inr ?? 0).toLocaleString()} / {form.unit || 'unit'}</div>
                      </div>
                      {aiResult.notes && (
                        <div className="md:col-span-3 text-[color:var(--foreground)]/80">{aiResult.notes}</div>
                      )}
                    </div>

                    {/* Rotten warning & confirmation */}
                    {(() => {
                      const cond = String(aiResult?.condition || '').toLowerCase();
                      const notes = String(aiResult?.notes || '').toLowerCase();
                      const score = typeof aiResult?.quality_score === 'number' ? aiResult.quality_score : undefined;
                      const maybeRotten = cond.includes('rotten') || notes.includes('rotten') || cond === 'poor' || (typeof score === 'number' && score < 0.3);
                      if (!maybeRotten) return null;
                      return (
                        <div className="mt-4 p-3 border border-red-800/30 bg-red-900/20 rounded">
                          <div className="text-red-300 text-sm mb-2">
                            Possible rot or poor quality detected. We recommend NOT selling this lot.
                          </div>
                          <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]/80">
                            <input
                              type="checkbox"
                              checked={confirmNotRotten}
                              onChange={(e) => setConfirmNotRotten(e.target.checked)}
                            />
                            I confirm this crop is not rotten and safe to sell.
                          </label>
                        </div>
                      );
                    })()}
                  </>
                ) : null}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Description</label>
              <textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href="/farmer/products" className="px-4 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--border)]">
              Cancel
            </Link>
            <button type="submit" disabled={saving || (!!aiResult && ((String(aiResult?.condition||'').toLowerCase().includes('rotten') || String(aiResult?.notes||'').toLowerCase().includes('rotten') || String(aiResult?.condition||'').toLowerCase() === 'poor' || (typeof aiResult?.quality_score === 'number' && aiResult.quality_score < 0.3)) && !confirmNotRotten))} className="px-4 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded inline-flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
