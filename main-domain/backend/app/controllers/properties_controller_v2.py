"""
Properties controller (v2): delegates to PropertiesService
"""
from flask import Blueprint, request, jsonify, current_app
from app import db, limiter
from app.utils.decorators import auth_required, manager_required, property_limit_check, validate_json_content_type
from app.services.properties_service_v2 import PropertiesService, PropertiesValidationError

properties_bp = Blueprint('properties', __name__)


@properties_bp.route('', methods=['GET'])
def get_properties():
    try:
        data = PropertiesService().list_public(request.args)
        return jsonify(data), 200
    except PropertiesValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        current_app.logger.error(f'Get properties error: {e}')
        return jsonify({'error': 'Failed to retrieve properties', 'message': 'An error occurred while fetching properties'}), 500


@properties_bp.route('/<int:property_id>', methods=['GET'])
def get_property(property_id):
    try:
        data = PropertiesService().get_by_id_public(property_id)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get property error: {e}')
        return jsonify({'error': 'Failed to retrieve property', 'message': 'An error occurred while fetching property information'}), 500


@properties_bp.route('', methods=['POST'])
@property_limit_check
@validate_json_content_type
def create_property(current_user):
    try:
        data = PropertiesService().create(current_user, request.get_json() or {})
        return jsonify(data), 201
    except PropertiesValidationError as e:
        return jsonify({'error': str(e), **e.details}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Create property error: {e}')
        return jsonify({'error': 'Failed to create property', 'message': 'An error occurred while creating the property'}), 500


@properties_bp.route('/my-properties', methods=['GET'])
@manager_required
def get_my_properties(current_user):
    try:
        data = PropertiesService().list_my_properties(current_user, request.args)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get my properties error: {e}')
        return jsonify({'error': 'Failed to retrieve properties', 'message': 'An error occurred while fetching your properties'}), 500


@properties_bp.route('/active', methods=['GET'])
def get_active_properties():
    """Get all active properties available for tenant inquiries."""
    try:
        data = PropertiesService().list_active_for_inquiries(request.args)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get active properties error: {e}')
        return jsonify({'error': 'Failed to retrieve active properties', 'message': 'An error occurred while fetching available properties'}), 500
