from datetime import datetime, timezone, date
from app import db
from sqlalchemy import Numeric
import enum

class LeaseStatus(enum.Enum):
    ACTIVE = 'active'
    EXPIRED = 'expired'
    TERMINATED = 'terminated'
    PENDING = 'pending'

class Tenant(db.Model):
    __tablename__ = 'tenants'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    
    # Contact Information (simplified schema)
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(120))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc), nullable=False)
    
    # Relationships (defined here to avoid conflicts)
    # Define user relationship with back_populates to match User model (which now uses back_populates)
    user = db.relationship('User', back_populates='tenant_profile')
    # Use property_obj to avoid conflict with Python's built-in property
    property_obj = db.relationship('Property', foreign_keys=[property_id], backref='tenants')
    tenant_units = db.relationship('TenantUnit', backref='tenant', cascade='all, delete-orphan')
    bills = db.relationship('Bill', back_populates='tenant', cascade='all, delete-orphan')
    maintenance_requests = db.relationship('MaintenanceRequest', backref='tenant', cascade='all, delete-orphan')
    
    # Compatibility properties for backward compatibility (return None for fields that don't exist)
    @property
    def occupation(self):
        return None
    
    @property
    def employer(self):
        return None
    
    @property
    def monthly_income(self):
        return None
    
    @property
    def assigned_room(self):
        """Get room number from tenant_units if available."""
        try:
            current_lease = self.current_lease
            if current_lease and current_lease.unit:
                return current_lease.unit.unit_number
        except Exception:
            pass
        return None
    
    @property
    def room_number(self):
        """Alias for assigned_room."""
        return self.assigned_room
    
    @property
    def is_approved(self):
        """Tenant is approved if they have an active lease."""
        try:
            return self.current_lease is not None
        except Exception:
            return False
    
    @property
    def has_pets(self):
        return False
    
    @property
    def pet_details(self):
        return None
    
    @property
    def has_vehicle(self):
        return False
    
    @property
    def vehicle_details(self):
        return None
    
    @property
    def background_check_status(self):
        return 'approved' if self.is_approved else 'pending'
    
    @property
    def credit_score(self):
        return None
    
    def __init__(self, user_id, **kwargs):
        self.user_id = user_id
        
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    @property
    def current_unit(self):
        """Get tenant's current unit."""
        try:
            from datetime import date
            from sqlalchemy import text
            # Check for active tenant_unit using new structure (move_in_date/move_out_date)
            active_tenant_unit = db.session.execute(text(
                """
                SELECT tu.unit_id FROM tenant_units tu
                WHERE tu.tenant_id = :tenant_id 
                  AND (
                    (tu.move_in_date IS NOT NULL AND tu.move_out_date IS NOT NULL 
                     AND tu.move_out_date >= CURDATE())
                    OR
                    (tu.is_active = TRUE)
                  )
                LIMIT 1
                """
            ), {'tenant_id': self.id}).first()
            
            if active_tenant_unit:
                from models.property import Unit
                return Unit.query.get(active_tenant_unit[0])
        except Exception:
            pass
        return None
    
    @property
    def current_lease(self):
        """Get tenant's current active lease."""
        try:
            from datetime import date
            from sqlalchemy import text
            # Check for active tenant_unit using new structure
            active_tenant_unit_id = db.session.execute(text(
                """
                SELECT tu.id FROM tenant_units tu
                WHERE tu.tenant_id = :tenant_id 
                  AND (
                    (tu.move_in_date IS NOT NULL AND tu.move_out_date IS NOT NULL 
                     AND tu.move_out_date >= CURDATE())
                    OR
                    (tu.is_active = TRUE)
                  )
                LIMIT 1
                """
            ), {'tenant_id': self.id}).first()
            
            if active_tenant_unit_id:
                return TenantUnit.query.get(active_tenant_unit_id[0])
        except Exception:
            pass
        return None
    
    @property
    def lease_history(self):
        """Get tenant's lease history."""
        try:
            return TenantUnit.query.filter_by(tenant_id=self.id).all()
        except Exception:
            return []
    
    @property
    def total_rent_paid(self):
        """Calculate total rent paid by tenant."""
        from models.bill import Payment, Bill, BillStatus
        total = db.session.query(db.func.sum(Payment.amount)).join(
            Bill, Payment.bill_id == Bill.id
        ).filter(
            Bill.tenant_id == self.id,
            Payment.status == 'completed'
        ).scalar()
        return float(total) if total else 0.0
    
    @property
    def outstanding_balance(self):
        """Calculate tenant's outstanding balance."""
        from models.bill import Bill, BillStatus
        # Calculate sum of amount_due for pending/overdue bills
        # amount_due is a property, so we need to calculate it manually
        bills = Bill.query.filter(
            Bill.tenant_id == self.id,
            Bill.status.in_([BillStatus.PENDING, BillStatus.OVERDUE])
        ).all()
        total = sum(float(bill.amount_due) for bill in bills)
        return total
    
    def approve_tenant(self):
        """Approve tenant application."""
        self.is_approved = True
        self.approval_date = datetime.now(timezone.utc)
        self.background_check_status = 'approved'
        db.session.commit()
    
    def reject_tenant(self):
        """Reject tenant application."""
        self.is_approved = False
        self.background_check_status = 'rejected'
        db.session.commit()
    
    def to_dict(self, include_user=False, include_lease=False):
        """Convert tenant to dictionary (simplified schema)."""
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'property_id': self.property_id,
            'phone_number': self.phone_number,
            'email': self.email,
            'assigned_room': self.assigned_room,
            'room_number': self.room_number,  # Alias
            'is_approved': self.is_approved,
            'status': 'Active' if self.is_approved else 'Pending',
            'background_check_status': self.background_check_status,
            'total_rent_paid': self.total_rent_paid,
            'outstanding_balance': self.outstanding_balance,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Include property info if available
        if hasattr(self, 'property_obj') and self.property_obj:
            data['property'] = {
                'id': self.property_obj.id,
                'name': getattr(self.property_obj, 'name', None) or getattr(self.property_obj, 'title', None) or getattr(self.property_obj, 'building_name', None)
            }
        elif self.property_id:
            data['property'] = {
                'id': self.property_id,
                'name': f'Property {self.property_id}'
            }
        
        if include_user and self.user:
            data['user'] = self.user.to_dict()
        
        if include_lease and self.current_lease:
            try:
                data['current_lease'] = self.current_lease.to_dict(include_unit=True)
            except Exception:
                pass
        
        return data
    
    def __repr__(self):
        return f'<Tenant {self.user.full_name if self.user else self.id}>'

class TenantUnit(db.Model):
    __tablename__ = 'tenant_units'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    unit_id = db.Column(db.Integer, db.ForeignKey('units.id'), nullable=False)
    
    # Lease Information
    lease_start_date = db.Column(db.Date, nullable=False)
    lease_end_date = db.Column(db.Date, nullable=False)
    monthly_rent = db.Column(Numeric(10, 2), nullable=False)
    security_deposit = db.Column(Numeric(10, 2), nullable=False)
    
    # Status
    lease_status = db.Column(db.Enum(LeaseStatus), default=LeaseStatus.ACTIVE, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Move-in/Move-out Information
    move_in_date = db.Column(db.Date)
    move_out_date = db.Column(db.Date)
    move_in_inspection_notes = db.Column(db.Text)
    move_out_inspection_notes = db.Column(db.Text)
    
    # Financial Information
    deposit_returned = db.Column(db.Boolean, default=False)
    deposit_return_amount = db.Column(Numeric(10, 2))
    deposit_return_date = db.Column(db.Date)
    
    # Renewal Information
    renewal_offered = db.Column(db.Boolean, default=False)
    renewal_accepted = db.Column(db.Boolean, default=False)
    renewal_date = db.Column(db.DateTime)
    
    # Notice and Termination
    notice_given = db.Column(db.Boolean, default=False)
    notice_date = db.Column(db.Date)
    termination_reason = db.Column(db.String(255))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc), nullable=False)
    
    # Unique constraint - one active lease per unit
    __table_args__ = (
        db.Index('idx_unit_active', 'unit_id', 'is_active'),
    )
    
    def __init__(self, tenant_id, unit_id, lease_start_date, lease_end_date, monthly_rent, security_deposit, **kwargs):
        self.tenant_id = tenant_id
        self.unit_id = unit_id
        self.lease_start_date = lease_start_date
        self.lease_end_date = lease_end_date
        self.monthly_rent = monthly_rent
        self.security_deposit = security_deposit
        
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def __repr__(self):
        return f'<TenantUnit Tenant:{self.tenant_id} Unit:{self.unit_id}>'
    
    @property
    def is_expired(self):
        """Check if lease is expired."""
        return self.lease_end_date < date.today()
    
    @property
    def days_until_expiry(self):
        """Get days until lease expiry."""
        if self.lease_end_date:
            delta = self.lease_end_date - date.today()
            return delta.days
        return None
    
    @property
    def lease_duration_months(self):
        """Get lease duration in months."""
        if self.lease_start_date and self.lease_end_date:
            delta = self.lease_end_date - self.lease_start_date
            return round(delta.days / 30.44)  # Average days per month
        return None
    
    def terminate_lease(self, termination_reason=None):
        """Terminate the lease."""
        self.lease_status = LeaseStatus.TERMINATED
        self.is_active = False
        self.move_out_date = date.today()
        if termination_reason:
            self.termination_reason = termination_reason
        
        # Update unit status to available
        if self.unit:
            from models.property import UnitStatus
            self.unit.status = 'available'  # Use string value since status is String type
        
        db.session.commit()
    
    def renew_lease(self, new_end_date, new_monthly_rent=None):
        """Renew the lease."""
        self.lease_end_date = new_end_date
        if new_monthly_rent:
            self.monthly_rent = new_monthly_rent
        self.renewal_accepted = True
        self.renewal_date = datetime.now(timezone.utc)
        self.lease_status = LeaseStatus.ACTIVE
        db.session.commit()
    
    def to_dict(self, include_tenant=False, include_unit=False):
        """Convert tenant unit relationship to dictionary."""
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'unit_id': self.unit_id,
            'lease_start_date': self.lease_start_date.isoformat(),
            'lease_end_date': self.lease_end_date.isoformat(),
            'monthly_rent': float(self.monthly_rent),
            'security_deposit': float(self.security_deposit),
            'lease_status': self.lease_status.value,
            'is_active': self.is_active,
            'is_expired': self.is_expired,
            'days_until_expiry': self.days_until_expiry,
            'lease_duration_months': self.lease_duration_months,
            'move_in_date': self.move_in_date.isoformat() if self.move_in_date else None,
            'move_out_date': self.move_out_date.isoformat() if self.move_out_date else None,
            'move_in_inspection_notes': self.move_in_inspection_notes,
            'move_out_inspection_notes': self.move_out_inspection_notes,
            'deposit_returned': self.deposit_returned,
            'deposit_return_amount': float(self.deposit_return_amount) if self.deposit_return_amount else None,
            'deposit_return_date': self.deposit_return_date.isoformat() if self.deposit_return_date else None,
            'renewal_offered': self.renewal_offered,
            'renewal_accepted': self.renewal_accepted,
            'renewal_date': self.renewal_date.isoformat() if self.renewal_date else None,
            'notice_given': self.notice_given,
            'notice_date': self.notice_date.isoformat() if self.notice_date else None,
            'termination_reason': self.termination_reason,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_tenant and self.tenant:
            data['tenant'] = self.tenant.to_dict(include_user=True)
        
        if include_unit and self.unit:
            data['unit'] = self.unit.to_dict()
        
        return data
    
    def __repr__(self):
        return f'<TenantUnit Tenant:{self.tenant_id} Unit:{self.unit_id}>'