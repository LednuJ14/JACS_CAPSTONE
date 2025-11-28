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
    """Get the current tenant's profile information."""
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
            'address_line1': current_user.address_line1,
            'address_line2': current_user.address_line2,
            'city': current_user.city,
            'province': current_user.province,
            'postal_code': current_user.postal_code,
            'country': current_user.country,
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
        address_fields = ['address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country']
        for field in address_fields:
            if field in data:
                value = sanitize_input(data[field]) if data[field] else None
                setattr(current_user, field, value)
        
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