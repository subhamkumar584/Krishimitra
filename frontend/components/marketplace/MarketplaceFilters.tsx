"use client";

import { useState } from 'react';
import { Search, Filter, X, MapPin, Tag } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

interface FilterState {
  search: string;
  category: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  sortBy: string;
}

interface MarketplaceFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: string[];
  locations: string[];
  isLoading?: boolean;
}

export default function MarketplaceFilters({ 
  filters, 
  onFiltersChange, 
  categories = [], 
  locations = [],
  isLoading = false 
}: MarketplaceFiltersProps) {
  const { t } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      search: '',
      category: '',
      location: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest'
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(localFilters).some(value => value && value !== 'newest');

  return (
    <div className="bg-[color:var(--card)] rounded-lg shadow-sm border border-[color:var(--border)] p-4 mb-6">
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--foreground)]/50 w-5 h-5" />
        <input
          type="text"
          placeholder={t('marketplace.search_placeholder')}
          value={localFilters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[color:var(--muted)] text-[color:var(--foreground)] placeholder-[color:var(--foreground)]/50 border border-[color:var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent"
        />
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Category Filter */}
        <div className="flex items-center space-x-2">
          <Tag className="w-4 h-4 text-[color:var(--foreground)]/70" />
          <select
            value={localFilters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="bg-[color:var(--muted)] text-[color:var(--foreground)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
          >
            <option value="">{t('marketplace.all_categories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {t(`category.${category}`) || category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Location Filter */}
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-[color:var(--foreground)]/70" />
          <select
            value={localFilters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            className="bg-[color:var(--muted)] text-[color:var(--foreground)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
          >
            <option value="">{t('marketplace.all_locations')}</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <select
          value={localFilters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          className="bg-[color:var(--muted)] text-[color:var(--foreground)] border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
        >
          <option value="newest">{t('marketplace.sort_newest')}</option>
          <option value="price_low">{t('marketplace.sort_price_low')}</option>
          <option value="price_high">{t('marketplace.sort_price_high')}</option>
          <option value="rating">{t('marketplace.sort_rating')}</option>
        </select>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 px-3 py-2 border border-[color:var(--border)] rounded-md text-sm text-[color:var(--foreground)] hover:bg-[color:var(--muted)] transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>{t('marketplace.filter')}</span>
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center space-x-2 px-3 py-2 bg-[color:var(--muted)] rounded-md text-sm text-[color:var(--foreground)] hover:bg-[color:var(--border)] transition-colors"
          >
            <X className="w-4 h-4" />
            <span>{t('action.cancel')}</span>
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border-t border-[color:var(--border)] pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                {t('marketplace.price_range')} (₹)
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder={t('filters.min')}
                  value={localFilters.minPrice}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  className="flex-1 bg-[color:var(--muted)] text-[color:var(--foreground)] placeholder-[color:var(--foreground)]/50 border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                />
                <input
                  type="number"
                  placeholder={t('filters.max')}
                  value={localFilters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  className="flex-1 bg-[color:var(--muted)] text-[color:var(--foreground)] placeholder-[color:var(--foreground)]/50 border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-[color:var(--border)]">
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-[color:var(--foreground)]/70 font-medium">{t('filters.active')}</span>
            <div className="flex flex-wrap gap-2">
              {localFilters.search && (
                <span className="bg-[color:var(--primary)]/20 text-[color:var(--primary)] px-2 py-1 rounded-full text-xs">
                  {t('filters.search')}: {localFilters.search}
                </span>
              )}
              {localFilters.category && (
                <span className="bg-blue-900/20 text-blue-400 px-2 py-1 rounded-full text-xs">
                  {t('filters.category')}: {t(`category.${localFilters.category}`) || localFilters.category}
                </span>
              )}
              {localFilters.location && (
                <span className="bg-purple-900/20 text-purple-400 px-2 py-1 rounded-full text-xs">
                  {t('filters.location')}: {localFilters.location}
                </span>
              )}
              {(localFilters.minPrice || localFilters.maxPrice) && (
                <span className="bg-[color:var(--accent)]/20 text-[color:var(--accent)] px-2 py-1 rounded-full text-xs">
                  {t('filters.price')}: ₹{localFilters.minPrice || '0'} - ₹{localFilters.maxPrice || '∞'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}