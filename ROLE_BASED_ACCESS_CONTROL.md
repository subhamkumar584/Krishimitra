# Role-Based Access Control Implementation

## Overview
This document outlines the comprehensive role-based access control (RBAC) system implemented in the AgriConnect marketplace platform.

## User Roles

### 1. Farmer 🌱
**Can:**
- View marketplace products (read-only)
- Create new product listings with image upload
- Manage their own products (edit, delete)
- Access analytics and sales data
- View product reviews and ratings

**Cannot:**
- Purchase products from marketplace
- Add items to cart
- Place orders

**Key Pages:**
- `/farmer/products` - Manage product listings
- `/farmer/products/new` - Create new product listing
- `/marketplace` - View-only marketplace access
- `/analytics` - Farmer-specific analytics dashboard

### 2. Customer 🛒
**Can:**
- View marketplace products
- Purchase products from farmers
- Add items to cart and manage cart
- Place orders and track order history
- Review products and farmers
- Access customer support

**Cannot:**
- Create product listings
- Access farmer analytics
- Manage other users

**Key Pages:**
- `/marketplace` - Full marketplace access with purchase capabilities
- `/cart` - Shopping cart management
- `/orders` - Order history and tracking

### 3. Admin ⚡
**Can:**
- All farmer capabilities
- All customer capabilities
- Manage users and platform settings
- Access comprehensive analytics
- Moderate reviews and content

**Key Pages:**
- `/admin/users` - User management
- `/analytics` - Full platform analytics
- All marketplace and product management features

## Backend Implementation

### Authentication & Authorization
- JWT-based authentication with role claims
- `@role_required` decorator for endpoint protection
- Role validation in middleware

### API Endpoints

#### Product Management
```
POST /api/v1/marketplace/products
- Role: farmer, admin
- Create product with image upload to Cloudinary

PUT /api/v1/marketplace/products/{id}
- Role: farmer (own products), admin
- Update product details

DELETE /api/v1/marketplace/products/{id}
- Role: farmer (own products), admin
- Soft delete product

GET /api/v1/marketplace/products/my
- Role: farmer
- Get farmer's own products only
```

#### Cart & Orders
```
POST /api/v1/cart/add
- Role: customer, admin
- Explicit check prevents farmers from purchasing
- Validates user role before cart operations

GET /api/v1/cart
- Role: customer, admin
- Retrieve cart items

POST /api/v1/orders
- Role: customer, admin
- Create order from cart
```

#### Public Endpoints
```
GET /api/v1/marketplace/products
- Public access
- Search and filter products

GET /api/v1/marketplace/products/{id}
- Public access
- Product details and reviews
```

## Frontend Implementation

### Role-Based UI Components

#### MainNav Component
- Dynamic navigation based on user role
- Role-specific menu items and actions
- User profile with role indicator

#### Marketplace Page
- Role-based header controls:
  - Farmers: "My Products" + "Sell Product" buttons
  - Customers: Shopping cart icon
  - Guests: Login prompt
- Farmer notice explaining view-only access
- Different empty states per role

#### ProductCard Component
- `showPurchaseButton` prop controls purchase UI
- Farmers see "View Details" instead of "Add to Cart"
- Quantity selectors hidden for farmers

### Route Protection
- `/farmer/*` routes require farmer role
- Cart and order pages restricted to customers/admins
- Dynamic redirects based on user role

## Security Features

### Backend Security
- Role validation on every protected endpoint
- Ownership verification for product CRUD operations
- Input validation and sanitization
- Image upload security with Cloudinary

### Frontend Security
- Authentication state management
- Role-based conditional rendering
- API error handling and user feedback
- Local storage token management

## Key Features

### Farmer-Specific Features
1. **Product Management Dashboard**
   - View, edit, delete own products
   - Product performance metrics
   - Stock management
   - Image upload with preview

2. **Sales Analytics**
   - Revenue tracking
   - Order analytics
   - Customer insights
   - Performance metrics

3. **Marketplace Integration**
   - Seamless product listing
   - Search and filter capabilities
   - Customer review system

### Customer-Specific Features
1. **Shopping Experience**
   - Full marketplace access
   - Advanced product search and filtering
   - Shopping cart management
   - Order tracking

2. **Review System**
   - Product reviews and ratings
   - Farmer reviews and ratings
   - Review history

### Admin Features
1. **Platform Management**
   - User role management
   - Content moderation
   - System analytics
   - Platform configuration

## Error Handling

### Backend Errors
- `403 Forbidden` for role violations
- `404 Not Found` for unauthorized resource access
- Detailed error messages for debugging

### Frontend Errors
- User-friendly error messages
- Role-specific error handling
- Graceful degradation for unauthorized actions

## Testing

### Role Verification Tests
- Verify farmers cannot purchase products
- Ensure customers cannot create product listings
- Validate admin access to all features
- Test ownership verification for product management

### UI/UX Tests
- Role-based navigation visibility
- Button and form availability per role
- Error message accuracy
- Mobile responsiveness across roles

## Future Enhancements

1. **Multi-level Permissions**
   - Farmer tiers (basic, premium, verified)
   - Customer categories (regular, wholesale)

2. **Advanced Role Features**
   - Temporary role elevation
   - Role-based pricing
   - Custom permissions per user

3. **Audit System**
   - Role change logging
   - Action audit trails
   - Security monitoring

## Deployment Considerations

1. **Environment Variables**
   - JWT secret keys
   - Role configuration
   - API security settings

2. **Database Setup**
   - User roles properly indexed
   - Role migration scripts
   - Default admin user creation

3. **Monitoring**
   - Role-based access logging
   - Failed authorization attempts
   - User activity tracking

This role-based access control system ensures that each user type has appropriate access levels while maintaining security and providing an optimal user experience for their specific use case.