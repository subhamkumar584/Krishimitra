"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Plus, TrendingUp, Lock, Package, Truck, Wrench } from 'lucide-react';
import Link from 'next/link';

import { useI18n } from "../../lib/i18n";
import { getProducts, addToCart, getCurrentUser, getOrders } from "../../lib/api";
import ProductCard from "../../components/marketplace/ProductCard";
import MarketplaceFilters from "../../components/marketplace/MarketplaceFilters";

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

interface FilterState {
  search: string;
  category: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  sortBy: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: 'farmer' | 'customer' | 'admin' | 'equipmetal';
}


export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [farmerPendingCount, setFarmerPendingCount] = useState<number>(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    location: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'newest'
  });

  // Mock data for demonstration
  const categories = ['vegetables', 'fruits', 'grains', 'spices', 'dairy'];
  const locations = ['Delhi', 'Mumbai', 'Pune', 'Bangalore', 'Chennai'];

  const { t } = useI18n();

  // Fetch current user to determine role
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (err) {
        console.error('Failed to fetch user:', err);
        // User might not be logged in, continue without user data
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };

    fetchUser();
  }, []);

  const fetchProducts = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        ...filters,
        min_price: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
        max_price: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
        sort_by: filters.sortBy,
        page,
        limit: pagination.limit
      };
      
      const response = await getProducts(params);
      setProducts(response.products || []);
      setPagination({
        page: response.pagination?.page || 1,
        limit: response.pagination?.limit || 12,
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || 0
      });
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to load products. Please try again later.');
      // Use mock data for demonstration
      setProducts([
        {
          id: 1,
          title: "Fresh Organic Tomatoes",
          price: 40,
          unit: "kg",
          stock: 500,
          category: "vegetables",
          location: "Pune, Maharashtra",
          seller_name: "Ramesh Kumar",
          average_rating: 4.5,
          reviews_count: 23,
          is_available: true
        },
        {
          id: 2,
          title: "Premium Basmati Rice",
          price: 120,
          unit: "kg",
          stock: 200,
          category: "grains",
          location: "Delhi, NCR",
          seller_name: "Suresh Agri Co.",
          average_rating: 4.8,
          reviews_count: 45,
          is_available: true
        },
        {
          id: 3,
          title: "Fresh Red Apples",
          price: 150,
          unit: "kg",
          stock: 100,
          category: "fruits",
          location: "Kashmir, J&K",
          seller_name: "Kashmir Fruits",
          average_rating: 4.7,
          reviews_count: 31,
          is_available: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const allowedSupplyCategory = (category?: string) => {
    let c = (category || '').toLowerCase().trim();
    if (c === 'pesticide/medicine' || c === 'medicine') c = 'pesticide';
    if (c === 'machinery parts' || c === 'machineary parts' || c === 'machinaery parts') c = 'machinery_parts';
    if (c === 'seed') c = 'seeds';
    if (c === 'fertlizer') c = 'fertilizer';
    return ['fertilizer','pesticide','seeds','tools','tool','machinery_parts','machinery'].includes(c);
  };
  
  const isCropCategoryForEquipmetal = (category?: string) => {
    // Equipmetal can buy crops only: treat anything NOT in supply set as crop
    return !allowedSupplyCategory(category);
  };

  const handleAddToCart = async (product: Product, quantity: number) => {
    if (!user) {
      alert('Please login to add items to cart.');
      return;
    }

    // Equipmetal: can only purchase crops (not supplies)
    if (user.role === 'equipmetal' && !isCropCategoryForEquipmetal(product.category)) {
      alert('Equipmetal providers can only purchase crops, not supplies.');
      return;
    }

    // Farmers: only allowed supply categories
    if (user.role === 'farmer' && !allowedSupplyCategory(product.category)) {
      alert('Farmers can only purchase equipment supplies (fertilizer, pesticide/medicine, seeds, tools, machinery parts).');
      return;
    }

    try {
      await addToCart(product.id, quantity);
      setCartCount(prev => prev + quantity);
      alert('Added to cart successfully!');
    } catch (err) {
      console.error('Failed to add to cart:', err);
      alert('Failed to add to cart. Please login or try again.');
    }
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  useEffect(() => {
    if (!userLoading) {
      fetchProducts(1);
      // If farmer, fetch pending approvals count
      if (user && user.role === 'farmer') {
        (async () => {
          try {
            const res = await getOrders('seller');
            const orders = res.orders || [];
            const pending = orders.filter((o: any) => o.payment_status === 'CAPTURED' && !['SHIPPED','DELIVERED','CANCELLED'].includes(o.status)).length;
            setFarmerPendingCount(pending);
          } catch {}
        })();
      } else {
        setFarmerPendingCount(0);
      }
    }
  }, [filters, userLoading, user]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchProducts(newPage);
  };


  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* Header */}
      <div className="bg-[color:var(--card)] shadow-sm border-b border-[color:var(--border)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[color:var(--foreground)]">
                {t('marketplace.title')}
              </h1>
              <p className="text-[color:var(--foreground)]/70 mt-1">
                {t('marketplace.subtitle')}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Show different controls based on user role */}
              {user && (
                <>
                  {/* Orders button - for customers, equipmetal, and farmers */}
                  {(user.role === 'customer' || user.role === 'equipmetal' || user.role === 'farmer') && (
                    <Link href="/orders" className="relative p-2" title="Your Orders">
                      <Truck className="w-6 h-6 text-[color:var(--foreground)]/70" />
                    </Link>
                  )}
                  {/* Cart Icon - show for all authenticated roles */}
                  <Link href="/cart" className="relative p-2" title="Cart">
                    <ShoppingCart className="w-6 h-6 text-[color:var(--foreground)]/70" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                </>
              )}
              
              {/* Farmer Controls - Only for farmers */}
              {(user && user.role === 'farmer') && (
                <div className="flex items-center space-x-3">
                  <Link 
                    href="/farmer/products" 
                    className="text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors flex items-center space-x-2 text-sm"
                  >
                    <Package className="w-4 h-4" />
                    <span>{t('role.my_products')}</span>
                  </Link>
                  <Link 
                    href="/farmer/orders" 
                    className="relative text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors flex items-center space-x-2 text-sm p-1"
                    title="Orders"
                  >
                    <div className="relative">
                      <Truck className="w-4 h-4" />
                      {farmerPendingCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                          {Math.min(99, farmerPendingCount)}
                        </span>
                      )}
                    </div>
                    <span>Orders</span>
                  </Link>
                  <Link 
                    href="/farmer/equipment" 
                    className="text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors flex items-center space-x-2 text-sm"
                    title="Equipments"
                  >
                    <Package className="w-4 h-4" />
                    <span>Equipments</span>
                  </Link>
                  <Link 
                    href="/farmer/products/new" 
                    className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('role.sell_product')}</span>
                  </Link>
                  <Link 
                    href="/equipmetal/products/new?type=rent" 
                    className="border border-[color:var(--border)] text-[color:var(--foreground)] px-4 py-2 rounded-lg hover:bg-[color:var(--muted)] transition-colors flex items-center space-x-2"
                    title="Sell Equipment"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Sell Equipment</span>
                  </Link>
                </div>
              )}

              {user && user.role === 'equipmetal' && (
                <div className="flex items-center space-x-3">
                  <Link 
                    href="/equipmetal/products/new" 
                    className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Sell Product</span>
                  </Link>
                  <Link 
                    href="/equipmetal/equipment" 
                    className="text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors flex items-center space-x-2 text-sm"
                    title="Manage Equipment"
                  >
                    <Package className="w-4 h-4" />
                    <span>Manage Equipment</span>
                  </Link>
                  <Link 
                    href="/equipmetal/orders" 
                    className="text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors flex items-center space-x-2 text-sm"
                    title="Seller Orders"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Seller Orders</span>
                  </Link>
                </div>
              )}

              {/* Login prompt for non-authenticated users */}
              {!user && !userLoading && (
                <Link 
                  href="/auth/login" 
                  className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{t('marketplace.login_to_shop')}</span>
                </Link>
              )}

              {/* Role indicator */}
              {user && (
                <div className="text-sm text-[color:var(--foreground)]/70 bg-[color:var(--muted)] px-3 py-1 rounded-full">
                  {user.role === 'farmer' && `🌱 ${t('role.farmer_mode')}`}
                  {user.role === 'customer' && `🛒 ${t('role.customer_mode')}`}
                  {user.role === 'admin' && `⚡ ${t('role.admin_mode')}`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <MarketplaceFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          categories={categories}
          locations={locations}
          isLoading={loading}
        />

        {/* Stats */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-[color:var(--foreground)]/70">
              <span>{t('marketplace.showing_results').replace('{count}', products.length.toString()).replace('{total}', pagination.total.toString())}</span>
              {filters.search && (
                <span>{t('marketplace.for_query').replace('{query}', filters.search)}</span>
              )}
            </div>
            <div className="flex items-center space-x-2 text-sm text-[color:var(--foreground)]/70">
              <TrendingUp className="w-4 h-4" />
              <span>{t('marketplace.updated_recently')}</span>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={() => fetchProducts(pagination.page)}
              className="mt-2 text-red-400 hover:text-red-300 font-medium"
            >
              {t('action.try_again')}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-md overflow-hidden animate-pulse">
                <div className="h-48 bg-[color:var(--muted)]"></div>
                <div className="p-4">
                  <div className="h-4 bg-[color:var(--muted)] rounded mb-2"></div>
                  <div className="h-6 bg-[color:var(--muted)] rounded mb-3"></div>
                  <div className="flex justify-between mb-3">
                    <div className="h-4 bg-[color:var(--muted)] rounded w-20"></div>
                    <div className="h-4 bg-[color:var(--muted)] rounded w-16"></div>
                  </div>
                  <div className="h-10 bg-[color:var(--muted)] rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Role-based access notice */}
        {user && user.role === 'farmer' && (
          <div className="mb-6 p-4 bg-[color:var(--primary)]/20 border border-[color:var(--primary)]/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">🌱</div>
              <div>
                <h3 className="font-semibold text-[color:var(--primary)]">{t('role.farmer_mode')}</h3>
                <p className="text-[color:var(--foreground)]/70 text-sm">
                  {t('role.farmer_notice')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={user && ((user.role === 'customer') || (user.role === 'farmer' && allowedSupplyCategory(product.category)) || (user.role === 'equipmetal' && isCropCategoryForEquipmetal(product.category))) ? ((id, qty) => handleAddToCart(product, qty)) : undefined}
                showPurchaseButton={user ? ((user.role === 'customer') || (user.role === 'farmer' && allowedSupplyCategory(product.category)) || (user.role === 'equipmetal' && isCropCategoryForEquipmetal(product.category))) : false}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="text-center py-12">
            <div className="text-[color:var(--foreground)]/40 mb-4">
              <TrendingUp className="w-16 h-16 mx-auto mb-4" />
            </div>
            <h3 className="text-lg font-medium text-[color:var(--foreground)] mb-2">
              {t('marketplace.no_products_found')}
            </h3>
            <p className="text-[color:var(--foreground)]/50 mb-6">
              {t('marketplace.adjust_filters')}
            </p>
            {user && user.role === 'farmer' && (
              <Link 
                href="/farmer/products/new" 
                className="inline-flex items-center space-x-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>{t('role.first_seller')}</span>
              </Link>
            )}
            {user && (user.role === 'customer' || user.role === 'admin') && (
              <div className="text-center">
                <p className="text-[color:var(--foreground)]/60 mb-4">
                  {t('role.no_products_available')}
                </p>
                <Link 
                  href="/" 
                  className="inline-flex items-center space-x-2 bg-[color:var(--muted)] text-[color:var(--foreground)] px-6 py-3 rounded-lg hover:bg-[color:var(--border)] transition-colors"
                >
                  <span>🏠</span>
                  <span>{t('marketplace.back_to_home')}</span>
                </Link>
              </div>
            )}
            {!user && (
              <Link 
                href="/auth/login" 
                className="inline-flex items-center space-x-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
              >
                <Lock className="w-5 h-5" />
                <span>{t('marketplace.login_to_start')}</span>
              </Link>
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-2 border border-[color:var(--border)] rounded-md text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('action.previous')}
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, index) => {
                const pageNumber = pagination.page <= 3 
                  ? index + 1
                  : pagination.page + index - 2;
                
                if (pageNumber <= pagination.pages) {
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-3 py-2 border rounded-md text-sm font-medium ${
                        pageNumber === pagination.page
                          ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/20 text-[color:var(--primary)]'
                          : 'border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--muted)]'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                }
                return null;
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="px-3 py-2 border border-[color:var(--border)] rounded-md text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('action.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
