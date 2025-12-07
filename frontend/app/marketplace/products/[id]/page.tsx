"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Star, 
  MapPin, 
  User, 
  Phone, 
  MessageCircle,
  ArrowLeft,
  Heart,
  Share2,
  Shield,
  Truck,
  Calendar
} from 'lucide-react';

import { getProduct, getFarmerProfile, addToCart, getProductReviews, getCurrentUser } from '../../../../lib/api';
import { useI18n } from '../../../../lib/i18n';
import { normalizeProduct, toNumber, formatNumber, isValidUrl, getCategoryIcon, formatCategory } from '../../../../lib/product';

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  category: string;
  location: string;
  image_url?: string;
  seller_id: number;
  seller_name: string;
  created_at: string;
  is_available: boolean;
}

interface Farmer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  location: string;
  bio?: string;
  total_products: number;
  average_rating: number;
  total_reviews: number;
}

interface SellerInfo {
  id: number;
  name: string;
  email?: string;
  location?: string;
  address?: string;
  rating?: number;
  review_count?: number;
}

interface Review {
  id: number;
  rating: number;
  review_text: string;
  buyer_name: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: 'farmer' | 'customer' | 'admin' | 'equipmetal';
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = parseInt(params.id as string);
  const { t } = useI18n();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'seller'>('description');
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Fetch current user to determine role
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!productId) return;
      
      setLoading(true);
      try {
        // Fetch product details
        const productResp: any = await getProduct(productId);
        const prod = productResp?.product ?? productResp;
        setProduct(prod);
        // Prefer seller object from product endpoint if provided
        if (productResp?.seller) {
          setSeller(productResp.seller as SellerInfo);
        }

        // Fetch farmer profile as fallback to enrich seller info
        if (prod?.seller_id) {
          try {
            const farmerResp: any = await getFarmerProfile(prod.seller_id);
            const farmerObj = farmerResp?.farmer ?? farmerResp;
            setFarmer(farmerObj);
            // If seller missing fields, fill from farmer
            setSeller((prev) => prev ?? {
              id: farmerObj.id,
              name: farmerObj.name,
              email: farmerObj.email,
              location: farmerObj.location,
              rating: Math.round(farmerObj.average_rating),
              review_count: farmerObj.total_reviews,
            });
          } catch {}
        }

        // Fetch reviews
        const reviewsData = await getProductReviews(productId, { limit: 5 });
        setReviews(reviewsData.reviews || []);

      } catch (err) {
        console.error('Failed to fetch product data:', err);
        setError('Failed to load product details');
        
        // Mock data for demonstration
        setProduct({
          id: productId,
          title: "Fresh Organic Tomatoes",
          description: "Premium quality organic tomatoes grown without pesticides. Rich in vitamins and perfect for salads, cooking, and juice. Harvested fresh from our farms in Pune. These tomatoes are grown using sustainable farming practices and are certified organic.",
          price: 40,
          unit: "kg",
          stock: 500,
          category: "vegetables",
          location: "Pune, Maharashtra",
          image_url: "",
          seller_id: 1,
          seller_name: "Ramesh Kumar",
          created_at: "2024-01-15T10:30:00Z",
          is_available: true
        });

        setFarmer({
          id: 1,
          name: "Ramesh Kumar",
          email: "ramesh@example.com",
          phone: "+91 98765 43210",
          location: "Pune, Maharashtra",
          bio: "I am a third-generation farmer specializing in organic vegetables. Our family has been farming for over 50 years, and we take pride in producing the highest quality organic produce.",
          total_products: 15,
          average_rating: 4.5,
          total_reviews: 23
        });

        setReviews([
          {
            id: 1,
            rating: 5,
            review_text: "Excellent quality tomatoes! Very fresh and tasty.",
            buyer_name: "Priya Sharma",
            created_at: "2024-01-10T14:20:00Z"
          },
          {
            id: 2,
            rating: 4,
            review_text: "Good product, delivered on time. Will order again.",
            buyer_name: "Amit Singh",
            created_at: "2024-01-08T11:15:00Z"
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product || isAddingToCart) return;
    
    // Only disallow farmers; allow customers, equipmetal, and admins
    if (!user || user.role === 'farmer') {
      alert('Only customers can purchase products. Farmers cannot buy from their own marketplace.');
      return;
    }
    
    setIsAddingToCart(true);
    try {
      await addToCart(product.id, quantity);
      alert('Added to cart successfully!');
    } catch (err) {
      console.error('Failed to add to cart:', err);
      alert('Failed to add to cart. Please login or try again.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product || isBuyingNow) return;
    if (!user || user.role === 'farmer') {
      alert('Only customers can purchase products. Farmers cannot buy from their own marketplace.');
      return;
    }
    setIsBuyingNow(true);
    try {
      await addToCart(product.id, quantity);
      router.push('/cart');
    } catch (err) {
      console.error('Failed to buy now:', err);
      alert('Failed to proceed. Please login or try again.');
    } finally {
      setIsBuyingNow(false);
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  // Safe number helpers to avoid runtime crashes when API returns strings/undefined
  const toNumber = (value: any, fallback = 0) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const formatNumber = (value: any) => {
    const n = toNumber(value);
    try { return n.toLocaleString(); } catch { return `${n}`; }
  };
  const formatDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  };

  const isValidUrl = (u?: string) => {
    return typeof u === 'string' && (/^https?:\/\//.test(u) || /^data:/.test(u) || u.startsWith('/'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--background)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-[color:var(--muted)] rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-[color:var(--muted)] rounded-lg"></div>
              <div className="space-y-4">
                <div className="h-8 bg-[color:var(--muted)] rounded w-3/4"></div>
                <div className="h-4 bg-[color:var(--muted)] rounded w-1/2"></div>
                <div className="h-6 bg-[color:var(--muted)] rounded w-1/4"></div>
                <div className="h-24 bg-[color:var(--muted)] rounded"></div>
                <div className="h-12 bg-[color:var(--muted)] rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[color:var(--foreground)] mb-4">{t('product.not_found_title')}</h2>
          <p className="text-[color:var(--foreground)]/70 mb-6">{error || t('product.not_found_body')}</p>
          <Link
            href="/marketplace"
            className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  // Normalized product for consistent view rendering
  const np = normalizeProduct(product);
  const isAvailable = np.isAvailable;

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
            <div className="mb-8">
          <Link
            href="/marketplace"
            className="flex items-center text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('marketplace.back_to_marketplace')}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative h-96 bg-gradient-to-br from-emerald-900/20 to-emerald-800/30 rounded-lg overflow-hidden">
              {isValidUrl(np.imageUrl) ? (
                <img
                  src={np.imageUrl as string}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">
                  {getCategoryIcon(np.category)}
                </div>
              )}
              
              {/* Stock status */}
              {!isAvailable && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-2 rounded-full text-sm font-semibold">
                  {t('product.out_of_stock')}
                </div>
              )}
              
              {/* Category badge */}
              <div className="absolute top-4 left-4 bg-[color:var(--card)]/90 backdrop-blur-sm px-3 py-2 rounded-full text-sm font-medium text-[color:var(--foreground)] border border-[color:var(--border)]">
                {formatCategory(np.category)}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex space-x-2">
              <button className="flex-1 flex items-center justify-center space-x-2 bg-[color:var(--muted)] text-[color:var(--foreground)] px-4 py-2 rounded-lg hover:bg-[color:var(--border)] transition-colors">
                <Heart className="w-4 h-4" />
                <span>{t('action.save')}</span>
              </button>
              <button className="flex-1 flex items-center justify-center space-x-2 bg-[color:var(--muted)] text-[color:var(--foreground)] px-4 py-2 rounded-lg hover:bg-[color:var(--border)] transition-colors">
                <Share2 className="w-4 h-4" />
                <span>{t('action.share')}</span>
              </button>
              {/* Edit button: only admin or owning farmer */}
              {user && ((user.role === 'admin') || (user.role === 'farmer' && user.id === product.seller_id)) && (
                <Link
                  href={user.role === 'admin' ? `/admin/products/${product.id}/edit` : `/farmer/products/${product.id}/edit`}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
                >
                  <span>Edit Product</span>
                </Link>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[color:var(--foreground)] mb-2">
                {product.title}
              </h1>
              
              <div className="flex items-center space-x-4 text-sm text-[color:var(--foreground)]/70 mb-4">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{product.location}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  <span>{t('loading')} {formatDate(product.created_at) || ''}</span>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-4xl font-bold text-[color:var(--primary)]">
                  {np.priceNum > 0 ? `₹${formatNumber(np.priceNum)}` : '₹—'}
                </span>
                <span className="text-[color:var(--foreground)]/50 text-lg ml-2">
                  /{t(`unit.${np.unit}`) || (np.unit || 'unit')}
                </span>
              </div>
            </div>

            {/* Stock and availability */}
            <div className="bg-[color:var(--card)] rounded-lg p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[color:var(--foreground)]">{t('product.stock_section')}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  np.isAvailable 
                    ? 'bg-[color:var(--primary)]/20 text-[color:var(--primary)]' 
                    : 'bg-red-900/20 text-red-400'
                }`}>
                  {np.stockNum} {np.unit || 'unit'} available
                </span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-[color:var(--foreground)]/70">
                <Shield className="w-4 h-4" />
                <span>{t('product.quality_guaranteed')}</span>
                <Truck className="w-4 h-4 ml-4" />
                <span>{t('product.free_delivery_note')}</span>
              </div>
            </div>

            {/* Quantity and Add to Cart - Role-based visibility */}
            <div className="bg-[color:var(--card)] rounded-lg p-6 border border-[color:var(--border)]">
              {/* Only show quantity selector for customers and admins */}
              {user && (user.role === 'customer') && (
                <div className="flex items-center space-x-4 mb-4">
                  <span className="text-[color:var(--foreground)] font-medium">{t('product.quantity')}:</span>
                  <div className="flex items-center border border-[color:var(--border)] rounded-md bg-[color:var(--muted)]">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 hover:bg-[color:var(--border)] text-[color:var(--foreground)] transition-colors"
                      disabled={!np.isAvailable}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={np.stockNum}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-center border-0 focus:ring-0 py-2 bg-transparent text-[color:var(--foreground)]"
                      disabled={!np.isAvailable}
                    />
                    <button
                      onClick={() => setQuantity(Math.min(np.stockNum, quantity + 1))}
                      className="px-3 py-2 hover:bg-[color:var(--border)] text-[color:var(--foreground)] transition-colors"
                      disabled={!np.isAvailable}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[color:var(--foreground)]/50">
                    {t('product.total')}: ₹{formatNumber(np.priceNum * quantity)}
                  </span>
                </div>
              )}

              <div className="flex space-x-3">
                {/* Role-based purchase controls */}
                {user ? (
                  user.role === 'customer' ? (
                    <>
                      <button
                        onClick={handleAddToCart}
                        disabled={!np.isAvailable || isAddingToCart}
                        className="flex-1 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isAddingToCart ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            {t('product.add_to_cart')}
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleBuyNow}
                        disabled={!isAvailable || isBuyingNow}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-3"
                      >
                        {t('product.buy_now')}
                      </button>
                    </>
                  ) : user.role === 'admin' ? (
                    <Link
                      href={`/chat?farmer_id=${product.seller_id}&product_id=${product.id}`}
                      className="px-6 py-3 border border-[color:var(--border)] rounded-lg hover:bg-[color:var(--muted)] transition-colors flex items-center space-x-2 text-[color:var(--foreground)]"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{t('nav.chat')}</span>
                    </Link>
                  ) : (
                    /* Farmer view - no chat, no purchase */
                    <div className="flex-1">
                      <div className="bg-[color:var(--primary)]/20 border border-[color:var(--primary)]/30 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-2xl">🌱</div>
                          <div>
                            <h4 className="font-semibold text-[color:var(--primary)]">Farmer Mode</h4>
                            <p className="text-[color:var(--foreground)]/70 text-sm">
                              As a farmer, you can view products but cannot make purchases in the marketplace.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  /* Not logged in */
                  <div className="flex-1">
                    <Link
                      href="/auth/login"
                      className="w-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-6 py-3 rounded-lg hover:opacity-90 transition-colors flex items-center justify-center space-x-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span>{t('product.login_to_purchase')}</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] overflow-hidden">
          <div className="border-b border-[color:var(--border)]">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'description', label: t('product.tab_description'), icon: null },
                { key: 'reviews', label: t('product.tab_reviews'), icon: Star },
                { key: 'seller', label: t('product.tab_seller'), icon: User },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as typeof activeTab)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === key
                      ? 'border-[color:var(--primary)] text-[color:var(--primary)]'
                      : 'border-transparent text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'description' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-[color:var(--foreground)]">{t('product.description_heading')}</h3>
                <p className="text-[color:var(--foreground)]/80 leading-relaxed">
                  {product.description || 'No description available for this product.'}
                </p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-[color:var(--foreground)]">{t('product.reviews_heading')}</h3>
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-[color:var(--border)] pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[color:var(--foreground)]">{review.buyer_name}</span>
                          <span className="text-sm text-[color:var(--foreground)]/70">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center mb-2">
                          {renderStars(review.rating)}
                        </div>
                        <p className="text-[color:var(--foreground)]/80">{review.review_text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[color:var(--foreground)]/50">{t('product.no_reviews_yet')}</p>
                )}
              </div>
            )}

            {activeTab === 'seller' && (seller || farmer) && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-[color:var(--foreground)]">{t('product.seller_information')}</h3>
                <div className="flex items-start space-x-4 mb-6">
                  <div className="w-16 h-16 bg-[color:var(--primary)]/20 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-[color:var(--primary)]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold text-[color:var(--foreground)]">{(seller?.name) || farmer?.name || 'Demo Farmer'}</h4>
                    <div className="flex items-center mt-1">
                      <MapPin className="w-4 h-4 text-gray-500 mr-1" />
                      <span className="text-[color:var(--foreground)]/70">{seller?.location || farmer?.location || product.location || 'Demo Farm, India'}</span>
                    </div>
                    <div className="flex items-center mt-1">
                      {renderStars(Math.round((seller?.rating as number) || (farmer?.average_rating as number) || 0))}
                      <span className="text-sm text-[color:var(--foreground)]/70 ml-2">
                        ({(seller?.review_count != null ? seller?.review_count : farmer?.total_reviews) || 0} {t('product.tab_reviews').toLowerCase()})
                      </span>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-[color:var(--foreground)]/70"><strong>{t('labels.email')}:</strong> {seller?.email || farmer?.email || 'demo-farmer@example.com'}</span>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-[color:var(--foreground)]/70"><strong>{t('labels.address')}:</strong> {seller?.address || seller?.location || farmer?.location || product.location || 'Demo Village, Demo District'}</span>
                    </div>
                  </div>
                </div>

                {farmer?.bio && (
                  <div className="mb-6">
                    <h5 className="font-medium text-[color:var(--foreground)] mb-2">About the Farmer</h5>
                    <p className="text-[color:var(--foreground)]/80">{farmer?.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[color:var(--muted)] p-4 rounded-lg">
                    <span className="text-2xl font-bold text-[color:var(--primary)]">{farmer?.total_products ?? 0}</span>
                    <p className="text-[color:var(--foreground)]/70">Products Listed</p>
                  </div>
                  <div className="bg-[color:var(--muted)] p-4 rounded-lg">
                    <span className="text-2xl font-bold text-[color:var(--primary)]">{(farmer?.average_rating ?? 0).toFixed(1)}</span>
                    <p className="text-[color:var(--foreground)]/70">Average Rating</p>
                  </div>
                </div>

                {farmer?.phone && (
                  <div className="mt-6 p-4 bg-[color:var(--primary)]/20 rounded-lg">
                    <div className="flex items-center">
                      <Phone className="w-5 h-5 text-[color:var(--primary)] mr-2" />
                      <span className="text-[color:var(--primary)] font-medium">Contact: {farmer?.phone}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}