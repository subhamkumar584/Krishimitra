from datetime import timedelta
from functools import wraps
from typing import Optional

from flask import request, jsonify
from flask_jwt_extended import JWTManager, create_access_token, get_jwt, jwt_required

# Initialize in app factory
jwt = JWTManager()


def init_jwt(app):
    # Secret key must be set via env: FLASK_SECRET or a default dev key
    secret = app.config.get("SECRET_KEY") or "dev-secret-change-me"
    app.config["SECRET_KEY"] = secret
    app.config["JWT_SECRET_KEY"] = secret
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
    jwt.init_app(app)


def create_token(identity: str, role: str) -> str:
    return create_access_token(identity=identity, additional_claims={"role": role})


def role_required(*allowed_roles: str):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt() or {}
            role = claims.get("role")
            if role not in allowed_roles:
                return jsonify({"error": "forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
