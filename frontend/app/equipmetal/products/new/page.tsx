"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Image as ImageIcon, Loader2, Sparkles, MapPin, Wrench } from 'lucide-react';

import { getAuth } from '../../../../lib/auth';
import { useI18n } from '../../../../lib/i18n';

const SALE_CATEGORIES = [
  { value: 'fertilizer', label: 'Fertilizer', emoji: '🧪' },
  { value: 'pesticide', label: 'Pesticide/Medicine', emoji: '🧴' },
  { value: 'seeds', label: 'Seeds', emoji: '🌱' },
  { value: 'tools', label: 'Tools', emoji: '🛠️' },
  { value: 'machinery_parts', label: 'Machinery Parts', emoji: '⚙️' },
];

const EQUIPMENT_CATEGORIES = [
  { value: 'tractor', label: 'Tractor' },
  { value: 'harvester', label: 'Harvester' },
  { value: 'drone', label: 'Agriculture Drone' },
  { value: 'tiller', label: 'Power Tiller' },
  { value: 'sprayer', label: 'Sprayer' },
  { value: 'other', label: 'Other Machinery' },
];

export default function EquipmetalNewProductPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [listingType, setListingType] = useState<'sell' | 'rent'>('sell');
  const sp = useSearchParams();
  // Initialize listing type from query param (?type=rent)
  useEffect(() => {
    const typeParam = sp?.get('type');
    if (typeParam === 'rent') setListingType('rent');
  }, [sp]);

  // Sale form
  const [saleForm, setSaleForm] = useState({
    title: '',
    category: '',
    description: '',
    price: '',
    unit: 'piece',
    stock: '',
    location: '',
    image: null as File | null,
  });

  // Rent form (equipment)
  const [rentForm, setRentForm] = useState({
    name: '',
    category: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    rate_per_hour: '',
    rate_per_day: '',
    contact_phone: '',
    image: null as File | null,
    uploadedImageUrl: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);

  // Geolocation helpers
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const useMyLocation = async () => {
    try {
      setGeoError(null);
      if (!('geolocation' in navigator)) {
        setGeoError('Geolocation is not supported by your browser.');
        return;
      }
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // Do not round for reverse geocoding; only for display
          const formatAddress = (addr: any) => {
            const a = addr || {};
            const locality = a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city || a.city_district;
            const district = a.county || a.state_district || a.district;
            const state = a.state;
            const country = a.country;
            const parts = [locality, district, state, country].filter(Boolean);
            return parts.join(', ');
          };
          let human = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          try {
            const url = new URL('https://nominatim.openstreetmap.org/reverse');
            url.searchParams.set('format', 'jsonv2');
            url.searchParams.set('lat', String(latitude));
            url.searchParams.set('lon', String(longitude));
            url.searchParams.set('zoom', '12'); // city/town level
            url.searchParams.set('addressdetails', '1');
            const r = await fetch(url.toString(), { headers: { 'Accept-Language': 'en' } });
            if (r.ok) {
              const j = await r.json();
              const addrText = formatAddress(j?.address);
              human = addrText || j?.display_name || human;
            }
          } catch {}

          // Update location fields depending on listing type
          if (listingType === 'sell') {
            setSale('location', human);
            if (saleForm.image) analyze(saleForm.image);
          } else {
            setRent('location', human);
            setRent('latitude', String(latitude));
            setRent('longitude', String(longitude));
            if (rentForm.image) analyze(rentForm.image);
          }
        } catch (e: any) {
          setGeoError(e?.message || 'Failed to obtain location');
        } finally {
          setGeoLoading(false);
        }
      }, (err) => {
        setGeoError(err?.message || 'Permission denied for location');
        setGeoLoading(false);
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch (e: any) {
      setGeoError(e?.message || 'Failed to obtain location');
      setGeoLoading(false);
    }
  };

  const setSale = (k: keyof typeof saleForm, v: any) => setSaleForm((p) => ({ ...p, [k]: v }));
  const setRent = (k: keyof typeof rentForm, v: any) => setRentForm((p) => ({ ...p, [k]: v }));

  const analyze = async (file: File | null) => {
    if (!file) return;
    try {
      setAiLoading(true);
      setAiResult(null);
      const auth = getAuth();
      const token = auth?.token;
      const fd = new FormData();
      fd.append('image', file);
      // Provide context for the analyzer
      const context: any = {
        listing_type: listingType,
        category: listingType === 'sell' ? saleForm.category : rentForm.category,
        location: listingType === 'sell' ? saleForm.location : rentForm.location,
        current_price: listingType === 'sell' ? saleForm.price : rentForm.rate_per_hour,
      };
      fd.append('context', JSON.stringify(context));
      const res = await fetch('/api/v1/media/analyze', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAiResult(data.ai || data);
        // Prefill hints based on response
        const sPrice = (data.ai?.suggested_price_in_inr ?? data.suggested_price_in_inr);
        const hourly = (data.ai?.suggested_hourly_rate_in_inr ?? data.suggested_hourly_rate_in_inr);
        const daily = (data.ai?.suggested_daily_rate_in_inr ?? data.suggested_daily_rate_in_inr);
        const desc = (data.ai?.description ?? data.description ?? data.ai?.notes ?? data.notes);
        if (listingType === 'sell') {
          if (sPrice) setSale('price', String(sPrice));
          if (desc && !saleForm.description) setSale('description', String(desc));
        }
        if (listingType === 'rent') {
          if (hourly) setRent('rate_per_hour', String(hourly));
          if (daily) setRent('rate_per_day', String(daily));
          if (desc && !rentForm.description) setRent('description', String(desc));
        }
      }
    } catch (e) {
      setAiResult(null);
    } finally {
      setAiLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    const auth = getAuth();
    const token = auth?.token;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('folder', 'krishimitra/equipmetal');
    const res = await fetch('/api/v1/media/upload', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url as string;
  };

  const submitSale = async () => {
    setErrors({});
    if (!saleForm.title.trim()) return setErrors((e) => ({ ...e, title: 'Title required' }));
    if (!saleForm.category) return setErrors((e) => ({ ...e, category: 'Category required' }));
    if (!saleForm.price.trim()) return setErrors((e) => ({ ...e, price: 'Price required' }));
    if (!saleForm.stock.trim()) return setErrors((e) => ({ ...e, stock: 'Stock required' }));
    if (!saleForm.image) return setErrors((e) => ({ ...e, image: 'Image required' }));
    try {
      setIsLoading(true);
      // Build multipart form for products API
      const auth = getAuth();
      const token = auth?.token;
      const fd = new FormData();
      fd.append('title', saleForm.title);
      fd.append('category', saleForm.category);
      fd.append('description', saleForm.description);
      fd.append('price', saleForm.price);
      fd.append('unit', saleForm.unit);
      fd.append('stock', saleForm.stock);
      fd.append('location', saleForm.location);
      fd.append('image', saleForm.image);
      const res = await fetch('/api/v1/marketplace/products', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create product');
      router.push('/marketplace');
    } catch (e: any) {
      alert(e?.message || 'Failed to create product');
    } finally {
      setIsLoading(false);
    }
  };

  const submitRent = async () => {
    setErrors({});
    if (!rentForm.name.trim()) return setErrors((e) => ({ ...e, name: 'Name required' }));
    if (!rentForm.category) return setErrors((e) => ({ ...e, category: 'Category required' }));
    if (!rentForm.location.trim()) return setErrors((e) => ({ ...e, location: 'Location required' }));
    try {
      setIsLoading(true);
      let imageUrl = rentForm.uploadedImageUrl;
      if (!imageUrl && rentForm.image) imageUrl = await uploadImage(rentForm.image);
      const auth = getAuth();
      const token = auth?.token;
      const payload: any = {
        name: rentForm.name,
        category: rentForm.category,
        description: rentForm.description || undefined,
        location: rentForm.location,
        latitude: rentForm.latitude ? Number(rentForm.latitude) : undefined,
        longitude: rentForm.longitude ? Number(rentForm.longitude) : undefined,
        rate_per_hour: rentForm.rate_per_hour ? Number(rentForm.rate_per_hour) : undefined,
        rate_per_day: rentForm.rate_per_day ? Number(rentForm.rate_per_day) : undefined,
        images: imageUrl ? [imageUrl] : [],
        contact_phone: rentForm.contact_phone || undefined,
      };
      const res = await fetch('/api/v1/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create equipment');
      router.push('/equipmetal/equipment');
    } catch (e: any) {
      alert(e?.message || 'Failed to create equipment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/marketplace" className="px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)] flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</Link>
          <h1 className="text-3xl font-bold text-[color:var(--foreground)]">New Listing</h1>
        </div>

        {/* Listing type selector */}
        <div className="mb-6 flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" checked={listingType === 'sell'} onChange={() => setListingType('sell')} /> Sell Product
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={listingType === 'rent'} onChange={() => setListingType('rent')} /> Rent Equipment
          </label>
        </div>

        {listingType === 'sell' ? (
          <div className="card border border-[color:var(--border)]/70 shadow-xl p-6">
            <div className="grid gap-4">
              <div>
                <label>{t('farmer.sell.product_name')}</label>
                <input value={saleForm.title} onChange={(e) => setSale('title', e.target.value)} placeholder={t('farmer.sell.name_placeholder')} />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
              </div>
              <div>
                <label>{t('farmer.sell.category')}</label>
                <select value={saleForm.category} onChange={(e) => setSale('category', e.target.value)}>
                  <option value="">Select category…</option>
                  {SALE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
                {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
              </div>
              <div>
                <label>{t('farmer.sell.description')}</label>
                <textarea value={saleForm.description} onChange={(e) => setSale('description', e.target.value)} placeholder={t('farmer.sell.description_placeholder')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>{t('farmer.sell.price_per_unit')}</label>
                  <input value={saleForm.price} onChange={(e) => setSale('price', e.target.value)} placeholder={t('farmer.sell.price_placeholder')} />
                  {errors.price && <p className="text-red-400 text-sm mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label>{t('farmer.sell.unit')}</label>
                  <select value={saleForm.unit} onChange={(e) => setSale('unit', e.target.value)}>
                    <option value="piece">Piece</option>
                    <option value="kg">Kg</option>
                    <option value="liter">Liter</option>
                    <option value="bag">Bag</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>{t('farmer.sell.available_stock')}</label>
                  <input value={saleForm.stock} onChange={(e) => setSale('stock', e.target.value)} placeholder={t('farmer.sell.stock_placeholder')} />
                  {errors.stock && <p className="text-red-400 text-sm mt-1">{errors.stock}</p>}
                </div>
                <div>
                  <label className="flex items-center justify-between">
                    <span>{t('farmer.sell.farm_location')}</span>
                    <button type="button" onClick={useMyLocation} className="text-[color:var(--primary)] text-xs underline disabled:opacity-60" disabled={geoLoading}>
                      {geoLoading ? t('loading') : t('farmer.sell.back').replace('Back to Marketplace','Use my current location')}
                    </button>
                  </label>
                  <input value={saleForm.location} onChange={(e) => setSale('location', e.target.value)} placeholder={t('farmer.sell.location_placeholder')} />
                  {geoError && <p className="text-amber-400 text-xs mt-1">{geoError}</p>}
                </div>
              </div>
              <div>
                <label>{t('farmer.sell.product_image')}</label>
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] || null; setSale('image', f); if (f) analyze(f); }} />
                {errors.image && <p className="text-red-400 text-sm mt-1">{errors.image}</p>}
                {aiLoading && <p className="text-[color:var(--foreground)]/70 text-sm mt-2">Analyzing image…</p>}
                {aiResult && (
                  <div className="mt-2 text-sm text-[color:var(--foreground)]/70">
                    <div className="font-medium">AI suggestions</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(aiResult, null, 2)}</pre>
                  </div>
                )}
              </div>
              <button className="btn btn-primary" disabled={isLoading} onClick={submitSale}>{isLoading ? 'Submitting…' : 'Create Product'}</button>
            </div>
          </div>
        ) : (
          <div className="card border border-[color:var(--border)]/70 shadow-xl p-6">
            <div className="grid gap-4">
              <div>
                <label>Name</label>
                <input value={rentForm.name} onChange={(e) => setRent('name', e.target.value)} />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>
              <div>
                <label>Category</label>
                <select value={rentForm.category} onChange={(e) => setRent('category', e.target.value)}>
                  <option value="">Select equipment category…</option>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
              </div>
              <div>
                <label>Description</label>
                <textarea value={rentForm.description} onChange={(e) => setRent('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Rate per hour (₹)</label>
                  <input value={rentForm.rate_per_hour} onChange={(e) => setRent('rate_per_hour', e.target.value)} />
                </div>
                <div>
                  <label>Rate per day (₹)</label>
                  <input value={rentForm.rate_per_day} onChange={(e) => setRent('rate_per_day', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center justify-between">
                    <span>Location</span>
                    <button type="button" onClick={useMyLocation} className="text-[color:var(--primary)] text-xs underline disabled:opacity-60" disabled={geoLoading}>
                      {geoLoading ? 'Detecting…' : 'Use my current location'}
                    </button>
                  </label>
                  <input value={rentForm.location} onChange={(e) => setRent('location', e.target.value)} />
                  {geoError && <p className="text-amber-400 text-xs mt-1">{geoError}</p>}
                </div>
                <div>
                  <label>Contact phone</label>
                  <input value={rentForm.contact_phone} onChange={(e) => setRent('contact_phone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Latitude</label>
                  <input value={rentForm.latitude} onChange={(e) => setRent('latitude', e.target.value)} />
                </div>
                <div>
                  <label>Longitude</label>
                  <input value={rentForm.longitude} onChange={(e) => setRent('longitude', e.target.value)} />
                </div>
              </div>
              {geoLoading && <p className="text-[color:var(--foreground)]/70 text-xs">Detecting your location…</p>}
              <div>
                <label>Image</label>
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] || null; setRent('image', f as any); if (f) analyze(f); }} />
                {aiLoading && <p className="text-[color:var(--foreground)]/70 text-sm mt-2">Analyzing image…</p>}
                {aiResult && (
                  <div className="mt-2 text-sm text-[color:var(--foreground)]/70">
                    <div className="font-medium">AI suggestions</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(aiResult, null, 2)}</pre>
                  </div>
                )}
              </div>
              <button className="btn btn-primary" disabled={isLoading} onClick={submitRent}>{isLoading ? 'Submitting…' : 'Create Equipment'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}