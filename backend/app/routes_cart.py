from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from flask_jwt_extended import jwt_required, get_jwt_identity

from .db import get_db
from .models import CartItem, Product, User
from .auth import role_required

bp = Blueprint("cart", __name__, url_prefix="/api/v1/cart")


@bp.post("/add")
@jwt_required()
def add_to_cart():
    """Add item to cart.
    - Customers and equipmetal: can purchase any active product (not owned by them).
    - Farmers: can purchase only equipment-related supplies (allowed categories), not their own products.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    product_id = data.get('product_id')
    quantity = float(data.get('quantity', 1.0))
    
    if not product_id:
        return jsonify({"error": "Product ID required"}), 400
    
    for db in get_db():
        session: Session = db
        
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        
        # Check if product exists and is active
        product = session.query(Product).filter_by(
            id=product_id, status="active"
        ).first()
        
        if not product:
            return jsonify({"error": "Product not found or inactive"}), 404
        
        # Prevent adding own products for everyone
        if product.seller_id == user_id:
            return jsonify({"error": "You cannot add your own product to cart"}), 400
        
        # Category normalization helper
        def norm_cat(raw: str | None) -> str:
            c = (raw or '').strip().lower()
            if c in {'pesticide/medicine', 'medicine'}:
                c = 'pesticide'
            if c in {'machinery parts', 'machineary parts', 'machinaery parts'}:
                c = 'machinery_parts'
            if c == 'seed':
                c = 'seeds'
            if c == 'fertlizer':
                c = 'fertilizer'
            return c
        
        cat = norm_cat(product.category)
        supply_set = { 'fertilizer', 'pesticide', 'seeds', 'tools', 'tool', 'machinery_parts', 'machinery' }
        
        # Role-based restrictions
        if user.role == 'farmer':
            # Farmers may ONLY purchase supplies (not crops)
            if cat not in supply_set:
                return jsonify({"error": "Farmers can only purchase equipment supplies (fertilizer, pesticide/medicine, seeds, tools, machinery parts)."}), 403
        elif user.role == 'equipmetal':
            # Equipmetal may NOT purchase supplies; crops only
            if cat in supply_set:
                return jsonify({"error": "Equipmetal providers cannot purchase supplies (fertilizer, pesticide/medicine, seeds, tools, machinery parts)."}), 403
        
        # Check stock availability
        if quantity > product.stock:
            return jsonify({"error": f"Only {product.stock} units available"}), 400
        
        # Check if item already in cart
        existing_item = session.query(CartItem).filter_by(
            user_id=user_id, product_id=product_id
        ).first()
        
        if existing_item:
            # Update quantity
            new_quantity = existing_item.quantity + quantity
            if new_quantity > product.stock:
                return jsonify({"error": f"Total quantity exceeds stock ({product.stock} units)"}), 400
            existing_item.quantity = new_quantity
        else:
            # Add new item
            cart_item = CartItem(
                user_id=user_id,
                product_id=product_id,
                quantity=quantity
            )
            session.add(cart_item)
        
        session.commit()
        
        return jsonify({
            "success": True,
            "message": "Item added to cart"
        })


@bp.get("")
@jwt_required()
def get_cart():
    """Get user's cart items"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        cart_items = session.query(CartItem).filter_by(user_id=user_id).all()
        
        cart_data = []
        total_amount = 0.0
        
        for item in cart_items:
            product = item.product
            item_total = item.quantity * product.price
            total_amount += item_total
            
            cart_data.append({
                "id": item.id,
                "product_id": product.id,
                "product_name": product.title,
                "product_image": product.image_url,
                "price": product.price,
                "unit": product.unit,
                "quantity": item.quantity,
                "total": item_total,
                "seller_name": product.seller.name,
                "seller_id": product.seller_id,
                "stock_available": product.stock
            })
        
        return jsonify({
            "cart_items": cart_data,
            "total_amount": total_amount,
            "total_items": len(cart_data)
        })


@bp.put("/<int:item_id>")
@jwt_required()
def update_cart_item(item_id: int):
    """Update cart item quantity"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    quantity = float(data.get('quantity', 1.0))
    
    if quantity <= 0:
        return jsonify({"error": "Quantity must be positive"}), 400
    
    for db in get_db():
        session: Session = db
        
        cart_item = session.query(CartItem).filter_by(
            id=item_id, user_id=user_id
        ).first()
        
        if not cart_item:
            return jsonify({"error": "Cart item not found"}), 404
        
        # Check stock availability
        if quantity > cart_item.product.stock:
            return jsonify({"error": f"Only {cart_item.product.stock} units available"}), 400
        
        cart_item.quantity = quantity
        session.commit()
        
        return jsonify({
            "success": True,
            "message": "Cart item updated"
        })


@bp.delete("/<int:item_id>")
@jwt_required()
def remove_from_cart(item_id: int):
    """Remove item from cart"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        cart_item = session.query(CartItem).filter_by(
            id=item_id, user_id=user_id
        ).first()
        
        if not cart_item:
            return jsonify({"error": "Cart item not found"}), 404
        
        session.delete(cart_item)
        session.commit()
        
        return jsonify({
            "success": True,
            "message": "Item removed from cart"
        })


@bp.delete("/clear")
@jwt_required()
def clear_cart():
    """Clear all items from cart"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        session.query(CartItem).filter_by(user_id=user_id).delete()
        session.commit()
        
        return jsonify({
            "success": True,
            "message": "Cart cleared"
        })