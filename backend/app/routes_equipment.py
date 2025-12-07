from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
import math

from .db import get_db
from .models import (
    Equipment, EquipmentBooking, EquipmetalEquipment, User,
    BookingStatus, PaymentStatus
)
from .auth import role_required

bp = Blueprint("equipment", __name__, url_prefix="/api/v1/equipment")


@bp.get("")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def list_equipment():
    """Get list of equipment with filters"""
    # Search parameters
    category = request.args.get("category")  # tractor, harvester, drone, etc.
    location = request.args.get("location", "")
    max_rate_hourly = request.args.get("max_rate_hourly", type=float)
    max_rate_daily = request.args.get("max_rate_daily", type=float)
    available_only = request.args.get("available", "true").lower() == "true"
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    radius = request.args.get("radius", 30, type=int)  # km
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 20, type=int), 100)
    
    for db in get_db():
        session: Session = db
        
        # Base query
        query = session.query(Equipment)
        
        # Role-based scoping
        claims = get_jwt() or {}
        role = claims.get("role")
        uid = None
        try:
            uid = int(get_jwt_identity())
        except Exception:
            uid = None
        
        # Equipmetal can only see their own equipment; admin sees all; farmer sees all available by default
        if role == 'equipmetal' and uid:
            query = query.filter(Equipment.owner_id == uid)
        
        # Availability filter (only for non-equipmetal)
        if available_only and role != 'equipmetal':
            query = query.filter(Equipment.availability == True)
        
        # Category filter
        if category:
            query = query.filter(Equipment.category.like(f"%{category}%"))
        
        # Location filter
        if location:
            query = query.filter(Equipment.location.like(f"%{location}%"))
        
        # Rate filters
        if max_rate_hourly:
            query = query.filter(Equipment.rate_per_hour <= max_rate_hourly)
        
        if max_rate_daily:
            query = query.filter(Equipment.rate_per_day <= max_rate_daily)
        
        # Get all equipment first
        all_equipment = query.all()
        
        # Apply proximity filter if coordinates provided
        if lat and lon:
            nearby_equipment = []
            for equip in all_equipment:
                if equip.latitude and equip.longitude:
                    distance = calculate_distance(lat, lon, equip.latitude, equip.longitude)
                    if distance <= radius:
                        nearby_equipment.append((equip, distance))
                else:
                    # Include equipment without coordinates
                    nearby_equipment.append((equip, None))
            
            # Sort by distance
            nearby_equipment.sort(key=lambda x: x[1] if x[1] is not None else float('inf'))
            equipment_data = [
                {
                    "id": e.id,
                    "name": e.name,
                    "category": e.category,
                    "description": e.description,
                    "location": e.location,
                    "latitude": e.latitude,
                    "longitude": e.longitude,
                    "rate_per_hour": e.rate_per_hour,
                    "rate_per_day": e.rate_per_day,
                    "availability": e.availability,
                    "images": e.images or [],
                    "contact_phone": e.contact_phone,
                    "owner": {
                        "id": e.owner.id,
                        "name": e.owner.name
                    },
                    "distance_km": round(dist, 2) if dist is not None else None,
                    "created_at": e.created_at.isoformat()
                }
                for e, dist in nearby_equipment
            ]
        else:
            equipment_data = [
                {
                    "id": e.id,
                    "name": e.name,
                    "category": e.category,
                    "description": e.description,
                    "location": e.location,
                    "latitude": e.latitude,
                    "longitude": e.longitude,
                    "rate_per_hour": e.rate_per_hour,
                    "rate_per_day": e.rate_per_day,
                    "availability": e.availability,
                    "images": e.images or [],
                    "contact_phone": e.contact_phone,
                    "owner": {
                        "id": e.owner.id,
                        "name": e.owner.name
                    },
                    "created_at": e.created_at.isoformat()
                }
                for e in all_equipment
            ]
        
        # Pagination
        total_count = len(equipment_data)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_equipment = equipment_data[start_idx:end_idx]
        
        return jsonify({
            "equipment": paginated_equipment,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        })


@bp.get("/<int:equipment_id>")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def get_equipment_details(equipment_id: int):
    """Get detailed equipment information"""
    for db in get_db():
        session: Session = db
        
        equipment = session.query(Equipment).filter_by(id=equipment_id).first()
        if not equipment:
            return jsonify({"error": "Equipment not found"}), 404
        
        # Authorization: equipmetal can only view own equipment; farmer/admin allowed
        claims = get_jwt() or {}
        role = claims.get("role")
        uid = None
        try:
            uid = int(get_jwt_identity())
        except Exception:
            uid = None
        if role == 'equipmetal' and uid and equipment.owner_id != uid:
            return jsonify({"error": "forbidden"}), 403
        
        # Get recent bookings to show availability calendar
        upcoming_bookings = session.query(EquipmentBooking).filter(
            and_(
                EquipmentBooking.equipment_id == equipment_id,
                EquipmentBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                EquipmentBooking.end_datetime >= datetime.utcnow()
            )
        ).order_by(EquipmentBooking.start_datetime).all()
        
        # Get owner's other equipment
        other_equipment = session.query(Equipment).filter(
            and_(Equipment.owner_id == equipment.owner_id, Equipment.id != equipment_id)
        ).limit(5).all()
        
        return jsonify({
            "equipment": {
                "id": equipment.id,
                "name": equipment.name,
                "category": equipment.category,
                "description": equipment.description,
                "location": equipment.location,
                "latitude": equipment.latitude,
                "longitude": equipment.longitude,
                "rate_per_hour": equipment.rate_per_hour,
                "rate_per_day": equipment.rate_per_day,
                "availability": equipment.availability,
                "images": equipment.images or [],
                "contact_phone": equipment.contact_phone,
                "created_at": equipment.created_at.isoformat()
            },
            "owner": {
                "id": equipment.owner.id,
                "name": equipment.owner.name,
                "contact_phone": equipment.contact_phone
            },
            "upcoming_bookings": [
                {
                    "start_datetime": booking.start_datetime.isoformat(),
                    "end_datetime": booking.end_datetime.isoformat(),
                    "status": booking.status.value
                }
                for booking in upcoming_bookings
            ],
            "other_equipment": [
                {
                    "id": e.id,
                    "name": e.name,
                    "category": e.category,
                    "rate_per_hour": e.rate_per_hour,
                    "rate_per_day": e.rate_per_day,
                    "images": e.images[0] if e.images else None
                }
                for e in other_equipment
            ]
        })


@bp.post("")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def create_equipment():
    """Add new equipment for rental"""
    owner_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    required_fields = ['name', 'category', 'location']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    for db in get_db():
        session: Session = db
        
        equipment = Equipment(
            owner_id=owner_id,
            name=data.get('name'),
            category=data.get('category'),
            description=data.get('description'),
            location=data.get('location'),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            rate_per_hour=data.get('rate_per_hour'),
            rate_per_day=data.get('rate_per_day'),
            images=data.get('images', []),
            contact_phone=data.get('contact_phone')
        )
        
        session.add(equipment)
        session.commit()
        
        # If created by equipmetal provider, also track it in equipmetal_equipments
        try:
            claims = get_jwt() or {}
            role = claims.get("role")
            if role == 'equipmetal':
                rec = EquipmetalEquipment(provider_id=owner_id, equipment_id=equipment.id)
                session.add(rec)
                session.commit()
        except Exception:
            session.rollback()
        
        return jsonify({
            "equipment_id": equipment.id,
            "message": "Equipment added successfully"
        })


@bp.put("/<int:equipment_id>")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def update_equipment(equipment_id: int):
    """Update equipment details"""
    owner_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    for db in get_db():
        session: Session = db
        
        equipment = session.query(Equipment).filter_by(id=equipment_id, owner_id=owner_id).first()
        if not equipment:
            return jsonify({"error": "Equipment not found"}), 404
        
        # Update allowed fields
        updatable_fields = [
            'name', 'category', 'description', 'location', 'latitude', 'longitude',
            'rate_per_hour', 'rate_per_day', 'availability', 'images', 'contact_phone'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(equipment, field, data[field])
        
        session.commit()
        
        return jsonify({"message": "Equipment updated successfully"})


@bp.delete("/<int:equipment_id>")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def delete_equipment(equipment_id: int):
    """Delete equipment. If any bookings exist (past or future), mark as unavailable instead.
    Also remove equipmetal linkage record if present to avoid FK errors.
    """
    owner_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        equipment = session.query(Equipment).filter_by(id=equipment_id, owner_id=owner_id).first()
        if not equipment:
            return jsonify({"error": "Equipment not found"}), 404
        
        # Check for active bookings
        active_bookings = session.query(EquipmentBooking).filter(
            and_(
                EquipmentBooking.equipment_id == equipment_id,
                EquipmentBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                EquipmentBooking.end_datetime > datetime.utcnow()
            )
        ).count()
        if active_bookings > 0:
            return jsonify({"error": "Cannot delete equipment with active bookings"}), 400
        
        # If any bookings exist historically, mark unavailable instead of deleting to preserve integrity
        any_bookings = session.query(EquipmentBooking).filter(
            EquipmentBooking.equipment_id == equipment_id
        ).count()
        if any_bookings > 0:
            equipment.availability = False
            session.commit()
            return jsonify({"message": "Equipment has bookings; marked unavailable instead of deleting"}), 200
        
        # Remove equipmetal_equipments linkage if present
        try:
            session.query(EquipmetalEquipment).filter_by(equipment_id=equipment_id).delete()
        except Exception:
            session.rollback()
        
        # Safe to delete
        session.delete(equipment)
        session.commit()
        
        return jsonify({"message": "Equipment deleted successfully"})


@bp.post("/book")
@jwt_required()
@role_required("farmer")
def create_booking():
    """Create equipment booking"""
    farmer_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    equipment_id = data.get('equipment_id')
    start_datetime_str = data.get('start_datetime')
    end_datetime_str = data.get('end_datetime')
    
    if not all([equipment_id, start_datetime_str, end_datetime_str]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        start_datetime = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
        end_datetime = datetime.fromisoformat(end_datetime_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({"error": "Invalid datetime format"}), 400
    
    if start_datetime >= end_datetime:
        return jsonify({"error": "Start time must be before end time"}), 400
    
    if start_datetime < datetime.utcnow():
        return jsonify({"error": "Start time cannot be in the past"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Check equipment exists and is available
        equipment = session.query(Equipment).filter_by(id=equipment_id, availability=True).first()
        if not equipment:
            return jsonify({"error": "Equipment not found or unavailable"}), 404
        
        # Check for overlapping bookings
        overlapping_bookings = session.query(EquipmentBooking).filter(
            and_(
                EquipmentBooking.equipment_id == equipment_id,
                EquipmentBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                or_(
                    and_(EquipmentBooking.start_datetime <= start_datetime, EquipmentBooking.end_datetime > start_datetime),
                    and_(EquipmentBooking.start_datetime < end_datetime, EquipmentBooking.end_datetime >= end_datetime),
                    and_(EquipmentBooking.start_datetime >= start_datetime, EquipmentBooking.end_datetime <= end_datetime)
                )
            )
        ).first()
        
        if overlapping_bookings:
            return jsonify({
                "error": "Equipment is already booked during this time period"
            }), 400
        
        # Calculate total cost
        duration_hours = (end_datetime - start_datetime).total_seconds() / 3600
        
        # Use daily rate if booking is for more than 8 hours, otherwise use hourly
        if duration_hours > 8 and equipment.rate_per_day:
            days = math.ceil(duration_hours / 24)
            total_amount = days * equipment.rate_per_day
            rate_used = equipment.rate_per_day
        else:
            total_amount = duration_hours * equipment.rate_per_hour
            rate_used = equipment.rate_per_hour
        
        # Create booking
        booking = EquipmentBooking(
            farmer_id=farmer_id,
            equipment_id=equipment_id,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            status=BookingStatus.PENDING,
            total_hours=duration_hours,
            rate_per_hour=rate_used,
            total_amount=total_amount,
            payment_status=PaymentStatus.PENDING
        )
        
        session.add(booking)
        session.commit()
        
        return jsonify({
            "booking_id": booking.id,
            "total_amount": total_amount,
            "total_hours": round(duration_hours, 2),
            "rate_used": rate_used,
            "status": booking.status.value,
            "message": "Booking created successfully. Complete payment to confirm."
        })


@bp.get("/bookings")
@jwt_required()
@role_required("farmer")
def get_farmer_bookings():
    """Get farmer's equipment bookings"""
    farmer_id = int(get_jwt_identity())
    status = request.args.get('status')
    
    for db in get_db():
        session: Session = db
        
        query = session.query(EquipmentBooking).filter_by(farmer_id=farmer_id)
        
        if status:
            try:
                status_enum = BookingStatus(status)
                query = query.filter(EquipmentBooking.status == status_enum)
            except ValueError:
                return jsonify({"error": "Invalid status"}), 400
        
        bookings = query.order_by(EquipmentBooking.created_at.desc()).all()
        
        bookings_data = []
        for booking in bookings:
            bookings_data.append({
                "id": booking.id,
                "equipment": {
                    "id": booking.equipment.id,
                    "name": booking.equipment.name,
                    "category": booking.equipment.category,
                    "owner_name": booking.equipment.owner.name,
                    "contact_phone": booking.equipment.contact_phone
                },
                "start_datetime": booking.start_datetime.isoformat(),
                "end_datetime": booking.end_datetime.isoformat(),
                "total_hours": booking.total_hours,
                "rate_per_hour": booking.rate_per_hour,
                "total_amount": booking.total_amount,
                "status": booking.status.value,
                "payment_status": booking.payment_status.value,
                "created_at": booking.created_at.isoformat(),
                "can_cancel": booking.status == BookingStatus.PENDING and booking.start_datetime > datetime.utcnow()
            })
        
        return jsonify({"bookings": bookings_data})


@bp.put("/bookings/<int:booking_id>/cancel")
@jwt_required()
@role_required("farmer")
def cancel_booking(booking_id: int):
    """Cancel equipment booking"""
    farmer_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        booking = session.query(EquipmentBooking).filter_by(
            id=booking_id, farmer_id=farmer_id
        ).first()
        
        if not booking:
            return jsonify({"error": "Booking not found"}), 404
        
        if booking.status != BookingStatus.PENDING:
            return jsonify({"error": "Only pending bookings can be cancelled"}), 400
        
        # Allow cancellation up to 2 hours before start time
        if booking.start_datetime <= datetime.utcnow() + timedelta(hours=2):
            return jsonify({"error": "Cannot cancel booking less than 2 hours before start time"}), 400
        
        booking.status = BookingStatus.CANCELLED
        session.commit()
        
        return jsonify({
            "success": True,
            "message": "Booking cancelled successfully"
        })


@bp.get("/categories")
def get_equipment_categories():
    """Get all equipment categories"""
    for db in get_db():
        session: Session = db
        
        categories = session.query(Equipment.category, func.count(Equipment.id)).filter(
            Equipment.availability == True
        ).group_by(Equipment.category).all()
        
        return jsonify({
            "categories": [
                {
                    "name": cat,
                    "equipment_count": count
                }
                for cat, count in categories if cat
            ]
        })


@bp.get("/analytics/utilization")
@role_required("admin")
def get_equipment_analytics():
    """Get equipment utilization analytics"""
    for db in get_db():
        session: Session = db
        
        # Overall equipment stats
        total_equipment = session.query(Equipment).count()
        available_equipment = session.query(Equipment).filter(Equipment.availability == True).count()
        
        # Category breakdown
        category_stats = session.query(
            Equipment.category,
            func.count(Equipment.id).label('total'),
            func.sum(func.cast(Equipment.availability, func.INTEGER)).label('available')
        ).group_by(Equipment.category).all()
        
        # Booking trends (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        booking_trends = session.query(
            func.date(EquipmentBooking.created_at).label('date'),
            func.count(EquipmentBooking.id).label('bookings'),
            func.sum(EquipmentBooking.total_amount).label('revenue')
        ).filter(
            EquipmentBooking.created_at >= thirty_days_ago
        ).group_by(
            func.date(EquipmentBooking.created_at)
        ).all()
        
        return jsonify({
            "overall": {
                "total_equipment": total_equipment,
                "available_equipment": available_equipment,
                "utilization_rate": round((total_equipment - available_equipment) / total_equipment * 100, 2) if total_equipment > 0 else 0
            },
            "categories": [
                {
                    "category": stat.category,
                    "total": stat.total,
                    "available": stat.available or 0,
                    "utilization": round((stat.total - (stat.available or 0)) / stat.total * 100, 2) if stat.total > 0 else 0
                }
                for stat in category_stats
            ],
            "booking_trends": [
                {
                    "date": trend.date.isoformat(),
                    "bookings": trend.bookings,
                    "revenue": float(trend.revenue or 0)
                }
                for trend in booking_trends
            ]
        })


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula"""
    # Convert latitude and longitude from degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Earth's radius in kilometers
    r = 6371
    
    return c * r