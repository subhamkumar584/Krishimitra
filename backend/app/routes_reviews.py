from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from .db import get_db
from .models import (
    ProductReview, FarmerReview, Order, Product, User,
    OrderStatus, Conversation, Message
)
from .auth import role_required

bp = Blueprint("reviews", __name__, url_prefix="/api/v1/reviews")


@bp.post("/products/<int:product_id>")
@jwt_required()
@role_required("customer")
def create_product_review(product_id: int):
    """Create a product review"""
    buyer_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    rating = data.get('rating', type=int)
    review_text = data.get('review_text', '').strip()
    order_id = data.get('order_id', type=int)
    
    if not rating or rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be between 1 and 5"}), 400
    
    if not review_text:
        return jsonify({"error": "Review text is required"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Verify the order exists and belongs to the user
        order = session.query(Order).filter_by(
            id=order_id, buyer_id=buyer_id, status=OrderStatus.DELIVERED
        ).first()
        
        if not order:
            return jsonify({"error": "Order not found or not delivered yet"}), 404
        
        # Verify the product is in the order
        order_item = next((item for item in order.items if item.product_id == product_id), None)
        if not order_item:
            return jsonify({"error": "Product not found in this order"}), 404
        
        # Check if review already exists
        existing_review = session.query(ProductReview).filter_by(
            product_id=product_id, buyer_id=buyer_id, order_id=order_id
        ).first()
        
        if existing_review:
            return jsonify({"error": "You have already reviewed this product"}), 400
        
        # Create review
        review = ProductReview(
            product_id=product_id,
            buyer_id=buyer_id,
            order_id=order_id,
            rating=rating,
            review_text=review_text
        )
        
        session.add(review)
        session.commit()
        
        return jsonify({
            "review_id": review.id,
            "message": "Product review created successfully"
        })


@bp.post("/farmers/<int:farmer_id>")
@jwt_required()
@role_required("customer")
def create_farmer_review(farmer_id: int):
    """Create a farmer review"""
    buyer_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    rating = data.get('rating', type=int)
    review_text = data.get('review_text', '').strip()
    order_id = data.get('order_id', type=int)
    
    if not rating or rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be between 1 and 5"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Verify the order exists and belongs to the user
        order = session.query(Order).filter_by(
            id=order_id, buyer_id=buyer_id, seller_id=farmer_id, status=OrderStatus.DELIVERED
        ).first()
        
        if not order:
            return jsonify({"error": "Order not found or not delivered yet"}), 404
        
        # Check if review already exists
        existing_review = session.query(FarmerReview).filter_by(
            farmer_id=farmer_id, buyer_id=buyer_id, order_id=order_id
        ).first()
        
        if existing_review:
            return jsonify({"error": "You have already reviewed this farmer"}), 400
        
        # Create review
        review = FarmerReview(
            farmer_id=farmer_id,
            buyer_id=buyer_id,
            order_id=order_id,
            rating=rating,
            review_text=review_text or ""
        )
        
        session.add(review)
        session.commit()
        
        return jsonify({
            "review_id": review.id,
            "message": "Farmer review created successfully"
        })


@bp.get("/products/<int:product_id>")
def get_product_reviews(product_id: int):
    """Get reviews for a specific product"""
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 10, type=int), 50)
    sort_by = request.args.get("sort", "newest")  # newest, oldest, rating_high, rating_low
    
    for db in get_db():
        session: Session = db
        
        query = session.query(ProductReview).filter_by(product_id=product_id)
        
        # Apply sorting
        if sort_by == "oldest":
            query = query.order_by(asc(ProductReview.created_at))
        elif sort_by == "rating_high":
            query = query.order_by(desc(ProductReview.rating), desc(ProductReview.created_at))
        elif sort_by == "rating_low":
            query = query.order_by(asc(ProductReview.rating), desc(ProductReview.created_at))
        else:  # newest
            query = query.order_by(desc(ProductReview.created_at))
        
        # Get total count
        total_reviews = query.count()
        
        # Pagination
        reviews = query.offset((page - 1) * limit).limit(limit).all()
        
        # Calculate average rating
        avg_rating = session.query(func.avg(ProductReview.rating)).filter_by(product_id=product_id).scalar() or 0
        
        # Rating distribution
        rating_distribution = session.query(
            ProductReview.rating,
            func.count(ProductReview.id)
        ).filter_by(product_id=product_id).group_by(ProductReview.rating).all()
        
        distribution = {str(i): 0 for i in range(1, 6)}
        for rating, count in rating_distribution:
            distribution[str(rating)] = count
        
        reviews_data = [
            {
                "id": review.id,
                "rating": review.rating,
                "review_text": review.review_text,
                "buyer_name": review.buyer.name,
                "created_at": review.created_at.isoformat(),
                "helpful_count": 0  # TODO: Add helpful votes feature
            }
            for review in reviews
        ]
        
        return jsonify({
            "reviews": reviews_data,
            "summary": {
                "average_rating": round(avg_rating, 2),
                "total_reviews": total_reviews,
                "rating_distribution": distribution
            },
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_reviews,
                "pages": (total_reviews + limit - 1) // limit
            }
        })


@bp.get("/farmers/<int:farmer_id>")
def get_farmer_reviews(farmer_id: int):
    """Get reviews for a specific farmer"""
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 10, type=int), 50)
    
    for db in get_db():
        session: Session = db
        
        query = session.query(FarmerReview).filter_by(farmer_id=farmer_id)
        query = query.order_by(desc(FarmerReview.created_at))
        
        # Get total count
        total_reviews = query.count()
        
        # Pagination
        reviews = query.offset((page - 1) * limit).limit(limit).all()
        
        # Calculate average rating
        avg_rating = session.query(func.avg(FarmerReview.rating)).filter_by(farmer_id=farmer_id).scalar() or 0
        
        reviews_data = [
            {
                "id": review.id,
                "rating": review.rating,
                "review_text": review.review_text,
                "buyer_name": review.buyer.name,
                "created_at": review.created_at.isoformat()
            }
            for review in reviews
        ]
        
        return jsonify({
            "reviews": reviews_data,
            "summary": {
                "average_rating": round(avg_rating, 2),
                "total_reviews": total_reviews
            },
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_reviews,
                "pages": (total_reviews + limit - 1) // limit
            }
        })


@bp.get("/my-reviews")
@jwt_required()
def get_my_reviews():
    """Get current user's reviews"""
    user_id = int(get_jwt_identity())
    review_type = request.args.get("type", "all")  # all, products, farmers
    
    for db in get_db():
        session: Session = db
        
        reviews_data = []
        
        if review_type in ["all", "products"]:
            product_reviews = session.query(ProductReview).filter_by(buyer_id=user_id).order_by(
                desc(ProductReview.created_at)
            ).all()
            
            for review in product_reviews:
                reviews_data.append({
                    "id": review.id,
                    "type": "product",
                    "rating": review.rating,
                    "review_text": review.review_text,
                    "created_at": review.created_at.isoformat(),
                    "product": {
                        "id": review.product.id,
                        "name": review.product.title,
                        "image": review.product.image_url
                    }
                })
        
        if review_type in ["all", "farmers"]:
            farmer_reviews = session.query(FarmerReview).filter_by(buyer_id=user_id).order_by(
                desc(FarmerReview.created_at)
            ).all()
            
            for review in farmer_reviews:
                reviews_data.append({
                    "id": review.id,
                    "type": "farmer",
                    "rating": review.rating,
                    "review_text": review.review_text,
                    "created_at": review.created_at.isoformat(),
                    "farmer": {
                        "id": review.farmer.id,
                        "name": review.farmer.name
                    }
                })
        
        # Sort by created_at if mixing types
        if review_type == "all":
            reviews_data.sort(key=lambda x: x["created_at"], reverse=True)
        
        return jsonify({"reviews": reviews_data})


@bp.put("/<int:review_id>")
@jwt_required()
def update_review(review_id: int):
    """Update a review (product or farmer)"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    rating = data.get('rating', type=int)
    review_text = data.get('review_text', '').strip()
    
    if rating and (rating < 1 or rating > 5):
        return jsonify({"error": "Rating must be between 1 and 5"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Try to find product review first
        review = session.query(ProductReview).filter_by(id=review_id, buyer_id=user_id).first()
        review_type = "product"
        
        if not review:
            # Try farmer review
            review = session.query(FarmerReview).filter_by(id=review_id, buyer_id=user_id).first()
            review_type = "farmer"
        
        if not review:
            return jsonify({"error": "Review not found"}), 404
        
        # Update fields if provided
        if rating:
            review.rating = rating
        if review_text:
            review.review_text = review_text
        
        session.commit()
        
        return jsonify({
            "message": f"{review_type.title()} review updated successfully"
        })


@bp.delete("/<int:review_id>")
@jwt_required()
def delete_review(review_id: int):
    """Delete a review"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        # Try to find product review first
        review = session.query(ProductReview).filter_by(id=review_id, buyer_id=user_id).first()
        review_type = "product"
        
        if not review:
            # Try farmer review
            review = session.query(FarmerReview).filter_by(id=review_id, buyer_id=user_id).first()
            review_type = "farmer"
        
        if not review:
            return jsonify({"error": "Review not found"}), 404
        
        session.delete(review)
        session.commit()
        
        return jsonify({
            "message": f"{review_type.title()} review deleted successfully"
        })


# Communication/Chat System
@bp.post("/conversations")
@jwt_required()
def start_conversation():
    """Start a conversation between customer and farmer"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    other_user_id = data.get('other_user_id', type=int)
    product_id = data.get('product_id', type=int)
    initial_message = data.get('message', '').strip()
    
    if not other_user_id:
        return jsonify({"error": "Other user ID required"}), 400
    
    if not initial_message:
        return jsonify({"error": "Initial message required"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Verify other user exists and has appropriate role
        other_user = session.query(User).filter_by(id=other_user_id).first()
        current_user = session.query(User).filter_by(id=user_id).first()
        
        if not other_user:
            return jsonify({"error": "User not found"}), 404
        
        # Determine farmer and customer
        if current_user.role == "farmer" and other_user.role == "customer":
            farmer_id, customer_id = user_id, other_user_id
        elif current_user.role == "customer" and other_user.role == "farmer":
            farmer_id, customer_id = other_user_id, user_id
        else:
            return jsonify({"error": "Conversations only allowed between farmers and customers"}), 400
        
        # Check if conversation already exists
        existing_conversation = session.query(Conversation).filter(
            and_(
                Conversation.farmer_id == farmer_id,
                Conversation.customer_id == customer_id,
                Conversation.product_id == product_id if product_id else Conversation.product_id.is_(None),
                Conversation.is_active == True
            )
        ).first()
        
        if existing_conversation:
            conversation = existing_conversation
        else:
            # Create new conversation
            conversation = Conversation(
                farmer_id=farmer_id,
                customer_id=customer_id,
                product_id=product_id,
                is_active=True
            )
            session.add(conversation)
            session.flush()
        
        # Add initial message
        message = Message(
            conversation_id=conversation.id,
            sender_id=user_id,
            message_text=initial_message,
            is_read=False
        )
        session.add(message)
        
        session.commit()
        
        return jsonify({
            "conversation_id": conversation.id,
            "message": "Conversation started successfully"
        })


@bp.get("/conversations")
@jwt_required()
def get_conversations():
    """Get user's conversations"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        current_user = session.query(User).filter_by(id=user_id).first()
        
        if current_user.role == "farmer":
            conversations = session.query(Conversation).filter_by(
                farmer_id=user_id, is_active=True
            ).order_by(desc(Conversation.updated_at)).all()
        else:  # customer
            conversations = session.query(Conversation).filter_by(
                customer_id=user_id, is_active=True
            ).order_by(desc(Conversation.updated_at)).all()
        
        conversations_data = []
        for conv in conversations:
            # Get last message
            last_message = session.query(Message).filter_by(
                conversation_id=conv.id
            ).order_by(desc(Message.created_at)).first()
            
            # Get unread message count
            unread_count = session.query(Message).filter(
                and_(
                    Message.conversation_id == conv.id,
                    Message.sender_id != user_id,
                    Message.is_read == False
                )
            ).count()
            
            # Get other participant
            other_user = conv.customer if current_user.role == "farmer" else conv.farmer
            
            conversations_data.append({
                "id": conv.id,
                "other_user": {
                    "id": other_user.id,
                    "name": other_user.name,
                    "role": other_user.role
                },
                "product": {
                    "id": conv.product.id,
                    "name": conv.product.title,
                    "image": conv.product.image_url
                } if conv.product else None,
                "last_message": {
                    "text": last_message.message_text if last_message else "",
                    "sender_name": last_message.sender.name if last_message else "",
                    "created_at": last_message.created_at.isoformat() if last_message else conv.created_at.isoformat()
                },
                "unread_count": unread_count,
                "updated_at": conv.updated_at.isoformat()
            })
        
        return jsonify({"conversations": conversations_data})


@bp.get("/conversations/<int:conversation_id>/messages")
@jwt_required()
def get_messages(conversation_id: int):
    """Get messages in a conversation"""
    user_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 50, type=int), 100)
    
    for db in get_db():
        session: Session = db
        
        # Verify user is part of this conversation
        conversation = session.query(Conversation).filter(
            and_(
                Conversation.id == conversation_id,
                or_(
                    Conversation.farmer_id == user_id,
                    Conversation.customer_id == user_id
                )
            )
        ).first()
        
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404
        
        # Get messages
        query = session.query(Message).filter_by(conversation_id=conversation_id)
        query = query.order_by(desc(Message.created_at))
        
        total_messages = query.count()
        messages = query.offset((page - 1) * limit).limit(limit).all()
        
        # Mark messages as read
        session.query(Message).filter(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.is_read == False
            )
        ).update({"is_read": True})
        
        session.commit()
        
        messages_data = [
            {
                "id": msg.id,
                "message_text": msg.message_text,
                "sender": {
                    "id": msg.sender.id,
                    "name": msg.sender.name,
                    "is_me": msg.sender_id == user_id
                },
                "created_at": msg.created_at.isoformat(),
                "is_read": msg.is_read
            }
            for msg in reversed(messages)  # Reverse to show oldest first
        ]
        
        return jsonify({
            "messages": messages_data,
            "conversation": {
                "id": conversation.id,
                "product": {
                    "id": conversation.product.id,
                    "name": conversation.product.title
                } if conversation.product else None
            },
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_messages,
                "pages": (total_messages + limit - 1) // limit
            }
        })


@bp.post("/conversations/<int:conversation_id>/messages")
@jwt_required()
def send_message(conversation_id: int):
    """Send a message in a conversation"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    message_text = data.get('message', '').strip()
    
    if not message_text:
        return jsonify({"error": "Message text required"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Verify user is part of this conversation
        conversation = session.query(Conversation).filter(
            and_(
                Conversation.id == conversation_id,
                or_(
                    Conversation.farmer_id == user_id,
                    Conversation.customer_id == user_id
                )
            )
        ).first()
        
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404
        
        # Create message
        message = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            message_text=message_text,
            is_read=False
        )
        
        session.add(message)
        
        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        
        session.commit()
        
        return jsonify({
            "message_id": message.id,
            "message": "Message sent successfully"
        })