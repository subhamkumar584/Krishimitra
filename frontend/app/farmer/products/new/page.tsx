"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Image as ImageIcon, Loader2, Sparkles, MapPin } from 'lucide-react';

import { useI18n } from '../../../../lib/i18n';

const CATEGORIES = [
  { value: 'vegetables', label: 'Vegetables', emoji: '🥬' },
  { value: 'fruits', label: 'Fruits', emoji: '🍎' },
  { value: 'grains', label: 'Grains', emoji: '🌾' },
  { value: 'spices', label: 'Spices', emoji: '🌶️' },
  { value: 'dairy', label: 'Dairy', emoji: '🥛' },
  { value: 'pulses', label: 'Pulses', emoji: '🫘' },
  { value: 'oil_seeds', label: 'Oil Seeds', emoji: '🌰' },
  { value: 'herbs', label: 'Herbs', emoji: '🌿' },
  { value: 'flowers', label: 'Flowers', emoji: '🌸' },
];

const UNITS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'quintal', label: 'Quintal (100 kg)' },
  { value: 'gram', label: 'Gram (g)' },
  { value: 'ton', label: 'Ton (1000 kg)' },
  { value: 'piece', label: 'Piece' },
  { value: 'dozen', label: 'Dozen (12 pieces)' },
  { value: 'liter', label: 'Liter (L)' },
  { value: 'bag', label: 'Bag' },
];

interface FormData {
  title: string;
  category: string;
  description: string;
  price: string;
  unit: string;
  stock: string;
  location: string;
  image: File | null;
}

export default function NewProductPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    title: '',
    category: '',
    description: '',
    price: '',
    unit: '',
    stock: '',
    location: '',
    image: null,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);

  // AI analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [confirmNotRotten, setConfirmNotRotten] = useState(false);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleImageChange = (file: File | null) => {
    if (!file) {
      setFormData(prev => ({ ...prev, image: null }));
      setImagePreview(null);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, image: t('farmer.sell.error.image_type') }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: t('farmer.sell.error.image_size') }));
      return;
    }

    setFormData(prev => ({ ...prev, image: file }));
    setErrors(prev => ({ ...prev, image: '' }));

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Trigger AI analysis in background
    analyzeWithGemini(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleImageChange(files[0]);
    }
  };

  // Geolocation -> fill location and re-run AI if image selected
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const useMyLocation = async () => {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const formatAddress = (addr: any) => {
          const a = addr || {};
          const locality = a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city || a.city_district;
          const district = a.county || a.state_district || a.district;
          const state = a.state;
          const country = a.country;
          const parts = [locality, district, state, country].filter(Boolean);
          return parts.join(', ');
        };
        // Reverse geocode via Nominatim
        let human = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const url = new URL('https://nominatim.openstreetmap.org/reverse');
          url.searchParams.set('format', 'jsonv2');
          url.searchParams.set('lat', String(latitude));
          url.searchParams.set('lon', String(longitude));
          url.searchParams.set('zoom', '12');
          url.searchParams.set('addressdetails', '1');
          const r = await fetch(url.toString(), { headers: { 'Accept-Language': 'en' } });
          if (r.ok) {
            const j = await r.json();
            human = formatAddress(j?.address) || j?.display_name || human;
          }
        } catch {}
        setFormData((prev) => ({ ...prev, location: human }));
        // If image already selected, re-run AI with updated location
        if (formData.image) analyzeWithGemini(formData.image);
      } catch (e: any) {
        setGeoError(e?.message || 'Failed to obtain location');
      } finally {
        setGeoLoading(false);
      }
    }, (err) => {
      setGeoError(err?.message || 'Permission denied for location');
      setGeoLoading(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = t('farmer.sell.error.name_required');
    } else if (formData.title.trim().length < 3) {
      newErrors.title = t('farmer.sell.error.name_min');
    }

    if (!formData.category) {
      newErrors.category = t('farmer.sell.error.category_required');
    }

    if (!formData.price.trim()) {
      newErrors.price = t('farmer.sell.error.price_required');
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      newErrors.price = t('farmer.sell.error.price_invalid');
    }

    if (!formData.unit) {
      newErrors.unit = t('farmer.sell.error.unit_required');
    }

    if (!formData.stock.trim()) {
      newErrors.stock = t('farmer.sell.error.stock_required');
    } else if (isNaN(parseFloat(formData.stock)) || parseFloat(formData.stock) < 0) {
      newErrors.stock = t('farmer.sell.error.stock_invalid');
    }

    if (!formData.image) {
      newErrors.image = t('farmer.sell.error.image_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function analyzeWithGemini(file: File | null) {
    try {
      setAiLoading(true);
      setAiResult(null);
      // Token
      const authData = localStorage.getItem('km_auth');
      let token: string | null = null;
      if (authData) { try { token = JSON.parse(authData)?.token || null; } catch {} }
      if (!token) throw new Error('Authentication required');

      const fd = new FormData();
      if (file) fd.append('image', file);
      fd.append('title', formData.title);
      fd.append('category', formData.category);
      fd.append('unit', formData.unit);
      fd.append('location', formData.location);
      fd.append('current_price', formData.price);

      const res = await fetch('http://localhost:5000/api/v1/media/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('AI analysis failed');
      const data = await res.json();
      setAiResult(data.ai || null);
      try {
        const suggested = data.ai || data || {};
        const sPrice = suggested.suggested_price_in_inr;
        const desc = suggested.description || suggested.notes;
        if (sPrice) setFormData((prev) => ({ ...prev, price: String(sPrice) }));
        if (desc && !formData.description) setFormData((prev) => ({ ...prev, description: String(desc) }));
      } catch {}
    } finally {
      setAiLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // If AI flagged potential rot, require confirmation before allowing submit
    const aiCondition = String(aiResult?.condition || '').toLowerCase();
    const aiNotes = String(aiResult?.notes || '').toLowerCase();
    const aiScore = typeof aiResult?.quality_score === 'number' ? aiResult.quality_score : undefined;
    const maybeRotten = !!aiResult && (
      aiCondition.includes('rotten') || aiNotes.includes('rotten') || aiCondition === 'poor' || (typeof aiScore === 'number' && aiScore < 0.3)
    );
    if (maybeRotten && !confirmNotRotten) {
      setErrors({ submit: 'AI detected possible rot. Please confirm the crop is not rotten and safe to sell, or avoid listing it.' });
      return;
    }

    setIsLoading(true);

    try {
      // Create FormData for multipart/form-data request
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title.trim());
      formDataToSend.append('category', formData.category);
      formDataToSend.append('description', formData.description.trim());
      formDataToSend.append('price', formData.price);
      formDataToSend.append('unit', formData.unit);
      formDataToSend.append('stock', formData.stock);
      formDataToSend.append('location', formData.location.trim());
      
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      // Get token from auth storage
      const authData = localStorage.getItem('km_auth');
      let token = null;
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed.token;
        } catch (e) {
          throw new Error('Authentication required');
        }
      }

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('http://localhost:5000/api/v1/marketplace/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // If server returned AI, show it
      if (result?.ai) setAiResult(result.ai);

      alert(t('farmer.sell.success'));
      router.push('/farmer/products');
      
    } catch (error: any) {
      console.error('Failed to create product:', error);
      setErrors({ submit: error.message || t('farmer.sell.submit_error_default') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/marketplace"
            className="flex items-center text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('farmer.sell.back')}
          </Link>
          
          <h1 className="text-3xl font-bold text-[color:var(--foreground)] mb-2">
            🌱 {t('farmer.sell.title')}
          </h1>
          <p className="text-[color:var(--foreground)]/70">
            {t('farmer.sell.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] p-6">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-6">
              {t('farmer.sell.basic_info')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.product_name')} *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder={t('farmer.sell.name_placeholder')}
                  className={`w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent ${errors.title ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                {errors.title && (
                  <p className="text-red-400 text-sm mt-1">{errors.title}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.category')} *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent ${errors.category ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                >
                  <option value="">{t('farmer.sell.select_category')}</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.emoji} {t(`category.${cat.value}`)}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-red-400 text-sm mt-1">{errors.category}</p>
                )}
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.unit')} *
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => handleInputChange('unit', e.target.value)}
                  className={`w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent ${errors.unit ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                >
                  <option value="">{t('farmer.sell.select_unit')}</option>
                  {UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {t(`unit.${unit.value}`)}
                    </option>
                  ))}
                </select>
                {errors.unit && (
                  <p className="text-red-400 text-sm mt-1">{errors.unit}</p>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={t('farmer.sell.description_placeholder')}
                  rows={4}
                  className="w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent resize-vertical"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] p-6">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-6">
              {t('farmer.sell.pricing_stock')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.price_per_unit')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder={t('farmer.sell.price_placeholder')}
                  className={`w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent ${errors.price ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                {errors.price && (
                  <p className="text-red-400 text-sm mt-1">{errors.price}</p>
                )}
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.available_stock')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  placeholder={t('farmer.sell.stock_placeholder')}
                  className={`w-full px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent ${errors.stock ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                {errors.stock && (
                  <p className="text-red-400 text-sm mt-1">{errors.stock}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Image */}
          <div className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] p-6">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-6">
              {t('farmer.sell.location_image')}
            </h2>
            
            <div className="space-y-6">
              {/* AI Suggestion Card (below image inputs) */}
              {(aiLoading || aiResult) && (
                <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/30 p-4">
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
                          <div className="text-[color:var(--foreground)] font-semibold">₹{(aiResult.suggested_price_in_inr ?? 0).toLocaleString()} / {formData.unit || 'unit'}</div>
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

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.farm_location')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder={t('farmer.sell.location_placeholder')}
                    className="flex-1 px-3 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={geoLoading || isLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-[color:var(--border)] rounded hover:bg-[color:var(--muted)] disabled:opacity-50"
                    title="Use my current location"
                  >
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    <span>Use my location</span>
                  </button>
                </div>
                {geoError && (
                  <div className="text-xs text-red-400 mt-1">{geoError}</div>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  {t('farmer.sell.product_image')} *
                </label>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver 
                      ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10'
                      : errors.image 
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-[color:var(--border)] hover:border-[color:var(--primary)]'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {imagePreview ? (
                    <div className="space-y-4">
                      <img
                        src={imagePreview}
                        alt={t('farmer.sell.preview_alt')}
                        className="mx-auto h-32 w-32 object-cover rounded-lg"
                      />
                      <div>
                        <p className="text-[color:var(--foreground)] font-medium">
                          {formData.image?.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleImageChange(null)}
                          className="text-red-400 hover:text-red-300 text-sm mt-2"
                          disabled={isLoading}
                        >
                          {t('farmer.sell.remove_image')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <ImageIcon className="mx-auto h-12 w-12 text-[color:var(--foreground)]/40" />
                      <div>
                        <p className="text-[color:var(--foreground)] font-medium">
                          {t('farmer.sell.drop_image')} {' '}
                          <label className="text-[color:var(--primary)] cursor-pointer hover:underline">
                            {t('farmer.sell.browse')}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                              disabled={isLoading}
                            />
                          </label>
                        </p>
                        <p className="text-[color:var(--foreground)]/60 text-sm">
                          {t('farmer.sell.supports_formats')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {errors.image && (
                  <p className="text-red-400 text-sm mt-2">{errors.image}</p>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <Link
              href="/marketplace"
              className="text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors"
            >
              {t('action.cancel')}
            </Link>
            
            <button
              type="submit"
              disabled={isLoading || (!!aiResult && ((String(aiResult?.condition||'').toLowerCase().includes('rotten') || String(aiResult?.notes||'').toLowerCase().includes('rotten') || String(aiResult?.condition||'').toLowerCase() === 'poor' || (typeof aiResult?.quality_score === 'number' && aiResult.quality_score < 0.3)) && !confirmNotRotten))}
              className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-8 py-3 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('farmer.sell.listing')}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>{t('farmer.sell.list')}</span>
                </>
              )}
            </button>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
              <p className="text-red-400">{errors.submit}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}