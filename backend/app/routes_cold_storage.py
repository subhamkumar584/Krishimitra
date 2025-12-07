from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import math

from .db import get_db
from .models import (
    ColdStorage, ColdStorageBooking, User,
    BookingStatus, PaymentStatus
)
from .auth import role_required

bp = Blueprint("cold_storage", __name__, url_prefix="/api/v1/cold-storage")


@bp.get("/facilities")
def list_cold_storage_facilities():
    """Get list of cold storage facilities with filters"""
    # Search parameters
    location = request.args.get("location", "")
    min_capacity = request.args.get("min_capacity", type=float)
    max_rate = request.args.get("max_rate", type=float)
    min_temp = request.args.get("min_temp", type=float)
    max_temp = request.args.get("max_temp", type=float)
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    radius = request.args.get("radius", 50, type=int)  # km
    page = request.args.get("page", 1, type=int)
    limit = min(request.args.get("limit", 20, type=int), 100)
    
    for db in get_db():
        session: Session = db
        
        # Base query
        query = session.query(ColdStorage).filter(ColdStorage.is_active == True)
        
        # Location filter
        if location:
            query = query.filter(ColdStorage.location.like(f"%{location}%"))
        
        # Capacity filter
        if min_capacity:
            query = query.filter(ColdStorage.available_capacity >= min_capacity)
        
        # Rate filter
        if max_rate:
            query = query.filter(ColdStorage.rate_per_ton_per_day <= max_rate)
        
        # Temperature range filter
        if min_temp:
            query = query.filter(ColdStorage.temperature_range_min <= min_temp)
        if max_temp:
            query = query.filter(ColdStorage.temperature_range_max >= max_temp)
        
        # Get all facilities first
        all_facilities = query.all()
        
        # Apply proximity filter if coordinates provided
        if lat and lon:
            nearby_facilities = []
            for facility in all_facilities:
                if facility.latitude and facility.longitude:
                    distance = calculate_distance(lat, lon, facility.latitude, facility.longitude)
                    if distance <= radius:
                        nearby_facilities.append((facility, distance))
                else:
                    # Include facilities without coordinates
                    nearby_facilities.append((facility, None))
            
            # Sort by distance
            nearby_facilities.sort(key=lambda x: x[1] if x[1] is not None else float('inf'))
            facilities_data = [
                {
                    "id": f.id,
                    "name": f.name,
                    "location": f.location,
                    "latitude": f.latitude,
                    "longitude": f.longitude,
                    "capacity": f.capacity,
                    "available_capacity": f.available_capacity,
                    "utilization": round((f.capacity - f.available_capacity) / f.capacity * 100, 1) if f.capacity > 0 else 0,
                    "temperature_range": {
                        "min": f.temperature_range_min,
                        "max": f.temperature_range_max
                    },
                    "rate_per_ton_per_day": f.rate_per_ton_per_day,
                    "contact": {
                        "phone": f.contact_phone,
                        "email": f.contact_email
                    },
                    "distance_km": round(dist, 2) if dist is not None else None
                }
                for f, dist in nearby_facilities
            ]
        else:
            facilities_data = [
                {
                    "id": f.id,
                    "name": f.name,
                    "location": f.location,
                    "latitude": f.latitude,
                    "longitude": f.longitude,
                    "capacity": f.capacity,
                    "available_capacity": f.available_capacity,
                    "utilization": round((f.capacity - f.available_capacity) / f.capacity * 100, 1) if f.capacity > 0 else 0,
                    "temperature_range": {
                        "min": f.temperature_range_min,
                        "max": f.temperature_range_max
                    },
                    "rate_per_ton_per_day": f.rate_per_ton_per_day,
                    "contact": {
                        "phone": f.contact_phone,
                        "email": f.contact_email
                    }
                }
                for f in all_facilities
            ]
        
        # Pagination
        total_count = len(facilities_data)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_facilities = facilities_data[start_idx:end_idx]
        
        return jsonify({
            "facilities": paginated_facilities,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        })


@bp.post("/facilities")
@jwt_required()
@role_required("equipmetal", "admin")
def create_cold_storage():
    """Create a cold storage facility (equipment provider/admin)."""
    data = request.get_json() or {}
    required = ['name', 'location', 'capacity', 'available_capacity', 'temperature_range_min', 'temperature_range_max', 'rate_per_ton_per_day']
    if not all(k in data for k in required):
        return jsonify({"error": "missing_fields"}), 400
    for db in get_db():
        session: Session = db
        cs = ColdStorage(
            name=data['name'],
            location=data['location'],
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            capacity=float(data['capacity']),
            available_capacity=float(data['available_capacity']),
            temperature_range_min=float(data['temperature_range_min']),
            temperature_range_max=float(data['temperature_range_max']),
            rate_per_ton_per_day=float(data['rate_per_ton_per_day']),
            contact_phone=data.get('contact_phone'),
            contact_email=data.get('contact_email'),
            is_active=True
        )
        session.add(cs)
        session.commit()
        return jsonify({"id": cs.id, "message": "Cold storage created"})


@bp.put("/facilities/<int:facility_id>")
@jwt_required()
@role_required("equipmetal", "admin")
def update_cold_storage(facility_id: int):
    data = request.get_json() or {}
    for db in get_db():
        session: Session = db
        cs = session.query(ColdStorage).filter_by(id=facility_id).first()
        if not cs:
            return jsonify({"error": "not_found"}), 404
        for field in ['name', 'location', 'latitude', 'longitude', 'capacity', 'available_capacity', 'temperature_range_min', 'temperature_range_max', 'rate_per_ton_per_day', 'contact_phone', 'contact_email', 'is_active']:
            if field in data:
                setattr(cs, field, data[field])
        session.commit()
        return jsonify({"ok": True})


@bp.delete("/facilities/<int:facility_id>")
@jwt_required()
@role_required("equipmetal", "admin")
def delete_cold_storage(facility_id: int):
    for db in get_db():
        session: Session = db
        cs = session.query(ColdStorage).filter_by(id=facility_id).first()
        if not cs:
            return jsonify({"error": "not_found"}), 404
        session.delete(cs)
        session.commit()
        return jsonify({"ok": True})


@bp.get("/facilities/<int:facility_id>")
def get_facility_details(facility_id: int):
    """Get detailed information about a cold storage facility"""
    for db in get_db():
        session: Session = db
        
        facility = session.query(ColdStorage).filter_by(id=facility_id, is_active=True).first()
        if not facility:
            return jsonify({"error": "Cold storage facility not found"}), 404
        
        # Get recent bookings for availability calendar
        recent_bookings = session.query(ColdStorageBooking).filter(
            and_(
                ColdStorageBooking.cold_storage_id == facility_id,
                ColdStorageBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                ColdStorageBooking.end_date >= datetime.utcnow()
            )
        ).all()
        
        return jsonify({
            "facility": {
                "id": facility.id,
                "name": facility.name,
                "location": facility.location,
                "latitude": facility.latitude,
                "longitude": facility.longitude,
                "capacity": facility.capacity,
                "available_capacity": facility.available_capacity,
                "utilization": round((facility.capacity - facility.available_capacity) / facility.capacity * 100, 1),
                "temperature_range": {
                    "min": facility.temperature_range_min,
                    "max": facility.temperature_range_max
                },
                "rate_per_ton_per_day": facility.rate_per_ton_per_day,
                "contact": {
                    "phone": facility.contact_phone,
                    "email": facility.contact_email
                }
            },
            "current_bookings": [
                {
                    "start_date": booking.start_date.isoformat(),
                    "end_date": booking.end_date.isoformat(),
                    "quantity": booking.quantity,
                    "commodity": booking.commodity,
                    "status": booking.status.value
                }
                for booking in recent_bookings
            ]
        })


@bp.post("/book")
@jwt_required()
@role_required("farmer")
def create_booking():
    """Create a cold storage booking"""
    farmer_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    facility_id = data.get('facility_id')
    commodity = data.get('commodity')
    quantity = data.get('quantity', type=float)
    start_date_str = data.get('start_date')
    end_date_str = data.get('end_date')
    
    if not all([facility_id, commodity, quantity, start_date_str, end_date_str]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400
    
    if start_date >= end_date:
        return jsonify({"error": "Start date must be before end date"}), 400
    
    if start_date < datetime.utcnow():
        return jsonify({"error": "Start date cannot be in the past"}), 400
    
    for db in get_db():
        session: Session = db
        
        # Check facility exists and has capacity
        facility = session.query(ColdStorage).filter_by(id=facility_id, is_active=True).first()
        if not facility:
            return jsonify({"error": "Cold storage facility not found"}), 404
        
        if quantity > facility.available_capacity:
            return jsonify({
                "error": f"Insufficient capacity. Available: {facility.available_capacity} tons"
            }), 400
        
        # Check for overlapping bookings
        overlapping_bookings = session.query(ColdStorageBooking).filter(
            and_(
                ColdStorageBooking.cold_storage_id == facility_id,
                ColdStorageBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
                or_(
                    and_(ColdStorageBooking.start_date <= start_date, ColdStorageBooking.end_date > start_date),
                    and_(ColdStorageBooking.start_date < end_date, ColdStorageBooking.end_date >= end_date),
                    and_(ColdStorageBooking.start_date >= start_date, ColdStorageBooking.end_date <= end_date)
                )
            )
        ).all()
        
        total_booked_quantity = sum(booking.quantity for booking in overlapping_bookings)
        if total_booked_quantity + quantity > facility.capacity:
            return jsonify({
                "error": f"Booking conflicts with existing reservations. Available during this period: {facility.capacity - total_booked_quantity} tons"
            }), 400
        
        # Calculate total cost
        days = (end_date - start_date).days
        if days == 0:
            days = 1  # Minimum 1 day
        
        total_amount = quantity * facility.rate_per_ton_per_day * days
        
        # Create booking
        booking = ColdStorageBooking(
            farmer_id=farmer_id,
            cold_storage_id=facility_id,
            commodity=commodity,
            quantity=quantity,
            start_date=start_date,
            end_date=end_date,
            status=BookingStatus.PENDING,
            rate_per_ton_per_day=facility.rate_per_ton_per_day,
            total_amount=total_amount,
            payment_status=PaymentStatus.PENDING
        )
        
        session.add(booking)
        session.commit()
        
        return jsonify({
            "booking_id": booking.id,
            "total_amount": total_amount,
            "days": days,
            "rate_per_ton_per_day": facility.rate_per_ton_per_day,
            "status": booking.status.value,
            "message": "Booking created successfully. Complete payment to confirm."
        })


@bp.get("/bookings")
@jwt_required()
@role_required("farmer")
def get_farmer_bookings():
    """Get farmer's cold storage bookings"""
    farmer_id = int(get_jwt_identity())
    status = request.args.get('status')  # pending, confirmed, active, completed, cancelled
    
    for db in get_db():
        session: Session = db
        
        query = session.query(ColdStorageBooking).filter_by(farmer_id=farmer_id)
        
        if status:
            try:
                status_enum = BookingStatus(status)
                query = query.filter(ColdStorageBooking.status == status_enum)
            except ValueError:
                return jsonify({"error": "Invalid status"}), 400
        
        bookings = query.order_by(ColdStorageBooking.created_at.desc()).all()
        
        bookings_data = []
        for booking in bookings:
            bookings_data.append({
                "id": booking.id,
                "facility": {
                    "id": booking.cold_storage.id,
                    "name": booking.cold_storage.name,
                    "location": booking.cold_storage.location
                },
                "commodity": booking.commodity,
                "quantity": booking.quantity,
                "start_date": booking.start_date.isoformat(),
                "end_date": booking.end_date.isoformat(),
                "days": (booking.end_date - booking.start_date).days,
                "rate_per_ton_per_day": booking.rate_per_ton_per_day,
                "total_amount": booking.total_amount,
                "status": booking.status.value,
                "payment_status": booking.payment_status.value,
                "created_at": booking.created_at.isoformat(),
                "can_cancel": booking.status == BookingStatus.PENDING and booking.start_date > datetime.utcnow()
            })
        
        return jsonify({"bookings": bookings_data})


@bp.put("/bookings/<int:booking_id>/cancel")
@jwt_required()
@role_required("farmer")
def cancel_booking(booking_id: int):
    """Cancel a cold storage booking"""
    farmer_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        
        booking = session.query(ColdStorageBooking).filter_by(
            id=booking_id, farmer_id=farmer_id
        ).first()
        
        if not booking:
            return jsonify({"error": "Booking not found"}), 404
        
        if booking.status != BookingStatus.PENDING:
            return jsonify({"error": "Only pending bookings can be cancelled"}), 400
        
        if booking.start_date <= datetime.utcnow():
            return jsonify({"error": "Cannot cancel booking that has already started"}), 400
        
        booking.status = BookingStatus.CANCELLED
        session.commit()
        
        return jsonify({
            "success": True,
            "message": "Booking cancelled successfully"
        })


@bp.get("/analytics/utilization")
@role_required("admin")
def get_utilization_analytics():
    """Get cold storage utilization analytics (Admin only)"""
    for db in get_db():
        session: Session = db
        
        # Overall utilization
        facilities = session.query(ColdStorage).filter(ColdStorage.is_active == True).all()
        
        total_capacity = sum(f.capacity for f in facilities)
        total_available = sum(f.available_capacity for f in facilities)
        overall_utilization = ((total_capacity - total_available) / total_capacity * 100) if total_capacity > 0 else 0
        
        # Monthly booking trends
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_bookings = session.query(
            func.date(ColdStorageBooking.created_at).label('date'),
            func.count(ColdStorageBooking.id).label('bookings'),
            func.sum(ColdStorageBooking.total_amount).label('revenue')
        ).filter(
            ColdStorageBooking.created_at >= thirty_days_ago
        ).group_by(
            func.date(ColdStorageBooking.created_at)
        ).all()
        
        return jsonify({
            "overall": {
                "total_facilities": len(facilities),
                "total_capacity": total_capacity,
                "total_available": total_available,
                "utilization_percentage": round(overall_utilization, 2)
            },
            "facilities": [
                {
                    "id": f.id,
                    "name": f.name,
                    "location": f.location,
                    "capacity": f.capacity,
                    "available": f.available_capacity,
                    "utilization": round((f.capacity - f.available_capacity) / f.capacity * 100, 1)
                }
                for f in facilities
            ],
            "monthly_trends": [
                {
                    "date": booking.date.isoformat(),
                    "bookings": booking.bookings,
                    "revenue": float(booking.revenue or 0)
                }
                for booking in recent_bookings
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