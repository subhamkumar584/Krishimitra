#!/usr/bin/env python3
"""
Script to check and fix the order_items table structure.

This script identifies missing columns in the order_items table compared to the OrderItem model.
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def check_order_items_table():
    """Check the current structure of the order_items table."""
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Check if order_items table exists
            table_check = connection.execute(text("""
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'order_items'
            """))
            
            table_exists = table_check.fetchone()[0] > 0
            
            if not table_exists:
                print("❌ order_items table does not exist!")
                return False
            
            # Get column information
            result = connection.execute(text("DESCRIBE order_items"))
            columns = result.fetchall()
            
            print("📋 Current order_items table structure:")
            for column in columns:
                print(f"   - {column[0]} ({column[1]})")
            
            # Check for the key columns from the OrderItem model
            column_names = [col[0] for col in columns]
            required_columns = ['id', 'order_id', 'product_id', 'quantity', 
                              'price_per_unit', 'total_price']
            
            print("\n✅ Column verification:")
            missing_columns = []
            for col in required_columns:
                if col in column_names:
                    print(f"   ✅ {col}")
                else:
                    print(f"   ❌ {col} - MISSING")
                    missing_columns.append(col)
            
            return len(missing_columns) == 0
                    
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def fix_order_items_table():
    """Fix the order_items table by adding missing columns or creating the table."""
    print("🔄 Starting order_items table migration...")
    
    # Expected columns from the OrderItem model
    model_columns = {
        'id': 'INT PRIMARY KEY AUTO_INCREMENT',
        'order_id': 'INT NOT NULL',
        'product_id': 'INT NOT NULL', 
        'quantity': 'FLOAT NOT NULL',
        'price_per_unit': 'FLOAT NOT NULL',
        'total_price': 'FLOAT NOT NULL'
    }
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            trans = connection.begin()
            
            try:
                # Check if table exists
                table_check = connection.execute(text("""
                    SELECT COUNT(*) as count 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'order_items'
                """))
                
                table_exists = table_check.fetchone()[0] > 0
                
                if not table_exists:
                    print("📝 Creating order_items table...")
                    create_table_query = text("""
                        CREATE TABLE order_items (
                            id INT PRIMARY KEY AUTO_INCREMENT,
                            order_id INT NOT NULL,
                            product_id INT NOT NULL,
                            quantity FLOAT NOT NULL,
                            price_per_unit FLOAT NOT NULL,
                            total_price FLOAT NOT NULL,
                            FOREIGN KEY (order_id) REFERENCES orders(id),
                            FOREIGN KEY (product_id) REFERENCES products(id)
                        )
                    """)
                    connection.execute(create_table_query)
                    print("✅ order_items table created successfully!")
                else:
                    print("📋 order_items table exists, checking for missing columns...")
                    
                    # Get existing columns
                    result = connection.execute(text("DESCRIBE order_items"))
                    existing_columns = {col[0] for col in result.fetchall()}
                    
                    # Find missing columns
                    missing_columns = {}
                    for col_name, col_definition in model_columns.items():
                        if col_name not in existing_columns:
                            missing_columns[col_name] = col_definition
                    
                    if missing_columns:
                        print(f"📋 Found {len(missing_columns)} missing columns:")
                        for col_name in missing_columns.keys():
                            print(f"   - {col_name}")
                        
                        # Add missing columns
                        for col_name, col_definition in missing_columns.items():
                            print(f"➕ Adding column: {col_name}")
                            alter_query = text(f"ALTER TABLE order_items ADD COLUMN {col_name} {col_definition}")
                            connection.execute(alter_query)
                            print(f"   ✅ Added {col_name}")
                        
                        # Add foreign key constraints if they don't exist
                        try:
                            print("🔗 Adding foreign key constraints...")
                            connection.execute(text("""
                                ALTER TABLE order_items 
                                ADD CONSTRAINT fk_order_items_order_id 
                                FOREIGN KEY (order_id) REFERENCES orders(id)
                            """))
                            print("   ✅ Added order_id foreign key")
                        except Exception:
                            print("   ⚠️ order_id foreign key already exists or failed to add")
                        
                        try:
                            connection.execute(text("""
                                ALTER TABLE order_items 
                                ADD CONSTRAINT fk_order_items_product_id 
                                FOREIGN KEY (product_id) REFERENCES products(id)
                            """))
                            print("   ✅ Added product_id foreign key")
                        except Exception:
                            print("   ⚠️ product_id foreign key already exists or failed to add")
                    else:
                        print("✅ All required columns already exist!")
                
                trans.commit()
                return True
                
            except Exception as e:
                print(f"❌ Error during migration: {e}")
                trans.rollback()
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


def main():
    """Main function."""
    print("🚀 KrishiMitra Database Migration: Fix order_items table")
    print("=" * 60)
    
    # Check current state
    print("🔍 Checking current order_items table structure...")
    
    # Fix the table
    success = fix_order_items_table()
    
    if success:
        print("\n🔍 Verifying final structure...")
        check_order_items_table()
        print("\n🎉 order_items table migration completed successfully!")
        print("💡 You can now restart your application - the checkout button should work!")
    else:
        print("❌ Migration failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()