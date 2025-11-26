"""
File upload and handling utilities
"""
import os
import uuid
import secrets
from werkzeug.utils import secure_filename as werkzeug_secure_filename
from PIL import Image
from flask import current_app

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'}
IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif'}

def allowed_file(filename, allowed_extensions=None):
    """
    Check if file has allowed extension.
    
    Args:
        filename (str): Filename to check
        allowed_extensions (set): Set of allowed extensions
        
    Returns:
        bool: True if file extension is allowed
    """
    if allowed_extensions is None:
        allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', ALLOWED_EXTENSIONS)
    
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

def secure_filename(filename):
    """
    Generate secure filename with UUID prefix.
    
    Args:
        filename (str): Original filename
        
    Returns:
        str: Secure filename with UUID
    """
    # Get secure filename from werkzeug
    secure_name = werkzeug_secure_filename(filename)
    
    # Add UUID prefix to avoid conflicts
    unique_id = str(uuid.uuid4())[:8]
    
    return f"{unique_id}_{secure_name}"

def save_uploaded_file(file, upload_folder, allowed_extensions=None, max_size=None):
    """
    Save uploaded file with validation.
    
    Args:
        file: Flask file upload object
        upload_folder (str): Directory to save file
        allowed_extensions (set): Allowed file extensions
        max_size (int): Maximum file size in bytes
        
    Returns:
        tuple: (success: bool, filename: str, error_message: str)
    """
    try:
        # Check if file was uploaded
        if not file or file.filename == '':
            return False, None, "No file selected"
        
        # Check file extension
        if not allowed_file(file.filename, allowed_extensions):
            return False, None, f"File type not allowed. Allowed types: {', '.join(allowed_extensions or ALLOWED_EXTENSIONS)}"
        
        # Check file size
        if max_size:
            # Seek to end to get size
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)  # Reset to beginning
            
            if size > max_size:
                return False, None, f"File too large. Maximum size: {max_size / 1024 / 1024:.1f}MB"
        
        # Generate secure filename
        filename = secure_filename(file.filename)
        
        # Create upload directory if it doesn't exist
        os.makedirs(upload_folder, exist_ok=True)
        
        # Save file
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        return True, filename, None
        
    except Exception as e:
        return False, None, f"Error saving file: {str(e)}"


def delete_file(file_path):
    """
    Safely delete a file.
    
    Args:
        file_path (str): Path to file to delete
        
    Returns:
        bool: True if file was deleted successfully
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False

def get_file_size(file_path):
    """
    Get file size in bytes.
    
    Args:
        file_path (str): Path to file
        
    Returns:
        int: File size in bytes, or 0 if file doesn't exist
    """
    try:
        return os.path.getsize(file_path) if os.path.exists(file_path) else 0
    except Exception:
        return 0

def format_file_size(size_bytes):
    """
    Format file size in human readable format.
    
    Args:
        size_bytes (int): File size in bytes
        
    Returns:
        str: Formatted file size
    """
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    size = float(size_bytes)
    
    while size >= 1024.0 and i < len(size_names) - 1:
        size /= 1024.0
        i += 1
    
    return f"{size:.1f} {size_names[i]}"
