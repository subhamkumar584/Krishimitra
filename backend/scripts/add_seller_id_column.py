#!/usr/bin/env python3
"""
Database migration script to add seller_id column to orders table.

This script adds the missing seller_id column to the orders table that is 
referenced in the Order model but doesn't exist in the database schema.
"""
import sys
import os
import pymysql
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings


def add_seller_id_column():
    """Add seller_id column to orders table if it doesn't exist."""
    print("🔄 Starting database migration...")
    print(f"📊 Database URL: {settings.DATABASE_URL.replace('password', '***')}")
    
    try:
        # Create engine
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Start a transaction
            trans = connection.begin()
            
            try:
                # Check if seller_id column already exists
                print("🔍 Checking if seller_id column exists...")
                
                check_column_query = text("""
                    SELECT COUNT(*) as count 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'orders' 
                    AND COLUMN_NAME = 'seller_id'
                """)
                
                result = connection.execute(check_column_query)
                column_exists = result.fetchone()[0] > 0
                
                if column_exists:
                    print("✅ seller_id column already exists in orders table.")
                    trans.rollback()
                    return True
                
                print("➕ Adding seller_id column to orders table...")
                
                # Add the seller_id column
                alter_query = text("""
                    ALTER TABLE orders 
                    ADD COLUMN seller_id INT NOT NULL,
                    ADD FOREIGN KEY (seller_id) REFERENCES users(id)
                """)
                
                connection.execute(alter_query)
                
                print("✅ Successfully added seller_id column to orders table!")
                
                # Commit the transaction
                trans.commit()
                
                return True
                
            except Exception as e:
                print(f"❌ Error during migration: {e}")
                trans.rollback()
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False


def verify_column():
    """Verify that the seller_id column was added successfully."""
    print("🔍 Verifying seller_id column...")
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Get column information
            describe_query = text("DESCRIBE orders")
            result = connection.execute(describe_query)
            columns = result.fetchall()
            
            print("📋 Current orders table structure:")
            for column in columns:
                print(f"   - {column[0]} ({column[1]})")
            
            # Check specifically for seller_id
            seller_id_exists = any(column[0] == 'seller_id' for column in columns)
            
            if seller_id_exists:
                print("✅ seller_id column successfully verified!")
                return True
            else:
                print("❌ seller_id column not found!")
                return False
                
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False


def main():
    """Main migration function."""
    print("🚀 KrishiMitra Database Migration: Add seller_id column to orders table")
    print("=" * 70)
    
    # Step 1: Add the column
    success = add_seller_id_column()
    
    if not success:
        print("❌ Migration failed!")
        sys.exit(1)
    
    # Step 2: Verify the column
    verified = verify_column()
    
    if verified:
        print("🎉 Migration completed successfully!")
        print("💡 You can now restart your application - the checkout button should work!")
    else:
        print("⚠️  Migration may have issues. Please check manually.")
        sys.exit(1)


if __name__ == "__main__":
    main()