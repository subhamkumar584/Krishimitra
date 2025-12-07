#!/usr/bin/env python3
"""
Comprehensive database migration script to sync orders table with the current model.

This script adds all missing columns from the Order model to the orders table.
"""
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def get_missing_columns():
    """Get list of columns that exist in model but not in database."""
    # Expected columns from the Order model
    model_columns = {
        'id': 'INT PRIMARY KEY AUTO_INCREMENT',
        'created_at': 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'buyer_id': 'INT NOT NULL',
        'seller_id': 'INT NOT NULL',
        'status': "ENUM('created','confirmed','processing','shipped','delivered','cancelled','refunded') DEFAULT 'created'",
        'payment_status': "ENUM('pending','authorized','captured','failed','refunded') DEFAULT 'pending'",
        'subtotal': 'FLOAT NOT NULL',
        'delivery_charges': 'FLOAT DEFAULT 0.0',
        'total_amount': 'FLOAT NOT NULL',
        'delivery_address': 'TEXT NULL',
        'delivery_phone': 'VARCHAR(20) NULL',
        'delivery_scheduled_at': 'DATETIME NULL',
        'delivered_at': 'DATETIME NULL',
        'razorpay_order_id': 'VARCHAR(64) NULL',
        'razorpay_payment_id': 'VARCHAR(64) NULL'
    }
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Get existing columns
            result = connection.execute(text("DESCRIBE orders"))
            existing_columns = {col[0] for col in result.fetchall()}
            
            # Find missing columns
            missing_columns = {}
            for col_name, col_definition in model_columns.items():
                if col_name not in existing_columns:
                    missing_columns[col_name] = col_definition
                    
            return missing_columns, existing_columns
            
    except Exception as e:
        print(f"❌ Error getting column information: {e}")
        return {}, set()


def add_missing_columns():
    """Add all missing columns to the orders table."""
    print("🔄 Starting comprehensive database migration...")
    print(f"📊 Database URL: {settings.DATABASE_URL.replace(settings.DATABASE_URL.split('@')[0].split('://')[-1], '***')}")
    
    missing_columns, existing_columns = get_missing_columns()
    
    if not missing_columns:
        print("✅ All columns are already present in the orders table!")
        return True
        
    print(f"📋 Found {len(missing_columns)} missing columns:")
    for col_name in missing_columns.keys():
        print(f"   - {col_name}")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            trans = connection.begin()
            
            try:
                # Add missing columns one by one
                for col_name, col_definition in missing_columns.items():
                    print(f"➕ Adding column: {col_name}")
                    
                    # Special handling for different column types
                    if col_name == 'payment_status':
                        alter_query = text(f"""
                            ALTER TABLE orders 
                            ADD COLUMN payment_status ENUM('pending','authorized','captured','failed','refunded') 
                            DEFAULT 'pending'
                        """)
                    elif col_name == 'status' and 'status' in existing_columns:
                        # Status column exists but might need to be updated to ENUM
                        print(f"   ⚠️ Skipping {col_name} - already exists (might need manual update)")
                        continue
                    else:
                        alter_query = text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_definition}")
                    
                    connection.execute(alter_query)
                    print(f"   ✅ Added {col_name}")
                
                # Add foreign key constraints
                if 'seller_id' in missing_columns:
                    print("🔗 Adding foreign key constraint for seller_id...")
                    connection.execute(text("""
                        ALTER TABLE orders 
                        ADD CONSTRAINT fk_orders_seller_id 
                        FOREIGN KEY (seller_id) REFERENCES users(id)
                    """))
                
                if 'buyer_id' not in [fk[0] for fk in connection.execute(text("""
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'orders' 
                    AND REFERENCED_TABLE_NAME = 'users'
                    AND COLUMN_NAME = 'buyer_id'
                """)).fetchall()]:
                    print("🔗 Adding foreign key constraint for buyer_id...")
                    try:
                        connection.execute(text("""
                            ALTER TABLE orders 
                            ADD CONSTRAINT fk_orders_buyer_id 
                            FOREIGN KEY (buyer_id) REFERENCES users(id)
                        """))
                    except Exception as e:
                        print(f"   ⚠️ Note: Could not add buyer_id foreign key: {e}")
                
                print("✅ Successfully added all missing columns!")
                trans.commit()
                return True
                
            except Exception as e:
                print(f"❌ Error during migration: {e}")
                trans.rollback()
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


def verify_schema():
    """Verify the final table schema."""
    print("🔍 Verifying updated schema...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            result = connection.execute(text("DESCRIBE orders"))
            columns = result.fetchall()
            
            print("📋 Final orders table structure:")
            for column in columns:
                print(f"   - {column[0]} ({column[1]})")
                
            # Check for foreign keys
            fk_result = connection.execute(text("""
                SELECT 
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = 'orders' 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            """))
            
            foreign_keys = fk_result.fetchall()
            if foreign_keys:
                print("\n🔗 Foreign key constraints:")
                for fk in foreign_keys:
                    print(f"   - {fk[0]} → {fk[1]}.{fk[2]}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False


def main():
    """Main migration function."""
    print("🚀 KrishiMitra Database Migration: Sync orders table with model")
    print("=" * 70)
    
    # Step 1: Add missing columns
    success = add_missing_columns()
    
    if not success:
        print("❌ Migration failed!")
        sys.exit(1)
    
    # Step 2: Verify the schema
    verified = verify_schema()
    
    if verified:
        print("\n🎉 Migration completed successfully!")
        print("💡 Your orders table is now synced with the model definition!")
        print("💡 You can now restart your application - the checkout button should work!")
    else:
        print("⚠️  Migration may have issues. Please check manually.")
        sys.exit(1)


if __name__ == "__main__":
    main()