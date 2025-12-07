#!/usr/bin/env python3
"""
Quick verification script to check the orders table structure.
"""
import sys
import os

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings
from sqlalchemy import create_engine, text

def check_orders_table():
    """Check the current structure of the orders table."""
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        with engine.connect() as connection:
            # Get column information
            result = connection.execute(text("DESCRIBE orders"))
            columns = result.fetchall()
            
            print("📋 Current orders table structure:")
            for column in columns:
                print(f"   - {column[0]} ({column[1]})")
            
            # Check for the key columns from the model
            column_names = [col[0] for col in columns]
            required_columns = ['id', 'created_at', 'buyer_id', 'seller_id', 'status', 'payment_status', 
                              'subtotal', 'delivery_charges', 'total_amount', 'delivery_address', 
                              'delivery_phone', 'delivery_scheduled_at', 'delivered_at', 
                              'razorpay_order_id', 'razorpay_payment_id']
            
            print("\n✅ Column verification:")
            for col in required_columns:
                if col in column_names:
                    print(f"   ✅ {col}")
                else:
                    print(f"   ❌ {col} - MISSING")
                    
        return True
                    
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Verifying orders table structure...")
    print("=" * 50)
    check_orders_table()