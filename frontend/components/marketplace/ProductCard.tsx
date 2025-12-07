"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, MapPin, Star, User } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

interface Product {
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

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: number, quantity: number) => void;
  isLoading?: boolean;
  showPurchaseButton?: boolean;
}

export default function ProductCard({ product, onAddToCart, isLoading = false, showPurchaseButton = true }: ProductCardProps) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Normalizers and guards
  const toNumber = (value: any, fallback = 0) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const formatNumber = (value: any) => {
    const n = toNumber(value);
    try { return n.toLocaleString(); } catch { return `${n}`; }
  };
  const isValidUrl = (u?: string) => {
    return typeof u === 'string' && (/^https?:\/\//.test(u) || /^data:/.test(u) || u.startsWith('/'));
  };

  const isAvailable = ((product as any).is_available ?? (toNumber((product as any).stock) > 0));

  const handleAddToCart = async () => {
    if (!onAddToCart || isAdding) return;
    setIsAdding(true);
    try {
      await onAddToCart(product.id, quantity);
    } finally {
      setIsAdding(false);
    }
  };

  const getCategoryIcon = (category?: string) => {
    const icons: { [key: string]: string } = {
      vegetables: '🥬',
      fruits: '🍎',
      grains: '🌾',
      spices: '🌶️',
      dairy: '🥛',
      meat: '🍖'
    };
    const key = typeof category === 'string' ? category.toLowerCase().trim() : '';
    return (key && icons[key]) ? icons[key] : '🌱';
  };
  const formatCategory = (category?: string) => {
    if (typeof category !== 'string' || category.length === 0) return 'Category';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      {/* Product Image */}
      <div className="relative h-48 bg-gradient-to-br from-emerald-900/20 to-emerald-800/30">
        {isValidUrl(product.image_url) ? (
          <img
            src={product.image_url as string}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {getCategoryIcon(product.category)}
          </div>
        )}
        
        {/* Stock status indicator */}
        {!isAvailable && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {t('product.out_of_stock')}
          </div>
        )}
        
        {/* Category badge */}
        <div className="absolute top-2 left-2 bg-[color:var(--card)]/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-[color:var(--foreground)] border border-[color:var(--border)]">
          {t(`category.${product.category}`) || formatCategory(product.category)}
        </div>
      </div>

      <div className="p-4">
        {/* Product title and meta */}
        <div className="mb-2">
          <Link href={`/marketplace/products/${product.id}`}>
            <h3 className="text-lg font-semibold text-[color:var(--foreground)] hover:text-[color:var(--primary)] transition-colors line-clamp-2">
              {product.title}
            </h3>
          </Link>
          {/* Date */}
          {product.created_at && (
            <div className="text-xs text-[color:var(--foreground)]/60 mt-1">
              Listed on {new Date(product.created_at).toLocaleDateString()}
            </div>
          )}
          
          {/* Rating */}
          {product.average_rating && (
            <div className="flex items-center mt-1">
              <div className="flex items-center">
                <Star className="w-4 h-4 fill-[color:var(--accent)] text-[color:var(--accent)]" />
                <span className="text-sm text-[color:var(--foreground)]/70 ml-1">
                  {product.average_rating.toFixed(1)} {t('product.reviews_count').replace('{count}', (product.reviews_count || 0).toString())}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Price and unit */}
        <div className="mb-3">
          <span className="text-2xl font-bold text-[color:var(--primary)]">
            {toNumber(product.price) > 0 ? `₹${formatNumber(product.price)}` : '₹—'}
          </span>
          <span className="text-[color:var(--foreground)]/50 text-sm ml-1">
            /{t(`unit.${product.unit}`) || (product.unit || 'unit')}
          </span>
        </div>

        {/* Location and seller */}
        <div className="flex items-center justify-between text-sm text-[color:var(--foreground)]/70 mb-3">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            <span className="truncate">{product.location}</span>
          </div>
          <div className="flex items-center">
            <User className="w-4 h-4 mr-1" />
            <span className="truncate">{product.seller_name}</span>
          </div>
        </div>

        {/* Stock info */}
        <div className="flex items-center justify-between text-sm text-[color:var(--foreground)]/70 mb-4">
          <span>{t('product.stock_label').replace('{stock}', toNumber(product.stock).toString()).replace('{unit}', t(`unit.${product.unit}`) || (product.unit || 'unit'))}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isAvailable 
              ? 'bg-[color:var(--primary)]/20 text-[color:var(--primary)]' 
              : 'bg-red-900/20 text-red-400'
          }`}>
            {isAvailable ? t('product.available') : t('product.unavailable')}
          </span>
        </div>

        {/* Quantity selector and add to cart - Only show for customers and admins */}
        {showPurchaseButton ? (
          <div className="flex items-center space-x-2">
            <div className="flex items-center border border-[color:var(--border)] rounded-md bg-[color:var(--muted)]">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-2 py-1 hover:bg-[color:var(--border)] text-[color:var(--foreground)] transition-colors"
                disabled={!isAvailable}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max={toNumber(product.stock)}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 text-center border-0 focus:ring-0 py-1 bg-transparent text-[color:var(--foreground)]"
                disabled={!isAvailable}
              />
              <button
                onClick={() => setQuantity(Math.min(toNumber(product.stock), quantity + 1))}
                className="px-2 py-1 hover:bg-[color:var(--border)] text-[color:var(--foreground)] transition-colors"
                disabled={!isAvailable}
              >
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!isAvailable || isAdding || !onAddToCart}
              className="flex-1 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label={t('product.add_to_cart')}
              title={t('product.add_to_cart')}
            >
              {isAdding ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
            </button>

            {/* View product button for customers */}
            <Link
              href={`/marketplace/products/${product.id}`}
              className="px-3 py-2 bg-[color:var(--muted)] text-[color:var(--foreground)] rounded-md hover:bg-[color:var(--border)] transition-colors"
            >
              {t('action.view')}
            </Link>
          </div>
        ) : (
          /* Farmer/Admin view - Show view details button */
          <Link
            href={`/marketplace/products/${product.id}`}
            className="w-full bg-[color:var(--muted)] text-[color:var(--foreground)] px-4 py-2 rounded-md hover:bg-[color:var(--border)] transition-colors flex items-center justify-center"
          >
            👁️ {t('product.view_details')}
          </Link>
        )}
      </div>
    </div>
  );
}