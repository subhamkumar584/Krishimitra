#!/usr/bin/env python3
"""
KrishiMitra Backend Server Startup Script
"""
from app import create_app

if __name__ == "__main__":
    print("🚀 Starting KrishiMitra Backend Server...")
    app = create_app()
    
    print("✅ Server will run at http://localhost:8000")
    print("📊 Available API Endpoints:")
    print("   - GET /api/v1/info/market-prices (mandi data)")
    print("   - GET /api/v1/weather?lat=X&lon=Y (weather data)")
    print("🔄 Press Ctrl+C to stop")
    print("-" * 50)
    
    try:
        app.run(host='0.0.0.0', port=8000, debug=True)
    except KeyboardInterrupt:
        print("🛑 Server stopped")