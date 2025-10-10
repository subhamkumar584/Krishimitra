#!/usr/bin/env bash
# Dev helper (bash) - optional
export FLASK_APP=backend/wsgi.py
export FLASK_ENV=development
flask run --host 0.0.0.0 --port 8000
