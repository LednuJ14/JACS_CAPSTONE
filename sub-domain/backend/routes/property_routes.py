from flask import Blueprint, jsonify, request, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timezone
from app import db
from models.property import Property
from models.user import User

property_bp = Blueprint('properties', __name__)

def allowed_file(filename):
    """Check if file extension is allowed."""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@property_bp.route('/', methods=['GET'])
@jwt_required()
def get_properties():
    """Get properties for the current user."""
    try:
        current_user_id = get_jwt_identity()
        
        # Convert string to int if needed
        if isinstance(current_user_id, str):
            try:
                current_user_id = int(current_user_id)
            except ValueError:
                return jsonify({'error': 'Invalid user ID'}), 400
        
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get properties managed by this user
        try:
            properties = Property.query.filter_by(manager_id=user.id).all()
            
            # Safely convert to dict, handling display_settings
            properties_list = []
            for prop in properties:
                try:
                    prop_dict = prop.to_dict()
                    properties_list.append(prop_dict)
                except Exception as prop_error:
                    current_app.logger.warning(f"Error converting property {prop.id} to dict: {str(prop_error)}", exc_info=True)
                    # Return basic property info if to_dict fails
                    try:
                        display_settings = getattr(prop, 'display_settings', None) or {}
                    except Exception:
                        display_settings = {}
                    
                    properties_list.append({
                        'id': prop.id,
                        'name': getattr(prop, 'name', 'Unknown'),
                        'address': getattr(prop, 'address', ''),
                        'city': getattr(prop, 'city', ''),
                        'display_settings': display_settings
                    })
            
            return jsonify(properties_list), 200
        except Exception as query_error:
            current_app.logger.error(f"Property query error: {str(query_error)}", exc_info=True)
            # Return empty array if query fails
            return jsonify([]), 200
    except Exception as e:
        current_app.logger.error(f"Get properties error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to get properties', 'details': str(e) if current_app.config.get('DEBUG') else None}), 500

@property_bp.route('/<int:property_id>/display-settings', methods=['GET'])
@jwt_required()
def get_display_settings(property_id):
    """Get display settings for a property."""
    try:
        current_user_id = get_jwt_identity()
        property_obj = Property.query.get(property_id)
        
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        
        # Verify user is the manager
        if property_obj.manager_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get display settings or return defaults
        display_settings = getattr(property_obj, 'display_settings', None) or {
            'companyName': property_obj.name or 'JACS',
            'companyTagline': 'Joint Association & Community System - Cebu City',
            'logoUrl': '',
            'primaryColor': '#000000',
            'secondaryColor': '#3B82F6',
            'accentColor': '#10B981',
            'backgroundImage': '',
            'loginLayout': 'modern',
            'websiteTheme': 'light',
            'headerStyle': 'fixed',
            'sidebarStyle': 'collapsible',
            'borderRadius': 'medium',
            'fontFamily': 'inter',
            'fontSize': 'medium'
        }
        
        return jsonify(display_settings), 200
    except Exception as e:
        current_app.logger.error(f"Get display settings error: {str(e)}")
        return jsonify({'error': 'Failed to get display settings'}), 500

@property_bp.route('/<int:property_id>/display-settings', methods=['PUT'])
@jwt_required()
def update_display_settings(property_id):
    """Update display settings for a property."""
    try:
        current_user_id = get_jwt_identity()
        property_obj = Property.query.get(property_id)
        
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        
        # Verify user is the manager
        if property_obj.manager_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Get existing settings or create new
        display_settings = getattr(property_obj, 'display_settings', None) or {}
        
        # Update allowed fields
        allowed_fields = [
            'companyName', 'companyTagline', 'logoUrl', 'primaryColor', 
            'secondaryColor', 'accentColor', 'backgroundImage', 'loginLayout',
            'websiteTheme', 'headerStyle', 'sidebarStyle', 'borderRadius',
            'fontFamily', 'fontSize'
        ]
        
        for field in allowed_fields:
            if field in data:
                display_settings[field] = data[field]
        
        # Update property
        property_obj.display_settings = display_settings
        property_obj.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return jsonify({
            'message': 'Display settings updated successfully',
            'display_settings': display_settings
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Update display settings error: {str(e)}")
        return jsonify({'error': 'Failed to update display settings'}), 500

@property_bp.route('/<int:property_id>/logo', methods=['POST'])
@jwt_required()
def upload_logo(property_id):
    """Upload logo for a property."""
    try:
        current_user_id = get_jwt_identity()
        property_obj = Property.query.get(property_id)
        
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        
        # Verify user is the manager
        if property_obj.manager_id != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, SVG'}), 400
        
        # Check file size (2MB max)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > 2 * 1024 * 1024:  # 2MB
            return jsonify({'error': 'File size exceeds 2MB limit'}), 400
        
        # Create upload directory if it doesn't exist
        upload_dir = os.path.join(current_app.instance_path, 'uploads', 'logos')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate secure filename
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{property_id}_{timestamp}_{filename}"
        filepath = os.path.join(upload_dir, filename)
        
        # Save file
        file.save(filepath)
        
        # Generate URL (relative path - will be served by Flask route)
        logo_url = f"/api/properties/{property_id}/logo/{filename}"
        
        # Update display settings
        display_settings = getattr(property_obj, 'display_settings', None) or {}
        display_settings['logoUrl'] = logo_url
        if hasattr(property_obj, 'display_settings'):
            property_obj.display_settings = display_settings
        property_obj.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return jsonify({
            'message': 'Logo uploaded successfully',
            'logoUrl': logo_url
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Logo upload error: {str(e)}")
        return jsonify({'error': 'Failed to upload logo'}), 500

@property_bp.route('/<int:property_id>/logo/<filename>', methods=['GET'])
def get_logo(property_id, filename):
    """Serve logo file."""
    try:
        property_obj = Property.query.get(property_id)
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        
        upload_dir = os.path.join(current_app.instance_path, 'uploads', 'logos')
        return send_from_directory(upload_dir, filename)
    except Exception as e:
        current_app.logger.error(f"Get logo error: {str(e)}")
        return jsonify({'error': 'Failed to get logo'}), 500
