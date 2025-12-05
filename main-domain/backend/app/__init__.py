"""
Flask Application Factory
"""
import os
import re
from flask import Flask
from flask import send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flasgger import Swagger

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
jwt = JWTManager()
bcrypt = Bcrypt()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)
mail = Mail()
swagger = Swagger()

def create_app(config_name=None):
    """
    Create and configure the Flask application.
    
    Args:
        config_name (str): Configuration environment name
        
    Returns:
        Flask: Configured Flask application instance
    """
    # Set template directory to the backend/templates folder
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
    app = Flask(__name__, template_folder=template_dir)
    
    # Load configuration
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    from config import config
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    # Configure CORS to allow all required localhost and subdomain origins
    raw_origins = app.config.get('CORS_ORIGINS') or [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://*.localhost:3000",
        "http://*.localhost:8080",
    ]
    def format_origins(origins):
        formatted = []
        for origin in origins:
            if isinstance(origin, str) and '*' in origin:
                pattern = re.escape(origin).replace(r'\*', r'.*')
                formatted.append(re.compile(f"^{pattern}$"))
            else:
                formatted.append(origin)
        return formatted
    allowed_origins = format_origins(raw_origins)
    
    # Configure CORS - use simpler configuration for better compatibility
    # In development, allow all localhost origins explicitly
    if app.config.get('FLASK_ENV') == 'development':
        # For development, allow all localhost variants
        dev_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
        cors.init_app(
            app,
            supports_credentials=True,
            resources={r"/api/*": {
                "origins": dev_origins,
                "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
                "expose_headers": ["Content-Type", "Authorization"],
                "max_age": 3600,
            }},
        )
    else:
        # Production: use restricted origins
        cors.init_app(
            app,
            supports_credentials=True,
            resources={
                r"/api/*": {
                    "origins": allowed_origins,
                    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
                    "expose_headers": ["Content-Type", "Authorization"],
                    "max_age": 3600,
                }
            },
        )
    jwt.init_app(app)
    bcrypt.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)
    
    # Handle CORS preflight requests explicitly to avoid redirect issues
    # This must come before any route handlers to prevent redirects during preflight
    @app.before_request
    def handle_cors_preflight():
        from flask import request, make_response
        if request.method == 'OPTIONS':
            # Return CORS headers immediately without any redirects
            response = make_response()
            origin = request.headers.get('Origin')
            if origin and origin in ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'http://127.0.0.1:8080']:
                response.headers.add('Access-Control-Allow-Origin', origin)
            else:
                response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.headers.add('Access-Control-Max-Age', '3600')
            return response
    
    # Register blueprints
    register_blueprints(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register JWT handlers
    register_jwt_handlers(app)

    # Configure Swagger / OpenAPI documentation
    # This is scoped to /api routes only and should not affect existing behavior.
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "JACS Property Platform API",
            "description": "Interactive API documentation for the main-domain backend.\n\n"
                           "Note: This documentation is generated automatically from the existing Flask routes "
                           "and may not include every detail of request/response payloads.",
            "version": "1.0.0",
        },
        "basePath": "/",
        "schemes": ["http", "https"],
    }

    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec_main",
                "route": "/api/swagger.json",
                # Limit to API routes only so other Flask endpoints are untouched
                "rule_filter": lambda rule: rule.rule.startswith("/api/"),
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        # Swagger UI will be served at /api/docs/
        "specs_route": "/api/docs/",
    }

    Swagger(app, template=swagger_template, config=swagger_config)
    
    # Create upload directory if it doesn't exist
    upload_dir = os.path.join(app.instance_path, app.config['UPLOAD_FOLDER'])
    os.makedirs(upload_dir, exist_ok=True)

    # Serve uploaded files from instance/uploads via /uploads/*
    @app.route('/uploads/<path:filename>')
    def uploaded_files(filename):
        return send_from_directory(upload_dir, filename)
    
    return app

def register_blueprints(app):
    """Register application blueprints."""
    # Swap to v2 auth controller (service-backed)
    from app.controllers.auth_controller_v2 import auth_bp
    # Swap to v2 users controller (service-backed)
    from app.controllers.users_controller_v2 import users_bp
    # Swap to v2 properties controller (service-backed)
    from app.controllers.properties_controller_v2 import properties_bp
    # Swap to v2 subscriptions controller (service-backed)
    from app.controllers.subscriptions_controller_v2 import subscriptions_bp
    # Swap to v2 admin controller (service-backed)
    from app.controllers.admin_controller_v2 import admin_bp
    from app.routes.admin_properties import admin_properties_bp
    from app.routes.admin_analytics import admin_analytics_bp
    from app.routes.admin_documents import admin_documents_bp
    from app.routes.manager_properties import manager_properties_bp
    from app.routes.manager_inquiries_new import manager_inquiries_bp
    from app.routes.manager_analytics import manager_analytics_bp
    from app.routes.tenant_inquiries_new import tenant_inquiries_bp
    from app.routes.tenant_profile import tenant_profile_bp
    from app.routes.tenant_notifications import tenant_notifications_bp
    from app.routes.manager_notifications import manager_notifications_bp
    from app.routes.admin_notifications import admin_notifications_bp
    from app.routes.public_units import public_units_bp
    from app.routes.inquiry_attachments import inquiry_attachments_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(properties_bp, url_prefix='/api/properties')
    app.register_blueprint(subscriptions_bp, url_prefix='/api/subscriptions')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_properties_bp, url_prefix='/api/admin/properties')
    app.register_blueprint(admin_analytics_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_documents_bp, url_prefix='/api/admin')
    app.register_blueprint(manager_properties_bp, url_prefix='/api/manager/properties')
    app.register_blueprint(manager_inquiries_bp, url_prefix='/api/manager/inquiries')
    app.register_blueprint(manager_analytics_bp, url_prefix='/api/manager/analytics')
    app.register_blueprint(tenant_inquiries_bp, url_prefix='/api/tenant/inquiries')
    app.register_blueprint(tenant_profile_bp, url_prefix='/api/tenant/profile')
    app.register_blueprint(tenant_notifications_bp, url_prefix='/api/tenant/notifications')
    app.register_blueprint(manager_notifications_bp, url_prefix='/api/manager/notifications')
    app.register_blueprint(admin_notifications_bp, url_prefix='/api/admin/notifications')
    
    # Inquiry attachments
    from app.routes.inquiry_attachments import inquiry_attachments_bp
    app.register_blueprint(inquiry_attachments_bp, url_prefix='/api/inquiries')
    # Note: password_reset_bp removed - all routes now handled by auth_controller_v2.py
    app.register_blueprint(public_units_bp, url_prefix='/api/units')

    # Relax rate limits for high-churn dev endpoints to avoid 429s in UI
    try:
        limiter.exempt(auth_bp)
        limiter.exempt(manager_properties_bp)
        limiter.exempt(manager_inquiries_bp)
        limiter.exempt(admin_properties_bp)
    except Exception as e:
        app.logger.warning(f"Could not exempt blueprints from rate limiting: {e}")
        pass

def register_error_handlers(app):
    """Register application error handlers."""
    from app.utils.error_handlers import register_error_handlers as register_handlers
    register_handlers(app)

def register_jwt_handlers(app):
    """Register JWT-related handlers."""
    from app.utils.jwt_handlers import register_jwt_handlers as register_handlers
    register_handlers(app, jwt)
