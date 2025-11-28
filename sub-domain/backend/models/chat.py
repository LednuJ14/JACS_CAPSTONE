from datetime import datetime, timezone
from app import db
import enum

class ChatStatus(enum.Enum):
    """Chat status enum."""
    ACTIVE = 'active'
    ARCHIVED = 'archived'
    CLOSED = 'closed'

class SenderType(enum.Enum):
    """Message sender type enum."""
    TENANT = 'tenant'
    PROPERTY_MANAGER = 'property_manager'

class Chat(db.Model):
    """Chat model for tenant-property manager conversations."""
    __tablename__ = 'chats'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False, index=True)
    subject = db.Column(db.String(255), nullable=True, default='New Conversation')
    status = db.Column(db.String(20), nullable=False, default='active', index=True)
    last_message_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    tenant = db.relationship('Tenant', backref='chats')
    property_obj = db.relationship('Property', foreign_keys=[property_id], backref='chats')
    messages = db.relationship('Message', backref='chat', cascade='all, delete-orphan', order_by='Message.created_at')
    
    def __init__(self, tenant_id, property_id, subject=None, **kwargs):
        self.tenant_id = tenant_id
        self.property_id = property_id
        self.subject = subject or 'New Conversation'
        self.status = kwargs.get('status', 'active')
        
        for key, value in kwargs.items():
            if hasattr(self, key) and key != 'status':
                setattr(self, key, value)
    
    def to_dict(self, include_messages=False, include_tenant=False, include_property=False):
        """Convert chat to dictionary."""
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'property_id': self.property_id,
            'subject': self.subject,
            'status': self.status,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'unread_count': 0  # Will be calculated by the route handler with proper user context
        }
        
        if include_messages:
            # Try to get messages from relationship first
            try:
                if self.messages:
                    # Check if it's a query result or a list
                    messages_list = list(self.messages) if hasattr(self.messages, '__iter__') else []
                    if messages_list:
                        data['messages'] = [msg.to_dict(include_sender=True) for msg in messages_list]
                    else:
                        data['messages'] = []
                else:
                    data['messages'] = []
            except Exception as msg_error:
                # If relationship access fails, return empty array
                data['messages'] = []
        
        if include_tenant and self.tenant:
            try:
                # Include user info to get tenant's name
                tenant_dict = self.tenant.to_dict(include_user=True)
                # Add a 'name' field for easy access
                if self.tenant.user:
                    first_name = getattr(self.tenant.user, 'first_name', '') or ''
                    last_name = getattr(self.tenant.user, 'last_name', '') or ''
                    if first_name or last_name:
                        tenant_dict['name'] = f"{first_name} {last_name}".strip()
                    else:
                        email = getattr(self.tenant.user, 'email', '')
                        if email:
                            tenant_dict['name'] = email.split('@')[0].replace('.', ' ').title()
                        else:
                            tenant_dict['name'] = f"Tenant {self.tenant.id}"
                else:
                    tenant_dict['name'] = f"Tenant {self.tenant.id}"
                data['tenant'] = tenant_dict
            except Exception as tenant_error:
                # Fallback if tenant serialization fails
                try:
                    tenant_name = 'Unknown'
                    if self.tenant.user:
                        first_name = getattr(self.tenant.user, 'first_name', '') or ''
                        last_name = getattr(self.tenant.user, 'last_name', '') or ''
                        if first_name or last_name:
                            tenant_name = f"{first_name} {last_name}".strip()
                        else:
                            email = getattr(self.tenant.user, 'email', '')
                            if email:
                                tenant_name = email.split('@')[0].replace('.', ' ').title()
                    data['tenant'] = {'id': self.tenant.id, 'name': tenant_name}
                except Exception:
                    data['tenant'] = {'id': self.tenant.id, 'name': 'Unknown'}
        
        if include_property and self.property_obj:
            try:
                property_data = {
                    'id': self.property_obj.id,
                    'name': getattr(self.property_obj, 'name', getattr(self.property_obj, 'title', 'Unknown'))
                }
                # Include property manager (owner) information
                if hasattr(self.property_obj, 'owner_id') and self.property_obj.owner_id:
                    try:
                        from models.user import User
                        owner = User.query.get(self.property_obj.owner_id)
                        if owner:
                            property_data['manager'] = {
                                'id': owner.id,
                                'name': f"{owner.first_name} {owner.last_name}".strip() or owner.email,
                                'email': owner.email
                            }
                    except Exception as owner_error:
                        # Log but don't fail - manager info is optional
                        pass
                data['property'] = property_data
            except Exception:
                data['property'] = {'id': self.property_id}
        
        return data
    
    def get_unread_count(self, user_id=None, sender_type=None):
        """Get count of unread messages for a specific user."""
        if not user_id or not sender_type:
            return 0
        
        # Count messages not sent by this user that are unread
        opposite_type = 'property_manager' if sender_type == 'tenant' else 'tenant'
        return Message.query.filter_by(
            chat_id=self.id,
            sender_type=opposite_type,
            is_read=False
        ).count()
    
    def __repr__(self):
        return f'<Chat {self.id}: Tenant {self.tenant_id} - Property {self.property_id}>'

class Message(db.Model):
    """Message model for chat messages."""
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chats.id'), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    sender_type = db.Column(db.String(20), nullable=False, index=True)  # 'tenant' or 'property_manager'
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    
    def __init__(self, chat_id, sender_id, sender_type, content, **kwargs):
        self.chat_id = chat_id
        self.sender_id = sender_id
        self.sender_type = sender_type
        self.content = content.strip()
        self.is_read = kwargs.get('is_read', False)
        
        for key, value in kwargs.items():
            if hasattr(self, key) and key != 'is_read':
                setattr(self, key, value)
    
    def mark_as_read(self):
        """Mark message as read."""
        self.is_read = True
        self.read_at = datetime.now(timezone.utc)
        db.session.commit()
    
    def to_dict(self, include_sender=False):
        """Convert message to dictionary."""
        data = {
            'id': self.id,
            'chat_id': self.chat_id,
            'sender_id': self.sender_id,
            'sender_type': self.sender_type,
            'content': self.content,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sender and self.sender:
            try:
                data['sender'] = {
                    'id': self.sender.id,
                    'name': self.sender.full_name,
                    'email': self.sender.email
                }
            except Exception:
                data['sender'] = {
                    'id': self.sender.id,
                    'name': getattr(self.sender, 'first_name', '') + ' ' + getattr(self.sender, 'last_name', ''),
                    'email': getattr(self.sender, 'email', '')
                }
        
        return data
    
    def __repr__(self):
        return f'<Message {self.id}: Chat {self.chat_id} from {self.sender_type}>'

