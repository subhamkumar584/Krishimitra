#!/usr/bin/env python3
"""
Create table equipmetal_equipments if it doesn't exist (MySQL-compatible).
Columns:
- id INT PK AUTO_INCREMENT
- created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- provider_id INT NOT NULL (FK users.id)
- equipment_id INT NOT NULL UNIQUE (FK equipments.id)
Indexes: provider_id, UNIQUE(equipment_id)
"""
import sys, os
from sqlalchemy import create_engine, text

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from app.config import settings

def table_exists(conn, table):
    q = text(
        """
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
        """
    )
    return conn.execute(q, {"table": table}).scalar() > 0

def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.begin() as conn:
        if not table_exists(conn, 'equipmetal_equipments'):
            conn.execute(text(
                """
                CREATE TABLE equipmetal_equipments (
                  id INT NOT NULL AUTO_INCREMENT,
                  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  provider_id INT NOT NULL,
                  equipment_id INT NOT NULL,
                  PRIMARY KEY (id),
                  UNIQUE KEY uq_equipment (equipment_id),
                  KEY idx_provider (provider_id),
                  CONSTRAINT fk_equipmetal_provider FOREIGN KEY (provider_id) REFERENCES users(id),
                  CONSTRAINT fk_equipmetal_equipment FOREIGN KEY (equipment_id) REFERENCES equipments(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            ))
            print("Created table equipmetal_equipments")
        else:
            print("Table equipmetal_equipments already exists")
    print("Done.")

if __name__ == '__main__':
    main()