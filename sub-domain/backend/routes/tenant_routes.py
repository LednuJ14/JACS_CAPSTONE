from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from models.user import User, UserRole
from models.tenant import Tenant
from datetime import datetime, date
import re

tenant_bp = Blueprint('tenants', __name__)

@tenant_bp.route('/me', methods=['GET'])
@jwt_required()
def get_my_tenant():
    """Get current logged-in tenant profile."""
    try:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get user
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user is a tenant
        # Handle both string and enum values for role (database stores as string)
        user_role = user.role
        if isinstance(user_role, UserRole):
            user_role_str = user_role.value
        elif isinstance(user_role, str):
            user_role_str = user_role.upper()
        else:
            user_role_str = str(user_role).upper() if user_role else 'TENANT'
        
        if user_role_str != 'TENANT':
            current_app.logger.warning(f"User {current_user_id} has role '{user_role_str}', expected 'TENANT'")
            return jsonify({'error': 'User is not a tenant', 'user_role': user_role_str}), 403
        
        # Get tenant profile for this user
        tenant = Tenant.query.filter_by(user_id=current_user_id).first()
        if not tenant:
            return jsonify({'error': 'Tenant profile not found'}), 404
        
        try:
            tenant_data = tenant.to_dict(include_user=True, include_lease=False)
            return jsonify(tenant_data), 200
        except Exception as tenant_error:
            current_app.logger.warning(f"Error serializing tenant {tenant.id}: {str(tenant_error)}")
            # Return minimal tenant data
            return jsonify({
                'id': tenant.id,
                'user_id': tenant.user_id,
                'property_id': getattr(tenant, 'property_id', None),
                'phone_number': getattr(tenant, 'phone_number', None),
                'email': getattr(tenant, 'email', None),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone_number': user.phone_number
                } if user else None
            }), 200
            
    except Exception as e:
        current_app.logger.error(f"Error in get_my_tenant: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@tenant_bp.route('/', methods=['GET'])
# @jwt_required()  # Temporarily disabled for testing
def get_tenants():
    """Get all tenants with their user info."""
    try:
        tenants = db.session.query(Tenant).join(User).all()
        print(f"Found {len(tenants)} tenants in database")
        
        tenant_list = []
        for tenant in tenants:
            try:
                # Use the to_dict method which handles the simplified schema
                tenant_data = tenant.to_dict(include_user=True, include_lease=False)
                tenant_list.append(tenant_data)
            except Exception as tenant_error:
                # Fallback: create minimal tenant data if to_dict fails
                current_app.logger.warning(f"Error serializing tenant {tenant.id}: {str(tenant_error)}")
                try:
                    tenant_data = {
                        'id': tenant.id,
                        'user_id': tenant.user_id,
                        'property_id': getattr(tenant, 'property_id', None),
                        'phone_number': getattr(tenant, 'phone_number', None),
                        'email': getattr(tenant, 'email', None),
                        'room_number': tenant.assigned_room or 'N/A',
                        'status': 'Active' if tenant.is_approved else 'Pending',
                        'property': {
                            'id': getattr(tenant, 'property_id', None),
                            'name': f'Property {getattr(tenant, "property_id", "Unknown")}'
                        },
                        'user': {
                            'id': tenant.user.id if tenant.user else None,
                            'email': tenant.user.email if tenant.user else None,
                            'first_name': tenant.user.first_name if tenant.user else None,
                            'last_name': tenant.user.last_name if tenant.user else None,
                            'phone_number': tenant.user.phone_number if tenant.user else None
                        } if tenant.user else None,
                        'created_at': tenant.created_at.isoformat() if tenant.created_at else None,
                        'updated_at': tenant.updated_at.isoformat() if tenant.updated_at else None
                    }
                    tenant_list.append(tenant_data)
                except Exception:
                    # Skip this tenant if even minimal serialization fails
                    continue
        
        return jsonify(tenant_list), 200
        
    except Exception as e:
        print(f"Error in get_tenants: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@tenant_bp.route('/', methods=['POST'])
# @jwt_required()  # Temporarily disabled for testing
def create_tenant():
    """Create a new tenant."""
    try:
        data = request.get_json()
        print(f"Received tenant creation data: {data}")
        
        # Validate required fields
        required_fields = ['email', 'username', 'password', 'first_name', 'last_name']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate email format
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check if user already exists
        existing_user = User.query.filter(
            (User.email == data['email']) | (User.username == data['username'])
        ).first()
        if existing_user:
            return jsonify({'error': 'User with this email or username already exists'}), 400
        
        # Create user
        user = User(
            email=data['email'],
            username=data['username'],
            password=data['password'],  # Will be hashed by User model
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone_number=data.get('phone_number', ''),
            role=UserRole.TENANT,
            address=data.get('address', '')
        )
        
        db.session.add(user)
        db.session.flush()  # Get the user ID
        
        # Helper function to convert empty strings to None for numeric fields
        def safe_float(value):
            if value is None or value == '' or value == 0:
                return None
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        
        def safe_int(value):
            if value is None or value == '':
                return None
            try:
                return int(value)
            except (ValueError, TypeError):
                return None
        
        def safe_date(value):
            if value is None or value == '':
                return None
            try:
                return datetime.strptime(value, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                return None
        
        # Get property_id - required for simplified schema
        property_id = data.get('property_id')
        if not property_id:
            # Try to get property_id from subdomain or request context
            try:
                from routes.auth_routes import get_property_id_from_request
                property_id = get_property_id_from_request(data=data)
            except Exception as prop_error:
                current_app.logger.warning(f"Could not get property_id from request: {str(prop_error)}")
            
        # Convert string property_id to int if needed
        if property_id and not isinstance(property_id, int):
            try:
                property_id = int(property_id)
            except (ValueError, TypeError):
                # If it's not a number, try to find property by subdomain/title
                from models.property import Property
                from sqlalchemy import text
                property_obj = db.session.execute(text(
                    """
                    SELECT id FROM properties 
                    WHERE LOWER(portal_subdomain) = LOWER(:subdomain)
                       OR LOWER(title) = LOWER(:subdomain)
                       OR LOWER(building_name) = LOWER(:subdomain)
                    LIMIT 1
                    """
                ), {'subdomain': str(property_id)}).first()
                if property_obj:
                    property_id = property_obj[0]
                else:
                    property_id = None
            
        if not property_id:
            return jsonify({'error': 'property_id is required. Please provide property_id or access through a property subdomain.'}), 400
        
        # Verify property exists
        from models.property import Property
        property_obj = Property.query.get(property_id)
        if not property_obj:
            return jsonify({'error': f'Property with id {property_id} not found'}), 404
        
        # Create tenant profile (simplified schema: user_id, property_id, phone_number, email)
        tenant = Tenant(
            user_id=user.id,
            property_id=property_id,
            phone_number=data.get('phone_number', '') or user.phone_number or '',
            email=data.get('email', '') or user.email or ''
        )
        
        db.session.add(tenant)
        db.session.commit()
        
        print(f"Successfully created tenant with ID: {tenant.id}")
        print(f"User ID: {user.id}, Tenant ID: {tenant.id}")
        
        # Verify the data was actually saved by querying it back
        verification_tenant = Tenant.query.get(tenant.id)
        verification_user = User.query.get(user.id)
        print(f"Verification - Tenant exists: {verification_tenant is not None}")
        print(f"Verification - User exists: {verification_user is not None}")
        
        # Return created tenant using to_dict method
        try:
            tenant_data = tenant.to_dict(include_user=True)
        except Exception as dict_error:
            current_app.logger.warning(f"Error serializing tenant: {str(dict_error)}")
            tenant_data = {
                'id': tenant.id,
                'user_id': user.id,
                'property_id': property_id,
                'phone_number': tenant.phone_number,
                'email': tenant.email,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone_number': user.phone_number,
                    'role': getattr(user.role, 'value', str(user.role)) if hasattr(user.role, 'value') else str(user.role)
                }
            }
        
        return jsonify(tenant_data), 201
        
    except ValueError as ve:
        db.session.rollback()
        print(f"Validation error in tenant creation: {str(ve)}")
        return jsonify({'error': str(ve)}), 422
    except Exception as e:
        db.session.rollback()
        print(f"Unexpected error in tenant creation: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        return jsonify({'error': str(e)}), 500

@tenant_bp.route('/<int:tenant_id>', methods=['PUT'])
# @jwt_required()  # Temporarily disabled for testing
def update_tenant(tenant_id):
    """Update a tenant."""
    try:
        data = request.get_json()
        
        # Find tenant
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({'error': 'Tenant not found'}), 404
        
        user = tenant.user
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Helper functions for safe conversions
        def safe_float(value):
            if value is None or value == '':
                return None
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        
        def safe_int(value):
            if value is None or value == '':
                return None
            try:
                return int(value)
            except (ValueError, TypeError):
                return None
        
        def safe_date(value):
            if value is None or value == '':
                return None
            try:
                return datetime.strptime(value, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                return None
        
        # Update user fields if provided
        if 'email' in data and data['email']:
            existing = User.query.filter(User.email == data['email'], User.id != user.id).first()
            if existing:
                return jsonify({'error': 'Email already taken'}), 400
            user.email = data['email']
        
        if 'username' in data and data['username']:
            existing = User.query.filter(User.username == data['username'], User.id != user.id).first()
            if existing:
                return jsonify({'error': 'Username already taken'}), 400
            user.username = data['username']
        
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'phone_number' in data:
            user.phone_number = data['phone_number']
        if 'address' in data:
            user.address = data['address']
        
        # Handle password update if provided
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        
        # Update tenant fields if provided (simplified schema: property_id, phone_number, email)
        if 'property_id' in data and data['property_id']:
            # Verify property exists
            from models.property import Property
            property_obj = Property.query.get(data['property_id'])
            if not property_obj:
                return jsonify({'error': f'Property with id {data["property_id"]} not found'}), 404
            tenant.property_id = data['property_id']
        if 'phone_number' in data:
            tenant.phone_number = data.get('phone_number', '')
        if 'email' in data:
            tenant.email = data.get('email', '')
        
        db.session.commit()
        
        # Return updated tenant using to_dict method
        try:
            tenant_data = tenant.to_dict(include_user=True)
        except Exception as dict_error:
            current_app.logger.warning(f"Error serializing tenant: {str(dict_error)}")
            tenant_data = {
                'id': tenant.id,
                'user_id': user.id,
                'property_id': getattr(tenant, 'property_id', None),
                'phone_number': getattr(tenant, 'phone_number', None),
                'email': getattr(tenant, 'email', None),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone_number': user.phone_number,
                    'role': getattr(user.role, 'value', str(user.role)) if hasattr(user.role, 'value') else str(user.role)
                }
            }
        
        return jsonify(tenant_data), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tenant_bp.route('/<int:tenant_id>', methods=['DELETE'])
# @jwt_required()  # Temporarily disabled for testing
def delete_tenant(tenant_id):
    """Delete a tenant."""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({'error': 'Tenant not found'}), 404
        
        user = tenant.user
        
        # Delete tenant record
        db.session.delete(tenant)
        # Delete user record
        if user:
            db.session.delete(user)
        
        db.session.commit()
        
        return jsonify({'message': 'Tenant deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tenant_bp.route('/<int:tenant_id>', methods=['GET'])
# @jwt_required()  # Temporarily disabled for testing
def get_tenant(tenant_id):
    """Get a specific tenant."""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({'error': 'Tenant not found'}), 404
        
        tenant_data = {
            'id': tenant.id,
            'user_id': tenant.user_id,
            'occupation': tenant.occupation,
            'employer': tenant.employer,
            'monthly_income': float(tenant.monthly_income) if tenant.monthly_income else None,
            'previous_landlord': tenant.previous_landlord,
            'previous_landlord_phone': tenant.previous_landlord_phone,
            'reference_name': tenant.reference_name,
            'reference_phone': tenant.reference_phone,
            'reference_relationship': tenant.reference_relationship,
            'preferred_move_in_date': tenant.preferred_move_in_date.isoformat() if tenant.preferred_move_in_date else None,
            'max_rent_budget': float(tenant.max_rent_budget) if tenant.max_rent_budget else None,
            'preferred_unit_type': tenant.preferred_unit_type,
            'assigned_room': tenant.assigned_room,
            'has_pets': tenant.has_pets,
            'pet_details': tenant.pet_details,
            'has_vehicle': tenant.has_vehicle,
            'vehicle_details': tenant.vehicle_details,
            'is_approved': tenant.is_approved,
            'background_check_status': tenant.background_check_status,
            'credit_score': tenant.credit_score,
            'user': {
                'id': tenant.user.id,
                'email': tenant.user.email,
                'username': tenant.user.username,
                'first_name': tenant.user.first_name,
                'last_name': tenant.user.last_name,
                'phone_number': tenant.user.phone_number,
                'address': tenant.user.address,
                'role': tenant.user.role.value
            }
        }
        
        return jsonify(tenant_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
