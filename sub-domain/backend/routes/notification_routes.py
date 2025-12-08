from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
from sqlalchemy import desc, and_, or_

from app import db
from models.notification import Notification, NotificationType, NotificationPriority
from models.user import User, UserRole
from models.tenant import Tenant

notification_bp = Blueprint('notifications', __name__)

def get_current_user():
    """Helper function to get current user from JWT token."""
    current_user_id = get_jwt_identity()
    if not current_user_id:
        return None
    return User.query.get(current_user_id)

def get_current_tenant():
    """Helper function to get current tenant from JWT token."""
    user = get_current_user()
    if not user:
        return None
    
    # Check if user is a tenant
    user_role = user.role
    if isinstance(user_role, UserRole):
        user_role_str = user_role.value
    elif isinstance(user_role, str):
        user_role_str = user_role.upper()
    else:
        user_role_str = str(user_role).upper() if user_role else 'TENANT'
    
    if user_role_str != 'TENANT':
        return None
    
    # Get tenant profile
    tenant = Tenant.query.filter_by(user_id=user.id).first()
    return tenant

@notification_bp.route('/', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get notifications for the current user (tenant or property manager)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_read = request.args.get('is_read', type=str)  # 'true', 'false', or None for all
        notification_type = request.args.get('type', type=str)
        priority = request.args.get('priority', type=str)
        
        # Determine user role
        user_role = current_user.role
        if isinstance(user_role, UserRole):
            user_role_str = user_role.value
        elif isinstance(user_role, str):
            user_role_str = user_role.upper()
        else:
            user_role_str = str(user_role).upper() if user_role else 'TENANT'
        
        # Build query based on user role
        if user_role_str == 'TENANT':
            # Tenants see notifications for their tenant_id
            tenant = get_current_tenant()
            if not tenant:
                return jsonify({'error': 'Tenant profile not found'}), 404
            query = Notification.query.filter_by(tenant_id=tenant.id, user_id=current_user.id, recipient_type='tenant')
        elif user_role_str in ['MANAGER', 'PROPERTY_MANAGER']:
            # Property managers see notifications for their user_id with recipient_type='property_manager'
            # CRITICAL: Get property_id from subdomain context to ensure isolation
            from routes.auth_routes import get_property_id_from_request
            property_id = get_property_id_from_request()
            
            # If property_id not in request, try to get from JWT token
            if not property_id:
                from flask_jwt_extended import get_jwt
                try:
                    claims = get_jwt()
                    property_id = claims.get('property_id')
                except Exception:
                    pass
            
            # Build base query
            query = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='property_manager'
            )
            
            # If property_id is available and Notification model has property_id field,
            # filter by it. Otherwise, notifications are already filtered by user_id
            # which should be sufficient since each property manager has their own user account.
            # However, if a manager manages multiple properties, we need property_id in notifications.
            # For now, we'll verify ownership if property_id is provided
            if property_id:
                from models.property import Property
                property_obj = Property.query.get(property_id)
                if property_obj and property_obj.owner_id != current_user.id:
                    return jsonify({
                        'error': 'Access denied. You do not own this property.',
                        'code': 'PROPERTY_ACCESS_DENIED'
                    }), 403
                
                # If Notification model has property_id, filter by it
                # Check if property_id column exists
                if hasattr(Notification, 'property_id'):
                    query = query.filter(Notification.property_id == property_id)
        elif user_role_str == 'STAFF':
            # Staff see notifications for their user_id with recipient_type='staff'
            query = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='staff'
            )
        else:
            # Other roles - see notifications for their user_id
            query = Notification.query.filter_by(user_id=current_user.id)
        
        # Filter by read status
        if is_read is not None:
            if is_read.lower() == 'true':
                query = query.filter_by(is_read=True)
            elif is_read.lower() == 'false':
                query = query.filter_by(is_read=False)
        
        # Filter by notification type
        if notification_type:
            query = query.filter(Notification.notification_type == notification_type.lower())
        
        # Filter by priority
        if priority:
            query = query.filter(Notification.priority == priority.lower())
        
        # Order by created_at descending (newest first)
        query = query.order_by(desc(Notification.created_at))
        
        # Paginate
        notifications = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Serialize notifications
        notifications_list = []
        for notification in notifications.items:
            try:
                notifications_list.append(notification.to_dict(include_related=False))
            except Exception as notif_error:
                current_app.logger.warning(f"Error serializing notification {notification.id}: {str(notif_error)}")
                continue
        
        return jsonify({
            'notifications': notifications_list,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': notifications.total,
                'pages': notifications.pages,
                'has_next': notifications.has_next,
                'has_prev': notifications.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_notifications: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Get count of unread notifications for the current user (tenant or property manager)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Determine user role
        user_role = current_user.role
        if isinstance(user_role, UserRole):
            user_role_str = user_role.value
        elif isinstance(user_role, str):
            user_role_str = user_role.upper()
        else:
            user_role_str = str(user_role).upper() if user_role else 'TENANT'
        
        # Build query based on user role
        if user_role_str == 'TENANT':
            tenant = get_current_tenant()
            if not tenant:
                return jsonify({'error': 'Tenant profile not found'}), 404
            count = Notification.query.filter_by(
                tenant_id=tenant.id,
                user_id=current_user.id,
                recipient_type='tenant',
                is_read=False
            ).count()
        elif user_role_str in ['MANAGER']:
            count = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='property_manager',
                is_read=False
            ).count()
        elif user_role_str == 'STAFF':
            count = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='staff',
                is_read=False
            ).count()
        else:
            count = Notification.query.filter_by(
                user_id=current_user.id,
                is_read=False
            ).count()
        
        return jsonify({'unread_count': count}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_unread_count: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/<int:notification_id>', methods=['GET'])
@jwt_required()
def get_notification(notification_id):
    """Get a specific notification."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=current_user.id  # Ensure user owns this notification
        ).first()
        
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        return jsonify(notification.to_dict(include_related=True)), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_notification: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a notification as read."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=current_user.id  # Ensure user owns this notification
        ).first()
        
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        notification.mark_as_read()
        
        return jsonify({
            'message': 'Notification marked as read',
            'notification': notification.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in mark_as_read: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/<int:notification_id>/unread', methods=['PUT'])
@jwt_required()
def mark_as_unread(notification_id):
    """Mark a notification as unread."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=current_user.id  # Ensure user owns this notification
        ).first()
        
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        notification.mark_as_unread()
        
        return jsonify({
            'message': 'Notification marked as unread',
            'notification': notification.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in mark_as_unread: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/mark-all-read', methods=['PUT'])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read for the current user."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Determine user role
        user_role = current_user.role
        if isinstance(user_role, UserRole):
            user_role_str = user_role.value
        elif isinstance(user_role, str):
            user_role_str = user_role.upper()
        else:
            user_role_str = str(user_role).upper() if user_role else 'TENANT'
        
        # Build query based on user role
        if user_role_str == 'TENANT':
            tenant = get_current_tenant()
            if not tenant:
                return jsonify({'error': 'Tenant profile not found'}), 404
            query = Notification.query.filter_by(
                tenant_id=tenant.id,
                user_id=current_user.id,
                recipient_type='tenant',
                is_read=False
            )
        elif user_role_str in ['MANAGER']:
            query = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='property_manager',
                is_read=False
            )
        elif user_role_str == 'STAFF':
            query = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='staff',
                is_read=False
            )
        else:
            query = Notification.query.filter_by(
                user_id=current_user.id,
                is_read=False
            )
        
        # Update all unread notifications
        updated = query.update({
            'is_read': True,
            'read_at': datetime.now(timezone.utc)
        })
        
        db.session.commit()
        
        return jsonify({
            'message': f'{updated} notifications marked as read',
            'count': updated
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in mark_all_as_read: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=current_user.id  # Ensure user owns this notification
        ).first()
        
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        db.session.delete(notification)
        db.session.commit()
        
        return jsonify({'message': 'Notification deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in delete_notification: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/delete-all-read', methods=['DELETE'])
@jwt_required()
def delete_all_read():
    """Delete all read notifications for the current user."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Determine user role
        user_role = current_user.role
        if isinstance(user_role, UserRole):
            user_role_str = user_role.value
        elif isinstance(user_role, str):
            user_role_str = user_role.upper()
        else:
            user_role_str = str(user_role).upper() if user_role else 'TENANT'
        
        # Build query based on user role
        if user_role_str == 'TENANT':
            tenant = get_current_tenant()
            if not tenant:
                return jsonify({'error': 'Tenant profile not found'}), 404
            query = Notification.query.filter_by(
                tenant_id=tenant.id,
                user_id=current_user.id,
                is_read=True
            )
        elif user_role_str in ['MANAGER']:
            query = Notification.query.filter_by(
                user_id=current_user.id,
                recipient_type='property_manager',
                is_read=True
            )
        else:
            query = Notification.query.filter_by(
                user_id=current_user.id,
                is_read=True
            )
        
        # Delete all read notifications
        deleted = query.delete()
        
        db.session.commit()
        
        return jsonify({
            'message': f'{deleted} read notifications deleted',
            'count': deleted
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in delete_all_read: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

