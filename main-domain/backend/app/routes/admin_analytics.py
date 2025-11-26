"""
Admin Analytics Routes - Aggregates data from all property managers and properties
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import text, func
from app import db
from app.utils.decorators import admin_required
from app.utils.error_handlers import handle_api_error

admin_analytics_bp = Blueprint('admin_analytics', __name__)


def _range_start(range_key: str) -> datetime:
    """Get the start date for the given period."""
    now = datetime.utcnow()
    key = (range_key or '30days').lower()
    if key in ['7days', 'week']:
        return now - timedelta(days=7)
    if key in ['30days', 'month']:
        return now - timedelta(days=30)
    if key in ['90days', 'quarter']:
        return now - timedelta(days=90)
    if key in ['1year', 'year']:
        return now - timedelta(days=365)
    return now - timedelta(days=30)


@admin_analytics_bp.route('/analytics', methods=['GET'])
@admin_required
def get_admin_analytics(current_user):
    """Admin analytics aggregating data from all property managers and properties."""
    try:
        property_filter = request.args.get('property', 'all')
        date_range = request.args.get('range', '30days')
        period_start = _range_start(date_range)
        
        # Build property filter
        property_where = ""
        property_params = {}
        
        if property_filter and str(property_filter).lower() != 'all':
            try:
                prop_id = int(property_filter)
                property_where = "WHERE p.id = :property_id"
                property_params['property_id'] = prop_id
            except (ValueError, TypeError):
                # Invalid property ID, ignore filter
                property_where = ""
                property_params = {}
        
        # Get all properties (or filtered)
        properties_sql = text(f"""
            SELECT p.id, p.title, p.building_name, p.status, p.owner_id,
                   u.first_name, u.last_name, u.email as owner_email
            FROM properties p
            LEFT JOIN users u ON p.owner_id = u.id
            {property_where}
            ORDER BY p.created_at DESC
        """)
        properties_result = db.session.execute(properties_sql, property_params).mappings().all()
        
        property_ids = [p['id'] for p in properties_result] if properties_result else []
        total_properties = len(property_ids)
        
        # If no properties, return safe defaults
        if not property_ids:
            # Still try to get manager count
            managers_sql = text(f"""
                SELECT COUNT(DISTINCT p.owner_id) as total_managers
                FROM properties p
                {property_where if property_where else ""}
            """)
            try:
                managers_result = db.session.execute(managers_sql, property_params).mappings().first()
                total_managers = int(managers_result['total_managers']) if managers_result else 0
            except Exception:
                total_managers = 0
            
            return jsonify({
                'totalProperties': 0,
                'totalRevenue': 0.0,
                'totalTenants': 0,
                'occupancyRate': 0.0,
                'maintenanceRequests': 0,
                'newInquiries': 0,
                'totalManagers': total_managers,
                'propertyPerformance': [],
                'managerPerformance': [],
                'monthlyData': []
            }), 200
        
        # Use tuple for IN clause (MySQL/MariaDB compatible)
        # Ensure it's always a tuple (single item needs trailing comma)
        property_ids_tuple = tuple(property_ids) if len(property_ids) > 1 else (property_ids[0],)
        
        # Calculate total revenue from tenant_units (active leases across all properties)
        revenue_sql = text("""
            SELECT COALESCE(SUM(tu.monthly_rent), 0) as total_revenue
            FROM tenant_units tu
            INNER JOIN units u ON u.id = tu.unit_id
            WHERE u.property_id IN :property_ids
            AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
        """)
        revenue_result = db.session.execute(revenue_sql, {'property_ids': property_ids_tuple}).mappings().first()
        total_revenue = float(revenue_result['total_revenue']) if revenue_result else 0.0
        
        # Calculate occupancy: count occupied units vs total units across all properties
        occupancy_sql = text("""
            SELECT 
                COUNT(DISTINCT u.id) as total_units,
                COUNT(DISTINCT CASE 
                    WHEN tu.id IS NOT NULL AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
                    THEN u.id 
                END) as occupied_units
            FROM units u
            LEFT JOIN tenant_units tu ON tu.unit_id = u.id 
                AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
            WHERE u.property_id IN :property_ids
        """)
        occupancy_result = db.session.execute(occupancy_sql, {'property_ids': property_ids_tuple}).mappings().first()
        total_units = int(occupancy_result['total_units']) if occupancy_result else 0
        occupied_units = int(occupancy_result['occupied_units']) if occupancy_result else 0
        occupancy_rate = round((occupied_units / total_units * 100), 2) if total_units > 0 else 0.0
        
        # Get total distinct tenants (active leases)
        tenants_sql = text("""
            SELECT COUNT(DISTINCT tu.tenant_id) as total_tenants
            FROM tenant_units tu
            INNER JOIN units u ON u.id = tu.unit_id
            WHERE u.property_id IN :property_ids
            AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
        """)
        tenants_result = db.session.execute(tenants_sql, {'property_ids': property_ids_tuple}).mappings().first()
        total_tenants = int(tenants_result['total_tenants']) if tenants_result else 0
        
        # Get maintenance requests count (within period)
        maintenance_requests = 0
        try:
            maintenance_sql = text("""
                SELECT COUNT(*) as total_requests
                FROM maintenance_requests mr
                WHERE mr.property_id IN :property_ids
                AND mr.created_at >= :period_start
            """)
            maintenance_result = db.session.execute(
                maintenance_sql, 
                {'property_ids': property_ids_tuple, 'period_start': period_start}
            ).mappings().first()
            maintenance_requests = int(maintenance_result['total_requests']) if maintenance_result else 0
        except Exception as e:
            current_app.logger.warning(f'Error fetching maintenance requests: {e}')
            maintenance_requests = 0
        
        # Get new inquiries within period
        new_inquiries = 0
        try:
            inquiries_sql = text("""
                SELECT COUNT(*) as total_inquiries
                FROM inquiries i
                WHERE i.property_id IN :property_ids
                AND i.created_at >= :period_start
            """)
            inquiries_result = db.session.execute(
                inquiries_sql,
                {'property_ids': property_ids_tuple, 'period_start': period_start}
            ).mappings().first()
            new_inquiries = int(inquiries_result['total_inquiries']) if inquiries_result else 0
        except Exception as e:
            current_app.logger.warning(f'Error fetching inquiries: {e}')
            new_inquiries = 0
        
        # Get total managers count
        managers_sql = text("""
            SELECT COUNT(DISTINCT p.owner_id) as total_managers
            FROM properties p
            {property_where}
        """.format(property_where=property_where if property_where else ""))
        managers_result = db.session.execute(managers_sql, property_params).mappings().first()
        total_managers = int(managers_result['total_managers']) if managers_result else 0
        
        # Get property performance breakdown
        property_performance = []
        for prop in properties_result[:20]:  # Limit to 20 properties to prevent performance issues
            try:
                prop_id = prop['id']
                
                # Get units count and occupied count for this property
                prop_units_sql = text("""
                    SELECT 
                        COUNT(DISTINCT u.id) as total_units,
                        COUNT(DISTINCT CASE 
                            WHEN tu.id IS NOT NULL AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
                            THEN u.id 
                        END) as occupied_units,
                        COALESCE(SUM(CASE 
                            WHEN tu.id IS NOT NULL AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
                            THEN tu.monthly_rent 
                            ELSE 0 
                        END), 0) as revenue
                    FROM units u
                    LEFT JOIN tenant_units tu ON tu.unit_id = u.id 
                        AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
                    WHERE u.property_id = :prop_id
                """)
                prop_units_result = db.session.execute(prop_units_sql, {'prop_id': prop_id}).mappings().first()
                
                prop_total_units = int(prop_units_result['total_units']) if prop_units_result else 0
                prop_occupied_units = int(prop_units_result['occupied_units']) if prop_units_result else 0
                prop_revenue = float(prop_units_result['revenue']) if prop_units_result else 0.0
                prop_occupancy = round((prop_occupied_units / prop_total_units * 100), 2) if prop_total_units > 0 else 0.0
                
                property_performance.append({
                    'id': prop_id,
                    'name': prop.get('title') or prop.get('building_name') or f'Property {prop_id}',
                    'occupancy': prop_occupancy,
                    'revenue': round(prop_revenue, 2),
                    'totalUnits': prop_total_units,
                    'occupiedUnits': prop_occupied_units,
                    'status': str(prop.get('status', '')).lower()
                })
            except Exception as e:
                current_app.logger.warning(f'Error processing property {prop.get("id")}: {e}')
                continue
        
        # Get manager performance breakdown
        manager_performance = []
        try:
            # Get distinct managers from properties
            distinct_managers_sql = text(f"""
                SELECT DISTINCT p.owner_id, u.first_name, u.last_name, u.email
                FROM properties p
                LEFT JOIN users u ON p.owner_id = u.id
                {property_where}
                WHERE p.owner_id IS NOT NULL
            """)
            managers_list = db.session.execute(distinct_managers_sql, property_params).mappings().all()
            
            for manager in managers_list[:20]:  # Limit to 20 managers
                try:
                    manager_id = manager['owner_id']
                    
                    # Get manager's properties
                    manager_props_sql = text("""
                        SELECT id FROM properties WHERE owner_id = :manager_id
                    """)
                    manager_props = db.session.execute(manager_props_sql, {'manager_id': manager_id}).fetchall()
                    manager_prop_ids = [p[0] for p in manager_props] if manager_props else []
                    
                    if not manager_prop_ids:
                        continue
                    
                    manager_prop_ids_tuple = tuple(manager_prop_ids)
                    
                    # Get manager's revenue
                    manager_revenue_sql = text("""
                        SELECT COALESCE(SUM(tu.monthly_rent), 0) as total_revenue
                        FROM tenant_units tu
                        INNER JOIN units u ON u.id = tu.unit_id
                        WHERE u.property_id IN :property_ids
                        AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
                    """)
                    manager_revenue_result = db.session.execute(
                        manager_revenue_sql, 
                        {'property_ids': manager_prop_ids_tuple}
                    ).mappings().first()
                    manager_revenue = float(manager_revenue_result['total_revenue']) if manager_revenue_result else 0.0
                    
                    manager_performance.append({
                        'id': manager_id,
                        'name': f"{manager.get('first_name', '')} {manager.get('last_name', '')}".strip() or manager.get('email', 'Unknown'),
                        'email': manager.get('email', ''),
                        'propertyCount': len(manager_prop_ids),
                        'revenue': round(manager_revenue, 2)
                    })
                except Exception as e:
                    current_app.logger.warning(f'Error processing manager {manager.get("owner_id")}: {e}')
                    continue
        except Exception as e:
            current_app.logger.warning(f'Error fetching manager performance: {e}')
            manager_performance = []
        
        # Generate monthly data (last 3 months)
        monthly_data = []
        try:
            for i in range(3):
                month_date = datetime.utcnow() - timedelta(days=30 * (2 - i))
                month_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                if i == 2:
                    month_end = datetime.utcnow()
                else:
                    next_month = month_date + timedelta(days=32)
                    month_end = next_month.replace(day=1) - timedelta(days=1)
                
                month_revenue_sql = text("""
                    SELECT COALESCE(SUM(tu.monthly_rent), 0) as revenue
                    FROM tenant_units tu
                    INNER JOIN units u ON u.id = tu.unit_id
                    WHERE u.property_id IN :property_ids
                    AND tu.move_in_date <= :month_end
                    AND (tu.move_out_date IS NULL OR tu.move_out_date >= :month_start)
                """)
                month_revenue_result = db.session.execute(
                    month_revenue_sql,
                    {'property_ids': property_ids_tuple, 'month_start': month_start, 'month_end': month_end}
                ).mappings().first()
                month_revenue = float(month_revenue_result['revenue']) if month_revenue_result else 0.0
                
                monthly_data.append({
                    'month': month_date.strftime('%b %Y'),
                    'revenue': round(month_revenue, 2)
                })
        except Exception as e:
            current_app.logger.warning(f'Error generating monthly data: {e}')
            monthly_data = []
        
        result = {
            'totalProperties': total_properties,
            'totalRevenue': round(total_revenue, 2),
            'totalTenants': total_tenants,
            'occupancyRate': occupancy_rate,
            'maintenanceRequests': maintenance_requests,
            'newInquiries': new_inquiries,
            'totalManagers': total_managers,
            'propertyPerformance': property_performance,
            'managerPerformance': manager_performance,
            'monthlyData': monthly_data
        }
        
        return jsonify(result), 200

    except Exception as e:
        current_app.logger.error(f'Get admin analytics error: {e}', exc_info=True)
        # Return safe defaults to prevent frontend crashes
        return jsonify({
            'totalProperties': 0,
            'totalRevenue': 0.0,
            'totalTenants': 0,
            'occupancyRate': 0.0,
            'maintenanceRequests': 0,
            'newInquiries': 0,
            'totalManagers': 0,
            'propertyPerformance': [],
            'managerPerformance': [],
            'monthlyData': [],
            'error': 'Failed to retrieve analytics data'
        }), 200  # Return 200 with error in response to prevent frontend crashes


