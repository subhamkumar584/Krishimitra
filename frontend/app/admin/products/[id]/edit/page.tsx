"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, AlertCircle, Upload as UploadIcon, Image as ImageIcon } from "lucide-react";

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

export default function AdminEditProductPage() {
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

        // Admin fetch: Use public product detail endpoint
        const res = await fetch(`http://localhost:5000/api/v1/marketplace/products/${id}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to load product (HTTP ${res.status})`);
        const data = await res.json();
        const prod = data?.product ?? data;
        if (!prod?.id) throw new Error("Product not found");

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
    } else {
      setPreview(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
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

      // Submit update (admin is allowed by backend)
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

      // Success -> go back to product view page
      router.push(`/marketplace/products/${id}`);
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
            href={`/marketplace/products/${id}`}
            className="flex items-center text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Product
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[color:var(--foreground)] mb-4">Admin: Edit Product</h1>

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
              <input value={form.location} onChange={(e) => setField("location", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm mb-1">Product Image</label>
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
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={(e) => onFileChange(e.target.files?.[0] || null)} className="text-sm" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={onUpload} disabled={uploading || !file} className="inline-flex items-center gap-2 px-3 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded disabled:opacity-50">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadIcon className="w-4 h-4" />}
                      <span>Upload</span>
                    </button>
                    <span className="text-xs text-[color:var(--foreground)]/60">After upload, the image link will be set automatically.</span>
                  </div>
                  {uploadError && (<div className="text-xs text-red-400">{uploadError}</div>)}
                  <input value={form.image_url} onChange={(e) => setField("image_url", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" placeholder="Image URL (auto-filled after upload)" />
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Description</label>
              <textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href={`/marketplace/products/${id}`} className="px-4 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--border)]">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded inline-flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
