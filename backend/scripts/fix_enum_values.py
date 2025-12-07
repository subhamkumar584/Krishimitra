#!/usr/bin/env python3
"""
Script to investigate and fix the enum values mismatch issue.

This script checks the database enum definitions and fixes any mismatches
between the model enums and database enums.
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def investigate_enum_issue():
    """Investigate the enum values issue."""
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Check the orders table structure, specifically the enum columns
            result = connection.execute(text("DESCRIBE orders"))
            columns = result.fetchall()
            
            print("📋 Orders table enum columns:")
            for column in columns:
                field, type_, null, key, default, extra = column
                if 'enum' in type_.lower():
                    print(f"   - {field}: {type_}")
                    print(f"     Default: {default}")
                    print()
            
            # Check what enum values are actually defined in the database
            print("🔍 Checking database enum definitions...")
            
            # Get enum values for payment_status
            enum_check = connection.execute(text("""
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME = 'payment_status'
            """))
            
            enum_result = enum_check.fetchone()
            if enum_result:
                enum_definition = enum_result[0]
                print(f"💳 payment_status enum in database: {enum_definition}")
            
            # Get enum values for status  
            status_check = connection.execute(text("""
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME = 'status'
            """))
            
            status_result = status_check.fetchone()
            if status_result:
                status_definition = status_result[0]
                print(f"📦 status enum in database: {status_definition}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error investigating enum issue: {e}")
        return False


def fix_enum_values():
    """Fix the enum values to match the application expectations."""
    print("🔄 Starting enum values fix...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            trans = connection.begin()
            
            try:
                print("🔧 Updating payment_status enum to match uppercase values...")
                
                # Update the payment_status enum to use uppercase values
                alter_payment_status = text("""
                    ALTER TABLE orders 
                    MODIFY COLUMN payment_status 
                    ENUM('PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED') 
                    DEFAULT 'PENDING'
                """)
                
                connection.execute(alter_payment_status)
                print("   ✅ Updated payment_status enum to uppercase")
                
                print("🔧 Updating status enum to match uppercase values...")
                
                # Update the status enum to use uppercase values  
                alter_status = text("""
                    ALTER TABLE orders 
                    MODIFY COLUMN status 
                    ENUM('CREATED','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') 
                    DEFAULT 'CREATED'
                """)
                
                connection.execute(alter_status)
                print("   ✅ Updated status enum to uppercase")
                
                trans.commit()
                return True
                
            except Exception as e:
                print(f"❌ Error during enum fix: {e}")
                trans.rollback()
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


def update_model_enums():
    """Update the model enum definitions to use uppercase values."""
    print("📝 Updating model enum definitions...")
    
    # Read the current models.py file
    models_path = os.path.join(os.path.dirname(__file__), '..', 'app', 'models.py')
    
    try:
        with open(models_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Update OrderStatus enum values to uppercase
        old_order_status = '''class OrderStatus(enum.Enum):
    CREATED = "created"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"'''
        
        new_order_status = '''class OrderStatus(enum.Enum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"'''
        
        # Update PaymentStatus enum values to uppercase
        old_payment_status = '''class PaymentStatus(enum.Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"'''
        
        new_payment_status = '''class PaymentStatus(enum.Enum):
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"'''
        
        # Update BookingStatus enum values to uppercase
        old_booking_status = '''class BookingStatus(enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"'''
        
        new_booking_status = '''class BookingStatus(enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"'''
        
        # Apply the replacements
        updated_content = content.replace(old_order_status, new_order_status)
        updated_content = updated_content.replace(old_payment_status, new_payment_status)
        updated_content = updated_content.replace(old_booking_status, new_booking_status)
        
        # Write the updated content back
        with open(models_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        
        print("   ✅ Updated model enum definitions to use uppercase values")
        return True
        
    except Exception as e:
        print(f"❌ Error updating model enums: {e}")
        return False


def verify_enum_fix():
    """Verify that the enum fix was successful."""
    print("🔍 Verifying enum fix...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Check the updated enum definitions
            print("📋 Updated database enum definitions:")
            
            # Check payment_status
            payment_check = connection.execute(text("""
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME = 'payment_status'
            """))
            
            payment_result = payment_check.fetchone()
            if payment_result:
                print(f"   💳 payment_status: {payment_result[0]}")
            
            # Check status
            status_check = connection.execute(text("""
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME = 'status'
            """))
            
            status_result = status_check.fetchone()
            if status_result:
                print(f"   📦 status: {status_result[0]}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error verifying enum fix: {e}")
        return False


def main():
    """Main function to fix the enum values issue."""
    print("🚀 KrishiMitra Database Fix: Enum Values Issue")
    print("=" * 60)
    
    # Step 1: Investigate the issue
    print("🔍 Step 1: Investigating the enum issue...")
    investigate_enum_issue()
    
    # Step 2: Fix database enum values
    print("\n🔧 Step 2: Fixing database enum values...")
    db_success = fix_enum_values()
    
    if not db_success:
        print("❌ Failed to fix database enum values!")
        return
    
    # Step 3: Update model enum definitions
    print("\n📝 Step 3: Updating model enum definitions...")
    model_success = update_model_enums()
    
    if not model_success:
        print("❌ Failed to update model enum definitions!")
        return
    
    # Step 4: Verify the fix
    print("\n🔍 Step 4: Verifying the fix...")
    verify_success = verify_enum_fix()
    
    if verify_success:
        print("\n🎉 Enum values issue has been resolved!")
        print("💡 The database and model enums now use consistent uppercase values!")
        print("💡 You can now restart your application and try the checkout process!")
    else:
        print("❌ Failed to verify the enum fix!")


if __name__ == "__main__":
    main()