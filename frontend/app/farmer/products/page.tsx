"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit, Eye, Trash2, Package, AlertCircle, Search, Filter, Wrench, MapPin } from 'lucide-react';

interface Product {
  id: number;
  title: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  location?: string;
  image_url?: string;
  description?: string;
  created_at: string;
  farmer_id: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  grains: 'Grains',
  spices: 'Spices',
  dairy: 'Dairy',
  pulses: 'Pulses',
  oil_seeds: 'Oil Seeds',
  herbs: 'Herbs',
  flowers: 'Flowers',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  vegetables: '🥬',
  fruits: '🍎',
  grains: '🌾',
  spices: '🌶️',
  dairy: '🥛',
  pulses: '🫘',
  oil_seeds: '🌰',
  herbs: '🌿',
  flowers: '🌸',
};

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

export default function FarmerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      
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

      const response = await fetch('http://localhost:5000/api/v1/marketplace/products/my', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter to only show products owned by current farmer
      // Note: The backend should ideally filter this, but we'll do it here for now
      setProducts(data.products || []);
      setFilteredProducts(data.products || []);
      
    } catch (error: any) {
      console.error('Failed to fetch products:', error);
      setError(error.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (productId: number) => {
    try {
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

      const response = await fetch(`http://localhost:5000/api/v1/marketplace/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete product: ${response.status}`);
      }

      // Remove from local state
      setProducts(prev => prev.filter(p => p.id !== productId));
      setFilteredProducts(prev => prev.filter(p => p.id !== productId));
      setShowConfirmDelete(null);
      
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      alert(`Failed to delete product: ${error.message}`);
    }
  };

const fetchEquipment = async () => {
    try {
      const authData = localStorage.getItem('km_auth');
      let token: string | null = null;
      if (authData) { try { token = JSON.parse(authData)?.token || null; } catch {}
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/v1/equipment', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load equipment');
      const auth = localStorage.getItem('km_auth');
      let uid: number | null = null;
      if (auth) { try { uid = JSON.parse(auth)?.user?.id || null; } catch {} }
      const list = (data.equipment || []).filter((e: any) => e?.owner?.id === uid);
      setEquipment(list);
    } catch (e) {
      setEquipment([]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchEquipment();
  }, []);

  useEffect(() => {
    let filtered = products;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.location?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory]);

  const formatPrice = (price: number, unit: string) => {
    return `₹${price.toLocaleString()}/${unit}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'text-red-400' };
    if (stock < 10) return { label: 'Low Stock', color: 'text-yellow-400' };
    return { label: 'In Stock', color: 'text-green-400' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 animate-pulse text-[color:var(--primary)] mx-auto mb-4" />
          <p className="text-[color:var(--foreground)]/70">Loading your products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">
            Failed to Load Products
          </h2>
          <p className="text-[color:var(--foreground)]/70 mb-6">{error}</p>
          <button
            onClick={fetchProducts}
            className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-2 rounded-lg hover:opacity-90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-[color:var(--foreground)] mb-2">
              🌾 My Products
            </h1>
            <p className="text-[color:var(--foreground)]/70">
              Manage your product listings and inventory
            </p>
          </div>
          
<div className="flex items-center gap-3">
            <Link
              href="/farmer/products/new"
              className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2 w-fit"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Crop/Product</span>
            </Link>
            <Link
              href="/equipmetal/products/new?type=rent"
              className="border border-[color:var(--border)] text-[color:var(--foreground)] px-6 py-3 rounded-lg hover:bg-[color:var(--muted)] transition-colors flex items-center space-x-2 w-fit"
            >
              <Wrench className="w-5 h-5" />
              <span>Add New Equipment</span>
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--foreground)]/40 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] placeholder:text-[color:var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--foreground)]/40 w-5 h-5" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent"
              >
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {CATEGORY_EMOJIS[value]} {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-[color:var(--foreground)]/20 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">
              {products.length === 0 ? 'No Products Yet' : 'No Products Found'}
            </h3>
            <p className="text-[color:var(--foreground)]/70 mb-6 max-w-md mx-auto">
              {products.length === 0
                ? 'Start selling by adding your first product to the marketplace.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {products.length === 0 && (
              <Link
                href="/farmer/products/new"
                className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors inline-flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Your First Product</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product.stock);
              
              return (
                <div
                  key={product.id}
                  className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] overflow-hidden hover:border-[color:var(--primary)]/50 transition-colors"
                >
                  {/* Product Image */}
                  <div className="aspect-square relative bg-gray-100 dark:bg-gray-800">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-[color:var(--foreground)]/20" />
                      </div>
                    )}
                    
                    {/* Stock Status Badge */}
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color} bg-black/20 backdrop-blur-sm`}>
                      {stockStatus.label}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-[color:var(--foreground)] text-sm leading-tight line-clamp-2">
                        {product.title}
                      </h3>
                      <span className="text-xs text-[color:var(--foreground)]/60 ml-2 whitespace-nowrap">
                        {CATEGORY_EMOJIS[product.category]}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[color:var(--primary)]">
                          {formatPrice(product.price, product.unit)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-[color:var(--foreground)]/70">
                        <span>Stock: {product.stock} {product.unit}</span>
                        <span>{formatDate(product.created_at)}</span>
                      </div>

                      {product.location && (
                        <p className="text-sm text-[color:var(--foreground)]/60 truncate">
                          📍 {product.location}
                        </p>
                      )}
      </div>

        {/* Equipment Section */}
        <div className="mt-10">
          <h2 className="text-2xl font-semibold text-[color:var(--foreground)] mb-4 flex items-center gap-2"><Wrench className="w-5 h-5" /> My Equipment</h2>
          {equipment.length === 0 ? (
            <div className="p-4 border border-[color:var(--border)] rounded text-[color:var(--foreground)]/70">No equipment added yet. Use "Add New Equipment" to create one.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment.map((e) => (
                <div key={e.id} className="p-4 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-[color:var(--foreground)] flex items-center gap-2">
                        <Wrench className="w-4 h-4" /> {e.name}
                      </div>
                      <div className="text-sm text-[color:var(--foreground)]/60 mt-1">{e.category}</div>
                    </div>
                    <div className="text-right text-sm text-[color:var(--foreground)]/70">
                      {e.rate_per_hour ? <div>₹{e.rate_per_hour}/hr</div> : null}
                      {e.rate_per_day ? <div>₹{e.rate_per_day}/day</div> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[color:var(--foreground)]/70">
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {e.location}</div>
                    <div className="flex items-center gap-2">
                      <Link href="/equipmetal/equipment" className="px-3 py-1 border rounded hover:bg-[color:var(--muted)]">Edit</Link>
                      <button onClick={async () => {
                        if (!confirm('Delete this equipment?')) return;
                        try {
                          const authData = localStorage.getItem('km_auth');
                          let token: string | null = null;
                          if (authData) { try { token = JSON.parse(authData)?.token || null; } catch {} }
                          if (!token) throw new Error('Authentication required');
                          const res = await fetch(`/api/v1/equipment/${e.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data?.error || 'Delete failed');
                          setEquipment((prev) => prev.filter((x) => x.id !== e.id));
                        } catch (err: any) {
                          alert(err?.message || 'Delete failed');
                        }
                      }} className="px-3 py-1 border border-red-500/40 text-red-400 rounded hover:bg-red-900/20">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/marketplace/products/${product.id}`}
                        className="flex-1 bg-[color:var(--background)] hover:bg-[color:var(--border)] border border-[color:var(--border)] text-[color:var(--foreground)] px-3 py-2 rounded-lg transition-colors flex items-center justify-center space-x-1 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </Link>
                      
                      <Link
                        href={`/farmer/products/${product.id}/edit`}
                        className="flex-1 bg-[color:var(--primary)]/20 hover:bg-[color:var(--primary)]/30 text-[color:var(--primary)] px-3 py-2 rounded-lg transition-colors flex items-center justify-center space-x-1 text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </Link>
                      
                      <button
                        onClick={() => setShowConfirmDelete(product.id)}
                        className="bg-red-900/20 hover:bg-red-900/30 text-red-400 px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showConfirmDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-[color:var(--foreground)] mb-2">
                Delete Product
              </h3>
              <p className="text-[color:var(--foreground)]/70 mb-6">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfirmDelete(null)}
                  className="flex-1 bg-[color:var(--background)] hover:bg-[color:var(--border)] border border-[color:var(--border)] text-[color:var(--foreground)] px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showConfirmDelete)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}