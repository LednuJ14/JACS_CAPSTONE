# Backend Clean Architecture and Flow

Purpose
- Provide a clean, easy-to-follow structure for the backend without changing your current code yet.
- Map your existing backend to clear layers (controllers → services → repositories → models) and show the request flow, error handling, auth, and subdomain portal path.

What you have today (mapped)
- App factory: backend/app/__init__.py (creates app, registers blueprints, extensions)
- Routes (controllers): backend/app/routes/* (auth, users, properties, subscriptions, admin, manager_*, property_portal, password_reset)
- Models: backend/app/models/* (user, property, subscription, inquiry, blacklisted_token)
- Utils: backend/app/utils/* (auth_helpers, validators, decorators, error_handlers, jwt_handlers, file_helpers, pagination, subdomain_helpers)
- Config: backend/config.py (development, production, testing; MySQL for runtime, SQLite only for tests; JWT, CORS, rate limiting, mail)

Clean layering (target)
- app/
  - controllers/  (thin HTTP adapters; previously routes/*)
  - services/     (business logic; orchestrates repositories)
  - repositories/ (DB access using SQLAlchemy models)
  - models/       (SQLAlchemy ORM models; largely unchanged)
  - schemas/      (request/response validation & serialization; Marshmallow)
  - utils/        (shared helpers: auth, subdomain, pagination)
  - interfaces/   (ports for services/repositories if you want stricter boundaries)
  - errors.py     (domain exceptions)
  - http.py       (response helpers; unified JSON shape)
- config.py       (kept)
- app.py          (kept; creates app from factory)

Unified JSON response shape
- Success: { "data": <payload>, "error": null, "meta": { optional } }
- Error:   { "data": null, "error": { "code": <http_code>, "message": "...", "details": { optional } } }

Request lifecycle (clean flow)
1) HTTP request → controller (validates request via schema, calls service)
2) Controller → service (business logic; authorization, orchestration)
3) Service → repository (pure DB interaction; create/read/update/delete)
4) Repository → model/SQLAlchemy (session work)
5) Service returns domain DTO → controller serializes via schema
6) Controller returns unified JSON response
7) Errors bubble as typed exceptions → global error handler → unified error JSON

Authentication & authorization
- JWT required for protected endpoints using a decorator (e.g., @jwt_required)
- Role checks enforced in service layer (or controller if very simple)
- Token blacklisting & callbacks remain in utils.jwt_handlers

Subdomain portal flow (clean path)
- Extract subdomain from Host header early (utility)
- Controller routes under /api/portal call a PortalService that resolves a property by subdomain, enforces portal_enabled, applies portal config (theme, branding, features)

Directory structure (proposed)
- app/
  - controllers/
    - auth_controller.py
    - users_controller.py
    - properties_controller.py
    - subscriptions_controller.py
    - admin_controller.py
    - portal_controller.py
  - services/
    - auth_service.py
    - user_service.py
    - property_service.py
    - subscription_service.py
    - portal_service.py
  - repositories/
    - user_repository.py
    - property_repository.py
    - subscription_repository.py
    - inquiry_repository.py
  - schemas/
    - auth_schemas.py
    - user_schemas.py
    - property_schemas.py
    - subscription_schemas.py
    - portal_schemas.py
  - models/
    - (existing models retained)
  - utils/
    - (keep existing; rename subdomain_helpers → subdomain)
  - errors.py
  - http.py

Minimal example skeletons

```python path=null start=null
# app/http.py
from flask import jsonify

def ok(data=None, meta=None, status=200):
    return jsonify({"data": data, "error": None, "meta": meta or {}}), status

def fail(message, code=400, details=None):
    return jsonify({
        "data": None,
        "error": {"code": code, "message": message, "details": details or {}}
    }), code
```

```python path=null start=null
# app/errors.py
class AppError(Exception):
    status_code = 400
    def __init__(self, message, status_code=None, details=None):
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}

class NotFoundError(AppError):
    status_code = 404

class UnauthorizedError(AppError):
    status_code = 401

class ForbiddenError(AppError):
    status_code = 403
```

```python path=null start=null
# app/__init__.py (app factory outline)
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# existing singletons
_db = SQLAlchemy()
_migrate = Migrate()
_jwt = JWTManager()
_bcrypt = Bcrypt()
_limiter = Limiter(key_func=get_remote_address, default_limits=["100 per hour"])


def create_app(config_name=None):
    app = Flask(__name__)

    from config import config
    cfg_name = config_name or 'development'
    app.config.from_object(config[cfg_name])

    _db.init_app(app)
    _migrate.init_app(app, _db)
    CORS(app, origins=app.config.get('CORS_ORIGINS', ['http://localhost:3000']))
    _jwt.init_app(app)
    _bcrypt.init_app(app)
    _limiter.init_app(app)

    register_error_handlers(app)
    register_blueprints(app)

    return app


def register_blueprints(app):
    from app.controllers.auth_controller import bp as auth_bp
    from app.controllers.users_controller import bp as users_bp
    from app.controllers.properties_controller import bp as properties_bp
    from app.controllers.subscriptions_controller import bp as subs_bp
    from app.controllers.admin_controller import bp as admin_bp
    from app.controllers.portal_controller import bp as portal_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(properties_bp, url_prefix='/api/properties')
    app.register_blueprint(subs_bp, url_prefix='/api/subscriptions')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(portal_bp, url_prefix='/api/portal')


def register_error_handlers(app):
    from app.http import fail
    from app.errors import AppError

    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        return fail(str(err), code=err.status_code, details=err.details)

    @app.errorhandler(404)
    def handle_404(_):
        return fail("Not Found", code=404)

    @app.errorhandler(500)
    def handle_500(err):
        return fail("Internal Server Error", code=500, details={"hint": "check logs"})
```

```python path=null start=null
# app/utils/subdomain.py
from urllib.parse import urlparse

def extract_subdomain(host: str) -> str:
    # host examples: "foo.localhost:5000", "foo.example.com"
    if not host:
        return ''
    host_no_port = host.split(':', 1)[0]
    parts = host_no_port.split('.')
    if len(parts) <= 1:
        return ''
    # treat localhost as root domain for local testing
    if parts[-1] == 'localhost':
        return parts[0]
    # generic: return first label as subdomain
    return parts[0]
```

```python path=null start=null
# app/repositories/property_repository.py
from app import _db as db
from app.models.property import Property

class PropertyRepository:
    def get_by_id(self, property_id: int) -> Property | None:
        return Property.query.get(property_id)

    def get_by_subdomain(self, subdomain: str) -> Property | None:
        return Property.query.filter_by(portal_subdomain=subdomain).first()

    def list(self, filters: dict, page=1, per_page=10):
        query = Property.query
        # apply filters...
        return query.paginate(page=page, per_page=per_page, error_out=False)
```

```python path=null start=null
# app/services/portal_service.py
from app.errors import NotFoundError, ForbiddenError

class PortalService:
    def __init__(self, property_repo):
        self.property_repo = property_repo

    def get_portal_info(self, subdomain: str):
        prop = self.property_repo.get_by_subdomain(subdomain)
        if not prop:
            raise NotFoundError("Property portal not found")
        if not getattr(prop, 'portal_enabled', False):
            raise ForbiddenError("Portal is disabled for this property")
        # construct a DTO / dict
        return {
            "property": {
                "id": prop.id,
                "title": prop.title,
                "theme": getattr(prop, 'portal_theme', 'default')
            },
            "portal_info": {
                "subdomain": getattr(prop, 'portal_subdomain', None)
            }
        }
```

```python path=null start=null
# app/controllers/portal_controller.py
from flask import Blueprint, request
from app.http import ok
from app.utils.subdomain import extract_subdomain
from app.repositories.property_repository import PropertyRepository
from app.services.portal_service import PortalService

bp = Blueprint('portal', __name__)

@bp.get('/info')
def portal_info():
    sub = extract_subdomain(request.host)
    svc = PortalService(PropertyRepository())
    data = svc.get_portal_info(sub)
    return ok(data)
```

```python path=null start=null
# app/schemas/auth_schemas.py (example)
from marshmallow import Schema, fields, validate

class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8))
```

```python path=null start=null
# app/controllers/auth_controller.py (example)
from flask import Blueprint, request
from flask_jwt_extended import create_access_token, create_refresh_token
from app.http import ok
from app.schemas.auth_schemas import LoginSchema
from app.errors import UnauthorizedError

bp = Blueprint('auth', __name__)

@bp.post('/login')
def login():
    payload = LoginSchema().load(request.get_json() or {})
    email, password = payload['email'], payload['password']

    # delegate to service (pseudo)
    user = authenticate_user(email, password)  # replace with AuthService
    if not user:
        raise UnauthorizedError("Invalid credentials")

    return ok({
        "access_token": create_access_token(identity=user.id),
        "refresh_token": create_refresh_token(identity=user.id),
        "user": {"id": user.id, "email": user.email, "role": user.role}
    })
```

```python path=null start=null
# tests/test_portal.py (example)
from app import create_app

def test_portal_info_client():
    app = create_app('testing')
    client = app.test_client()
    resp = client.get('/api/portal/info', headers={'Host': 'test-property.localhost:5000'})
    assert resp.status_code in (200, 404)  # depending on seeded data
```

Migration checklist (incremental)
1) Create http.py and errors.py for unified responses and typed errors
2) Introduce services/ and repositories/ directories; start with Properties/Portal
3) Move heavy logic out of app/routes/* into services; keep controllers thin
4) Add schemas/ with Marshmallow for input validation; use in controllers
5) Standardize error handling via register_error_handlers; raise AppError subclasses
6) For subdomain features, centralize Host parsing in utils/subdomain.py; make PortalService the single source of truth
7) Gradually refactor feature by feature (auth → properties → subscriptions → admin); keep existing endpoints and contracts stable while moving internals

Testing focus
- Keep pytest + pytest-flask; prioritize service-level unit tests and controller smoke tests
- Use testing config (sqlite:///:memory:, reduced bcrypt rounds)

Where to look in the current code to migrate first
- app/routes/property_portal.py → controllers/portal_controller.py + services/portal_service.py + repositories/property_repository.py + utils/subdomain.py
- app/routes/auth.py → controllers/auth_controller.py + services/auth_service.py
- app/utils/* → consolidate into utils/ (subdomain, pagination, auth helpers)
- Keep models as-is; repositories wrap model access

Notes
- This guide does not change your code on disk. It provides a clear, modular target structure and examples so you can refactor incrementally without breaking endpoints.
