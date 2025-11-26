from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from models.user import User, UserRole
from models.staff import Staff, StaffRole, EmploymentStatus
from datetime import datetime, date
from sqlalchemy import text
import re

staff_bp = Blueprint('staff', __name__)

@staff_bp.route('/', methods=['GET'])
# @jwt_required()  # Temporarily disabled for testing
def get_staff():
    """Get all staff members with their user info."""
    try:
        staff_members = db.session.query(Staff).join(User).all()
        print(f"Found {len(staff_members)} staff members in database")
        
        staff_list = []
        for staff in staff_members:
            try:
                # Use to_dict method which handles missing columns gracefully
                staff_data = staff.to_dict(include_user=True)
                
                # Add user info if not already included
                if 'user' not in staff_data and staff.user:
                    try:
                        staff_data['user'] = {
                            'id': staff.user.id,
                            'email': getattr(staff.user, 'email', ''),
                            'username': getattr(staff.user, 'username', ''),
                            'first_name': getattr(staff.user, 'first_name', ''),
                            'last_name': getattr(staff.user, 'last_name', ''),
                            'phone': getattr(staff.user, 'phone_number', ''),
                            'phone_number': getattr(staff.user, 'phone_number', ''),
                            'role': getattr(staff.user.role, 'value', str(staff.user.role)) if hasattr(staff.user, 'role') else 'staff'
                        }
                    except Exception as user_error:
                        current_app.logger.warning(f"Error accessing user for staff {staff.id}: {str(user_error)}")
                        staff_data['user'] = {
                            'id': staff.user_id,
                            'email': '',
                            'username': '',
                            'first_name': '',
                            'last_name': '',
                            'phone': '',
                            'phone_number': '',
                            'role': 'staff'
                        }
                
                staff_list.append(staff_data)
            except Exception as serialization_error:
                current_app.logger.warning(f"Error serializing staff {staff.id}: {str(serialization_error)}")
                # Include minimal staff data if serialization fails
                try:
                    staff_list.append({
                        'id': staff.id,
                        'employee_id': staff.employee_id,
                        'staff_role': staff.staff_role.value if hasattr(staff.staff_role, 'value') else str(staff.staff_role),
                        'user_id': staff.user_id,
                        'created_at': staff.created_at.isoformat() if staff.created_at else None
                    })
                except Exception:
                    # Skip this staff member if even minimal serialization fails
                    continue
        
        return jsonify(staff_list), 200
        
    except Exception as e:
        print(f"Error in get_staff: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/', methods=['POST'])
# @jwt_required()  # Temporarily disabled for testing
def create_staff():
    """Create a new staff member."""
    try:
        # Get JSON data and handle case where it might be a string
        data = request.get_json()
        
        # If data is a string, try to parse it as JSON
        if isinstance(data, str):
            import json
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                return jsonify({'error': 'Invalid JSON format'}), 400
        
        # Ensure data is a dictionary
        if not isinstance(data, dict):
            return jsonify({'error': 'Request body must be a JSON object'}), 400
        
        print(f"Received staff creation data: {data}")
        
        # Validate required fields (only fields that exist in database)
        required_fields = ['email', 'username', 'password', 'first_name', 'last_name', 'employee_id', 'staff_role', 'property_id']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate property_id exists
        property_id = data.get('property_id')
        try:
            property_id = int(property_id)
            from models.property import Property
            property_obj = Property.query.get(property_id)
            if not property_obj:
                return jsonify({'error': f'Property with ID {property_id} does not exist'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid property_id'}), 400
        
        # Validate email format
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check if user already exists
        existing_user = User.query.filter(
            (User.email == data['email']) | (User.username == data['username'])
        ).first()
        if existing_user:
            return jsonify({'error': 'User with this email or username already exists'}), 400
        
        # Check if employee ID already exists
        existing_staff = Staff.query.filter_by(employee_id=data['employee_id']).first()
        if existing_staff:
            return jsonify({'error': 'Employee ID already exists'}), 400
        
        # Create user - ensure all string fields are not None
        user = User(
            email=data['email'] or '',
            username=data.get('username') or None,
            password=data['password'] or '',  # Will be hashed by User model
            first_name=data.get('first_name') or '',
            last_name=data.get('last_name') or '',
            phone_number=data.get('phone_number') or None,
            role=UserRole.STAFF,
            address=data.get('address') or None
        )
        
        db.session.add(user)
        db.session.flush()  # Get the user ID
        
        # Validate staff role - use string value directly (database uses enum as string)
        staff_role_str = str(data['staff_role']).lower()
        valid_roles = ['maintenance', 'security', 'cleaning', 'manager', 'admin_assistant', 'other']
        if staff_role_str not in valid_roles:
            return jsonify({'error': f'Invalid staff_role. Must be one of: {", ".join(valid_roles)}'}), 400
        
        # Create staff profile (only fields that exist in database)
        staff = Staff(
            user_id=user.id,
            employee_id=data['employee_id'],
            staff_role=staff_role_str,  # Use string value directly
            property_id=property_id
        )
        
        db.session.add(staff)
        db.session.commit()
        
        print(f"Successfully created staff with ID: {staff.id}")
        print(f"User ID: {user.id}, Staff ID: {staff.id}")
        
        # Verify the data was actually saved by querying it back
        verification_staff = Staff.query.get(staff.id)
        verification_user = User.query.get(user.id)
        print(f"Verification - Staff exists: {verification_staff is not None}")
        print(f"Verification - User exists: {verification_user is not None}")
        
        # Return created staff using to_dict method
        try:
            staff_data = staff.to_dict(include_user=True)
        except Exception as dict_error:
            current_app.logger.warning(f"Error serializing staff: {str(dict_error)}")
            # Fallback to minimal data
            staff_data = {
                'id': staff.id,
                'employee_id': staff.employee_id,
                'staff_role': staff.staff_role,
                'user_id': staff.user_id,
                'created_at': staff.created_at.isoformat() if staff.created_at else None,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone_number': user.phone_number,
                    'role': getattr(user.role, 'value', str(user.role)) if hasattr(user, 'role') else 'staff'
                }
            }
        
        return jsonify(staff_data), 201
        
    except ValueError as ve:
        db.session.rollback()
        print(f"Validation error in staff creation: {str(ve)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(ve)}), 422
    except Exception as e:
        db.session.rollback()
        print(f"Unexpected error in staff creation: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/<int:staff_id>', methods=['PUT'])
# @jwt_required()  # Temporarily disabled for testing
def update_staff(staff_id):
    """Update a staff member."""
    try:
        # Get JSON data and handle case where it might be a string
        data = request.get_json()
        
        # If data is a string, try to parse it as JSON
        if isinstance(data, str):
            import json
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                return jsonify({'error': 'Invalid JSON format'}), 400
        
        # Ensure data is a dictionary
        if not isinstance(data, dict):
            return jsonify({'error': 'Request body must be a JSON object'}), 400
        
        # Find staff member
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({'error': 'Staff member not found'}), 404
        
        user = staff.user
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update user fields if provided
        if 'email' in data and data['email']:
            # Check if email is taken by another user
            existing = User.query.filter(User.email == data['email'], User.id != user.id).first()
            if existing:
                return jsonify({'error': 'Email already taken'}), 400
            user.email = data['email']
        
        if 'username' in data and data['username']:
            # Check if username is taken by another user
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
        
        # Update staff fields if provided
        if 'employee_id' in data and data['employee_id']:
            # Check if employee ID is taken by another staff
            existing = Staff.query.filter(Staff.employee_id == data['employee_id'], Staff.id != staff.id).first()
            if existing:
                return jsonify({'error': 'Employee ID already taken'}), 400
            staff.employee_id = data['employee_id']
        
        if 'staff_role' in data:
            # Validate staff role - use string value directly
            staff_role_str = str(data['staff_role']).lower()
            valid_roles = ['maintenance', 'security', 'cleaning', 'manager', 'admin_assistant', 'other']
            if staff_role_str not in valid_roles:
                return jsonify({'error': f'Invalid staff_role. Must be one of: {", ".join(valid_roles)}'}), 400
            staff.staff_role = staff_role_str
        
        # Note: job_title, department, hire_date, employment_status, monthly_salary, hourly_rate, etc.
        # don't exist in the database, so we can't update them.
        # They are handled as compatibility properties in the model.
        
        db.session.commit()
        
        # Return updated staff using to_dict method
        try:
            staff_data = staff.to_dict(include_user=True)
        except Exception as dict_error:
            current_app.logger.warning(f"Error serializing staff: {str(dict_error)}")
            # Fallback to minimal data
            staff_data = {
                'id': staff.id,
                'employee_id': staff.employee_id,
                'staff_role': staff.staff_role,
                'user_id': staff.user_id,
                'created_at': staff.created_at.isoformat() if staff.created_at else None,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone_number': user.phone_number,
                    'role': getattr(user.role, 'value', str(user.role)) if hasattr(user, 'role') else 'staff'
                }
            }
        
        return jsonify(staff_data), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Unexpected error in staff update: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/<int:staff_id>', methods=['DELETE'])
# @jwt_required()  # Temporarily disabled for testing
def delete_staff(staff_id):
    """Delete a staff member."""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({'error': 'Staff member not found'}), 404
        
        user = staff.user
        user_id = user.id
        
        # Check if user manages any properties before deleting
        # Use raw SQL to avoid triggering Property model queries with missing columns
        try:
            result = db.session.execute(
                text("SELECT COUNT(*) as count FROM properties WHERE manager_id = :manager_id"),
                {"manager_id": user_id}
            ).fetchone()
            
            if result and result.count > 0:
                return jsonify({
                    'error': f'Cannot delete staff member. User manages {result.count} property/properties. Please reassign properties first.'
                }), 400
        except Exception as check_error:
            current_app.logger.warning(f"Error checking managed properties: {str(check_error)}")
            # Continue with deletion if check fails (might be missing table/column)
        
        # Expunge the user from the session to prevent lazy-loading relationships
        # This prevents SQLAlchemy from trying to query Property model with missing columns
        db.session.expunge(user)
        db.session.expunge(staff)
        
        # Delete staff record (re-query to get fresh instance)
        staff_to_delete = Staff.query.get(staff_id)
        if staff_to_delete:
            user_to_delete = staff_to_delete.user
            db.session.delete(staff_to_delete)
            # Delete user record
            if user_to_delete:
                db.session.delete(user_to_delete)
        
        db.session.commit()
        
        return jsonify({'message': 'Staff member deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting staff: {str(e)}", exc_info=True)
        error_msg = str(e)
        if current_app.config.get('DEBUG'):
            return jsonify({'error': error_msg}), 500
        else:
            return jsonify({'error': 'Failed to delete staff member'}), 500

@staff_bp.route('/<int:staff_id>', methods=['GET'])
# @jwt_required()  # Temporarily disabled for testing
def get_staff_member(staff_id):
    """Get a specific staff member."""
    try:
        staff = Staff.query.get(staff_id)
        if not staff:
            return jsonify({'error': 'Staff member not found'}), 404
        
        # Use to_dict method which handles missing columns gracefully
        try:
            staff_data = staff.to_dict(include_user=True)
        except Exception as dict_error:
            current_app.logger.warning(f"Error serializing staff: {str(dict_error)}")
            # Fallback to minimal data
            staff_data = {
                'id': staff.id,
                'employee_id': staff.employee_id,
                'staff_role': staff.staff_role,
                'user_id': staff.user_id,
                'created_at': staff.created_at.isoformat() if staff.created_at else None,
                'user': {
                    'id': staff.user.id,
                    'email': getattr(staff.user, 'email', ''),
                    'username': getattr(staff.user, 'username', ''),
                    'first_name': getattr(staff.user, 'first_name', ''),
                    'last_name': getattr(staff.user, 'last_name', ''),
                    'phone_number': getattr(staff.user, 'phone_number', ''),
                    'address': getattr(staff.user, 'address', '')
                }
            }
        
        return jsonify(staff_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
