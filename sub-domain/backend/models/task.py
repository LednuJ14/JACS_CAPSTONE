from datetime import datetime, timezone
from app import db
import enum

class TaskStatus(enum.Enum):
    OPEN = 'open'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

class TaskPriority(enum.Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    URGENT = 'urgent'

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    # Use String type instead of Enum to avoid validation issues with database enum values
    # Database enum: 'low', 'medium', 'high', 'urgent'
    priority = db.Column(db.String(20), default='medium', nullable=False)
    # Database enum: 'open', 'in_progress', 'completed', 'cancelled'
    status = db.Column(db.String(20), default='open', nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'))  # Optional: if task is tenant-specific
    unit_id = db.Column(db.Integer, db.ForeignKey('units.id'))  # Optional: if task is unit-specific
    due_date = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc), nullable=False)
    
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_tasks')
    assignee = db.relationship('User', foreign_keys=[assigned_to], backref='assigned_tasks')
    tenant = db.relationship('Tenant', backref='tasks')
    unit = db.relationship('Unit', backref='tasks')
    
    def to_dict(self):
        try:
            # Safely get assignee name
            assigned_to_name = None
            if self.assigned_to:
                try:
                    assignee = User.query.get(self.assigned_to)
                    assigned_to_name = assignee.full_name if assignee else None
                except:
                    pass
            
            # Safely get creator name
            creator_name = None
            if self.created_by:
                try:
                    creator = User.query.get(self.created_by)
                    creator_name = creator.full_name if creator else None
                except:
                    pass
            
            # Safely get tenant name
            tenant_name = None
            if self.tenant_id:
                try:
                    from models.tenant import Tenant
                    tenant = Tenant.query.get(self.tenant_id)
                    tenant_name = tenant.name if tenant else None
                except:
                    pass
            
            # Safely get unit name
            unit_name = None
            if self.unit_id:
                try:
                    from models.unit import Unit
                    unit = Unit.query.get(self.unit_id)
                    if unit and hasattr(unit, 'property') and unit.property:
                        unit_name = f"{unit.property.name} - Unit {unit.unit_number}"
                    elif unit:
                        unit_name = f"Unit {unit.unit_number}"
                except:
                    pass
            
            return {
                'id': self.id,
                'title': self.title,
                'description': self.description,
                'priority': self.priority.value if hasattr(self.priority, 'value') else (str(self.priority) if self.priority else 'medium'),
                'status': self.status.value if hasattr(self.status, 'value') else (str(self.status) if self.status else 'open'),
                'assigned_to': self.assigned_to,
                'assigned_to_name': assigned_to_name,
                'created_by': self.created_by,
                'creator_name': creator_name,
                'tenant_id': self.tenant_id,
                'tenant_name': tenant_name,
                'unit_id': self.unit_id,
                'unit_name': unit_name,
                'due_date': self.due_date.isoformat() if self.due_date else None,
                'completed_at': self.completed_at.isoformat() if self.completed_at else None,
                'notes': self.notes,
                'created_at': self.created_at.isoformat() if self.created_at else None,
                'updated_at': self.updated_at.isoformat() if self.updated_at else None
            }
        except Exception as e:
            # Fallback minimal representation
            return {
                'id': self.id,
                'title': self.title or 'Untitled Task',
                'description': self.description or '',
                'priority': 'medium',
                'status': 'open',
                'assigned_to': self.assigned_to,
                'assigned_to_name': None,
                'created_by': self.created_by,
                'creator_name': None,
                'tenant_id': self.tenant_id,
                'tenant_name': None,
                'unit_id': self.unit_id,
                'unit_name': None,
                'due_date': None,
                'completed_at': None,
                'notes': self.notes,
                'created_at': None,
                'updated_at': None
            }
