from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import jwt_required, get_jwt_identity

from .db import get_db
from .models import User
from .auth import create_token

bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@bp.post("/register")
def register():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower() or None
    phone = (data.get("phone") or "").strip() or None
    name = (data.get("name") or "").strip() or None
    role = (data.get("role") or "farmer").strip()
    password = data.get("password") or ""
    aadhaar = (data.get("aadhaar_number") or "").strip() or None
    pan = (data.get("pan_number") or "").strip() or None
    company_name = (data.get("company_name") or "").strip() or None
    gst_number = (data.get("gst_number") or "").strip() or None
    service_categories = data.get("service_categories")  # expect list or JSON
    address = (data.get("address") or "").strip() or None
    verification_status = (data.get("verification_status") or "unverified").strip() or "unverified"

    if not (email or phone) or not password:
        return jsonify({"error": "email or phone and password required"}), 400

    pwd_hash = generate_password_hash(password)

    for db in get_db():
        session: Session = db
        # Uniqueness checks
        if email and session.query(User).filter_by(email=email).first():
            return jsonify({"error": "email already registered"}), 409
        if phone and session.query(User).filter_by(phone=phone).first():
            return jsonify({"error": "phone already registered"}), 409

        is_approved = True
        if role in ("farmer", "equipmetal"):
            is_approved = False  # require admin approval
        user = User(
            email=email,
            phone=phone,
            name=name,
            role=role,
            password_hash=pwd_hash,
            aadhaar_number=aadhaar,
            pan_number=pan,
            is_approved=is_approved,
            company_name=company_name,
            gst_number=gst_number,
            service_categories=service_categories,
            verification_status=verification_status,
            address=address,
        )
        session.add(user)
        session.commit()
        if not is_approved:
            return jsonify({
                "message": "Registration received. Admin approval required before login.",
                "user": {
                    "id": user.id,
                    "role": user.role,
                    "name": user.name,
                    "email": user.email,
                    "phone": user.phone,
                    "aadhaar_number": user.aadhaar_number,
                    "pan_number": user.pan_number,
                    "company_name": user.company_name,
                    "gst_number": user.gst_number,
                    "service_categories": user.service_categories,
                    "verification_status": user.verification_status,
                    "address": user.address,
                }
            })
        token = create_token(identity=str(user.id), role=user.role)
        return jsonify({
            "token": token,
            "user": {
                "id": user.id,
                "role": user.role,
                "name": user.name,
                "email": user.email,
                "phone": user.phone,
                "company_name": user.company_name,
                "gst_number": user.gst_number,
                "service_categories": user.service_categories,
                "verification_status": user.verification_status,
                "address": user.address,
            }
        })


@bp.post("/login")
def login():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower() or None
    phone = (data.get("phone") or "").strip() or None
    password = data.get("password") or ""

    if not (email or phone) or not password:
        return jsonify({"error": "email or phone and password required"}), 400

    for db in get_db():
        session: Session = db
        q = session.query(User)
        user = None
        if email:
            user = q.filter_by(email=email).first()
        else:
            user = q.filter_by(phone=phone).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "invalid credentials"}), 401
        if user.role in ('farmer', 'equipmetal') and not getattr(user, 'is_approved', True):
            return jsonify({"error": "awaiting_admin_approval"}), 403
        token = create_token(identity=str(user.id), role=user.role)
        return jsonify({"token": token, "user": {"id": user.id, "role": user.role, "name": user.name, "email": user.email, "phone": user.phone}})


@bp.get("/pending-farmers")
@jwt_required()
def list_pending_farmers():
    from .auth import role_required
    for db in get_db():
        session: Session = db
        # role check inline
        # In practice, use @role_required('admin'), but we avoid circular import ordering issues
        # We'll verify via current user
        uid = int(get_jwt_identity())
        cur = session.query(User).filter_by(id=uid).first()
        if not cur or cur.role != 'admin':
            return jsonify({"error": "forbidden"}), 403
        pending = session.query(User).filter_by(role='farmer', is_approved=False).all()
        return jsonify({
            "farmers": [
                {
                    "id": u.id,
                    "name": u.name,
                    "email": u.email,
                    "phone": u.phone,
                    "aadhaar_number": getattr(u, 'aadhaar_number', None),
                    "pan_number": getattr(u, 'pan_number', None),
                    "created_at": u.created_at.isoformat(),
                } for u in pending
            ]
        })

@bp.get("/pending-providers")
@jwt_required()
def list_pending_providers():
    for db in get_db():
        session: Session = db
        uid = int(get_jwt_identity())
        cur = session.query(User).filter_by(id=uid).first()
        if not cur or cur.role != 'admin':
            return jsonify({"error": "forbidden"}), 403
        pending = session.query(User).filter_by(role='equipmetal', is_approved=False).all()
        return jsonify({
            "providers": [
                {
                    "id": u.id,
                    "name": u.name,
                    "email": u.email,
                    "phone": u.phone,
                    "company_name": getattr(u, 'company_name', None),
                    "gst_number": getattr(u, 'gst_number', None),
                    "service_categories": getattr(u, 'service_categories', None),
                    "created_at": u.created_at.isoformat(),
                } for u in pending
            ]
        })

@bp.post("/providers/<int:uid>/approve")
@jwt_required()
def approve_provider(uid: int):
    for db in get_db():
        session: Session = db
        me_id = int(get_jwt_identity())
        me = session.query(User).filter_by(id=me_id).first()
        if not me or me.role != 'admin':
            return jsonify({"error": "forbidden"}), 403
        user = session.query(User).filter_by(id=uid, role='equipmetal').first()
        if not user:
            return jsonify({"error": "not found"}), 404
        user.is_approved = True
        session.commit()
        return jsonify({"ok": True})

@bp.post("/providers/<int:uid>/reject")
@jwt_required()
def reject_provider(uid: int):
    for db in get_db():
        session: Session = db
        me_id = int(get_jwt_identity())
        me = session.query(User).filter_by(id=me_id).first()
        if not me or me.role != 'admin':
            return jsonify({"error": "forbidden"}), 403
        user = session.query(User).filter_by(id=uid, role='equipmetal').first()
        if not user:
            return jsonify({"error": "not found"}), 404
        if getattr(user, 'is_approved', True):
            return jsonify({"error": "cannot_reject_approved_user"}), 400
        session.delete(user)
        session.commit()
        return jsonify({"ok": True})

@bp.post("/farmers/<int:uid>/approve")
@jwt_required()
def approve_farmer(uid: int):
    for db in get_db():
        session: Session = db
        # Admin check
        from .auth import role_required
        # manually check role
        me_id = int(get_jwt_identity())
        me = session.query(User).filter_by(id=me_id).first()
        if not me or me.role != 'admin':
            return jsonify({"error": "forbidden"}), 403
        user = session.query(User).filter_by(id=uid, role='farmer').first()
        if not user:
            return jsonify({"error": "not found"}), 404
        user.is_approved = True
        session.commit()
        return jsonify({"ok": True})

@bp.post("/farmers/<int:uid>/reject")
@jwt_required()
def reject_farmer(uid: int):
    """Reject a pending farmer signup by deleting the user record.
    Only allowed for admin. Safe because pending farmers have no data linked.
    """
    for db in get_db():
        session: Session = db
        me_id = int(get_jwt_identity())
        me = session.query(User).filter_by(id=me_id).first()
        if not me or me.role != 'admin':
            return jsonify({"error": "forbidden"}), 403
        user = session.query(User).filter_by(id=uid, role='farmer').first()
        if not user:
            return jsonify({"error": "not found"}), 404
        # Only allow reject if not approved yet
        if getattr(user, 'is_approved', True):
            return jsonify({"error": "cannot_reject_approved_user"}), 400
        session.delete(user)
        session.commit()
        return jsonify({"ok": True})

@bp.get("/me")
@jwt_required()
def get_current_user():
    """Get current authenticated user info"""
    user_id = int(get_jwt_identity())
    
    for db in get_db():
        session: Session = db
        user = session.query(User).filter_by(id=user_id).first()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "name": user.name,
            "role": user.role,
            "aadhaar_number": getattr(user, 'aadhaar_number', None),
            "pan_number": getattr(user, 'pan_number', None),
            "is_approved": getattr(user, 'is_approved', True),
            "company_name": getattr(user, 'company_name', None),
            "gst_number": getattr(user, 'gst_number', None),
            "service_categories": getattr(user, 'service_categories', None),
            "verification_status": getattr(user, 'verification_status', 'unverified'),
            "address": getattr(user, 'address', None),
            "created_at": user.created_at.isoformat()
        })
