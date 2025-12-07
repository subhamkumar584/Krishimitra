from flask import Blueprint, request, jsonify
import razorpay
import hmac
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from .db import get_db
from .models import (
    Order, OrderItem, CartItem, Product, User, 
    OrderStatus, PaymentStatus, 
    ColdStorageBooking, EquipmentBooking, BookingStatus,
    PaymentSession
)
from .auth import role_required
from .config import settings

bp = Blueprint("payments", __name__, url_prefix="/api/v1/payments")

# Initialize Razorpay client only if enabled
razorpay_client = None
if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(
        settings.RAZORPAY_KEY_ID,
        settings.RAZORPAY_KEY_SECRET
    ))


@bp.post("/create-order")
@jwt_required()
def create_razorpay_order():
    """Create Razorpay order for marketplace purchase"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    order_type = data.get('type', 'marketplace')  # marketplace, cold_storage, equipment
    
    for db in get_db():
        session: Session = db
        
        if order_type == 'marketplace':
            return create_marketplace_order(session, user_id, data)
        elif order_type == 'cold_storage':
            return create_cold_storage_order(session, user_id, data)
        elif order_type == 'equipment':
            return create_equipment_order(session, user_id, data)
        else:
            return jsonify({"error": "Invalid order type"}), 400


def create_marketplace_order(session: Session, user_id: int, data: dict):
    """Prepare Razorpay order for marketplace purchase WITHOUT creating DB orders yet.
    Orders will be created after payment is verified.
    """
    try:
        # Get cart items
        cart_items = session.query(CartItem).filter_by(user_id=user_id).all()
        if not cart_items:
            return jsonify({"error": "Cart is empty"}), 400

        # Group items by seller and compute totals
        seller_orders: dict[int, dict] = {}
        for cart_item in cart_items:
            seller_id = cart_item.product.seller_id
            if seller_id not in seller_orders:
                seller_orders[seller_id] = {
                    'items': [],
                    'subtotal': 0.0,
                    'delivery_charges': 50.0,
                }
            item_total = float(cart_item.quantity) * float(cart_item.product.price)
            seller_orders[seller_id]['items'].append({
                'product_id': cart_item.product_id,
                'quantity': cart_item.quantity,
                'price_per_unit': cart_item.product.price,
                'total_price': item_total,
                'product_title': cart_item.product.title,
            })
            seller_orders[seller_id]['subtotal'] += item_total

        total_amount = 0.0
        for _, order_data in seller_orders.items():
            total_amount += order_data['subtotal'] + order_data['delivery_charges']

        # Create Razorpay order (skip in dev if keys missing)
        if razorpay_client is not None and settings.RAZORPAY_ENABLED:
            razorpay_order = razorpay_client.order.create({
                'amount': int(total_amount * 100),  # Convert to paise
                'currency': 'INR',
                'receipt': f'order_rcptid_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
                'payment_capture': '1'
            })
            order_id_value = razorpay_order['id']
        else:
            # Dev mode: no external payment, generate a fake order id
            order_id_value = f"order_DEV_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Persist a payment session mapping the razorpay order to the buyer and cart snapshot
        session_obj = PaymentSession(
            buyer_id=user_id,
            razorpay_order_id=order_id_value,
            currency='INR',
            amount=total_amount,
            cart_snapshot={
                'delivery_address': data.get('delivery_address'),
                'delivery_phone': data.get('delivery_phone'),
                'sellers': {
                    str(seller_id): {
                        'subtotal': v['subtotal'],
                        'delivery_charges': v['delivery_charges'],
                        'items': v['items'],
                    } for seller_id, v in seller_orders.items()
                }
            }
        )
        session.add(session_obj)
        session.commit()

        return jsonify({
            "success": True,
            "razorpay_order_id": order_id_value,
            "amount": total_amount,
            "currency": "INR",
            "key": settings.RAZORPAY_KEY_ID
        })

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500


def create_equipment_order(session: Session, user_id: int, data: dict):
    """Prepare Razorpay order for an equipment booking (pay-first flow).
    Validates availability and stores a payment session snapshot to create the booking after payment.
    """
    try:
        equipment_id = data.get('equipment_id')
        start_dt_str = data.get('start_datetime')
        end_dt_str = data.get('end_datetime')
        if not all([equipment_id, start_dt_str, end_dt_str]):
            return jsonify({"error": "equipment_id, start_datetime and end_datetime are required"}), 400

        from datetime import datetime as _dt
        try:
            start_dt = _dt.fromisoformat(str(start_dt_str).replace('Z', '+00:00'))
            end_dt = _dt.fromisoformat(str(end_dt_str).replace('Z', '+00:00'))
        except Exception:
            return jsonify({"error": "Invalid datetime format"}), 400
        if start_dt >= end_dt:
            return jsonify({"error": "Start time must be before end time"}), 400
        if start_dt < _dt.utcnow():
            return jsonify({"error": "Start time cannot be in the past"}), 400

        # Fetch equipment
        from .models import Equipment
        equipment = session.query(Equipment).filter_by(id=int(equipment_id), availability=True).first()
        if not equipment:
            return jsonify({"error": "Equipment not found or unavailable"}), 404

        # Check for overlapping bookings
        overlap = session.query(EquipmentBooking).filter(
            and_(
                EquipmentBooking.equipment_id == equipment.id,
                EquipmentBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                or_(
                    and_(EquipmentBooking.start_datetime <= start_dt, EquipmentBooking.end_datetime > start_dt),
                    and_(EquipmentBooking.start_datetime < end_dt, EquipmentBooking.end_datetime >= end_dt),
                    and_(EquipmentBooking.start_datetime >= start_dt, EquipmentBooking.end_datetime <= end_dt)
                )
            )
        ).first()
        if overlap:
            return jsonify({"error": "Equipment is already booked during this time period"}), 400

        # Calculate amount
        duration_hours = (end_dt - start_dt).total_seconds() / 3600
        if duration_hours > 8 and equipment.rate_per_day:
            import math
            days = math.ceil(duration_hours / 24)
            total_amount = days * float(equipment.rate_per_day or 0)
        else:
            total_amount = duration_hours * float(equipment.rate_per_hour or 0)

        # Create Razorpay order (or dev fake id)
        if razorpay_client is not None and settings.RAZORPAY_ENABLED:
            rp_order = razorpay_client.order.create({
                'amount': int(total_amount * 100),
                'currency': 'INR',
                'receipt': f'eq_order_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
                'payment_capture': '1'
            })
            rp_order_id = rp_order['id']
        else:
            rp_order_id = f"order_DEV_EQ_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Save payment session snapshot
        session_obj = PaymentSession(
            buyer_id=user_id,
            razorpay_order_id=rp_order_id,
            currency='INR',
            amount=total_amount,
            cart_snapshot={
                'type': 'equipment',
                'equipment_id': equipment.id,
                'seller_id': equipment.owner_id,
                'start_datetime': start_dt.isoformat(),
                'end_datetime': end_dt.isoformat(),
                'rate_per_hour': float(equipment.rate_per_hour or 0),
                'rate_per_day': float(equipment.rate_per_day or 0),
                'total_amount': float(total_amount),
            }
        )
        session.add(session_obj)
        session.commit()

        return jsonify({
            'success': True,
            'razorpay_order_id': rp_order_id,
            'amount': total_amount,
            'currency': 'INR',
            'key': settings.RAZORPAY_KEY_ID
        })
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.post("/verify-payment")
@jwt_required()
def verify_payment():
    """Verify Razorpay payment signature and CREATE orders from the buyer's cart snapshot.
    After payment success: create seller-specific orders with status CONFIRMED (awaiting seller approval),
    then clear the buyer's cart.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_signature = data.get('razorpay_signature')
    
    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return jsonify({"error": "Missing payment details"}), 400
    
    try:
        # Verify signature
        generated_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != razorpay_signature:
            return jsonify({"error": "Invalid payment signature"}), 400
        
        for db in get_db():
            session: Session = db

            # Retrieve payment session
            ps = session.query(PaymentSession).filter_by(razorpay_order_id=razorpay_order_id, buyer_id=user_id).first()
            if not ps:
                return jsonify({"error": "Payment session not found"}), 404

            cart_snapshot = ps.cart_snapshot or {}

            # Branch by session type
            if cart_snapshot.get('type') == 'equipment':
                # Create equipment booking
                try:
                    eq_id = int(cart_snapshot.get('equipment_id'))
                    start_dt = datetime.fromisoformat(str(cart_snapshot.get('start_datetime')).replace('Z', '+00:00'))
                    end_dt = datetime.fromisoformat(str(cart_snapshot.get('end_datetime')).replace('Z', '+00:00'))
                    total_amount = float(cart_snapshot.get('total_amount') or 0.0)

                    # Optional re-check for overlap
                    overlap = session.query(EquipmentBooking).filter(
                        and_(
                            EquipmentBooking.equipment_id == eq_id,
                            EquipmentBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                            or_(
                                and_(EquipmentBooking.start_datetime <= start_dt, EquipmentBooking.end_datetime > start_dt),
                                and_(EquipmentBooking.start_datetime < end_dt, EquipmentBooking.end_datetime >= end_dt),
                                and_(EquipmentBooking.start_datetime >= start_dt, EquipmentBooking.end_datetime <= end_dt)
                            )
                        )
                    ).first()
                    if overlap:
                        # Booking conflict after payment (rare) -> return error; refunds handled off-platform
                        return jsonify({"error": "Booking conflict detected after payment. Please contact support."}), 409

                    duration_hours = (end_dt - start_dt).total_seconds() / 3600
                    rate_used = float(cart_snapshot.get('rate_per_hour') or 0.0)
                    if duration_hours > 8 and float(cart_snapshot.get('rate_per_day') or 0.0) > 0:
                        rate_used = float(cart_snapshot.get('rate_per_day') or 0.0)

                    booking = EquipmentBooking(
                        farmer_id=user_id,
                        equipment_id=eq_id,
                        start_datetime=start_dt,
                        end_datetime=end_dt,
                        status=BookingStatus.PENDING,
                        total_hours=duration_hours,
                        rate_per_hour=rate_used,
                        total_amount=total_amount,
                        payment_status=PaymentStatus.CAPTURED,
                    )
                    session.add(booking)
                    # Clean up session
                    session.delete(ps)
                    session.commit()
                    return jsonify({
                        "success": True,
                        "message": "Payment verified and equipment booking created",
                        "booking_id": booking.id
                    })
                except Exception as e:
                    session.rollback()
                    return jsonify({"error": str(e)}), 500

            # Default: marketplace orders
            sellers = cart_snapshot.get('sellers') or {}
            created_ids = []

            # Create per-seller orders
            for seller_id_str, payload in sellers.items():
                try:
                    seller_id = int(seller_id_str)
                except Exception:
                    continue
                subtotal = float(payload.get('subtotal') or 0.0)
                delivery_charges = float(payload.get('delivery_charges') or 0.0)
                order_total = subtotal + delivery_charges

                order = Order(
                    buyer_id=user_id,
                    seller_id=seller_id,
                    status=OrderStatus.CONFIRMED,  # Payment success; awaiting seller approval to ship
                    payment_status=PaymentStatus.CAPTURED,
                    subtotal=subtotal,
                    delivery_charges=delivery_charges,
                    total_amount=order_total,
                    delivery_address=cart_snapshot.get('delivery_address'),
                    delivery_phone=cart_snapshot.get('delivery_phone'),
                    razorpay_order_id=razorpay_order_id,
                    razorpay_payment_id=razorpay_payment_id,
                )
                session.add(order)
                session.flush()

                for item in (payload.get('items') or []):
                    order_item = OrderItem(
                        order_id=order.id,
                        product_id=int(item['product_id']),
                        quantity=float(item['quantity']),
                        price_per_unit=float(item['price_per_unit']),
                        total_price=float(item['total_price']),
                    )
                    session.add(order_item)

                created_ids.append(order.id)

            # Clear buyer cart and remove payment session
            session.query(CartItem).filter_by(user_id=user_id).delete()
            session.delete(ps)
            session.commit()

            return jsonify({
                "success": True,
                "message": "Payment verified and orders created",
                "orders": created_ids
            })
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.post("/webhook")
def webhook():
    """Handle Razorpay webhooks"""
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    webhook_signature = request.headers.get('X-Razorpay-Signature', '')
    webhook_body = request.get_data()
    
    # Verify webhook signature
    try:
        expected_signature = hmac.new(
            webhook_secret.encode('utf-8'),
            webhook_body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_signature, webhook_signature):
            return jsonify({"error": "Invalid webhook signature"}), 400
        
        # Process webhook data
        data = request.get_json()
        event = data.get('event')
        payload = data.get('payload', {}).get('payment', {}).get('entity', {})
        
        razorpay_order_id = payload.get('order_id')
        razorpay_payment_id = payload.get('id')
        status = payload.get('status')
        
        if not razorpay_order_id:
            return jsonify({"error": "Missing order ID"}), 400
        
        for db in get_db():
            session: Session = db
            
            if event == 'payment.captured':
                # If using deferred order creation, there may be no orders yet.
                # Optionally, mark any pre-created orders (legacy) as captured.
                orders = session.query(Order).filter_by(
                    razorpay_order_id=razorpay_order_id
                ).all()
                for order in orders:
                    order.payment_status = PaymentStatus.CAPTURED
                    order.razorpay_payment_id = razorpay_payment_id
                    order.status = OrderStatus.CONFIRMED

                # Clean up payment session if exists (orders will be created by client verify endpoint)
                ps = session.query(PaymentSession).filter_by(razorpay_order_id=razorpay_order_id).first()
                if ps:
                    # Do not delete here; verify endpoint will delete after creating orders.
                    pass
                session.commit()
                
            elif event == 'payment.failed':
                # Delete any pre-created orders (legacy) and cleanup payment session
                orders = session.query(Order).filter_by(
                    razorpay_order_id=razorpay_order_id
                ).all()
                for order in orders:
                    session.delete(order)
                ps = session.query(PaymentSession).filter_by(razorpay_order_id=razorpay_order_id).first()
                if ps:
                    session.delete(ps)
                session.commit()
        
        return jsonify({"status": "ok"}), 200
        
    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({"error": "Webhook processing failed"}), 500


@bp.get("/orders")
@jwt_required()
def get_user_orders():
    """Get user's orders (buyer or seller view)"""
    user_id = int(get_jwt_identity())
    role = request.args.get('role', 'buyer')  # buyer or seller
    
    for db in get_db():
        session: Session = db
        
        if role == 'buyer':
            orders = session.query(Order).filter_by(buyer_id=user_id).order_by(
                Order.created_at.desc()
            ).all()
        else:
            orders = session.query(Order).filter_by(seller_id=user_id).order_by(
                Order.created_at.desc()
            ).all()
        
        order_list = []
        for order in orders:
            order_items = []
            for item in order.items:
                order_items.append({
                    "product_id": item.product_id,
                    "product_name": item.product.title,
                    "quantity": item.quantity,
                    "price_per_unit": item.price_per_unit,
                    "total_price": item.total_price
                })
            
            order_list.append({
                "id": order.id,
                "created_at": order.created_at.isoformat(),
                "status": order.status.value,
                "payment_status": order.payment_status.value,
                "subtotal": order.subtotal,
                "delivery_charges": order.delivery_charges,
                "total_amount": order.total_amount,
                "buyer_name": order.buyer.name,
                "seller_name": order.seller.name,
                "delivery_address": order.delivery_address,
                "items": order_items
            })
        
        return jsonify({"orders": order_list})


@bp.get("/orders/<int:order_id>")
@jwt_required()
def get_order_detail(order_id: int):
    """Return order details only if authorized.
    - Buyer view (default): only the buyer who placed the order can view.
    - Seller view: only the seller who owns the order can view.
    - Admin: can view all.
    Pass ?role=buyer|seller (default buyer) to choose perspective.
    """
    user_id = int(get_jwt_identity())
    role_param = request.args.get('role', 'buyer')
    claims = get_jwt() or {}
    current_role = claims.get('role')

    for db in get_db():
        session: Session = db
        order = session.query(Order).filter_by(id=order_id).first()
        if not order:
            return jsonify({"error": "Order not found"}), 404

        # Authorization
        if current_role == 'admin':
            pass
        elif role_param == 'seller':
            if order.seller_id != user_id:
                return jsonify({"error": "forbidden"}), 403
        else:
            # buyer
            if order.buyer_id != user_id:
                return jsonify({"error": "forbidden"}), 403

        items = []
        for item in order.items:
            items.append({
                "product_id": item.product_id,
                "product_name": item.product.title,
                "quantity": item.quantity,
                "price_per_unit": item.price_per_unit,
                "total_price": item.total_price
            })
        return jsonify({
            "order": {
                "id": order.id,
                "created_at": order.created_at.isoformat(),
                "status": order.status.value,
                "payment_status": order.payment_status.value,
                "subtotal": order.subtotal,
                "delivery_charges": order.delivery_charges,
                "total_amount": order.total_amount,
                "buyer": {"id": order.buyer.id, "name": order.buyer.name} if order.buyer else None,
                "seller": {"id": order.seller.id, "name": order.seller.name} if order.seller else None,
                "delivery_address": order.delivery_address,
                "delivery_phone": order.delivery_phone,
                "items": items
            }
        })


@bp.post("/orders/<int:order_id>/approve")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def approve_order(order_id: int):
    """Seller approves an order; upon approval, mark the order as SHIPPED.
    Requires payment_status == CAPTURED and the seller must own the order (unless admin).
    """
    user_id = int(get_jwt_identity())
    for db in get_db():
        session: Session = db

        order = session.query(Order).filter_by(id=order_id).first()
        if not order:
            return jsonify({"error": "Order not found"}), 404

        # Only seller or admin can approve
        user: User | None = session.query(User).filter_by(id=user_id).first()
        if user is None:
            return jsonify({"error": "User not found"}), 404
        if user.role != 'admin' and order.seller_id != user_id:
            return jsonify({"error": "Not authorized"}), 403

        if order.payment_status != PaymentStatus.CAPTURED:
            return jsonify({"error": "Payment not captured yet"}), 400

        if order.status in (OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED):
            return jsonify({"error": f"Cannot approve order in status {order.status.value}"}), 400

        # Approve -> mark as SHIPPED
        order.status = OrderStatus.SHIPPED
        session.commit()
        return jsonify({"success": True, "order_id": order.id, "status": order.status.value})


@bp.post("/orders/<int:order_id>/reject")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def reject_order(order_id: int):
    """Seller rejects an order; set status to CANCELLED if not already shipped/delivered/cancelled."""
    user_id = int(get_jwt_identity())
    for db in get_db():
        session: Session = db

        order = session.query(Order).filter_by(id=order_id).first()
        if not order:
            return jsonify({"error": "Order not found"}), 404

        user: User | None = session.query(User).filter_by(id=user_id).first()
        if user is None:
            return jsonify({"error": "User not found"}), 404
        if user.role != 'admin' and order.seller_id != user_id:
            return jsonify({"error": "Not authorized"}), 403

        if order.status in (OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED):
            return jsonify({"error": f"Cannot reject order in status {order.status.value}"}), 400

        # Optional: only allow reject if payment captured; here we'll allow regardless and expect refund off-platform
        order.status = OrderStatus.CANCELLED
        session.commit()
        return jsonify({"success": True, "order_id": order.id, "status": order.status.value})
