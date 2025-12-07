// Shared product helper utilities and normalization
// Ensures consistent rendering for price, image, stock, category across views

export type ProductLike = {
  id?: number;
  title?: string;
  price?: number | string | null;
  unit?: string | null;
  stock?: number | string | null;
  category?: string | null;
  location?: string | null;
  image_url?: string | null;
  seller_id?: number | string | null;
  seller_name?: string | null;
  created_at?: string | null;
  is_available?: boolean | null;
  [key: string]: any;
};

export function toNumber(value: any, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatNumber(value: any): string {
  const n = toNumber(value);
  try { return n.toLocaleString(); } catch { return `${n}`; }
}

export function isValidUrl(u?: string | null): boolean {
  if (!u || typeof u !== 'string') return false;
  return /^https?:\/\//.test(u) || /^data:/.test(u) || u.startsWith('/');
}

export function getCategoryIcon(category?: string | null): string {
  const icons: Record<string, string> = {
    vegetables: '🥬',
    fruits: '🍎',
    grains: '🌾',
    spices: '🌶️',
    dairy: '🥛',
    meat: '🍖'
  };
  const key = typeof category === 'string' ? category.toLowerCase().trim() : '';
  return (key && icons[key]) ? icons[key] : '🌱';
}

export function formatCategory(category?: string | null): string {
  if (typeof category !== 'string' || category.length === 0) return 'Category';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function deriveAvailability(p: ProductLike): boolean {
  if (typeof p?.is_available === 'boolean') return p.is_available;
  return toNumber(p?.stock) > 0;
}

export function normalizeProduct(p: ProductLike) {
  const priceNum = toNumber(p?.price, 0);
  const stockNum = toNumber(p?.stock, 0);
  const unit = (typeof p?.unit === 'string' && p.unit.trim()) ? p.unit : 'unit';
  const imageUrl = typeof p?.image_url === 'string' ? p.image_url : '';
  const isAvailable = deriveAvailability(p);
  const category = (typeof p?.category === 'string') ? p.category : '';
  return {
    ...p,
    priceNum,
    stockNum,
    unit,
    imageUrl,
    isAvailable,
    category,
  };
}
