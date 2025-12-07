from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta

from .db import get_db
from .models import (
    Product, User, ProductReview, FarmerReview, 
    Order, OrderItem, MarketPrice, PricingInsight
)
from .auth import role_required
from .services.cloudinary_service import CloudinaryService
from .services.gemini_image import analyze_quality_and_price
import httpx

bp = Blueprint("marketplace", __name__, url_prefix="/api/v1/marketplace")


@bp.get("/products")
@jwt_required(optional=True)
def list_products():
    """Advanced product search with filters"""
    try:
        # Search parameters
        q = request.args.get("q", "")
        category = request.args.get("category")
        min_price = request.args.get("min_price", type=float)
        max_price = request.args.get("max_price", type=float)
        location = request.args.get("location")
        seller_id = request.args.get("seller_id", type=int)
        sort_by = request.args.get("sort", "created_at")  # created_at, price, rating, name
        sort_order = request.args.get("order", "desc")  # asc, desc
        page = request.args.get("page", 1, type=int)
        limit = min(request.args.get("limit", 20, type=int), 100)
        
        for db in get_db():
            session: Session = db
            
            # Base query
            query = session.query(Product).filter(Product.status == "active")
            
            # Search filters
            if q:
                like = f"%{q}%"
                query = query.filter(or_(
                    Product.title.like(like),
                    Product.description.like(like),
                    Product.category.like(like)
                ))
            
            if category:
                query = query.filter(Product.category.like(f"%{category}%"))
            
            if min_price:
                query = query.filter(Product.price >= min_price)
            
            if max_price:
                query = query.filter(Product.price <= max_price)
            
            if location:
                query = query.filter(Product.location.like(f"%{location}%"))
            
            if seller_id:
                query = query.filter(Product.seller_id == seller_id)
            
            # Role-based visibility: farmers see only their own products
            try:
                claims = get_jwt() or {}
                role = claims.get("role")
                if role == 'farmer':
                    uid = int(get_jwt_identity())
                    query = query.filter(Product.seller_id == uid)
            except Exception:
                pass
            
            # Sorting
            if sort_by == "price":
                order_col = Product.price
            elif sort_by == "name":
                order_col = Product.title
            elif sort_by == "rating":
                # Join with reviews to sort by average rating
                query = query.outerjoin(ProductReview).group_by(Product.id)
                order_col = func.coalesce(func.avg(ProductReview.rating), 0)
            else:
                order_col = Product.created_at
            
            if sort_order == "asc":
                query = query.order_by(asc(order_col))
            else:
                query = query.order_by(desc(order_col))
            
            # Pagination
            total_count = query.count()
            products = query.offset((page - 1) * limit).limit(limit).all()
            
            # Build response with enhanced data
            items = []
            for p in products:
                # Get average rating
                avg_rating = session.query(func.avg(ProductReview.rating)).filter(
                    ProductReview.product_id == p.id
                ).scalar() or 0
                
                # Get review count
                review_count = session.query(func.count(ProductReview.id)).filter(
                    ProductReview.product_id == p.id
                ).scalar() or 0
                
                # Get seller rating
                seller_rating = session.query(func.avg(FarmerReview.rating)).filter(
                    FarmerReview.farmer_id == p.seller_id
                ).scalar() or 0
                
                items.append({
                    "id": p.id,
                    "title": p.title,
                    "description": p.description,
                    "category": p.category,
                    "price": p.price,
                    "unit": p.unit,
                    "stock": p.stock,
                    "location": p.location,
                    "image_url": p.image_url,
                    "seller_id": p.seller_id,
                    "seller_name": p.seller.name if p.seller else None,
                    "seller_rating": round(seller_rating, 2),
                    "product_rating": round(avg_rating, 2),
                    "review_count": review_count,
                    "created_at": p.created_at.isoformat(),
                    "freshness_score": calculate_freshness_score(p.created_at),
                    "is_available": p.stock > 0 and p.status == "active"
                })
            
            return jsonify({
                "products": items,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                },
                "filters_applied": {
                    "search": q,
                    "category": category,
                    "price_range": [min_price, max_price] if min_price or max_price else None,
                    "location": location,
                    "seller_id": seller_id
                }
            })
    except Exception as e:
        # Return error details to help diagnose in dev
        return jsonify({"error": str(e)}), 500


def calculate_freshness_score(created_at):
    """Calculate freshness score based on product listing age"""
    days_old = (datetime.utcnow() - created_at).days
    if days_old == 0:
        return 100  # Fresh today
    elif days_old <= 3:
        return 90   # Very fresh
    elif days_old <= 7:
        return 75   # Fresh
    elif days_old <= 14:
        return 50   # Moderate
    else:
        return 25   # Old


@bp.post("/products")
@jwt_required()
@role_required("farmer", "equipmetal")
def create_product():
    """Create a new product with image upload"""
    uid = int(get_jwt_identity())
    
    # Get form data
    title = request.form.get('title')
    description = request.form.get('description')
    category = request.form.get('category')
    price = request.form.get('price')
    unit = request.form.get('unit')
    stock = request.form.get('stock')
    location = request.form.get('location')
    
    # Validation
    if not all([title, category, price, unit, stock]):
        return jsonify({"error": "Missing required fields: title, category, price, unit, stock"}), 400
    
    # Check for image file
    if 'image' not in request.files:
        return jsonify({"error": "Product image is required"}), 400
    
    image_file = request.files['image']
    if not image_file or image_file.filename == '':
        return jsonify({"error": "Product image is required"}), 400
    
    try:
        price = float(price)
        stock = float(stock)
        
        if price <= 0:
            return jsonify({"error": "Price must be greater than 0"}), 400
        if stock < 0:
            return jsonify({"error": "Stock cannot be negative"}), 400
            
    except ValueError:
        return jsonify({"error": "Invalid price or stock value"}), 400
    
    # Upload image to Cloudinary
    upload_result = CloudinaryService.upload_image(image_file, "krishimitra/products")
    
    if not upload_result['success']:
        return jsonify({"error": f"Image upload failed: {upload_result['error']}"}), 400
    
    for db in get_db():
        session: Session = db
        p = Product(
            seller_id=uid,
            title=title.strip(),
            description=description.strip() if description else None,
            category=category.strip(),
            price=price,
            unit=unit.strip(),
            stock=stock,
            location=location.strip() if location else None,
            image_url=upload_result['url']
        )
        session.add(p)
        session.commit()

        # AI analysis: quality and suggested price (best-effort; non-blocking)
        ai = None
        try:
            # Fetch image bytes from Cloudinary URL for analysis
            with httpx.Client(timeout=20) as client:
                r = client.get(upload_result['url'])
                r.raise_for_status()
                img_bytes = r.content
            context = {
                "title": title,
                "category": category,
                "unit": unit,
                "location": location,
                "current_price": price,
            }
            ai = analyze_quality_and_price(img_bytes, image_file.mimetype or "image/jpeg", context)
            # Persist suggested price insight
            try:
                from .models import PricingInsight, User
                insight = PricingInsight(
                    farmer_id=uid,
                    product_id=p.id,
                    commodity=title,
                    current_market_price=price,
                    suggested_price=float(ai.get("suggested_price_in_inr") or 0.0),
                    confidence_score=float(ai.get("quality_score") or 0.0),
                    reasoning=f"condition={ai.get('condition')}; notes={ai.get('notes','')}"
                )
                session.add(insight)
                session.commit()
            except Exception:
                session.rollback()
        except Exception:
            ai = None
        
        return jsonify({
            "id": p.id,
            "message": "Product created successfully",
            "image_url": upload_result['url'],
            "thumbnail_url": upload_result.get('thumbnail_url'),
            "ai": ai or None
        })


@bp.put("/products/<int:pid>")
@role_required("farmer", "equipmetal", "admin")
def update_product(pid: int):
    uid = int(get_jwt_identity())
    claims = get_jwt() or {}
    role = claims.get("role")
    data = request.get_json(force=True) or {}
    for db in get_db():
        session: Session = db
        # Admins can edit any product; farmers can edit only their own
        if role == "admin":
            p = session.query(Product).filter_by(id=pid).first()
        else:
            p = session.query(Product).filter_by(id=pid, seller_id=uid).first()
        if not p:
            return jsonify({"error": "not found"}), 404
        image_changed = False
        for field in ["title", "description", "category", "unit", "location", "image_url", "status"]:
            if field in data:
                if field == "image_url" and getattr(p, field) != data[field]:
                    image_changed = True
                setattr(p, field, data[field])
        if "price" in data:
            p.price = float(data["price"]) 
        if "stock" in data:
            p.stock = float(data["stock"]) 
        session.commit()

        ai = None
        if image_changed and p.image_url:
            # Analyze new image best-effort
            try:
                with httpx.Client(timeout=20) as client:
                    r = client.get(p.image_url)
                    r.raise_for_status()
                    img_bytes = r.content
                context = {
                    "title": p.title,
                    "category": p.category,
                    "unit": p.unit,
                    "location": p.location,
                    "current_price": p.price,
                }
                ai = analyze_quality_and_price(img_bytes, "image/jpeg", context)
                try:
                    from .models import PricingInsight
                    insight = PricingInsight(
                        farmer_id=p.seller_id,
                        product_id=p.id,
                        commodity=p.title,
                        current_market_price=p.price,
                        suggested_price=float(ai.get("suggested_price_in_inr") or 0.0),
                        confidence_score=float(ai.get("quality_score") or 0.0),
                        reasoning=f"condition={ai.get('condition')}; notes={ai.get('notes','')}"
                    )
                    session.add(insight)
                    session.commit()
                except Exception:
                    session.rollback()
            except Exception:
                ai = None
        return jsonify({"ok": True, "ai": ai or None})


@bp.delete("/products/<int:pid>")
@role_required("farmer", "equipmetal", "admin")
def delete_product(pid: int):
    uid = int(get_jwt_identity())
    for db in get_db():
        session: Session = db
        p = session.query(Product).filter_by(id=pid, seller_id=uid).first()
        if not p:
            return jsonify({"error": "not found"}), 404
        p.status = "deleted"
        session.commit()
        return jsonify({"ok": True})


@bp.get("/products/my")
@jwt_required()
@role_required("farmer", "equipmetal")
def get_my_products():
    """Get products owned by the current farmer"""
    farmer_id = int(get_jwt_identity())
    
    # Get query parameters
    q = request.args.get("q", "")
    category = request.args.get("category")
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 20, type=int), 100)
    
    for db in get_db():
        session: Session = db
        
        # Base query - only farmer's own products (including inactive ones for management)
        query = session.query(Product).filter(
            and_(Product.seller_id == farmer_id, Product.status != "deleted")
        )
        
        # Search filters
        if q:
            like = f"%{q}%"
            query = query.filter(or_(
                Product.title.like(like),
                Product.description.like(like),
                Product.category.like(like)
            ))
        
        if category:
            query = query.filter(Product.category == category)
        
        # Order by creation date (newest first)
        query = query.order_by(desc(Product.created_at))
        
        # Pagination
        total_count = query.count()
        products = query.offset((page - 1) * limit).limit(limit).all()
        
        # Build response
        items = []
        for p in products:
            # Get average rating
            avg_rating = session.query(func.avg(ProductReview.rating)).filter(
                ProductReview.product_id == p.id
            ).scalar() or 0
            
            # Get review count
            review_count = session.query(func.count(ProductReview.id)).filter(
                ProductReview.product_id == p.id
            ).scalar() or 0
            
            items.append({
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "category": p.category,
                "price": p.price,
                "unit": p.unit,
                "stock": p.stock,
                "location": p.location,
                "image_url": p.image_url,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
                "product_rating": round(avg_rating, 2),
                "review_count": review_count,
                "freshness_score": calculate_freshness_score(p.created_at),
                "is_available": p.stock > 0 and p.status == "active"
            })
        
        return jsonify({
            "products": items,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        })


@bp.get("/products/<int:pid>")
@jwt_required(optional=True)
def get_product_details(pid: int):
    """Get detailed product information"""
    for db in get_db():
        session: Session = db
        
        product = session.query(Product).filter_by(id=pid, status="active").first()
        if not product:
            return jsonify({"error": "Product not found"}), 404
        
        # If farmer, only allow viewing own products
        try:
            claims = get_jwt() or {}
            role = claims.get("role")
            if role == 'farmer':
                uid = int(get_jwt_identity())
                if product.seller_id != uid:
                    return jsonify({"error": "forbidden"}), 403
        except Exception:
            pass
        
        # Get product reviews
        reviews = session.query(ProductReview).filter_by(product_id=pid).order_by(
            ProductReview.created_at.desc()
        ).limit(10).all()
        
        # Get average rating
        avg_rating = session.query(func.avg(ProductReview.rating)).filter(
            ProductReview.product_id == pid
        ).scalar() or 0
        
        # Get seller info and rating
        seller_rating = session.query(func.avg(FarmerReview.rating)).filter(
            FarmerReview.farmer_id == product.seller_id
        ).scalar() or 0
        
        seller_review_count = session.query(func.count(FarmerReview.id)).filter(
            FarmerReview.farmer_id == product.seller_id
        ).scalar() or 0
        
        # Get other products from same seller
        other_products = session.query(Product).filter(
            and_(Product.seller_id == product.seller_id, Product.id != pid, Product.status == "active")
        ).limit(5).all()
        
        return jsonify({
            "product": {
                "id": product.id,
                "title": product.title,
                "description": product.description,
                "category": product.category,
                "price": product.price,
                "unit": product.unit,
                "stock": product.stock,
                "location": product.location,
                "image_url": product.image_url,
                "created_at": product.created_at.isoformat(),
                "rating": round(avg_rating, 2),
                "review_count": len(reviews),
                "freshness_score": calculate_freshness_score(product.created_at),
                "is_available": product.stock > 0 and product.status == "active"
            },
            "seller": {
                "id": product.seller.id,
                "name": product.seller.name,
                "email": product.seller.email,
                "rating": round(seller_rating, 2),
                "review_count": seller_review_count,
                "location": product.location,  # Seller location from product
                "address": product.location
            },
            "reviews": [{
                "id": r.id,
                "rating": r.rating,
                "review_text": r.review_text,
                "buyer_name": r.buyer.name,
                "created_at": r.created_at.isoformat()
            } for r in reviews],
            "other_products": [{
                "id": p.id,
                "title": p.title,
                "price": p.price,
                "unit": p.unit,
                "image_url": p.image_url
            } for p in other_products]
        })


@bp.post("/products/bulk")
@role_required("farmer", "equipmetal", "admin")
def bulk_create_products():
    """Bulk create products"""
    uid = int(get_jwt_identity())
    data = request.get_json() or {}
    products_data = data.get('products', [])
    
    if not products_data:
        return jsonify({"error": "No products data provided"}), 400
    
    created_products = []
    errors = []
    
    for db in get_db():
        session: Session = db
        
        for i, product_data in enumerate(products_data):
            try:
                product = Product(
                    seller_id=uid,
                    title=product_data.get("title"),
                    description=product_data.get("description"),
                    category=product_data.get("category"),
                    price=float(product_data.get("price", 0)),
                    unit=product_data.get("unit"),
                    stock=float(product_data.get("stock", 0)),
                    location=product_data.get("location"),
                    image_url=product_data.get("image_url")
                )
                session.add(product)
                session.flush()
                created_products.append({"index": i, "id": product.id, "title": product.title})
            except Exception as e:
                errors.append({"index": i, "error": str(e)})
        
        if not errors:
            session.commit()
        else:
            session.rollback()
        
        return jsonify({
            "created": len(created_products),
            "errors": len(errors),
            "products": created_products,
            "error_details": errors
        })


@bp.put("/products/bulk")
@role_required("farmer", "equipmetal", "admin")
def bulk_update_products():
    """Bulk update products"""
    uid = int(get_jwt_identity())
    data = request.get_json() or {}
    updates = data.get('updates', [])  # [{"id": 1, "price": 100, "stock": 50}, ...]
    
    if not updates:
        return jsonify({"error": "No updates provided"}), 400
    
    updated_products = []
    errors = []
    
    for db in get_db():
        session: Session = db
        
        for update_data in updates:
            try:
                product_id = update_data.get('id')
                product = session.query(Product).filter_by(id=product_id, seller_id=uid).first()
                
                if not product:
                    errors.append({"id": product_id, "error": "Product not found"})
                    continue
                
                # Update allowed fields
                for field in ['title', 'description', 'price', 'unit', 'stock', 'location', 'image_url', 'status']:
                    if field in update_data:
                        if field in ['price', 'stock']:
                            setattr(product, field, float(update_data[field]))
                        else:
                            setattr(product, field, update_data[field])
                
                updated_products.append({"id": product.id, "title": product.title})
                
            except Exception as e:
                errors.append({"id": update_data.get('id'), "error": str(e)})
        
        if not errors:
            session.commit()
        else:
            session.rollback()
        
        return jsonify({
            "updated": len(updated_products),
            "errors": len(errors),
            "products": updated_products,
            "error_details": errors
        })


@bp.get("/categories")
def get_categories():
    """Get all product categories"""
    for db in get_db():
        session: Session = db
        
        categories = session.query(Product.category, func.count(Product.id)).filter(
            Product.status == "active"
        ).group_by(Product.category).all()
        
        return jsonify({
            "categories": [{
                "name": cat,
                "product_count": count
            } for cat, count in categories if cat]
        })


@bp.get("/farmer/<int:farmer_id>")
def get_farmer_profile(farmer_id: int):
    """Get farmer profile with products and ratings"""
    for db in get_db():
        session: Session = db
        
        farmer = session.query(User).filter_by(id=farmer_id, role="farmer").first()
        if not farmer:
            return jsonify({"error": "Farmer not found"}), 404
        
        # Get farmer's products
        products = session.query(Product).filter_by(
            seller_id=farmer_id, status="active"
        ).order_by(Product.created_at.desc()).limit(20).all()
        
        # Get farmer rating
        avg_rating = session.query(func.avg(FarmerReview.rating)).filter(
            FarmerReview.farmer_id == farmer_id
        ).scalar() or 0
        
        review_count = session.query(func.count(FarmerReview.id)).filter(
            FarmerReview.farmer_id == farmer_id
        ).scalar() or 0
        
        # Get recent reviews
        reviews = session.query(FarmerReview).filter_by(
            farmer_id=farmer_id
        ).order_by(FarmerReview.created_at.desc()).limit(5).all()
        
        return jsonify({
            "farmer": {
                "id": farmer.id,
                "name": farmer.name,
                "email": farmer.email,
                "rating": round(avg_rating, 2),
                "review_count": review_count,
                "joined_date": farmer.created_at.isoformat()
            },
            "products": [{
                "id": p.id,
                "title": p.title,
                "category": p.category,
                "price": p.price,
                "unit": p.unit,
                "stock": p.stock,
                "image_url": p.image_url,
                "created_at": p.created_at.isoformat()
            } for p in products],
            "recent_reviews": [{
                "rating": r.rating,
                "review_text": r.review_text,
                "buyer_name": r.buyer.name,
                "created_at": r.created_at.isoformat()
            } for r in reviews]
        })
