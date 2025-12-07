// Use same-origin by default so Next.js rewrites proxy to the backend.
// Set NEXT_PUBLIC_BACKEND_URL if you want to hit the backend directly.
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

// Helper function to make authenticated API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Get token from the same key used by auth.ts
  const authData = typeof window !== 'undefined' ? localStorage.getItem('km_auth') : null;
  let token = null;
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      token = parsed.token;
    } catch (e) {
      console.error('Failed to parse auth data:', e);
    }
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  } as Record<string, string>;

  // If the body is FormData, let the browser set headers appropriately
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (e: any) {
    throw new Error(`Network request failed. Ensure backend is running and NEXT_PUBLIC_BACKEND_URL (if set) points to it. ${e?.message || ''}`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    // API Error logged
    throw new Error(errorText || `HTTP ${res.status}`);
  }

  return res.json();
}

// Authentication
export async function login(email: string, password: string) {
  return apiCall('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(userData: any) {
  return apiCall('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function getCurrentUser() {
  // First try to get user from stored auth data
  const authData = localStorage.getItem('km_auth');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      if (parsed.user && parsed.token) {
        // Return the stored user data
        return parsed.user;
      }
    } catch (e) {
      console.error('Failed to parse stored auth data:', e);
    }
  }
  
  // Fallback to API call if no stored data
  return apiCall('/api/v1/auth/me');
}

// Marketplace APIs
export async function getProducts(params?: {
  search?: string;           // UI: search term -> backend: q
  category?: string;
  location?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: 'newest' | 'price_low' | 'price_high' | 'rating'; // UI sort -> backend: sort/order
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    // Map UI params to backend expectations
    if (params.search) searchParams.append('q', params.search);
    if (params.category) searchParams.append('category', params.category);
    if (params.location) searchParams.append('location', params.location);
    if (params.min_price !== undefined) searchParams.append('min_price', params.min_price.toString());
    if (params.max_price !== undefined) searchParams.append('max_price', params.max_price.toString());
    if (params.page !== undefined) searchParams.append('page', params.page.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());

    // Sort mapping
    if (params.sort_by) {
      switch (params.sort_by) {
        case 'newest':
          searchParams.append('sort', 'created_at');
          searchParams.append('order', 'desc');
          break;
        case 'price_low':
          searchParams.append('sort', 'price');
          searchParams.append('order', 'asc');
          break;
        case 'price_high':
          searchParams.append('sort', 'price');
          searchParams.append('order', 'desc');
          break;
        case 'rating':
          searchParams.append('sort', 'rating');
          searchParams.append('order', 'desc');
          break;
      }
    }
  }
  const query = searchParams.toString();
  return apiCall(`/api/v1/marketplace/products${query ? `?${query}` : ''}`);
}

export async function getProduct(id: number) {
  return apiCall(`/api/v1/marketplace/products/${id}`);
}

export async function getFarmerProfile(id: number) {
  // Backend route is singular: /api/v1/marketplace/farmer/<id>
  return apiCall(`/api/v1/marketplace/farmer/${id}`);
}

export async function createProduct(productData: any) {
  return apiCall('/api/v1/marketplace/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  });
}

// Cart APIs
export async function getCart() {
  return apiCall('/api/v1/cart');
}

export async function addToCart(productId: number, quantity: number) {
  return apiCall('/api/v1/cart/add', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}

export async function updateCartItem(itemId: number, quantity: number) {
  // Backend route: PUT /api/v1/cart/<item_id>
  return apiCall(`/api/v1/cart/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeFromCart(itemId: number) {
  // Backend route: DELETE /api/v1/cart/<item_id>
  return apiCall(`/api/v1/cart/${itemId}`, {
    method: 'DELETE',
  });
}

export async function clearCart() {
  return apiCall('/api/v1/cart/clear', {
    method: 'DELETE',
  });
}

// Order APIs
export async function createOrder(orderData: any) {
  return apiCall('/api/v1/payments/create-order', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
}

export async function verifyPayment(paymentData: any) {
  // Backend route is /api/v1/payments/verify-payment
  return apiCall('/api/v1/payments/verify-payment', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}

export async function getOrders(role: 'buyer' | 'seller' = 'buyer') {
  const searchParams = new URLSearchParams();
  if (role) searchParams.append('role', role);
  const query = searchParams.toString();
  return apiCall(`/api/v1/payments/orders${query ? `?${query}` : ''}`);
}

export async function approveOrder(orderId: number) {
  return apiCall(`/api/v1/payments/orders/${orderId}/approve`, {
    method: 'POST',
  });
}

export async function rejectOrder(orderId: number) {
  return apiCall(`/api/v1/payments/orders/${orderId}/reject`, {
    method: 'POST',
  });
}

// Reviews APIs
export async function getProductReviews(productId: number, params?: {
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }
  
  const query = searchParams.toString();
  return apiCall(`/api/v1/reviews/products/${productId}${query ? `?${query}` : ''}`);
}

export async function createProductReview(productId: number, reviewData: {
  rating: number;
  review_text: string;
  order_id: number;
}) {
  return apiCall(`/api/v1/reviews/products/${productId}`, {
    method: 'POST',
    body: JSON.stringify(reviewData),
  });
}

// Analytics APIs
export async function getDashboardStats() {
  return apiCall('/api/v1/analytics/dashboard');
}

// AI APIs
export async function recommendSoil(body: any) {
  return apiCall('/api/v1/ai/recommend/soil', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
