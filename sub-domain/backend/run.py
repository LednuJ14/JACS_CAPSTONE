#!/usr/bin/env python3
"""
JACS Property Management System Backend
Main application entry point
"""

from app import create_app
from flask import jsonify
import os

# Create Flask application
app = create_app()

if __name__ == '__main__':
    # Run the application
    # Use a distinct default port to avoid clashing with main-domain backend
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print("="*50)
    print("🏢 JACS Property Management System")
    print("🚀 Starting Flask Backend Server...")
    print(f"📡 Running on: http://localhost:{port}")
    print(f"🔧 Environment: {os.environ.get('FLASK_ENV', 'development')}")
    print(f"🐛 Debug Mode: {debug}")
    print("="*50)
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )