#!/usr/bin/env python3
"""
Comprehensive database schema synchronization script.

This script ensures all tables are synchronized with their corresponding SQLAlchemy models.
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def check_all_tables():
    """Check all critical tables for schema consistency."""
    
    # Define expected schemas for critical tables
    expected_schemas = {
        'users': [
            'id', 'created_at', 'email', 'phone', 'name', 'role', 'password_hash', 'locale'
        ],
        'products': [
            'id', 'created_at', 'seller_id', 'title', 'description', 'category', 
            'price', 'unit', 'stock', 'location', 'image_url', 'status'
        ],
        'orders': [
            'id', 'created_at', 'buyer_id', 'seller_id', 'status', 'payment_status',
            'subtotal', 'delivery_charges', 'total_amount', 'delivery_address', 
            'delivery_phone', 'delivery_scheduled_at', 'delivered_at', 
            'razorpay_order_id', 'razorpay_payment_id'
        ],
        'order_items': [
            'id', 'order_id', 'product_id', 'quantity', 'price_per_unit', 'total_price'
        ],
        'cart_items': [
            'id', 'created_at', 'user_id', 'product_id', 'quantity'
        ]
    }
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            all_good = True
            
            for table_name, expected_columns in expected_schemas.items():
                print(f"\n🔍 Checking {table_name} table...")
                
                # Check if table exists
                table_check = connection.execute(text(f"""
                    SELECT COUNT(*) as count 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = '{table_name}'
                """))
                
                table_exists = table_check.fetchone()[0] > 0
                
                if not table_exists:
                    print(f"   ❌ {table_name} table does not exist!")
                    all_good = False
                    continue
                
                # Get existing columns
                result = connection.execute(text(f"DESCRIBE {table_name}"))
                existing_columns = {col[0] for col in result.fetchall()}
                
                # Check for missing columns
                missing_columns = [col for col in expected_columns if col not in existing_columns]
                extra_columns = [col for col in existing_columns if col not in expected_columns]
                
                if missing_columns:
                    print(f"   ❌ Missing columns in {table_name}: {', '.join(missing_columns)}")
                    all_good = False
                elif extra_columns:
                    print(f"   ⚠️  Extra columns in {table_name}: {', '.join(extra_columns)}")
                    print(f"   ✅ All expected columns present in {table_name}")
                else:
                    print(f"   ✅ {table_name} table schema is correct")
            
            return all_good
            
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return False


def get_table_creation_status():
    """Check which tables exist in the database."""
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE()
                ORDER BY TABLE_NAME
            """))
            
            existing_tables = [row[0] for row in result.fetchall()]
            
            print("📋 Existing tables in database:")
            for table in existing_tables:
                print(f"   - {table}")
            
            return existing_tables
            
    except Exception as e:
        print(f"❌ Error getting table list: {e}")
        return []


def recreate_missing_tables():
    """Use SQLAlchemy to create any missing tables."""
    print("\n🔄 Using SQLAlchemy to ensure all tables exist...")
    
    try:
        from app.db import Base, init_engine
        
        engine = init_engine(settings.DATABASE_URL)
        
        # This will create any missing tables
        Base.metadata.create_all(bind=engine)
        
        print("✅ SQLAlchemy table creation completed")
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables with SQLAlchemy: {e}")
        return False


def main():
    """Main function to check and synchronize all tables."""
    print("🚀 KrishiMitra Database Schema Synchronization")
    print("=" * 60)
    
    # Step 1: Show existing tables
    print("🔍 Step 1: Checking existing tables...")
    existing_tables = get_table_creation_status()
    
    # Step 2: Use SQLAlchemy to create missing tables
    print("\n🔄 Step 2: Ensuring all tables exist...")
    recreate_success = recreate_missing_tables()
    
    if not recreate_success:
        print("❌ Failed to create missing tables!")
        return
    
    # Step 3: Check schema consistency
    print("\n🔍 Step 3: Checking schema consistency...")
    schema_ok = check_all_tables()
    
    if schema_ok:
        print("\n🎉 All database tables are properly synchronized!")
        print("💡 Your application should now work without schema-related errors!")
    else:
        print("\n⚠️  Some tables still have schema issues.")
        print("💡 You may need to run specific migration scripts for individual tables.")
    
    # Step 4: Final table list
    print("\n📋 Final table status:")
    get_table_creation_status()


if __name__ == "__main__":
    main()