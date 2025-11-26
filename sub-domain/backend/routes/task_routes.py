from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone

from app import db
from models.task import Task, TaskPriority, TaskStatus
from models.user import User, UserRole

task_bp = Blueprint('tasks', __name__)

def get_current_user():
    """Helper function to get current user from JWT token."""
    current_user_id = get_jwt_identity()
    return User.query.get(current_user_id)

@task_bp.route('/my-tasks', methods=['GET'])
@jwt_required()
def get_my_tasks():
    """Get tasks assigned to the current staff member."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if user.role != UserRole.STAFF:
            return jsonify({'error': 'Only staff can access their tasks'}), 403
        
        # Get staff profile (optional check)
        staff_profile = user.staff_profile
        # Note: Staff profile might not exist, but that's okay
        # Tasks are assigned to User IDs, not Staff profile IDs
        
        # Get tasks assigned to this user (staff member)
        tasks = Task.query.filter_by(assigned_to=user.id).order_by(Task.created_at.desc()).all()
        
        return jsonify({
            'tasks': [task.to_dict() for task in tasks],
            'total': len(tasks)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get my tasks error: {str(e)}")
        return jsonify({'error': 'Failed to load tasks'}), 500

@task_bp.route('/', methods=['GET'])
@jwt_required()
def get_tasks():
    """Get tasks filtered by user's role and permissions."""
    try:
        current_app.logger.info("Getting tasks - endpoint called")
        
        # Simplified version - just return empty list for now to test basic functionality
        return jsonify({
            'tasks': [],
            'total': 0,
            'pages': 0,
            'current_page': 1,
            'per_page': 20,
            'has_next': False,
            'has_prev': False
        }), 200
        
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        search = request.args.get('search', '')
        status = request.args.get('status')
        priority = request.args.get('priority')
        assigned_to = request.args.get('assigned_to')
        
        # Base query
        query = Task.query
        
        # Filter by user role
        if current_user.role == UserRole.TENANT:
            # Tenants can only see tasks assigned to them or their unit
            query = query.filter(
                (Task.assigned_to == current_user.id) |
                (Task.tenant_id == current_user.id)
            )
        elif current_user.role == UserRole.STAFF:
            # Staff can see all tasks except private tasks between property managers and specific tenants
            # For simplicity, let's allow staff to see all tasks for now
            pass
        # Property managers can see all tasks
        
        # Apply search filter
        if search:
            query = query.filter(
                Task.title.ilike(f'%{search}%') |
                Task.description.ilike(f'%{search}%')
            )
        
        # Apply status filter
        if status:
            try:
                status_enum = TaskStatus(status)
                query = query.filter(Task.status == status_enum)
            except ValueError:
                return jsonify({'error': f'Invalid task status: {status}'}), 400
        
        # Apply priority filter
        if priority:
            try:
                priority_enum = TaskPriority(priority)
                query = query.filter(Task.priority == priority_enum)
            except ValueError:
                return jsonify({'error': f'Invalid task priority: {priority}'}), 400
        
        # Apply assigned_to filter
        if assigned_to:
            if assigned_to.isdigit():
                query = query.filter(Task.assigned_to == int(assigned_to))
        
        # Order by priority and due date
        query = query.order_by(
            Task.priority.desc(),
            Task.due_date.asc().nullslast(),
            Task.created_at.desc()
        )
        
        # Paginate
        try:
            current_app.logger.info(f"About to paginate query")
            tasks = query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            current_app.logger.info(f"Pagination successful, found {len(tasks.items)} tasks")
        except Exception as paginate_error:
            current_app.logger.error(f"Pagination error: {str(paginate_error)}")
            raise
        
        try:
            current_app.logger.info(f"Converting tasks to dict...")
            task_dicts = []
            for i, task in enumerate(tasks.items):
                try:
                    task_dict = task.to_dict()
                    task_dicts.append(task_dict)
                    current_app.logger.info(f"Task {i+1} converted successfully")
                except Exception as task_error:
                    current_app.logger.error(f"Error converting task {task.id}: {str(task_error)}")
                    # Skip this task and continue
                    continue
            
            current_app.logger.info(f"All tasks converted, returning response")
            
            return jsonify({
                'tasks': task_dicts,
                'total': tasks.total,
                'pages': tasks.pages,
                'current_page': page,
                'per_page': per_page,
                'has_next': tasks.has_next,
                'has_prev': tasks.has_prev
            }), 200
        except Exception as dict_error:
            current_app.logger.error(f"Dict conversion error: {str(dict_error)}")
            # Return empty list if conversion fails
            return jsonify({
                'tasks': [],
                'total': 0,
                'pages': 0,
                'current_page': page,
                'per_page': per_page,
                'has_next': False,
                'has_prev': False
            }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get tasks error: {str(e)}")
        import traceback
        current_app.logger.error(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to fetch tasks'}), 500

@task_bp.route('/<int:task_id>', methods=['GET'])
@jwt_required()
def get_task(task_id):
    """Get a specific task by ID."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        # Check permissions
        if current_user.role == UserRole.TENANT:
            if task.assigned_to != current_user.id and task.tenant_id != current_user.id:
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({'task': task.to_dict()}), 200
        
    except Exception as e:
        current_app.logger.error(f"Get task error: {str(e)}")
        return jsonify({'error': 'Failed to fetch task'}), 500

@task_bp.route('/', methods=['POST'])
@jwt_required()
def create_task():
    """Create a new task."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Only property managers and staff can create tasks
        if current_user.role not in [UserRole.PROPERTY_MANAGER, UserRole.STAFF]:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['title', 'description']
        for field in required_fields:
            if not data.get(field, '').strip():
                return jsonify({'error': f'{field.title()} is required'}), 400
        
        # Validate priority
        priority = TaskPriority.MEDIUM  # default
        if data.get('priority'):
            try:
                priority = TaskPriority(data['priority'])
            except ValueError:
                return jsonify({'error': f'Invalid priority: {data["priority"]}'}), 400
        
        # Parse due date
        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid due date format. Use ISO format.'}), 400
        
        # Validate assigned user
        assigned_to = None
        if data.get('assigned_to'):
            if str(data['assigned_to']).isdigit():
                assigned_user = User.query.get(int(data['assigned_to']))
                if not assigned_user:
                    return jsonify({'error': 'Assigned user not found'}), 400
                assigned_to = assigned_user.id
        
        # Create task
        task = Task(
            title=data['title'].strip(),
            description=data['description'].strip(),
            priority=priority,
            status=TaskStatus.OPEN,  # Always start as open
            due_date=due_date,
            assigned_to=assigned_to,
            created_by=current_user.id,
            tenant_id=data.get('tenant_id') if data.get('tenant_id') and str(data.get('tenant_id')).isdigit() else None,
            unit_id=data.get('unit_id') if data.get('unit_id') and str(data.get('unit_id')).isdigit() else None
        )
        
        db.session.add(task)
        db.session.commit()
        
        # Notify assigned staff member if task is assigned
        if task.assigned_to:
            try:
                from services.notification_service import NotificationService
                NotificationService.notify_staff_task_assigned(task, task.assigned_to)
            except Exception as notif_error:
                current_app.logger.warning(f"Failed to create notification for task {task.id}: {str(notif_error)}")
        
        current_app.logger.info(f"Task created: {task.id} by user {current_user.id}")
        
        return jsonify({
            'message': 'Task created successfully',
            'task': task.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Create task error: {str(e)}")
        return jsonify({'error': 'Failed to create task'}), 500

@task_bp.route('/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    """Update a task."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        # Check permissions - property managers and staff can update any task
        # Tenants can only update tasks assigned to them (and only certain fields)
        if current_user.role == UserRole.TENANT:
            if task.assigned_to != current_user.id:
                return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update fields based on user role
        if current_user.role in [UserRole.PROPERTY_MANAGER, UserRole.STAFF]:
            # Full update permissions
            if 'title' in data:
                task.title = data['title'].strip()
            
            if 'description' in data:
                task.description = data['description'].strip()
            
            if 'priority' in data:
                try:
                    task.priority = TaskPriority(data['priority'])
                except ValueError:
                    return jsonify({'error': f'Invalid priority: {data["priority"]}'}), 400
            
            if 'due_date' in data:
                if data['due_date']:
                    try:
                        task.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
                    except ValueError:
                        return jsonify({'error': 'Invalid due date format. Use ISO format.'}), 400
                else:
                    task.due_date = None
            
            if 'assigned_to' in data:
                old_assigned_to = task.assigned_to
                if data['assigned_to'] and str(data['assigned_to']).isdigit():
                    assigned_user = User.query.get(int(data['assigned_to']))
                    if not assigned_user:
                        return jsonify({'error': 'Assigned user not found'}), 400
                    task.assigned_to = assigned_user.id
                    # Notify newly assigned staff member
                    if task.assigned_to != old_assigned_to:
                        try:
                            from services.notification_service import NotificationService
                            NotificationService.notify_staff_task_assigned(task, task.assigned_to)
                        except Exception as notif_error:
                            current_app.logger.warning(f"Failed to create notification for task {task.id}: {str(notif_error)}")
                else:
                    task.assigned_to = None
            
            if 'tenant_id' in data:
                task.tenant_id = data['tenant_id'] if data['tenant_id'] and str(data['tenant_id']).isdigit() else None
            
            if 'unit_id' in data:
                task.unit_id = data['unit_id'] if data['unit_id'] and str(data['unit_id']).isdigit() else None
        
        # Status can be updated by both staff/property managers and assigned tenants
        if 'status' in data:
            try:
                new_status = TaskStatus(data['status'])
                
                # Tenants can only change status to in_progress or completed
                if current_user.role == UserRole.TENANT:
                    if new_status not in [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED]:
                        return jsonify({'error': 'Tenants can only set status to in_progress or completed'}), 403
                
                task.status = new_status
                
                # Set completion date when task is completed
                if new_status == TaskStatus.COMPLETED:
                    task.completed_at = datetime.now(timezone.utc)
                elif task.completed_at:  # Reset completion date if status changed from completed
                    task.completed_at = None
                    
            except ValueError:
                return jsonify({'error': f'Invalid status: {data["status"]}'}), 400
        
        db.session.commit()
        
        # Notify assigned staff member if task is assigned and was updated
        if task.assigned_to and ('title' in data or 'description' in data or 'priority' in data or 'due_date' in data):
            try:
                from services.notification_service import NotificationService
                NotificationService.notify_staff_task_updated(task, task.assigned_to)
            except Exception as notif_error:
                current_app.logger.warning(f"Failed to create notification for task {task.id}: {str(notif_error)}")
        
        current_app.logger.info(f"Task updated: {task_id} by user {current_user.id}")
        
        return jsonify({
            'message': 'Task updated successfully',
            'task': task.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Update task error: {str(e)}")
        return jsonify({'error': 'Failed to update task'}), 500

@task_bp.route('/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    """Delete a task."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Only property managers and staff can delete tasks
        if current_user.role not in [UserRole.PROPERTY_MANAGER, UserRole.STAFF]:
            return jsonify({'error': 'Access denied'}), 403
        
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        # Delete task
        db.session.delete(task)
        db.session.commit()
        
        current_app.logger.info(f"Task deleted: {task_id} by user {current_user.id}")
        
        return jsonify({'message': 'Task deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Delete task error: {str(e)}")
        return jsonify({'error': 'Failed to delete task'}), 500

@task_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_task_stats():
    """Get task statistics."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Base query
        query = Task.query
        
        # Filter by user role
        if current_user.role == UserRole.TENANT:
            query = query.filter(
                (Task.assigned_to == current_user.id) |
                (Task.tenant_id == current_user.id)
            )
        
        # Count by status
        stats = {}
        for status in TaskStatus:
            stats[status.value] = query.filter(Task.status == status).count()
        
        # Count by priority
        priority_stats = {}
        for priority in TaskPriority:
            priority_stats[priority.value] = query.filter(Task.priority == priority).count()
        
        # Overdue tasks
        overdue_count = query.filter(
            Task.due_date < datetime.now(timezone.utc),
            Task.status != TaskStatus.COMPLETED
        ).count()
        
        return jsonify({
            'status_stats': stats,
            'priority_stats': priority_stats,
            'overdue_count': overdue_count,
            'total_tasks': query.count()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get task stats error: {str(e)}")
        return jsonify({'error': 'Failed to fetch task statistics'}), 500

@task_bp.route('/enums', methods=['GET'])
@jwt_required()
def get_task_enums():
    """Get available task statuses and priorities."""
    try:
        return jsonify({
            'statuses': [{'value': status.value, 'label': status.value.replace('_', ' ').title()} for status in TaskStatus],
            'priorities': [{'value': priority.value, 'label': priority.value.title()} for priority in TaskPriority]
        }), 200
    except Exception as e:
        current_app.logger.error(f"Get task enums error: {str(e)}")
        return jsonify({'error': 'Failed to fetch task enums'}), 500

@task_bp.route('/test', methods=['GET'])
def test_tasks():
    """Test endpoint for task functionality."""
    return jsonify({
        'status': 'ok',
        'message': 'Task routes are working',
        'task_count': Task.query.count(),
        'available_endpoints': [
            'GET /tasks/',
            'POST /tasks/',
            'GET /tasks/enums',
            'GET /tasks/stats',
            'GET /tasks/<id>',
            'PUT /tasks/<id>',
            'DELETE /tasks/<id>'
        ]
    }), 200
