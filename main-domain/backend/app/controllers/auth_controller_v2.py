"""
Auth controller (v2): Thin layer that delegates to AuthServiceV2
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db, limiter
from app.utils.decorators import validate_json_content_type
from app.services.auth_service_v2 import AuthServiceV2, AuthValidationError, AuthDomainError

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
@validate_json_content_type
@limiter.limit("20 per minute")
def register():
    try:
        service = AuthServiceV2()
        data = service.register(request.get_json() or {})
        return jsonify(data), 201
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except AuthDomainError as e:
        # domain errors on register should be surfaced with 400 to help UI
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Registration error: {e}')
        return jsonify({'error': 'Registration failed', 'message': 'An error occurred during registration'}), 500


@auth_bp.route('/login', methods=['POST'])
@validate_json_content_type
def login():
    try:
        service = AuthServiceV2()
        data = service.login(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        # Handle failed login attempts
        if str(e) == 'Invalid credentials':
            payload = request.get_json() or {}
            from app.repositories.user_repository import UserRepository
            user = UserRepository().get_by_email(payload.get('email', ''))
            service.handle_failed_login(user)
        # Return error based on type
        code = 401 if str(e) in ['Invalid credentials'] else 423 if 'locked' in str(e).lower() else 403 if 'suspended' in str(e).lower() or 'inactive' in str(e).lower() else 400
        return jsonify({'error': str(e), **e.details}), code
    except Exception as e:
        current_app.logger.error(f'Login error: {e}')
        return jsonify({'error': 'Login failed', 'message': 'An error occurred during login'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    try:
        service = AuthServiceV2()
        data = service.refresh(get_jwt_identity())
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 401
    except Exception as e:
        current_app.logger.error(f'Token refresh error: {e}')
        return jsonify({'error': 'Token refresh failed', 'message': 'Unable to refresh access token'}), 500


@auth_bp.route('/verify-2fa', methods=['POST'])
@validate_json_content_type
def verify_two_factor():
    try:
        service = AuthServiceV2()
        data = service.verify_two_factor(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'2FA verify error: {e}')
        return jsonify({'error': 'Verification failed'}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    try:
        token = get_jwt()
        service = AuthServiceV2()
        data = service.logout(
            jti=token['jti'],
            token_type=token['type'],
            expires_at=datetime.fromtimestamp(token['exp']),
            current_user_id=get_jwt_identity()
        )
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Logout error: {e}')
        return jsonify({'error': 'Logout failed', 'message': 'An error occurred during logout'}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        service = AuthServiceV2()
        data = service.me(get_jwt_identity())
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 404
    except Exception as e:
        current_app.logger.error(f'Get current user error: {e}')
        return jsonify({'error': 'Failed to get user info', 'message': 'Unable to retrieve current user information'}), 500


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
@validate_json_content_type
def change_password():
    try:
        service = AuthServiceV2()
        data = service.change_password(get_jwt_identity(), request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Change password error: {e}')
        return jsonify({'error': 'Password change failed', 'message': 'Unable to change password'}), 500


# Email verification endpoints
@auth_bp.route('/verify-email', methods=['POST'])
@validate_json_content_type
@limiter.limit("10 per minute")
def verify_email():
    try:
        service = AuthServiceV2()
        data = service.verify_email(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Email verification error: {e}')
        return jsonify({'error': 'Email verification failed', 'message': 'An error occurred during email verification'}), 500


@auth_bp.route('/check-verification-status', methods=['GET'])
@limiter.limit("30 per minute")
def check_verification_status():
    """Check if an email has been verified (for polling from original browser)."""
    try:
        email = request.args.get('email')
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        service = AuthServiceV2()
        data = service.check_verification_status({'email': email})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Check verification status error: {e}')
        return jsonify({'error': 'Failed to check verification status', 'message': 'An error occurred'}), 500


@auth_bp.route('/resend-verification', methods=['POST'])
@validate_json_content_type
@limiter.limit("5 per minute")
def resend_verification_email():
    try:
        service = AuthServiceV2()
        data = service.resend_verification_email(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except AuthDomainError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        current_app.logger.error(f'Resend verification email error: {e}')
        return jsonify({'error': 'Failed to resend verification email', 'message': 'An error occurred while sending verification email'}), 500


# Password reset endpoints
@auth_bp.route('/forgot-password', methods=['POST'])
@validate_json_content_type
@limiter.limit("5 per minute")
def forgot_password():
    try:
        service = AuthServiceV2()
        data = service.forgot_password(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Forgot password error: {e}')
        return jsonify({'error': 'Failed to send reset email', 'message': 'An error occurred while sending the reset email'}), 500


@auth_bp.route('/verify-reset-token', methods=['POST'])
@validate_json_content_type
@limiter.limit("20 per minute")
def verify_reset_token():
    try:
        service = AuthServiceV2()
        data = service.verify_reset_token(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Verify reset token error: {e}')
        return jsonify({'error': 'Token verification failed', 'message': 'An error occurred during token verification'}), 500


@auth_bp.route('/reset-password', methods=['POST'])
@validate_json_content_type
@limiter.limit("10 per minute")
def reset_password():
    try:
        service = AuthServiceV2()
        data = service.reset_password(request.get_json() or {})
        return jsonify(data), 200
    except AuthValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Reset password error: {e}')
        return jsonify({'error': 'Password reset failed', 'message': 'An error occurred during password reset'}), 500


# Health check endpoint
@auth_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'authentication',
        'timestamp': datetime.utcnow().isoformat()
    }), 200