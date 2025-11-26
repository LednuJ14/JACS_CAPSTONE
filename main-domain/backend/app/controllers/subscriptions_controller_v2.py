"""
Subscriptions controller (v2): delegates to SubscriptionsService
"""
from flask import Blueprint, jsonify, current_app
from app.utils.decorators import manager_required
from app.services.subscriptions_service import SubscriptionsService

subscriptions_bp = Blueprint('subscriptions', __name__)


@subscriptions_bp.route('/plans', methods=['GET'])
def get_subscription_plans():
    try:
        data = SubscriptionsService().plans()
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get subscription plans error: {e}')
        return jsonify({'error': 'Failed to retrieve subscription plans', 'message': 'An error occurred while fetching subscription plans'}), 500


@subscriptions_bp.route('/my-subscription', methods=['GET'])
@manager_required
def get_my_subscription(current_user):
    try:
        data = SubscriptionsService().my_subscription(current_user)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get my subscription error: {e}')
        return jsonify({'error': 'Failed to retrieve subscription', 'message': 'An error occurred while fetching your subscription'}), 500


@subscriptions_bp.route('/billing-history', methods=['GET'])
@manager_required
def get_billing_history(current_user):
    try:
        data = SubscriptionsService().billing_history(current_user)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get billing history error: {e}')
        return jsonify({'error': 'Failed to retrieve billing history', 'message': 'An error occurred while fetching billing history'}), 500


@subscriptions_bp.route('/payment-methods', methods=['GET'])
@manager_required
def get_payment_methods(current_user):
    try:
        data = SubscriptionsService().payment_methods(current_user)
        return jsonify(data), 200
    except Exception as e:
        current_app.logger.error(f'Get payment methods error: {e}')
        return jsonify({'error': 'Failed to retrieve payment methods', 'message': 'An error occurred while fetching payment methods'}), 500


@subscriptions_bp.route('/upgrade', methods=['POST'])
@manager_required
def upgrade_plan(current_user):
    try:
        from flask import request
        data = request.get_json()
        result = SubscriptionsService().upgrade_plan(current_user, data)
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f'Upgrade plan error: {e}')
        return jsonify({'error': 'Failed to upgrade plan', 'message': str(e)}), 500


@subscriptions_bp.route('/payment-methods/add', methods=['POST'])
@manager_required
def add_payment_method(current_user):
    try:
        from flask import request
        data = request.get_json()
        result = SubscriptionsService().add_payment_method(current_user, data)
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f'Add payment method error: {e}')
        return jsonify({'error': 'Failed to add payment method', 'message': 'An error occurred while adding payment method'}), 500


@subscriptions_bp.route('/payment-methods/<int:method_id>', methods=['DELETE'])
@manager_required
def remove_payment_method(current_user, method_id):
    try:
        result = SubscriptionsService().remove_payment_method(current_user, method_id)
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f'Remove payment method error: {e}')
        return jsonify({'error': 'Failed to remove payment method', 'message': 'An error occurred while removing payment method'}), 500


@subscriptions_bp.route('/payment-methods/<int:method_id>/set-default', methods=['POST'])
@manager_required
def set_default_payment_method(current_user, method_id):
    try:
        result = SubscriptionsService().set_default_payment_method(current_user, method_id)
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f'Set default payment method error: {e}')
        return jsonify({'error': 'Failed to set default payment method', 'message': 'An error occurred while setting default payment method'}), 500


@subscriptions_bp.route('/billing/<int:billing_id>/pay', methods=['POST'])
@manager_required
def process_payment(current_user, billing_id):
    try:
        from flask import request
        payment_data = request.get_json()
        
        # Validate required payment fields
        required_fields = ['payment_method', 'card_number', 'expiry_month', 'expiry_year', 'cvv']
        for field in required_fields:
            if not payment_data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        result = SubscriptionsService().process_payment(current_user, billing_id, payment_data)
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        current_app.logger.error(f'Process payment error: {e}')
        return jsonify({'error': 'Payment processing failed', 'message': str(e)}), 500
