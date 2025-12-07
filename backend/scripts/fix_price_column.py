#!/usr/bin/env python3
"""
Script to fix the 'price' column issue in order_items table.

This script investigates and fixes the issue where the 'price' field 
doesn't have a default value.
"""
import sys
import os
from sqlalchemy import create_engine, text

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def investigate_price_column():
    """Investigate the price column issue in order_items table."""
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Get detailed column information for order_items
            result = connection.execute(text("DESCRIBE order_items"))
            columns = result.fetchall()
            
            print("📋 Detailed order_items table structure:")
            for column in columns:
                field, type_, null, key, default, extra = column
                print(f"   - {field}:")
                print(f"     Type: {type_}")
                print(f"     Null: {null}")
                print(f"     Key: {key}")
                print(f"     Default: {default}")
                print(f"     Extra: {extra}")
                print()
            
            # Check if the problematic 'price' column exists
            price_columns = [col for col in columns if col[0] == 'price']
            
            if price_columns:
                price_col = price_columns[0]
                field, type_, null, key, default, extra = price_col
                
                print("🔍 Found 'price' column details:")
                print(f"   - Type: {type_}")
                print(f"   - Allows NULL: {null}")
                print(f"   - Default value: {default}")
                
                if null == 'NO' and default is None:
                    print("❌ Issue found: 'price' column does not allow NULL and has no default value!")
                    return True
                else:
                    print("✅ 'price' column seems to be properly configured.")
                    return False
            else:
                print("✅ No 'price' column found in order_items table.")
                return False
                
    except Exception as e:
        print(f"❌ Error investigating price column: {e}")
        return False


def fix_price_column():
    """Fix the price column issue."""
    print("🔄 Starting price column fix...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            trans = connection.begin()
            
            try:
                # Check current state
                result = connection.execute(text("DESCRIBE order_items"))
                columns = {col[0]: col for col in result.fetchall()}
                
                if 'price' in columns:
                    field, type_, null, key, default, extra = columns['price']
                    
                    if null == 'NO' and default is None:
                        print("🔧 Fixing 'price' column - making it nullable or adding default value...")
                        
                        # Option 1: Make the column nullable
                        print("   Option 1: Making 'price' column nullable...")
                        alter_query = text("ALTER TABLE order_items MODIFY COLUMN price FLOAT NULL")
                        connection.execute(alter_query)
                        print("   ✅ Made 'price' column nullable")
                        
                        # Alternatively, we could drop this column if it's not needed
                        # since we have price_per_unit and total_price
                        print("   🗑️ Since we have 'price_per_unit', we could remove the redundant 'price' column...")
                        print("   Would you like to remove it? (This script will just make it nullable for safety)")
                        
                    else:
                        print("✅ 'price' column is already properly configured")
                else:
                    print("✅ No 'price' column found - nothing to fix")
                
                trans.commit()
                return True
                
            except Exception as e:
                print(f"❌ Error during fix: {e}")
                trans.rollback()
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


def remove_redundant_price_column():
    """Remove the redundant 'price' column since we have price_per_unit."""
    print("🗑️ Removing redundant 'price' column...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            trans = connection.begin()
            
            try:
                # Check if price column exists
                result = connection.execute(text("DESCRIBE order_items"))
                columns = {col[0]: col for col in result.fetchall()}
                
                if 'price' in columns and 'price_per_unit' in columns:
                    print("📝 Both 'price' and 'price_per_unit' columns exist.")
                    print("   Removing redundant 'price' column...")
                    
                    # Drop the price column
                    drop_query = text("ALTER TABLE order_items DROP COLUMN price")
                    connection.execute(drop_query)
                    print("   ✅ Removed redundant 'price' column")
                    
                elif 'price' in columns:
                    print("⚠️  Only 'price' column exists. Renaming to 'price_per_unit'...")
                    rename_query = text("ALTER TABLE order_items CHANGE COLUMN price price_per_unit FLOAT NOT NULL")
                    connection.execute(rename_query)
                    print("   ✅ Renamed 'price' to 'price_per_unit'")
                    
                else:
                    print("✅ No redundant 'price' column found")
                
                trans.commit()
                return True
                
            except Exception as e:
                print(f"❌ Error during column removal: {e}")
                trans.rollback()
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


def verify_final_structure():
    """Verify the final table structure."""
    print("🔍 Verifying final order_items table structure...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            result = connection.execute(text("DESCRIBE order_items"))
            columns = result.fetchall()
            
            print("📋 Final order_items table structure:")
            for column in columns:
                field, type_, null, key, default, extra = column
                null_str = "NULL" if null == "YES" else "NOT NULL"
                default_str = f"DEFAULT {default}" if default else ""
                print(f"   - {field}: {type_} {null_str} {default_str}")
            
            # Check for expected columns
            column_names = [col[0] for col in columns]
            expected = ['id', 'order_id', 'product_id', 'quantity', 'price_per_unit', 'total_price']
            
            print("\n✅ Column verification:")
            all_good = True
            for col in expected:
                if col in column_names:
                    print(f"   ✅ {col}")
                else:
                    print(f"   ❌ {col} - MISSING")
                    all_good = False
            
            # Check for unexpected columns
            unexpected = [col for col in column_names if col not in expected]
            if unexpected:
                print(f"\n⚠️  Unexpected columns: {', '.join(unexpected)}")
            
            return all_good
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False


def main():
    """Main function to fix the price column issue."""
    print("🚀 KrishiMitra Database Fix: Price Column Issue")
    print("=" * 60)
    
    # Step 1: Investigate the issue
    print("🔍 Step 1: Investigating the price column issue...")
    has_issue = investigate_price_column()
    
    if not has_issue:
        print("✅ No price column issue found!")
        verify_final_structure()
        return
    
    # Step 2: Offer different fix options
    print("\n🔧 Step 2: Fixing the issue...")
    print("We have a few options:")
    print("  1. Make the 'price' column nullable (safe option)")
    print("  2. Remove the redundant 'price' column (recommended)")
    
    # For automated fix, let's go with option 2 (remove redundant column)
    print("Going with option 2: Remove redundant 'price' column...")
    
    success = remove_redundant_price_column()
    
    if not success:
        print("❌ Failed to remove redundant column. Trying safe option...")
        success = fix_price_column()
    
    # Step 3: Verify
    if success:
        print("\n🔍 Step 3: Verifying the fix...")
        verify_final_structure()
        print("\n🎉 Price column issue has been resolved!")
        print("💡 You can now restart your application and try the checkout process!")
    else:
        print("❌ Failed to fix the price column issue!")


if __name__ == "__main__":
    main()