from sqlalchemy import Column, DateTime, Integer, String, JSON, Text, Float, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base
import enum


# Users and Auth
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=True)
    role = Column(String(32), default="farmer", nullable=False)  # farmer | customer | admin | equipmetal
    password_hash = Column(String(255), nullable=False)
    locale = Column(String(10), nullable=True)
    aadhaar_number = Column(String(20), nullable=True)
    pan_number = Column(String(20), nullable=True)
    is_approved = Column(Boolean, default=True)  # For farmers: admin approval required
    # Provider fields (for equipmetal and optional for others)
    company_name = Column(String(255), nullable=True)
    gst_number = Column(String(64), nullable=True)
    service_categories = Column(JSON, nullable=True)  # e.g., ["tractor", "harvester", "fertilizer"]
    verification_status = Column(String(32), default="unverified", nullable=False)
    address = Column(Text, nullable=True)

    products = relationship("Product", back_populates="seller")


# Marketplace
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    price = Column(Float, nullable=False)
    unit = Column(String(50), nullable=True)  # e.g., kg, quintal
    stock = Column(Float, nullable=False, default=0)
    location = Column(String(255), nullable=True)
    image_url = Column(String(512), nullable=True)
    status = Column(String(50), default="active")

    seller = relationship("User", back_populates="products")


# Enums
class OrderStatus(enum.Enum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"

class PaymentStatus(enum.Enum):
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"

class BookingStatus(enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# Cart System
class CartItem(Base):
    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    
    user = relationship("User")
    product = relationship("Product")


# Enhanced Order System
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(Enum(OrderStatus), default=OrderStatus.CREATED)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    subtotal = Column(Float, nullable=False)  # INR
    delivery_charges = Column(Float, default=0.0)  # INR
    total_amount = Column(Float, nullable=False)  # INR
    
    delivery_address = Column(Text, nullable=True)
    delivery_phone = Column(String(20), nullable=True)
    delivery_scheduled_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    
    razorpay_order_id = Column(String(64), index=True, nullable=True)
    razorpay_payment_id = Column(String(64), nullable=True)
    
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    items = relationship("OrderItem", back_populates="order")


class PaymentSession(Base):
    """Temporary record that ties a Razorpay order to a buyer and their cart snapshot.
    Orders are only created after successful payment verification.
    """
    __tablename__ = "payment_sessions"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    razorpay_order_id = Column(String(64), index=True, unique=True, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    amount = Column(Float, nullable=False)
    cart_snapshot = Column(JSON, nullable=True)  # Optional snapshot of items per seller

    buyer = relationship("User")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    price_per_unit = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    
    order = relationship("Order", back_populates="items")
    product = relationship("Product")


# Reviews and Ratings
class ProductReview(Base):
    __tablename__ = "product_reviews"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1-5
    review_text = Column(Text, nullable=True)
    
    product = relationship("Product")
    buyer = relationship("User")
    order = relationship("Order")


class FarmerReview(Base):
    __tablename__ = "farmer_reviews"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1-5
    review_text = Column(Text, nullable=True)
    
    farmer = relationship("User", foreign_keys=[farmer_id])
    buyer = relationship("User", foreign_keys=[buyer_id])
    order = relationship("Order")


# Cold Storage System
class ColdStorage(Base):
    __tablename__ = "cold_storages"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    capacity = Column(Float, nullable=False)  # in tons
    available_capacity = Column(Float, nullable=False)
    
    temperature_range_min = Column(Float, nullable=False)  # Celsius
    temperature_range_max = Column(Float, nullable=False)  # Celsius
    
    rate_per_ton_per_day = Column(Float, nullable=False)  # INR
    
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    
    is_active = Column(Boolean, default=True)


class ColdStorageBooking(Base):
    __tablename__ = "cold_storage_bookings"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cold_storage_id = Column(Integer, ForeignKey("cold_storages.id"), nullable=False)
    
    commodity = Column(String(100), nullable=False)
    quantity = Column(Float, nullable=False)  # in tons
    
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    
    rate_per_ton_per_day = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    razorpay_order_id = Column(String(64), nullable=True)
    
    farmer = relationship("User")
    cold_storage = relationship("ColdStorage")


# Equipment Rental System
class Equipment(Base):
    __tablename__ = "equipments"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # tractor, harvester, drone, etc.
    description = Column(Text, nullable=True)
    
    location = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    rate_per_hour = Column(Float, nullable=True)
    rate_per_day = Column(Float, nullable=True)
    
    availability = Column(Boolean, default=True)
    
    images = Column(JSON, nullable=True)  # List of image URLs
    
    contact_phone = Column(String(20), nullable=True)
    
    owner = relationship("User")


class EquipmentBooking(Base):
    __tablename__ = "equipment_bookings"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=False)
    
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    
    total_hours = Column(Float, nullable=False)
    rate_per_hour = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    razorpay_order_id = Column(String(64), nullable=True)
    
    farmer = relationship("User")
    equipment = relationship("Equipment")


class EquipmetalEquipment(Base):
    __tablename__ = "equipmetal_equipments"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipments.id"), nullable=False, unique=True)

    provider = relationship("User")
    equipment = relationship("Equipment")


# Communication System
class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    farmer = relationship("User", foreign_keys=[farmer_id])
    customer = relationship("User", foreign_keys=[customer_id])
    product = relationship("Product")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    message_text = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


# Analytics and Market Insights
class MarketPrice(Base):
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    commodity = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # vegetable, fruit, grain
    region = Column(String(100), nullable=False)
    
    min_price = Column(Float, nullable=False)
    max_price = Column(Float, nullable=False)
    avg_price = Column(Float, nullable=False)
    
    source = Column(String(100), nullable=False)  # government, enam, internal


class PricingInsight(Base):
    __tablename__ = "pricing_insights"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    
    commodity = Column(String(100), nullable=False)
    current_market_price = Column(Float, nullable=False)
    suggested_price = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0
    
    reasoning = Column(Text, nullable=True)
    
    farmer = relationship("User")
    product = relationship("Product")


# AI Logs
class SoilRecommendationLog(Base):
    __tablename__ = "soil_recommendation_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user_id = Column(String(64), nullable=True)

    request = Column(JSON, nullable=False)
    response = Column(JSON, nullable=False)

    model_name = Column(String(255), nullable=True)
