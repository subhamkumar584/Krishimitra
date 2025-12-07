#!/usr/bin/env python3
"""
Simple Flask application runner for testing APIs
"""

from app import create_app

if __name__ == "__main__":
    app = create_app()
    print("Starting Flask server...")
    print("Server will be available at: http://localhost:5000")
    print("API Base URL: http://localhost:5000/api/v1/")
    print("Health Check: http://localhost:5000/health")
    app.run(debug=True, host="0.0.0.0", port=5000)