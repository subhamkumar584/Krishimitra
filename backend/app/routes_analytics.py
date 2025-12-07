from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case, extract, text, cast, Integer
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from typing import Dict, List

from .db import get_db
from .models import (
    User, Product, Order, OrderStatus, OrderItem,
    ProductReview, FarmerReview, ColdStorageBooking,
    EquipmentBooking, ColdStorage, Equipment
)
from .auth import role_required

bp = Blueprint("analytics", __name__, url_prefix="/api/v1/analytics")


@bp.get("/dashboard")
@jwt_required()
def get_dashboard_stats():
    """Get dashboard statistics based on user role"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        current_user = session.query(User).filter_by(id=user_id).first()
        
        if current_user.role == "farmer":
            return _get_farmer_dashboard(session, user_id)
        elif current_user.role == "customer":
            return _get_customer_dashboard(session, user_id)
        elif current_user.role == "admin":
            return _get_admin_dashboard(session)
        else:
            return jsonify({"error": "Invalid user role"}), 400


def _get_farmer_dashboard(session: Session, farmer_id: int) -> Dict:
    """Get farmer dashboard statistics"""
    now = datetime.utcnow()
    last_30_days = now - timedelta(days=30)
    last_7_days = now - timedelta(days=7)
    
    # Product statistics
    total_products = session.query(Product).filter_by(seller_id=farmer_id).count()
    active_products = session.query(Product).filter_by(
        seller_id=farmer_id, is_available=True
    ).count()
    
    # Order statistics
    total_orders = session.query(Order).filter_by(seller_id=farmer_id).count()
    pending_orders = session.query(Order).filter_by(
        seller_id=farmer_id, status=OrderStatus.PENDING
    ).count()
    
    # Revenue calculations
    revenue_30_days = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        and_(
            Order.seller_id == farmer_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
            Order.created_at >= last_30_days
        )
    ).scalar() or 0
    
    revenue_7_days = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        and_(
            Order.seller_id == farmer_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
            Order.created_at >= last_7_days
        )
    ).scalar() or 0
    
    # Review statistics
    avg_rating = session.query(func.avg(FarmerReview.rating)).filter_by(
        farmer_id=farmer_id
    ).scalar() or 0
    
    total_reviews = session.query(FarmerReview).filter_by(farmer_id=farmer_id).count()
    
    # Recent orders
    recent_orders = session.query(Order).filter_by(seller_id=farmer_id).order_by(
        desc(Order.created_at)
    ).limit(5).all()
    
    recent_orders_data = [
        {
            "id": order.id,
            "buyer_name": order.buyer.name,
            "total_amount": float(order.total_amount),
            "status": order.status.value,
            "created_at": order.created_at.isoformat(),
            "items_count": len(order.items)
        }
        for order in recent_orders
    ]
    
    # Top selling products
    top_products = session.query(
        Product.id,
        Product.title,
        func.count(OrderItem.id).label('order_count'),
        func.sum(OrderItem.quantity).label('total_quantity')
    ).join(OrderItem).join(Order).filter(
        and_(
            Product.seller_id == farmer_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
        )
    ).group_by(Product.id, Product.title).order_by(
        desc('total_quantity')
    ).limit(5).all()
    
    top_products_data = [
        {
            "id": product.id,
            "name": product.title,
            "orders_count": product.order_count,
            "total_sold": product.total_quantity
        }
        for product in top_products
    ]
    
    return {
        "overview": {
            "total_products": total_products,
            "active_products": active_products,
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "revenue_30_days": float(revenue_30_days),
            "revenue_7_days": float(revenue_7_days),
            "average_rating": round(float(avg_rating), 2),
            "total_reviews": total_reviews
        },
        "recent_orders": recent_orders_data,
        "top_products": top_products_data
    }


def _get_customer_dashboard(session: Session, customer_id: int) -> Dict:
    """Get customer dashboard statistics"""
    now = datetime.utcnow()
    last_30_days = now - timedelta(days=30)
    
    # Order statistics
    total_orders = session.query(Order).filter_by(buyer_id=customer_id).count()
    pending_orders = session.query(Order).filter_by(
        buyer_id=customer_id, status=OrderStatus.PENDING
    ).count()
    
    # Spending statistics
    total_spent = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        and_(
            Order.buyer_id == customer_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
        )
    ).scalar() or 0
    
    spent_30_days = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        and_(
            Order.buyer_id == customer_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
            Order.created_at >= last_30_days
        )
    ).scalar() or 0
    
    # Review statistics
    reviews_given = session.query(ProductReview).filter_by(buyer_id=customer_id).count()
    
    # Recent orders
    recent_orders = session.query(Order).filter_by(buyer_id=customer_id).order_by(
        desc(Order.created_at)
    ).limit(5).all()
    
    recent_orders_data = [
        {
            "id": order.id,
            "seller_name": order.seller.name,
            "total_amount": float(order.total_amount),
            "status": order.status.value,
            "created_at": order.created_at.isoformat(),
            "items_count": len(order.items)
        }
        for order in recent_orders
    ]
    
    # Favorite categories (most ordered)
    favorite_categories = session.query(
        Product.category,
        func.count(OrderItem.id).label('order_count')
    ).join(OrderItem).join(Order).filter(
        and_(
            Order.buyer_id == customer_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
        )
    ).group_by(Product.category).order_by(desc('order_count')).limit(5).all()
    
    favorite_categories_data = [
        {
            "category": cat.category,
            "orders_count": cat.order_count
        }
        for cat in favorite_categories
    ]
    
    return {
        "overview": {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "total_spent": float(total_spent),
            "spent_30_days": float(spent_30_days),
            "reviews_given": reviews_given
        },
        "recent_orders": recent_orders_data,
        "favorite_categories": favorite_categories_data
    }


def _get_admin_dashboard(session: Session) -> Dict:
    """Get admin dashboard statistics"""
    now = datetime.utcnow()
    last_30_days = now - timedelta(days=30)
    
    # User statistics
    total_users = session.query(User).count()
    farmers_count = session.query(User).filter_by(role="farmer").count()
    customers_count = session.query(User).filter_by(role="customer").count()
    
    new_users_30_days = session.query(User).filter(
        User.created_at >= last_30_days
    ).count()
    
    # Product statistics
    total_products = session.query(Product).count()
    active_products = session.query(Product).filter_by(is_available=True).count()
    
    # Order statistics
    total_orders = session.query(Order).count()
    pending_orders = session.query(Order).filter_by(status=OrderStatus.PENDING).count()
    
    # Revenue statistics
    total_revenue = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
    ).scalar() or 0
    
    revenue_30_days = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        and_(
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
            Order.created_at >= last_30_days
        )
    ).scalar() or 0
    
    # Cold storage statistics
    total_facilities = session.query(ColdStorage).count()
    active_facilities = session.query(ColdStorage).filter_by(
        is_active=True
    ).count()
    
    # Equipment statistics
    total_equipment = session.query(Equipment).count()
    available_equipment = session.query(Equipment).filter_by(
        availability=True
    ).count()
    
    return {
        "overview": {
            "total_users": total_users,
            "farmers_count": farmers_count,
            "customers_count": customers_count,
            "new_users_30_days": new_users_30_days,
            "total_products": total_products,
            "active_products": active_products,
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "total_revenue": float(total_revenue),
            "revenue_30_days": float(revenue_30_days),
            "total_facilities": total_facilities,
            "active_facilities": active_facilities,
            "total_equipment": total_equipment,
            "available_equipment": available_equipment
        }
    }


@bp.get("/sales-report")
@jwt_required()
@role_required("farmer")
def get_sales_report():
    """Get detailed sales report for farmers"""
    user_id = int(get_jwt_identity())
    period = request.args.get("period", "30")  # 7, 30, 90, 365 days
    
    try:
        days = int(period)
    except ValueError:
        days = 30
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    for db in get_db():
        session: Session = db
        
        # Daily sales data
        daily_sales = session.query(
            func.date(Order.created_at).label('date'),
            func.count(Order.id).label('orders_count'),
            func.coalesce(func.sum(Order.total_amount), 0).label('revenue')
        ).filter(
            and_(
                Order.seller_id == user_id,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
                Order.created_at >= start_date
            )
        ).group_by(func.date(Order.created_at)).order_by('date').all()
        
        daily_sales_data = [
            {
                "date": sale.date.isoformat(),
                "orders": sale.orders_count,
                "revenue": float(sale.revenue)
            }
            for sale in daily_sales
        ]
        
        # Product performance
        product_performance = session.query(
            Product.id,
            Product.title,
            Product.category,
            func.count(OrderItem.id).label('orders_count'),
            func.sum(OrderItem.quantity).label('quantity_sold'),
            func.sum(OrderItem.price * OrderItem.quantity).label('revenue')
        ).join(OrderItem).join(Order).filter(
            and_(
                Product.seller_id == user_id,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
                Order.created_at >= start_date
            )
        ).group_by(Product.id, Product.title, Product.category).order_by(
            desc('revenue')
        ).all()
        
        product_performance_data = [
            {
                "id": product.id,
                "name": product.title,
                "category": product.category,
                "orders_count": product.orders_count,
                "quantity_sold": product.quantity_sold,
                "revenue": float(product.revenue)
            }
            for product in product_performance
        ]
        
        # Category breakdown
        category_breakdown = session.query(
            Product.category,
            func.count(OrderItem.id).label('orders_count'),
            func.sum(OrderItem.quantity).label('quantity_sold'),
            func.sum(OrderItem.price * OrderItem.quantity).label('revenue')
        ).join(OrderItem).join(Order).filter(
            and_(
                Product.seller_id == user_id,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
                Order.created_at >= start_date
            )
        ).group_by(Product.category).order_by(desc('revenue')).all()
        
        category_breakdown_data = [
            {
                "category": cat.category,
                "orders_count": cat.orders_count,
                "quantity_sold": cat.quantity_sold,
                "revenue": float(cat.revenue)
            }
            for cat in category_breakdown
        ]
        
        # Summary statistics
        total_revenue = sum(sale.revenue for sale in daily_sales_data)
        total_orders = sum(sale.orders for sale in daily_sales_data)
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        return jsonify({
            "period_days": days,
            "summary": {
                "total_revenue": total_revenue,
                "total_orders": total_orders,
                "average_order_value": avg_order_value
            },
            "daily_sales": daily_sales_data,
            "product_performance": product_performance_data,
            "category_breakdown": category_breakdown_data
        })


@bp.get("/customer-insights")
@jwt_required()
@role_required("farmer")
def get_customer_insights():
    """Get customer insights for farmers"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        # Top customers by revenue
        top_customers = session.query(
            User.id,
            User.name,
            User.email,
            func.count(Order.id).label('orders_count'),
            func.sum(Order.total_amount).label('total_spent'),
            func.max(Order.created_at).label('last_order_date')
        ).join(Order, User.id == Order.buyer_id).filter(
            and_(
                Order.seller_id == user_id,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
            )
        ).group_by(User.id, User.name, User.email).order_by(
            desc('total_spent')
        ).limit(10).all()
        
        top_customers_data = [
            {
                "id": customer.id,
                "name": customer.name,
                "email": customer.email,
                "orders_count": customer.orders_count,
                "total_spent": float(customer.total_spent),
                "last_order_date": customer.last_order_date.isoformat()
            }
            for customer in top_customers
        ]
        
        # Customer acquisition over time (monthly)
        customer_acquisition = session.query(
            extract('year', Order.created_at).label('year'),
            extract('month', Order.created_at).label('month'),
            func.count(func.distinct(Order.buyer_id)).label('new_customers')
        ).filter(
            Order.seller_id == user_id
        ).group_by(
            extract('year', Order.created_at),
            extract('month', Order.created_at)
        ).order_by('year', 'month').all()
        
        customer_acquisition_data = [
            {
                "year": int(data.year),
                "month": int(data.month),
                "new_customers": data.new_customers
            }
            for data in customer_acquisition
        ]
        
        # Customer geography (state-wise)
        customer_geography = session.query(
            User.state,
            func.count(func.distinct(User.id)).label('customers_count'),
            func.count(Order.id).label('orders_count'),
            func.sum(Order.total_amount).label('total_revenue')
        ).join(Order, User.id == Order.buyer_id).filter(
            and_(
                Order.seller_id == user_id,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
            )
        ).group_by(User.state).order_by(desc('total_revenue')).all()
        
        customer_geography_data = [
            {
                "state": geo.state or "Unknown",
                "customers_count": geo.customers_count,
                "orders_count": geo.orders_count,
                "total_revenue": float(geo.total_revenue)
            }
            for geo in customer_geography
        ]
        
        return jsonify({
            "top_customers": top_customers_data,
            "customer_acquisition": customer_acquisition_data,
            "customer_geography": customer_geography_data
        })


@bp.get("/market-trends")
@jwt_required()
def get_market_trends():
    """Get market trends and analytics"""
    category = request.args.get("category")
    state = request.args.get("state")
    period = request.args.get("period", "30")  # days
    
    try:
        days = int(period)
    except ValueError:
        days = 30
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    for db in get_db():
        session: Session = db
        
        # Build base query
        base_query = session.query(
            Product.category,
            func.avg(OrderItem.price).label('avg_price'),
            func.count(OrderItem.id).label('orders_count'),
            func.sum(OrderItem.quantity).label('total_quantity')
        ).join(OrderItem).join(Order).join(User, Order.buyer_id == User.id).filter(
            and_(
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
                Order.created_at >= start_date
            )
        )
        
        # Apply filters
        if category:
            base_query = base_query.filter(Product.category == category)
        if state:
            base_query = base_query.filter(User.state == state)
        
        # Group and order
        market_trends = base_query.group_by(Product.category).order_by(
            desc('orders_count')
        ).all()
        
        market_trends_data = [
            {
                "category": trend.category,
                "average_price": float(trend.avg_price),
                "orders_count": trend.orders_count,
                "total_quantity": trend.total_quantity,
                "demand_score": trend.orders_count * trend.total_quantity  # Simple demand metric
            }
            for trend in market_trends
        ]
        
        # Price trends over time for specific category
        price_trends_data = []
        if category:
            price_trends = session.query(
                func.date(Order.created_at).label('date'),
                func.avg(OrderItem.price).label('avg_price')
            ).join(OrderItem).join(Product).filter(
                and_(
                    Product.category == category,
                    Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED]),
                    Order.created_at >= start_date
                )
            ).group_by(func.date(Order.created_at)).order_by('date').all()
            
            price_trends_data = [
                {
                    "date": trend.date.isoformat(),
                    "average_price": float(trend.avg_price)
                }
                for trend in price_trends
            ]
        
        return jsonify({
            "market_trends": market_trends_data,
            "price_trends": price_trends_data,
            "filters": {
                "category": category,
                "state": state,
                "period_days": days
            }
        })


@bp.get("/performance-metrics")
@jwt_required()
@role_required("admin")
def get_performance_metrics():
    """Get platform performance metrics for admins"""
    period = request.args.get("period", "30")  # days
    
    try:
        days = int(period)
    except ValueError:
        days = 30
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    for db in get_db():
        session: Session = db
        
        # Order conversion metrics
        total_orders = session.query(Order).filter(
            Order.created_at >= start_date
        ).count()
        
        successful_orders = session.query(Order).filter(
            and_(
                Order.created_at >= start_date,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
            )
        ).count()
        
        conversion_rate = (successful_orders / total_orders * 100) if total_orders > 0 else 0
        
        # Revenue metrics
        total_revenue = session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
            and_(
                Order.created_at >= start_date,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
            )
        ).scalar() or 0
        
        # User engagement metrics
        active_farmers = session.query(func.count(func.distinct(Order.seller_id))).filter(
            Order.created_at >= start_date
        ).scalar() or 0
        
        active_customers = session.query(func.count(func.distinct(Order.buyer_id))).filter(
            Order.created_at >= start_date
        ).scalar() or 0
        
        # Product metrics
        products_sold = session.query(func.count(func.distinct(OrderItem.product_id))).join(Order).filter(
            and_(
                Order.created_at >= start_date,
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.COMPLETED])
            )
        ).scalar() or 0
        
        # Review metrics
        reviews_count = session.query(ProductReview).filter(
            ProductReview.created_at >= start_date
        ).count()
        
        avg_product_rating = session.query(func.avg(ProductReview.rating)).filter(
            ProductReview.created_at >= start_date
        ).scalar() or 0
        
        # Cold storage utilization
        cs_bookings = session.query(ColdStorageBooking).filter(
            ColdStorageBooking.start_date >= start_date.date()
        ).count()
        
        # Equipment utilization
        eq_bookings = session.query(EquipmentBooking).filter(
            EquipmentBooking.start_datetime >= start_date
        ).count()
        
        return jsonify({
            "period_days": days,
            "order_metrics": {
                "total_orders": total_orders,
                "successful_orders": successful_orders,
                "conversion_rate": round(conversion_rate, 2)
            },
            "revenue_metrics": {
                "total_revenue": float(total_revenue),
                "average_order_value": float(total_revenue / successful_orders) if successful_orders > 0 else 0
            },
            "user_engagement": {
                "active_farmers": active_farmers,
                "active_customers": active_customers
            },
            "product_metrics": {
                "products_sold": products_sold,
                "reviews_count": reviews_count,
                "average_rating": round(float(avg_product_rating), 2)
            },
            "service_utilization": {
                "cold_storage_bookings": cs_bookings,
                "equipment_bookings": eq_bookings
            }
        })