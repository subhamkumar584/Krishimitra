#!/usr/bin/env python3
"""
Add approval-related columns to users table if they don't exist (MySQL).
Columns: aadhaar_number VARCHAR(20) NULL, pan_number VARCHAR(20) NULL, is_approved TINYINT(1) NOT NULL DEFAULT 1
"""
import sys, os
from sqlalchemy import create_engine, text

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from app.config import settings

def column_exists(conn, table, column):
    q = text(
        """
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column
        """
    )
    return conn.execute(q, {"table": table, "column": column}).scalar() > 0

def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.begin() as conn:
        print("Checking users table...")
        if not column_exists(conn, 'users', 'aadhaar_number'):
            print("Adding aadhaar_number column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN aadhaar_number VARCHAR(20) NULL"))
        else:
            print("aadhaar_number already exists")
        if not column_exists(conn, 'users', 'pan_number'):
            print("Adding pan_number column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN pan_number VARCHAR(20) NULL"))
        else:
            print("pan_number already exists")
        if not column_exists(conn, 'users', 'is_approved'):
            print("Adding is_approved column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN is_approved TINYINT(1) NOT NULL DEFAULT 1"))
        else:
            print("is_approved already exists")
    print("Done.")

if __name__ == '__main__':
    main()
