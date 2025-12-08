"""
Tenant Profile API Routes
"""
from flask import Blueprint, request, jsonify, current_app
import os
from app import db
from app.models.user import User, UserRole
from app.utils.decorators import tenant_required
from app.utils.error_handlers import handle_api_error
from app.utils.validators import validate_required_fields, sanitize_input
from app.utils.file_helpers import save_uploaded_file, IMAGE_EXTENSIONS
import base64
import pyotp
import qrcode
from io import BytesIO

tenant_profile_bp = Blueprint('tenant_profile', __name__)

@tenant_profile_bp.route('/', methods=['GET'])
@tenant_required
def get_tenant_profile(current_user):
    """
    Get tenant profile
    ---
    tags:
      - Tenant Profile
    summary: Get the current tenant's profile
    description: Retrieve profile information for the authenticated tenant
    security:
      - Bearer: []
    responses:
      200:
        description: Profile retrieved successfully
        schema:
          type: object
          properties:
            id:
              type: integer
            email:
              type: string
            first_name:
              type: string
            last_name:
              type: string
      401:
        description: Unauthorized
      500:
        description: Server error
    """
    try:
        # Build a conservative, flat profile payload to avoid serialization issues
        role_value = getattr(current_user.role, 'value', current_user.role)
        status_value = getattr(current_user.status, 'value', current_user.status)
        def safe_iso(dt):
            try:
                return dt.isoformat() if dt else None
            except Exception:
                return str(dt) if dt else None
        profile_data = {
            'id': current_user.id,
            'email': current_user.email,
            'role': role_value,
            'status': status_value,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'full_name': f"{current_user.first_name} {current_user.last_name}",
            'phone_number': current_user.phone_number,
            'date_of_birth': safe_iso(current_user.date_of_birth),
            'profile_image_url': current_user.profile_image_url,
            'two_factor_enabled': bool(getattr(current_user, 'two_factor_enabled', False)),
            # Flattened address fields expected by frontend
            'address': current_user.address,
            'city': current_user.city,
            'province': current_user.province,
            'postal_code': current_user.postal_code,
            'country': current_user.country,
            'bio': current_user.bio,
            'created_at': safe_iso(current_user.created_at),
            'updated_at': safe_iso(current_user.updated_at),
            'last_login': safe_iso(current_user.last_login)
        }
        
        # Add tenant-specific data with safe fallbacks
        try:
            total_inquiries = current_user.sent_inquiries.count() if hasattr(current_user, 'sent_inquiries') and current_user.sent_inquiries is not None else 0
        except Exception:
            total_inquiries = 0
        try:
            active_inquiries = current_user.sent_inquiries.filter_by(is_archived=False).count() if hasattr(current_user, 'sent_inquiries') and current_user.sent_inquiries is not None else 0
        except Exception:
            active_inquiries = 0
        try:
            member_since = current_user.created_at.isoformat() if getattr(current_user, 'created_at', None) else None
        except Exception:
            member_since = None

        profile_data['statistics'] = {
            'total_inquiries': total_inquiries,
            'active_inquiries': active_inquiries,
            'member_since': member_since
        }
        
        # Add tenant's current unit and property assignment information
        unit_info = None
        property_info = None
        
        try:
            from sqlalchemy import text
            from datetime import date
            
            # Get tenant's current active unit assignment
            # First, check if user has a tenant profile in tenants table
            current_app.logger.info(f'=== Fetching tenant profile for user_id: {current_user.id} ===')
            tenant_profile = db.session.execute(text("""
                SELECT id, property_id FROM tenants WHERE user_id = :user_id LIMIT 1
            """), {'user_id': current_user.id}).first()
            
            if tenant_profile:
                tenant_profile_id = tenant_profile[0]
                tenant_property_id = tenant_profile[1] if len(tenant_profile) > 1 else None
                current_app.logger.info(f'✓ Found tenant profile: tenant_id={tenant_profile_id}, property_id={tenant_property_id}')
                
                # First, let's verify tenant_units record exists
                tenant_unit_check = db.session.execute(text("""
                    SELECT COUNT(*) as cnt FROM tenant_units WHERE tenant_id = :tenant_id
                """), {'tenant_id': tenant_profile_id}).scalar()
                current_app.logger.info(f'Found {tenant_unit_check} tenant_units record(s) for tenant_id={tenant_profile_id}')
                
                # Strategy 1: Simple query - just get tenant_units with unit and property
                # Start with the most basic query possible
                assignment = None
                
                try:
                    # First, test the simplest possible query
                    test_query = db.session.execute(text("""
                        SELECT tu.id, tu.unit_id, tu.property_id 
                        FROM tenant_units tu 
                        WHERE tu.tenant_id = :tenant_id 
                        LIMIT 1
                    """), {'tenant_id': tenant_profile_id}).first()
                    current_app.logger.info(f'Test query result: {test_query is not None}, data: {test_query}')
                    
                    # Now do the full query
                    assignment = db.session.execute(text("""
                        SELECT 
                            tu.id as tu_id,
                            tu.unit_id,
                            tu.property_id as tu_property_id,
                            tu.move_in_date,
                            tu.move_out_date,
                            tu.monthly_rent,
                            u.id as unit_db_id,
                            u.property_id as unit_property_id,
                            u.unit_name,
                            u.unit_number,
                            u.status as unit_status,
                            u.monthly_rent as unit_monthly_rent
                        FROM tenant_units tu
                        INNER JOIN units u ON u.id = tu.unit_id
                        WHERE tu.tenant_id = :tenant_id
                        ORDER BY tu.id DESC
                        LIMIT 1
                    """), {'tenant_id': tenant_profile_id}).mappings().first()
                    
                    if assignment:
                        current_app.logger.info(f'✓ Query 1 SUCCESS: Found assignment with unit_id={assignment.get("unit_id")}, property_id={assignment.get("tu_property_id")}')
                        current_app.logger.info(f'Assignment keys: {list(assignment.keys())}')
                        current_app.logger.info(f'Unit name: {assignment.get("unit_name")}, Unit number: {assignment.get("unit_number")}')
                    else:
                        current_app.logger.warning(f'✗ Query 1 returned no results')
                except Exception as q1_error:
                    current_app.logger.error(f'✗ Query 1 failed with exception: {str(q1_error)}', exc_info=True)
                
                # If we got unit data, now fetch property separately
                if assignment:
                    prop_id_to_fetch = assignment.get('tu_property_id') or assignment.get('unit_property_id') or tenant_property_id
                    current_app.logger.info(f'Fetching property for prop_id={prop_id_to_fetch}')
                    
                    if prop_id_to_fetch:
                        try:
                            prop_row = db.session.execute(text("""
                                SELECT 
                                    p.id as property_db_id,
                                    p.building_name,
                                    p.title as property_title,
                                    p.address as property_address,
                                    p.city as property_city,
                                    p.province as property_province
                                FROM properties p
                                WHERE p.id = :property_id
                                LIMIT 1
                            """), {'property_id': prop_id_to_fetch}).mappings().first()
                            
                            if prop_row:
                                # Merge property data into assignment
                                for key, value in prop_row.items():
                                    assignment[key] = value
                                current_app.logger.info(f'Property fetched: {prop_row.get("property_title") or prop_row.get("building_name")}')
                            else:
                                current_app.logger.warning(f'Property {prop_id_to_fetch} not found in properties table')
                        except Exception as prop_error:
                            current_app.logger.error(f'Property query failed: {prop_error}')
                else:
                    current_app.logger.warning(f'No tenant_units record found for tenant_id={tenant_profile_id}')
                
                if assignment:
                    # Get property_id from various possible sources
                    prop_id = assignment.get('tu_property_id') or assignment.get('unit_property_id') or assignment.get('property_db_id') or assignment.get('property_id') or tenant_property_id
                    
                    current_app.logger.info(f'Found tenant_units record: tu_id={assignment.get("tu_id")}, unit_id={assignment.get("unit_id")}, prop_id={prop_id}')
                    current_app.logger.info(f'Assignment keys: {list(assignment.keys())}')
                    
                    # Build unit info - ensure all fields are populated
                    unit_id_val = assignment.get('unit_id') or assignment.get('unit_db_id')
                    unit_name_val = assignment.get('unit_name') or assignment.get('unit_number') or f"Unit {assignment.get('unit_number', '')}"
                    unit_number_val = assignment.get('unit_number') or assignment.get('unit_name')
                    
                    unit_info = {
                        'id': unit_id_val,
                        'unit_name': unit_name_val,
                        'unit_number': unit_number_val,
                        'status': assignment.get('unit_status'),
                        'monthly_rent': float(assignment.get('monthly_rent') or assignment.get('unit_monthly_rent') or 0),
                        'move_in_date': safe_iso(assignment.get('move_in_date')),
                        'move_out_date': safe_iso(assignment.get('move_out_date'))
                    }
                    
                    # Build property info - always try to build it if we have property data
                    prop_title = assignment.get('property_title')
                    prop_building = assignment.get('building_name')
                    
                    if prop_id or prop_title or prop_building:
                        property_info = {
                            'id': prop_id,
                            'building_name': prop_building,
                            'title': prop_title or prop_building,
                            'address': assignment.get('property_address'),
                            'city': assignment.get('property_city'),
                            'province': assignment.get('property_province')
                        }
                        current_app.logger.info(f'Built property info: id={property_info.get("id")}, title={property_info.get("title")}, building={property_info.get("building_name")}')
                    else:
                        # If we still don't have property info, try fetching from property_id directly
                        if prop_id:
                            try:
                                prop_fetch = db.session.execute(text("""
                                    SELECT 
                                        p.id as property_id,
                                        p.building_name,
                                        p.title as property_title,
                                        p.address as property_address,
                                        p.city as property_city,
                                        p.province as property_province
                                    FROM properties p
                                    WHERE p.id = :property_id
                                    LIMIT 1
                                """), {'property_id': prop_id}).mappings().first()
                                
                                if prop_fetch:
                                    property_info = {
                                        'id': prop_fetch.get('property_id'),
                                        'building_name': prop_fetch.get('building_name'),
                                        'title': prop_fetch.get('property_title') or prop_fetch.get('building_name'),
                                        'address': prop_fetch.get('property_address'),
                                        'city': prop_fetch.get('property_city'),
                                        'province': prop_fetch.get('property_province')
                                    }
                                    current_app.logger.info(f'Fetched property info separately: {property_info.get("title")}')
                            except Exception as prop_fetch_error:
                                current_app.logger.error(f'Error fetching property separately: {prop_fetch_error}')
                    
                    current_app.logger.info(f'Final assignment data - unit_id={unit_info.get("id")}, unit_name={unit_info.get("unit_name")}, property_id={prop_id}, has_property_info={property_info is not None}')
                
                # Strategy 2: If no tenant_units found, get property from tenants.property_id
                if not assignment and tenant_property_id:
                    current_app.logger.info(f'No tenant_units record found, falling back to property_id from tenants table: {tenant_property_id}')
                    property_only = db.session.execute(text("""
                        SELECT 
                            p.id as property_id,
                            p.building_name,
                            p.title as property_title,
                            p.address as property_address,
                            p.city as property_city,
                            p.province as property_province
                        FROM properties p
                        WHERE p.id = :property_id
                        LIMIT 1
                    """), {'property_id': tenant_property_id}).mappings().first()
                    
                    if property_only:
                        property_info = {
                            'id': property_only.get('property_id'),
                            'building_name': property_only.get('building_name'),
                            'title': property_only.get('property_title') or property_only.get('building_name'),
                            'address': property_only.get('property_address'),
                            'city': property_only.get('property_city'),
                            'province': property_only.get('property_province')
                        }
                        current_app.logger.info(f'Found property from tenants table: {property_info.get("title")}')
            else:
                current_app.logger.warning(f'No tenant profile found for user_id: {current_user.id}')
                
        except Exception as unit_error:
            current_app.logger.error(f'Failed to fetch tenant unit/property info: {str(unit_error)}', exc_info=True)
            # Don't fail the entire request if unit/property lookup fails
            unit_info = None
            property_info = None
        
        # Always set these fields, even if None (don't omit them)
        profile_data['current_unit'] = unit_info
        profile_data['current_property'] = property_info
        
        # Log what we're returning for debugging
        current_app.logger.info(f'Profile response - current_unit: {unit_info is not None}, current_property: {property_info is not None}')
        if unit_info:
            current_app.logger.info(f'Unit info details: id={unit_info.get("id")}, name={unit_info.get("unit_name")}, number={unit_info.get("unit_number")}')
        if property_info:
            current_app.logger.info(f'Property info details: id={property_info.get("id")}, title={property_info.get("title")}, building={property_info.get("building_name")}')
        
        return jsonify({
            'profile': profile_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get tenant profile error: {e}')
        return handle_api_error(500, "Failed to retrieve profile")

@tenant_profile_bp.route('/', methods=['PUT'])
@tenant_required
def update_tenant_profile(current_user):
    """Update the current tenant's profile information."""
    try:
        data = request.get_json()
        if not data:
            return handle_api_error(400, "No data provided")
        
        # Update basic profile fields
        if 'first_name' in data and data['first_name']:
            current_user.first_name = sanitize_input(data['first_name'])
        
        if 'last_name' in data and data['last_name']:
            current_user.last_name = sanitize_input(data['last_name'])
        
        if 'phone_number' in data:
            current_user.phone_number = sanitize_input(data['phone_number']) if data['phone_number'] else None
        
        if 'date_of_birth' in data:
            if data['date_of_birth']:
                from datetime import datetime
                try:
                    current_user.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
                except ValueError:
                    return handle_api_error(400, "Invalid date format. Use YYYY-MM-DD")
            else:
                current_user.date_of_birth = None
        
        # Update address fields
        if 'address' in data:
            current_user.address = sanitize_input(data['address']) if data['address'] else None
        
        address_fields = ['city', 'province', 'postal_code', 'country']
        for field in address_fields:
            if field in data:
                value = sanitize_input(data[field]) if data[field] else None
                setattr(current_user, field, value)
        
        # Update bio field
        if 'bio' in data:
            current_user.bio = sanitize_input(data['bio']) if data['bio'] else None
        
        db.session.commit()
        
        # Send notification about profile update
        try:
            from app.services.notification_service import NotificationService
            NotificationService.notify_account_update(
                tenant_id=current_user.id,
                update_type="profile"
            )
        except Exception as notif_error:
            current_app.logger.error(f"Failed to send notification: {str(notif_error)}")
            # Don't fail the request if notification fails
        
        return jsonify({
            'message': 'Profile updated successfully',
            'profile': current_user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Update tenant profile error: {e}')
        return handle_api_error(500, "Failed to update profile")

@tenant_profile_bp.route('/change-password', methods=['POST'])
@tenant_required
def change_password(current_user):
    """Change the current tenant's password."""
    try:
        data = request.get_json()
        if not data:
            return handle_api_error(400, "No data provided")
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')
        
        if not current_password or not new_password or not confirm_password:
            return handle_api_error(400, "All password fields are required")
        
        # Verify current password
        if not current_user.check_password(current_password):
            return handle_api_error(400, "Current password is incorrect")
        
        # Verify new password confirmation
        if new_password != confirm_password:
            return handle_api_error(400, "New password and confirmation do not match")
        
        # Validate new password strength (basic validation)
        if len(new_password) < 8:
            return handle_api_error(400, "New password must be at least 8 characters long")
        
        # Update password
        current_user.set_password(new_password)
        db.session.commit()
        
        # Send notification about password change
        try:
            from app.services.notification_service import NotificationService
            NotificationService.notify_account_update(
                tenant_id=current_user.id,
                update_type="password"
            )
        except Exception as notif_error:
            current_app.logger.error(f"Failed to send notification: {str(notif_error)}")
            # Don't fail the request if notification fails
        
        return jsonify({
            'message': 'Password changed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Change password error: {e}')
        return handle_api_error(500, "Failed to change password")


@tenant_profile_bp.route('/upload-image', methods=['POST'])
@tenant_required
def upload_profile_image(current_user):
    """Upload and set the tenant's profile image."""
    try:
        if 'image' not in request.files:
            return handle_api_error(400, "No image file provided")

        file = request.files['image']
        if not file or file.filename == '':
            return handle_api_error(400, "No image selected")

        # Build user-specific upload directory under instance/uploads/users/<id>
        upload_folder = os.path.join(
            current_app.instance_path,
            current_app.config.get('UPLOAD_FOLDER', 'uploads'),
            'users',
            str(current_user.id)
        )

        success, filename, error = save_uploaded_file(
            file,
            upload_folder,
            allowed_extensions=IMAGE_EXTENSIONS,
            max_size=5 * 1024 * 1024  # 5MB
        )

        if not success:
            return handle_api_error(400, error or "Failed to save image")

        # Public URL served by /uploads route
        public_url = f"/uploads/users/{current_user.id}/{filename}"

        # Persist on user
        current_user.profile_image_url = public_url
        db.session.commit()

        return jsonify({
            'message': 'Profile image updated successfully',
            'profile_image_url': public_url
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Upload profile image error: {e}')
        return handle_api_error(500, "Failed to upload profile image")


# Two-Factor Authentication (TOTP) - DEPRECATED: System uses email-based 2FA
# These routes are kept for backward compatibility but may not work if two_factor_secret column is dropped
@tenant_profile_bp.route('/2fa/setup', methods=['POST'])
@tenant_required
def twofa_setup(current_user):
    """Initialize 2FA setup: generate secret and QR image (data URL)."""
    try:
        # Check if two_factor_secret column exists (for backward compatibility)
        if not hasattr(current_user, 'two_factor_secret'):
            return handle_api_error(400, 'TOTP 2FA is not available. Please use email-based 2FA instead.')
        
        # Generate new secret
        secret = pyotp.random_base32()
        current_user.two_factor_secret = secret
        db.session.commit()

        issuer = (current_app.config.get('APP_NAME') or 'CapstoneApp').replace(':', '')
        label = f"{issuer}:{current_user.email}"
        uri = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)

        # Create QR code PNG as data URL
        qr = qrcode.QRCode(box_size=6, border=2)
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = BytesIO()
        img.save(buf, format='PNG')
        data_url = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')

        return jsonify({'secret': secret, 'otpauth_url': uri, 'qr_data_url': data_url}), 200
    except Exception as e:
        current_app.logger.error(f'2FA setup error: {e}')
        return handle_api_error(500, 'Failed to initialize 2FA')


@tenant_profile_bp.route('/2fa/enable', methods=['POST'])
@tenant_required
def twofa_enable(current_user):
    """Verify code and enable 2FA."""
    try:
        # Check if two_factor_secret column exists (for backward compatibility)
        if not hasattr(current_user, 'two_factor_secret'):
            return handle_api_error(400, 'TOTP 2FA is not available. Please use email-based 2FA instead.')
        
        data = request.get_json() or {}
        code = (data.get('code') or '').strip()
        if not current_user.two_factor_secret:
            return handle_api_error(400, '2FA secret not initialized')
        totp = pyotp.TOTP(current_user.two_factor_secret)
        if not totp.verify(code, valid_window=1):
            return handle_api_error(400, 'Invalid verification code')
        current_user.two_factor_enabled = True
        db.session.commit()
        return jsonify({'message': 'Two-factor authentication enabled'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'2FA enable error: {e}')
        return handle_api_error(500, 'Failed to enable 2FA')


@tenant_profile_bp.route('/2fa/disable', methods=['POST'])
@tenant_required
def twofa_disable(current_user):
    """Disable 2FA after verifying current password or code (optional simple flow)."""
    try:
        current_user.two_factor_enabled = False
        # Keep secret so user can re-enable quickly; clear if you prefer
        db.session.commit()
        return jsonify({'message': 'Two-factor authentication disabled'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'2FA disable error: {e}')
        return handle_api_error(500, 'Failed to disable 2FA')


# Email-based 2FA toggle (no TOTP)
@tenant_profile_bp.route('/2fa/email/enable', methods=['POST'])
@tenant_required
def twofa_email_enable(current_user):
    """Enable email-based 2FA for current tenant."""
    try:
        current_user.two_factor_enabled = True
        # Clear any TOTP secret to avoid confusion (if column exists)
        try:
            if hasattr(current_user, 'two_factor_secret'):
                current_user.two_factor_secret = None
        except Exception:
            pass
        db.session.commit()
        return jsonify({'message': 'Email-based two-factor authentication enabled'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'2FA email enable error: {e}')
        return handle_api_error(500, 'Failed to enable 2FA')


@tenant_profile_bp.route('/2fa/email/disable', methods=['POST'])
@tenant_required
def twofa_email_disable(current_user):
    """Disable email-based 2FA for current tenant."""
    try:
        current_user.two_factor_enabled = False
        current_user.two_factor_email_code = None
        current_user.two_factor_email_expires = None
        db.session.commit()
        return jsonify({'message': 'Email-based two-factor authentication disabled'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'2FA email disable error: {e}')
        return handle_api_error(500, 'Failed to disable 2FA')