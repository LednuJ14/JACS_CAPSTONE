"""
Users controller (v2): delegates to UsersService
"""
from flask import Blueprint, request, jsonify, current_app
from app.utils.decorators import admin_required, owner_or_admin_required, validate_json_content_type
from app.services.users_service import UsersService, UsersValidationError

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@admin_required
def get_users(current_user):
    try:
        data = UsersService().list_users(request.args)
        return jsonify(data), 200
    except UsersValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Get users error: {e}')
        return jsonify({'error': 'Failed to retrieve users', 'message': 'An error occurred while fetching users'}), 500


@users_bp.route('/<int:user_id>', methods=['GET'])
@owner_or_admin_required
def get_user(current_user, user_id):
    try:
        data = UsersService().get_user(current_user, user_id)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get user error: {e}')
        return jsonify({'error': 'Failed to retrieve user', 'message': 'An error occurred while fetching user information'}), 500


@users_bp.route('/<int:user_id>', methods=['PUT'])
@owner_or_admin_required
@validate_json_content_type
def update_user(current_user, user_id):
    try:
        data = UsersService().update_user(current_user, user_id, request.get_json() or {})
        return jsonify(data), 200
    except UsersValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Update user error: {e}')
        return jsonify({'error': 'Failed to update user', 'message': 'An error occurred while updating user information'}), 500


@users_bp.route('/<int:user_id>/status', methods=['PATCH'])
@admin_required
@validate_json_content_type
def update_user_status(current_user, user_id):
    try:
        data = UsersService().update_user_status(current_user, user_id, request.get_json() or {})
        return jsonify(data), 200
    except UsersValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Update user status error: {e}')
        return jsonify({'error': 'Failed to update user status', 'message': 'An error occurred while updating user status'}), 500


@users_bp.route('/stats', methods=['GET'])
@admin_required
def get_user_stats(current_user):
    try:
        data = UsersService().stats()
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get user stats error: {e}')
        return jsonify({'error': 'Failed to retrieve user statistics', 'message': 'An error occurred while fetching user statistics'}), 500
