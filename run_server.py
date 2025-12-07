from backend.app import create_app
from waitress import serve

app = create_app()

if __name__ == "__main__":
    # Allow larger uploads (e.g., plant images)
    serve(app, host="0.0.0.0", port=8000, max_request_body_size=32 * 1024 * 1024)
