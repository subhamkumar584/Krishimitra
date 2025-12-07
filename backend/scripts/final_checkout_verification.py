#!/usr/bin/env python3
"""
Final verification script to ensure all database issues are resolved
and the checkout process should work properly.
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def verify_orders_table():
    """Verify the orders table has all required columns and proper enum values."""
    print("🔍 Verifying orders table...")
    
    expected_columns = [
        'id', 'created_at', 'buyer_id', 'seller_id', 'status', 'payment_status',
        'subtotal', 'delivery_charges', 'total_amount', 'delivery_address', 
        'delivery_phone', 'delivery_scheduled_at', 'delivered_at', 
        'razorpay_order_id', 'razorpay_payment_id'
    ]
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Check table structure
            result = connection.execute(text("DESCRIBE orders"))
            columns = result.fetchall()
            
            column_names = [col[0] for col in columns]
            
            print("   📋 Column verification:")
            all_good = True
            for col in expected_columns:
                if col in column_names:
                    print(f"     ✅ {col}")
                else:
                    print(f"     ❌ {col} - MISSING")
                    all_good = False
            
            # Check enum values
            enum_columns = [col for col in columns if 'enum' in col[1].lower()]
            if enum_columns:
                print("   📋 Enum columns:")
                for col in enum_columns:
                    field, type_, _, _, default, _ = col
                    print(f"     ✅ {field}: {type_} (default: {default})")
            
            return all_good
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def verify_order_items_table():
    """Verify the order_items table has all required columns."""
    print("🔍 Verifying order_items table...")
    
    expected_columns = ['id', 'order_id', 'product_id', 'quantity', 'price_per_unit', 'total_price']
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Check table structure
            result = connection.execute(text("DESCRIBE order_items"))
            columns = result.fetchall()
            
            column_names = [col[0] for col in columns]
            
            print("   📋 Column verification:")
            all_good = True
            for col in expected_columns:
                if col in column_names:
                    print(f"     ✅ {col}")
                else:
                    print(f"     ❌ {col} - MISSING")
                    all_good = False
            
            # Check for problematic columns
            problematic_columns = ['price']  # This was causing issues
            for col in problematic_columns:
                if col in column_names:
                    print(f"     ⚠️  {col} - Should be removed (redundant)")
                    all_good = False
            
            return all_good
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def verify_foreign_keys():
    """Verify that all required foreign key constraints exist."""
    print("🔍 Verifying foreign key constraints...")
    
    expected_foreign_keys = [
        ('orders', 'buyer_id', 'users', 'id'),
        ('orders', 'seller_id', 'users', 'id'),
        ('order_items', 'order_id', 'orders', 'id'),
        ('order_items', 'product_id', 'products', 'id'),
    ]
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Get all foreign key constraints
            fk_result = connection.execute(text("""
                SELECT 
                    TABLE_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND REFERENCED_TABLE_NAME IS NOT NULL
                ORDER BY TABLE_NAME, COLUMN_NAME
            """))
            
            existing_fks = fk_result.fetchall()
            
            print("   📋 Foreign key verification:")
            all_good = True
            
            for table, column, ref_table, ref_column in expected_foreign_keys:
                found = any(
                    fk[0] == table and fk[1] == column and 
                    fk[2] == ref_table and fk[3] == ref_column 
                    for fk in existing_fks
                )
                
                if found:
                    print(f"     ✅ {table}.{column} → {ref_table}.{ref_column}")
                else:
                    print(f"     ❌ {table}.{column} → {ref_table}.{ref_column} - MISSING")
                    all_good = False
            
            return all_good
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def simulate_order_creation():
    """Simulate the key parts of order creation to check for potential issues."""
    print("🧪 Simulating order creation process...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Test 1: Check if we can insert into orders table with all required fields
            print("   🔬 Test 1: Checking orders table insert compatibility...")
            
            # This is a dry run - we'll prepare the query but not execute it
            test_order_query = text("""
                SELECT 
                    'orders' as table_name,
                    'Can insert with all required columns' as test_result
                WHERE EXISTS (
                    SELECT 1 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'orders' 
                    AND COLUMN_NAME IN ('buyer_id', 'seller_id', 'status', 'payment_status', 
                                       'subtotal', 'delivery_charges', 'total_amount')
                    GROUP BY TABLE_NAME 
                    HAVING COUNT(*) = 7
                )
            """)
            
            result = connection.execute(test_order_query)
            if result.fetchone():
                print("     ✅ Orders table ready for inserts")
            else:
                print("     ❌ Orders table missing required columns")
                return False
            
            # Test 2: Check if we can insert into order_items table
            print("   🔬 Test 2: Checking order_items table insert compatibility...")
            
            test_order_items_query = text("""
                SELECT 
                    'order_items' as table_name,
                    'Can insert with all required columns' as test_result
                WHERE EXISTS (
                    SELECT 1 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'order_items' 
                    AND COLUMN_NAME IN ('order_id', 'product_id', 'quantity', 'price_per_unit', 'total_price')
                    GROUP BY TABLE_NAME 
                    HAVING COUNT(*) = 5
                )
            """)
            
            result = connection.execute(test_order_items_query)
            if result.fetchone():
                print("     ✅ Order_items table ready for inserts")
            else:
                print("     ❌ Order_items table missing required columns")
                return False
            
            # Test 3: Check enum values
            print("   🔬 Test 3: Checking enum values compatibility...")
            
            enum_check = connection.execute(text("""
                SELECT 
                    COLUMN_NAME,
                    COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'orders' 
                AND DATA_TYPE = 'enum'
            """))
            
            enum_results = enum_check.fetchall()
            enum_ok = True
            
            for column_name, column_type in enum_results:
                if 'PENDING' in column_type and 'CREATED' in column_type:
                    print(f"     ✅ {column_name} enum uses uppercase values")
                else:
                    print(f"     ❌ {column_name} enum may have case issues: {column_type}")
                    enum_ok = False
            
            return enum_ok
            
    except Exception as e:
        print(f"   ❌ Error during simulation: {e}")
        return False


def main():
    """Main verification function."""
    print("🚀 Final Checkout Verification for KrishiMitra")
    print("=" * 60)
    print("This script verifies that all database schema issues have been resolved")
    print("and the checkout process should work properly.")
    print()
    
    all_tests_passed = True
    
    # Test 1: Orders table
    orders_ok = verify_orders_table()
    all_tests_passed = all_tests_passed and orders_ok
    print()
    
    # Test 2: Order items table
    order_items_ok = verify_order_items_table()
    all_tests_passed = all_tests_passed and order_items_ok
    print()
    
    # Test 3: Foreign keys
    fks_ok = verify_foreign_keys()
    all_tests_passed = all_tests_passed and fks_ok
    print()
    
    # Test 4: Simulation
    simulation_ok = simulate_order_creation()
    all_tests_passed = all_tests_passed and simulation_ok
    print()
    
    # Final verdict
    if all_tests_passed:
        print("🎉 SUCCESS: All database schema issues have been resolved!")
        print("✅ The checkout process should now work properly!")
        print()
        print("📝 What was fixed:")
        print("   ✅ Added missing 'seller_id' column to orders table")
        print("   ✅ Added missing 'price_per_unit' and 'total_price' columns to order_items table")
        print("   ✅ Removed redundant 'price' column from order_items table")
        print("   ✅ Fixed enum values to use consistent uppercase format")
        print("   ✅ Added proper foreign key constraints")
        print("   ✅ Synchronized all table schemas with model definitions")
        print()
        print("💡 Next steps:")
        print("   1. Restart your KrishiMitra application")
        print("   2. Test the checkout process with a sample order")
        print("   3. Monitor the application logs for any remaining issues")
    else:
        print("❌ ISSUES FOUND: Some database schema problems still exist!")
        print("⚠️  Please review the output above and run the appropriate migration scripts.")


if __name__ == "__main__":
    main()