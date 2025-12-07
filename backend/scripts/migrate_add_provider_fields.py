#!/usr/bin/env python3
"""
Add provider-related columns to users table if they don't exist (MySQL-compatible).
Columns:
- company_name VARCHAR(255) NULL
- gst_number VARCHAR(64) NULL
- service_categories JSON NULL
- verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified'
- address TEXT NULL
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
        print("Checking users table for provider columns...")
        if not column_exists(conn, 'users', 'company_name'):
            print("Adding company_name column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN company_name VARCHAR(255) NULL"))
        else:
            print("company_name already exists")
        if not column_exists(conn, 'users', 'gst_number'):
            print("Adding gst_number column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN gst_number VARCHAR(64) NULL"))
        else:
            print("gst_number already exists")
        if not column_exists(conn, 'users', 'service_categories'):
            print("Adding service_categories column (JSON)...")
            conn.execute(text("ALTER TABLE users ADD COLUMN service_categories JSON NULL"))
        else:
            print("service_categories already exists")
        if not column_exists(conn, 'users', 'verification_status'):
            print("Adding verification_status column with default 'unverified'...")
            conn.execute(text("ALTER TABLE users ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified'"))
        else:
            print("verification_status already exists")
        if not column_exists(conn, 'users', 'address'):
            print("Adding address column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN address TEXT NULL"))
        else:
            print("address already exists")
    print("Done.")

if __name__ == '__main__':
    main()