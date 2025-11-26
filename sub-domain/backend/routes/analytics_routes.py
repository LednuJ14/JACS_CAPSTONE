from flask import Blueprint, jsonify, current_app, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import func, extract, or_, text
from datetime import datetime, timedelta, date
from decimal import Decimal
import re

from app import db
from models.user import User, UserRole
from models.property import Property, Unit, UnitStatus
from models.tenant import Tenant
from models.staff import Staff, EmploymentStatus
from models.bill import Bill, BillStatus, Payment, PaymentStatus
from models.request import MaintenanceRequest, RequestStatus
from models.announcement import Announcement
from models.task import Task, TaskStatus

# Try to import TenantUnit, but handle if it doesn't exist
try:
    from models.tenant import TenantUnit
    TENANT_UNIT_AVAILABLE = True
except ImportError:
    TENANT_UNIT_AVAILABLE = False
    TenantUnit = None

analytics_bp = Blueprint('analytics', __name__)

def get_property_id_from_request(data=None):
    """
    Try to get property_id from request.
    Checks request body, query parameter, header, subdomain, or Origin header.
    Returns None if not found.
    """
    try:
        # Check query parameter first
        property_id = request.args.get('property_id', type=int)
        if property_id:
            return property_id
        
        # Check header
        property_id = request.headers.get('X-Property-ID', type=int)
        if property_id:
            return property_id
        
        # Check JWT claims
        try:
            claims = get_jwt()
            if claims:
                property_id = claims.get('property_id')
                if property_id:
                    return property_id
        except Exception:
            pass
        
        # Check request body if data is provided
        if data:
            property_id = data.get('property_id')
            if property_id:
                try:
                    return int(property_id)
                except (ValueError, TypeError):
                    pass
        
        # Try to extract from subdomain in Origin or Host header
        origin = request.headers.get('Origin', '')
        host = request.headers.get('Host', '')
        
        if origin or host:
            # Extract subdomain (e.g., "pat" from "pat.localhost:8080")
            subdomain_match = re.search(r'([a-zA-Z0-9-]+)\.localhost', origin or host)
            if subdomain_match:
                subdomain = subdomain_match.group(1).lower()
                
                # Try to find property by matching subdomain
                try:
                    # Try exact match on portal_subdomain, title, building_name
                    match_columns = ['portal_subdomain', 'title', 'building_name']
                    for col in match_columns:
                        try:
                            property_obj = db.session.execute(text(
                                f"SELECT id FROM properties WHERE LOWER(TRIM(COALESCE({col}, ''))) = :subdomain LIMIT 1"
                            ), {'subdomain': subdomain}).first()
                            
                            if property_obj:
                                return property_obj[0]
                        except Exception:
                            continue
                except Exception:
                    pass
        
        return None
    except Exception as e:
        current_app.logger.warning(f"Error getting property_id from request: {str(e)}")
        return None

def table_exists(table_name):
    """Check if a table exists in the database."""
    try:
        result = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM information_schema.TABLES "
            f"WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table_name}'"
        ))
        return result.scalar() > 0
    except Exception:
        return False

def require_role(allowed_roles):
    """Decorator to require specific user roles."""
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            claims = get_jwt()
            user_role = claims.get('role')
            if user_role not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@analytics_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_data():
    """Get dashboard data based on user role and property context."""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        user_role = claims.get('role')
        
        # Get property_id from request (subdomain, query param, header, or JWT)
        property_id = get_property_id_from_request()
        
        # If no property_id provided, try to get from user's owned properties (owner_id instead of manager_id)
        if not property_id and user_role == 'property_manager':
            try:
                user = User.query.get(current_user_id)
                if user:
                    # Get the first property owned by this user
                    owned_property = Property.query.filter_by(
                        owner_id=user.id
                    ).first()
                    
                    if owned_property:
                        property_id = owned_property.id
            except Exception as e:
                current_app.logger.warning(f"Error getting owned property: {str(e)}")
                property_id = None
        
        if user_role == 'property_manager':
            if not property_id:
                # Return safe empty dashboard instead of error
                return jsonify({
                    'property_id': None,
                    'property_name': None,
                    'metrics': {
                        'total_income': 0.0,
                        'current_month': datetime.now().strftime('%B %Y'),
                        'active_tenants': 0,
                        'active_staff': 0,
                        'total_properties': 0,
                        'occupancy_rate': 0.0,
                        'outstanding_balance': 0.0
                    },
                    'properties': {
                        'total': 0,
                        'total_units': 0,
                        'occupied_units': 0,
                        'available_units': 0,
                        'occupancy_rate': 0.0
                    },
                    'sales_data': [],
                    'maintenance_requests': [],
                    'pending_tasks': [],
                    'announcements': [],
                    'message': 'No property selected. Please select a property to view analytics.'
                }), 200
            return get_manager_dashboard(property_id)
        elif user_role == 'staff':
            return get_staff_dashboard(current_user_id, property_id)
        elif user_role == 'tenant':
            return get_tenant_dashboard(current_user_id)
        else:
            return jsonify({'error': 'Invalid user role'}), 400
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        current_app.logger.error(f"Dashboard error: {str(e)}\n{error_trace}", exc_info=True)
        
        # Return safe default response instead of crashing
        safe_response = {
            'property_id': None,
            'property_name': None,
            'metrics': {
                'total_income': 0.0,
                'current_month': datetime.now().strftime('%B %Y'),
                'active_tenants': 0,
                'active_staff': 0,
                'total_properties': 0,
                'occupancy_rate': 0.0,
                'outstanding_balance': 0.0
            },
            'properties': {
                'total': 0,
                'total_units': 0,
                'occupied_units': 0,
                'available_units': 0,
                'occupancy_rate': 0.0
            },
            'sales_data': [],
            'maintenance_requests': [],
            'pending_tasks': [],
            'announcements': [],
            'error': 'Failed to load dashboard data',
            'error_details': str(e) if current_app.config.get('DEBUG', False) else None
        }
        
        # Return 200 with error message instead of 500 to prevent frontend crashes
        return jsonify(safe_response), 200

def get_manager_dashboard(property_id):
    """Get property manager dashboard data for a specific property."""
    try:
        # Verify property exists
        property_obj = Property.query.get(property_id)
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        
        # Key Metrics - Property-specific with error handling
        try:
            # Single property context
            total_properties = 1
        except Exception as e:
            current_app.logger.warning(f"Error getting property: {str(e)}")
            total_properties = 0
        
        try:
            if table_exists('units'):
                # Only count units for this property
                total_units = Unit.query.filter_by(property_id=property_id).count()
            else:
                current_app.logger.warning("Units table does not exist")
                total_units = 0
        except Exception as e:
            current_app.logger.warning(f"Error getting total units: {str(e)}")
            total_units = 0
        
        try:
            # Use string values since status is now String type (matches database enum)
            occupied_units = Unit.query.filter(
                Unit.property_id == property_id,
                or_(Unit.status == 'occupied', Unit.status == 'rented')
            ).count()
        except Exception as e:
            current_app.logger.warning(f"Error getting occupied units: {str(e)}")
            occupied_units = 0
        
        try:
            # Use string values since status is now String type (matches database enum)
            available_units = Unit.query.filter(
                Unit.property_id == property_id,
                or_(Unit.status == 'available', Unit.status == 'vacant')
            ).count()
        except Exception as e:
            current_app.logger.warning(f"Error getting available units: {str(e)}")
            available_units = 0
        
        try:
            # Try to get active tenants for this property - handle case where TenantUnit table might not exist
            if TENANT_UNIT_AVAILABLE and TenantUnit and table_exists('tenant_units'):
                try:
                    # Get tenants for units in this property
                    # Use date-based check for active rentals (simplified structure)
                    from datetime import date
                    active_tenants = Tenant.query.join(TenantUnit).join(Unit).filter(
                        Unit.property_id == property_id,
                        TenantUnit.move_in_date.isnot(None),
                        TenantUnit.move_out_date.isnot(None),
                        TenantUnit.move_out_date >= date.today()
                    ).count()
                except Exception as join_error:
                    current_app.logger.warning(f"Error joining TenantUnit: {str(join_error)}")
                    # Fallback: count tenants with units in this property
                    try:
                        active_tenants = db.session.query(Tenant).join(TenantUnit).join(Unit).filter(
                            Unit.property_id == property_id
                        ).count()
                    except Exception:
                        active_tenants = 0
            else:
                # TenantUnit table doesn't exist or model not available
                active_tenants = 0
        except Exception as e:
            current_app.logger.warning(f"Error getting active tenants: {str(e)}")
            active_tenants = 0
        
        try:
            if hasattr(EmploymentStatus, 'ACTIVE'):
                active_staff = Staff.query.filter_by(employment_status=EmploymentStatus.ACTIVE).count()
            else:
                active_staff = Staff.query.filter_by(employment_status='ACTIVE').count()
        except Exception as e:
            current_app.logger.warning(f"Error getting active staff: {str(e)}")
            active_staff = 0
        
        # Calculate occupancy rate
        occupancy_rate = round((occupied_units / total_units * 100), 2) if total_units > 0 else 0
        
        # Financial metrics - current month
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Total income for current month - Property-specific
        try:
            # Check if required tables exist
            if table_exists('payments') and table_exists('bills') and table_exists('units'):
                try:
                    if hasattr(BillStatus, 'PAID') and hasattr(PaymentStatus, 'COMPLETED'):
                        monthly_income = db.session.query(func.sum(Payment.amount)).join(Bill).join(Unit).filter(
                            Unit.property_id == property_id,
                            Bill.status == BillStatus.PAID,
                            extract('month', Payment.payment_date) == current_month,
                            extract('year', Payment.payment_date) == current_year,
                            Payment.status == PaymentStatus.COMPLETED
                        ).scalar() or Decimal('0.00')
                    else:
                        monthly_income = db.session.query(func.sum(Payment.amount)).join(Bill).join(Unit).filter(
                            Unit.property_id == property_id,
                            Bill.status == 'PAID',
                            extract('month', Payment.payment_date) == current_month,
                            extract('year', Payment.payment_date) == current_year,
                            Payment.status == 'COMPLETED'
                        ).scalar() or Decimal('0.00')
                except Exception as join_error:
                    current_app.logger.warning(f"Error joining for monthly income: {str(join_error)}")
                    monthly_income = Decimal('0.00')
            else:
                monthly_income = Decimal('0.00')
        except Exception as e:
            current_app.logger.warning(f"Error getting monthly income: {str(e)}")
            monthly_income = Decimal('0.00')
        
        # Outstanding balance - Property-specific
        # amount_due is a property, so calculate manually
        try:
            if table_exists('bills') and table_exists('units'):
                try:
                    # Get all pending/overdue bills for this property
                    if hasattr(BillStatus, 'PENDING') and hasattr(BillStatus, 'OVERDUE'):
                        bills = Bill.query.join(Unit).filter(
                            Unit.property_id == property_id,
                            Bill.status.in_([BillStatus.PENDING, BillStatus.OVERDUE])
                        ).all()
                    else:
                        bills = Bill.query.join(Unit).filter(
                            Unit.property_id == property_id,
                            Bill.status.in_(['PENDING', 'OVERDUE'])
                        ).all()
                    
                    # Sum amount_due for each bill (amount_due is a calculated property)
                    outstanding_balance = sum(float(bill.amount_due) for bill in bills)
                    outstanding_balance = Decimal(str(outstanding_balance))
                except Exception as join_error:
                    current_app.logger.warning(f"Error joining for outstanding balance: {str(join_error)}")
                    outstanding_balance = Decimal('0.00')
            else:
                current_app.logger.warning("Bills or Units tables do not exist, outstanding balance set to 0.")
                outstanding_balance = Decimal('0.00')
        except Exception as e:
            current_app.logger.warning(f"Error getting outstanding balance: {str(e)}")
            outstanding_balance = Decimal('0.00')
        
        # Recent maintenance requests - Property-specific
        try:
            if table_exists('maintenance_requests') and table_exists('units'):
                try:
                    if hasattr(RequestStatus, 'COMPLETED'):
                        recent_requests = MaintenanceRequest.query.join(Unit).filter(
                            Unit.property_id == property_id,
                            MaintenanceRequest.status != RequestStatus.COMPLETED
                        ).order_by(MaintenanceRequest.created_at.desc()).limit(10).all()
                    else:
                        recent_requests = MaintenanceRequest.query.join(Unit).filter(
                            Unit.property_id == property_id,
                            MaintenanceRequest.status != 'COMPLETED'
                        ).order_by(MaintenanceRequest.created_at.desc()).limit(10).all()
                except Exception as join_error:
                    current_app.logger.warning(f"Error joining maintenance requests: {str(join_error)}")
                    # Fallback: get all maintenance requests
                    recent_requests = MaintenanceRequest.query.limit(10).all()
            else:
                recent_requests = []
        except Exception as e:
            current_app.logger.warning(f"Error getting maintenance requests: {str(e)}")
            recent_requests = []
        
        # Pending tasks - Property-specific (if tasks are linked to properties/units)
        try:
            if table_exists('tasks') and table_exists('units'):
                try:
                    if hasattr(TaskStatus, 'PENDING'):
                        # Try to filter by property if task has unit_id
                        pending_tasks = Task.query.join(Unit).filter(
                            Unit.property_id == property_id,
                            Task.status == TaskStatus.PENDING
                        ).limit(10).all()
                    else:
                        pending_tasks = Task.query.join(Unit).filter(
                            Unit.property_id == property_id,
                            Task.status == 'PENDING'
                        ).limit(10).all()
                except Exception:
                    # Fallback if join doesn't work - get all pending tasks
                    if hasattr(TaskStatus, 'PENDING'):
                        pending_tasks = Task.query.filter_by(status=TaskStatus.PENDING).limit(10).all()
                    else:
                        pending_tasks = Task.query.filter_by(status='PENDING').limit(10).all()
            else:
                pending_tasks = []
        except Exception as e:
            current_app.logger.warning(f"Error getting pending tasks: {str(e)}")
            pending_tasks = []
        
        # Recent announcements - Property-specific (using property_id and is_published)
        try:
            if table_exists('announcements'):
                # Use property_id and is_published (database column names)
                recent_announcements = Announcement.query.filter(
                    or_(
                        Announcement.property_id == property_id,
                        Announcement.property_id.is_(None)  # Include global announcements
                    ),
                    Announcement.is_published == True
                ).order_by(Announcement.created_at.desc()).limit(5).all()
            else:
                recent_announcements = []
        except Exception as e:
            current_app.logger.warning(f"Error getting announcements: {str(e)}")
            recent_announcements = []
        
        # Revenue trend data (last 6 months)
        sales_data = []
        try:
            # Check if required tables exist
            payments_table_exists = table_exists('payments')
            bills_table_exists = table_exists('bills')
            
            if payments_table_exists and bills_table_exists:
                for i in range(5, -1, -1):  # Last 6 months
                    target_date = datetime.now() - timedelta(days=i * 30)
                    month_name = target_date.strftime('%b %Y')
                    
                    try:
                        if hasattr(PaymentStatus, 'COMPLETED'):
                            monthly_revenue = db.session.query(func.sum(Payment.amount)).join(Bill).join(Unit).filter(
                                Unit.property_id == property_id,
                                extract('month', Payment.payment_date) == target_date.month,
                                extract('year', Payment.payment_date) == target_date.year,
                                Payment.status == PaymentStatus.COMPLETED
                            ).scalar() or Decimal('0.00')
                        else:
                            monthly_revenue = db.session.query(func.sum(Payment.amount)).join(Bill).join(Unit).filter(
                                Unit.property_id == property_id,
                                extract('month', Payment.payment_date) == target_date.month,
                                extract('year', Payment.payment_date) == target_date.year,
                                Payment.status == 'COMPLETED'
                            ).scalar() or Decimal('0.00')
                        
                        # Normalize to percentage for chart (assuming max 125k)
                        trend_value = min(float(monthly_revenue) / 1000, 125)  # Convert to thousands
                        actual_value = min(float(monthly_revenue) / 1000, 125)
                        
                        sales_data.append({
                            'month': month_name,
                            'trend': trend_value,
                            'actual': actual_value
                        })
                    except Exception as month_error:
                        current_app.logger.warning(f"Error getting revenue for {month_name}: {str(month_error)}")
                        sales_data.append({
                            'month': month_name,
                            'trend': 0,
                            'actual': 0
                        })
            else:
                # Tables don't exist, return empty data
                current_app.logger.warning("Payments or Bills tables do not exist, returning empty sales data")
                for i in range(5, -1, -1):
                    target_date = datetime.now() - timedelta(days=i * 30)
                    month_name = target_date.strftime('%b %Y')
                    sales_data.append({
                        'month': month_name,
                        'trend': 0,
                        'actual': 0
                    })
        except Exception as e:
            current_app.logger.warning(f"Error generating sales data: {str(e)}")
            # Return empty sales data
            sales_data = []
        
        # Get current month name
        current_month_name = datetime.now().strftime('%B %Y')
        
        # Safely serialize objects to dictionaries
        maintenance_requests_data = []
        for req in recent_requests:
            try:
                maintenance_requests_data.append(req.to_dict(include_tenant=True, include_unit=True))
            except Exception as e:
                current_app.logger.warning(f"Error serializing maintenance request {req.id}: {str(e)}")
                continue
        
        pending_tasks_data = []
        for task in pending_tasks:
            try:
                pending_tasks_data.append(task.to_dict())
            except Exception as e:
                current_app.logger.warning(f"Error serializing task {task.id}: {str(e)}")
                continue
        
        announcements_data = []
        for ann in recent_announcements:
            try:
                announcements_data.append(ann.to_dict())
            except Exception as e:
                current_app.logger.warning(f"Error serializing announcement {ann.id}: {str(e)}")
                continue
        
        return jsonify({
            'property_id': property_id,
            'property_name': property_obj.name if property_obj else None,
            'metrics': {
                'total_income': float(monthly_income),
                'current_month': current_month_name,
                'active_tenants': active_tenants,
                'active_staff': active_staff,
                'total_properties': total_properties,
                'occupancy_rate': occupancy_rate,
                'outstanding_balance': float(outstanding_balance)
            },
            'properties': {
                'total': total_properties,
                'total_units': total_units,
                'occupied_units': occupied_units,
                'available_units': available_units,
                'occupancy_rate': occupancy_rate
            },
            'sales_data': sales_data,
            'maintenance_requests': maintenance_requests_data,
            'pending_tasks': pending_tasks_data,
            'announcements': announcements_data
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        current_app.logger.error(f"Manager dashboard error: {str(e)}\n{error_trace}", exc_info=True)
        
        # Return a safe default response instead of crashing
        # This ensures the frontend can still render something
        try:
            property_obj = Property.query.get(property_id) if property_id else None
            property_name = property_obj.name if property_obj else None
        except:
            property_name = None
        
        # Return minimal safe data
        safe_response = {
            'property_id': property_id,
            'property_name': property_name,
            'metrics': {
                'total_income': 0.0,
                'current_month': datetime.now().strftime('%B %Y'),
                'active_tenants': 0,
                'active_staff': 0,
                'total_properties': 1,
                'occupancy_rate': 0.0,
                'outstanding_balance': 0.0
            },
            'properties': {
                'total': 1,
                'total_units': 0,
                'occupied_units': 0,
                'available_units': 0,
                'occupancy_rate': 0.0
            },
            'sales_data': [],
            'maintenance_requests': [],
            'pending_tasks': [],
            'announcements': [],
            'error': 'Some data could not be loaded',
            'error_details': str(e) if current_app.config.get('DEBUG', False) else None
        }
        
        # Add CORS headers manually in case of error
        response = jsonify(safe_response)
        response.status_code = 200  # Return 200 with error message instead of 500
        
        return response

def get_staff_dashboard(user_id):
    """Get staff dashboard data."""
    try:
        user = User.query.get(user_id)
        if not user or not user.staff_profile:
            return jsonify({'error': 'Staff profile not found'}), 404
        
        staff = user.staff_profile
        
        # My tasks
        my_tasks = Task.query.filter_by(assigned_to=staff.id).order_by(Task.created_at.desc()).limit(10).all()
        pending_tasks_count = Task.query.filter_by(assigned_to=staff.id, status=TaskStatus.PENDING).count()
        completed_tasks_count = Task.query.filter_by(assigned_to=staff.id, status=TaskStatus.COMPLETED).count()
        
        # My maintenance requests
        my_requests = MaintenanceRequest.query.filter_by(
            assigned_to=staff.id
        ).order_by(MaintenanceRequest.created_at.desc()).limit(10).all()
        
        # Announcements (using is_published from database)
        recent_announcements = Announcement.query.filter_by(
            is_published=True
        ).order_by(Announcement.created_at.desc()).limit(5).all()
        
        return jsonify({
            'staff_info': staff.to_dict(include_user=True),
            'tasks': {
                'pending_count': pending_tasks_count,
                'completed_count': completed_tasks_count,
                'recent_tasks': [task.to_dict() for task in my_tasks]
            },
            'maintenance_requests': [req.to_dict(include_tenant=True, include_unit=True) for req in my_requests],
            'announcements': [ann.to_dict() for ann in recent_announcements]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Staff dashboard error: {str(e)}")
        return jsonify({'error': 'Failed to load staff dashboard'}), 500

def get_tenant_dashboard(user_id):
    """Get tenant dashboard data."""
    try:
        user = User.query.get(user_id)
        if not user or not user.tenant_profile:
            return jsonify({'error': 'Tenant profile not found'}), 404
        
        tenant = user.tenant_profile
        
        # Current lease info
        current_lease = tenant.current_lease
        
        # Recent bills
        recent_bills = Bill.query.filter_by(
            tenant_id=tenant.id
        ).order_by(Bill.created_at.desc()).limit(10).all()
        
        # Outstanding balance (amount_due is a property, calculate manually)
        # Use string values since status is now String type
        bills = Bill.query.filter(
            Bill.tenant_id == tenant.id,
            Bill.status.in_(['pending', 'overdue'])
        ).all()
        outstanding_balance = sum(float(bill.amount_due) for bill in bills)
        outstanding_balance = Decimal(str(outstanding_balance))
        
        # My maintenance requests
        my_requests = MaintenanceRequest.query.filter_by(
            tenant_id=tenant.id
        ).order_by(MaintenanceRequest.created_at.desc()).limit(10).all()
        
        # Announcements (using is_published from database)
        recent_announcements = Announcement.query.filter_by(
            is_published=True
        ).order_by(Announcement.created_at.desc()).limit(5).all()
        
        # Payment history
        payment_history = []
        if recent_bills:
            for bill in recent_bills:
                for payment in bill.payments:
                    payment_history.append({
                        'date': payment.payment_date.isoformat(),
                        'amount': float(payment.amount),
                        'bill_title': bill.title,
                        'payment_method': payment.payment_method.value if hasattr(payment.payment_method, 'value') else str(payment.payment_method)
                    })
        
        return jsonify({
            'tenant_info': tenant.to_dict(include_user=True, include_lease=True),
            'current_lease': current_lease.to_dict(include_unit=True) if current_lease else None,
            'financial_summary': {
                'outstanding_balance': float(outstanding_balance),
                'total_paid': tenant.total_rent_paid,
            },
            'recent_bills': [bill.to_dict(include_unit=True) for bill in recent_bills],
            'maintenance_requests': [req.to_dict(include_unit=True) for req in my_requests],
            'announcements': [ann.to_dict() for ann in recent_announcements],
            'payment_history': sorted(payment_history, key=lambda x: x['date'], reverse=True)[:5]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Tenant dashboard error: {str(e)}")
        return jsonify({'error': 'Failed to load tenant dashboard'}), 500

@analytics_bp.route('/financial-summary', methods=['GET'])
@jwt_required()
def get_financial_summary():
    """Get financial summary for property managers - property-specific."""
    try:
        # Get property_id from request (subdomain, query param, header, or JWT)
        property_id = get_property_id_from_request()
        
        if not property_id:
            return jsonify({
                'error': 'Property ID is required. Please access through your property subdomain.'
            }), 400
        
        # Verify property exists - use raw query to avoid enum validation issues
        try:
            # Use raw SQL to get property without triggering enum validation
            property_result = db.session.execute(text(
                "SELECT id, title, description FROM properties WHERE id = :property_id LIMIT 1"
            ), {'property_id': property_id}).first()
            
            if not property_result:
                return jsonify({'error': 'Property not found'}), 404
            
            # Try to get Property object, but if enum validation fails, use raw result
            try:
                property_obj = Property.query.get(property_id)
            except Exception as enum_error:
                # If enum validation fails, create a mock object from raw query
                current_app.logger.warning(f"Enum validation error for property {property_id}, using raw query result: {str(enum_error)}")
                property_obj = type('Property', (), {
                    'id': property_result[0],
                    'name': property_result[1] if property_result[1] else f'Property {property_result[0]}',
                    'title': property_result[1] if property_result[1] else f'Property {property_result[0]}'
                })()
        except Exception as prop_error:
            current_app.logger.error(f"Error getting property {property_id}: {str(prop_error)}", exc_info=True)
            return jsonify({'error': 'Property not found'}), 404
        
        # Monthly revenue for the last 12 months - Property-specific
        monthly_data = []
        for i in range(11, -1, -1):
            target_date = datetime.now() - timedelta(days=i * 30)
            month_name = target_date.strftime('%b %Y')
            
            try:
                # Check if required tables exist
                if table_exists('payments') and table_exists('bills') and table_exists('units'):
                    # Filter by property_id through Unit join
                    monthly_revenue = db.session.query(func.sum(Payment.amount)).join(Bill, Bill.id == Payment.bill_id).join(Unit, Unit.id == Bill.unit_id).filter(
                        Unit.property_id == property_id,
                        extract('month', Payment.payment_date) == target_date.month,
                        extract('year', Payment.payment_date) == target_date.year,
                        Payment.status == 'completed'  # Use lowercase string value
                    ).scalar() or Decimal('0.00')
                else:
                    monthly_revenue = Decimal('0.00')
            except Exception as e:
                current_app.logger.warning(f"Error getting monthly revenue for {month_name}: {str(e)}", exc_info=True)
                monthly_revenue = Decimal('0.00')
            
            monthly_data.append({
                'month': month_name,
                'revenue': float(monthly_revenue)
            })
        
        # Total metrics - Property-specific
        try:
            if table_exists('payments') and table_exists('bills') and table_exists('units'):
                total_revenue = db.session.query(func.sum(Payment.amount)).join(Bill, Bill.id == Payment.bill_id).join(Unit, Unit.id == Bill.unit_id).filter(
                    Unit.property_id == property_id,
                    Payment.status == 'completed'  # Use lowercase string value
                ).scalar() or Decimal('0.00')
            else:
                total_revenue = Decimal('0.00')
        except Exception as e:
            current_app.logger.warning(f"Error getting total revenue: {str(e)}", exc_info=True)
            total_revenue = Decimal('0.00')
        
        # Outstanding balance - Property-specific
        try:
            if table_exists('bills') and table_exists('units'):
                bills = Bill.query.join(Unit, Unit.id == Bill.unit_id).filter(
                    Unit.property_id == property_id,
                    Bill.status.in_(['pending', 'overdue'])
                ).all()
                # Safely calculate outstanding balance
                total_outstanding = 0.0
                for bill in bills:
                    try:
                        # amount_due is a property that queries the database, so handle carefully
                        # Calculate directly: amount - amount_paid
                        bill_amount = float(bill.amount) if hasattr(bill, 'amount') else 0.0
                        
                        # Calculate amount_paid from payments directly (more efficient)
                        try:
                            from models.bill import Payment
                            from sqlalchemy import func
                            amount_paid = db.session.query(func.sum(Payment.amount)).filter(
                                Payment.bill_id == bill.id,
                                Payment.status.in_(['completed', 'approved'])
                            ).scalar() or 0.0
                            amount_paid = float(amount_paid)
                        except Exception:
                            amount_paid = 0.0
                        
                        amount_due = max(0.0, bill_amount - amount_paid)
                        total_outstanding += amount_due
                    except Exception as bill_error:
                        current_app.logger.warning(f"Error calculating amount_due for bill {bill.id}: {str(bill_error)}")
                        continue
                total_outstanding = Decimal(str(total_outstanding))
            else:
                total_outstanding = Decimal('0.00')
        except Exception as e:
            current_app.logger.warning(f"Error getting outstanding balance: {str(e)}", exc_info=True)
            total_outstanding = Decimal('0.00')
        
        # Overdue bills - Property-specific
        try:
            if table_exists('bills') and table_exists('units'):
                overdue_bills = Bill.query.join(Unit, Unit.id == Bill.unit_id).filter(
                    Unit.property_id == property_id,
                    Bill.status == 'overdue'
                ).count()
            else:
                overdue_bills = 0
        except Exception as e:
            current_app.logger.warning(f"Error getting overdue bills count: {str(e)}", exc_info=True)
            overdue_bills = 0
        
        # Safely get property name
        property_name = None
        try:
            property_name = getattr(property_obj, 'name', None) or getattr(property_obj, 'title', None) or f'Property {property_id}'
        except Exception:
            property_name = f'Property {property_id}'
        
        return jsonify({
            'property_id': property_id,
            'property_name': property_name,
            'monthly_revenue': monthly_data,
            'totals': {
                'total_revenue': float(total_revenue),
                'outstanding_balance': float(total_outstanding),
                'overdue_bills_count': overdue_bills
            }
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        current_app.logger.error(f"Financial summary error: {str(e)}\n{error_trace}", exc_info=True)
        
        # Return detailed error in DEBUG mode
        error_response = {'error': 'Failed to load financial summary'}
        if current_app.config.get('DEBUG', False):
            error_response['details'] = str(e)
            error_response['traceback'] = error_trace.split('\n')[-5:]  # Last 5 lines
        
        return jsonify(error_response), 500

@analytics_bp.route('/occupancy-report', methods=['GET'])
@jwt_required()
def get_occupancy_report():
    """Get occupancy report for property managers - property-specific."""
    try:
        # Get property_id from request (subdomain, query param, header, or JWT)
        property_id = get_property_id_from_request()
        
        if not property_id:
            return jsonify({
                'error': 'Property ID is required. Please access through your property subdomain.'
            }), 400
        
        # Verify property exists - use raw query to avoid enum validation issues
        try:
            # Use raw SQL to get property without triggering enum validation
            property_result = db.session.execute(text(
                "SELECT id, title, description FROM properties WHERE id = :property_id LIMIT 1"
            ), {'property_id': property_id}).first()
            
            if not property_result:
                return jsonify({'error': 'Property not found'}), 404
            
            property_obj = Property.query.get(property_id) if property_result else None
            # If Property.query.get fails due to enum validation, use the raw result
            if not property_obj:
                property_obj = type('Property', (), {
                    'id': property_result[0],
                    'name': property_result[1] if property_result[1] else f'Property {property_result[0]}',
                    'title': property_result[1] if property_result[1] else f'Property {property_result[0]}'
                })()
        except Exception as prop_error:
            current_app.logger.warning(f"Error getting property: {str(prop_error)}")
            # Fallback: use raw query result
            try:
                property_result = db.session.execute(text(
                    "SELECT id, title FROM properties WHERE id = :property_id LIMIT 1"
                ), {'property_id': property_id}).first()
                if property_result:
                    property_obj = type('Property', (), {
                        'id': property_result[0],
                        'name': property_result[1] if property_result[1] else f'Property {property_result[0]}',
                        'title': property_result[1] if property_result[1] else f'Property {property_result[0]}'
                    })()
                else:
                    return jsonify({'error': 'Property not found'}), 404
            except Exception:
                return jsonify({'error': 'Property not found'}), 404
        
        # Overall occupancy - Property-specific
        try:
            if table_exists('units'):
                total_units = Unit.query.filter_by(property_id=property_id).count()
                occupied_units = Unit.query.filter(
                    Unit.property_id == property_id,
                    or_(Unit.status == 'occupied', Unit.status == 'rented')
                ).count()
                available_units = Unit.query.filter(
                    Unit.property_id == property_id,
                    or_(Unit.status == 'available', Unit.status == 'vacant')
                ).count()
                occupancy_rate = round((occupied_units / total_units * 100), 2) if total_units > 0 else 0
            else:
                total_units = 0
                occupied_units = 0
                available_units = 0
                occupancy_rate = 0
        except Exception as e:
            current_app.logger.warning(f"Error getting occupancy data: {str(e)}", exc_info=True)
            total_units = 0
            occupied_units = 0
            available_units = 0
            occupancy_rate = 0
        
        # Unit type breakdown (if property_type info available)
        unit_type_data = []
        try:
            # Group by property_type or similar if available
            # For now, we'll use a simple breakdown
            unit_type_data = [
                {
                    'type': 'All Units',
                    'total': total_units,
                    'occupied': occupied_units,
                    'available': available_units,
                    'occupancy_rate': occupancy_rate
                }
            ]
        except Exception as e:
            current_app.logger.warning(f"Error getting unit type breakdown: {str(e)}")
            unit_type_data = []
        
        # Safely get property name
        property_name = None
        try:
            property_name = getattr(property_obj, 'name', None) or getattr(property_obj, 'title', None) or f'Property {property_id}'
        except Exception:
            property_name = f'Property {property_id}'
        
        return jsonify({
            'property_id': property_id,
            'property_name': property_name,
            'overall_occupancy': {
                'total_units': total_units,
                'occupied_units': occupied_units,
                'available_units': available_units,
                'occupancy_rate': occupancy_rate
            },
            'unit_type_breakdown': unit_type_data
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        current_app.logger.error(f"Occupancy report error: {str(e)}\n{error_trace}", exc_info=True)
        
        # Return detailed error in DEBUG mode
        error_response = {'error': 'Failed to load occupancy report'}
        if current_app.config.get('DEBUG', False):
            error_response['details'] = str(e)
            error_response['traceback'] = error_trace.split('\n')[-5:]  # Last 5 lines
        
        return jsonify(error_response), 500