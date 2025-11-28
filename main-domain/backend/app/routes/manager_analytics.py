"""
Manager Analytics API Routes
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import text, func
from app import db
from app.utils.decorators import manager_required
from app.utils.error_handlers import handle_api_error

manager_analytics_bp = Blueprint('manager_analytics', __name__)


def _get_period_start(period: str) -> datetime:
    """Get the start date for the given period."""
    now = datetime.utcnow()
    period = (period or 'month').lower()
    if period in ['week', '7days']:
        return now - timedelta(days=7)
    if period in ['month', '30days']:
        return now - timedelta(days=30)
    if period in ['quarter', '90days']:
        return now - timedelta(days=90)
    if period in ['year', '1year']:
        return now - timedelta(days=365)
    return now - timedelta(days=30)


@manager_analytics_bp.route('', methods=['GET'])
@manager_analytics_bp.route('/', methods=['GET'])
@manager_required
def get_manager_analytics(current_user):
    """Get analytics data for the current manager based on real data."""
    try:
        # Query params
        property_filter = request.args.get('property', 'all')
        period = request.args.get('period', 'month')
        period_start = _get_period_start(period)
        
        # Build property filter SQL
        property_where = "WHERE p.owner_id = :owner_id"
        property_params = {'owner_id': current_user.id}
        
        if property_filter and property_filter != 'all':
            try:
                property_id = int(property_filter)
                property_where += " AND p.id = :property_id"
                property_params['property_id'] = property_id
            except (ValueError, TypeError):
                # Invalid property ID, ignore filter
                pass
        
        # Get manager's properties
        properties_sql = text(f"""
            SELECT p.id, p.title, p.building_name, p.status
            FROM properties p
            {property_where}
        """)
        properties_result = db.session.execute(properties_sql, property_params).mappings().all()
        
        property_ids = [p['id'] for p in properties_result] if properties_result else []
        
        if not property_ids:
            # No properties, return empty analytics
            return jsonify({
                'totalRevenue': 0.0,
                'totalExpenses': 0.0,
                'netIncome': 0.0,
                'occupancyRate': 0.0,
                'maintenanceRequests': 0,
                'tenantSatisfaction': 0.0,
                'monthlyData': [],
                'propertyPerformance': []
            }), 200
        
        # Use tuple for IN clause (MySQL/MariaDB compatible)
        property_ids_tuple = tuple(property_ids)
        
        # Calculate real revenue from tenant_units (active leases)
        # Revenue represents total monthly rent from all currently active leases
        # This is the recurring monthly revenue, not filtered by period
        revenue_sql = text("""
            SELECT COALESCE(SUM(tu.monthly_rent), 0) as total_revenue
            FROM tenant_units tu
            INNER JOIN units u ON u.id = tu.unit_id
            WHERE u.property_id IN :property_ids
            AND (tu.move_out_date IS NULL OR tu.move_out_date > CURDATE())
            AND tu.move_in_date <= NOW()
        """)
        revenue_result = db.session.execute(revenue_sql, {'property_ids': property_ids_tuple}).mappings().first()
        total_revenue = float(revenue_result['total_revenue']) if revenue_result else 0.0
        
        # Calculate occupancy: count occupied units vs total units
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
        
        # Get real maintenance requests count (within period)
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
        
        # Get tenant satisfaction from maintenance_requests ratings
        satisfaction_sql = text("""
            SELECT 
                AVG(mr.tenant_satisfaction_rating) as avg_rating,
                COUNT(mr.tenant_satisfaction_rating) as rating_count
            FROM maintenance_requests mr
            WHERE mr.property_id IN :property_ids
            AND mr.tenant_satisfaction_rating IS NOT NULL
            AND mr.created_at >= :period_start
        """)
        satisfaction_result = db.session.execute(
            satisfaction_sql,
            {'property_ids': property_ids_tuple, 'period_start': period_start}
        ).mappings().first()
        
        tenant_satisfaction = 0.0
        if satisfaction_result and satisfaction_result['avg_rating']:
            tenant_satisfaction = round(float(satisfaction_result['avg_rating']), 1)
        
        # Calculate real expenses from subscription bills (paid/verified bills within period)
        expenses_sql = text("""
            SELECT COALESCE(SUM(sb.amount), 0) as total_expenses
            FROM subscription_bills sb
            WHERE sb.user_id = :user_id
            AND sb.status IN ('paid', 'verified', 'completed')
            AND (
                (sb.billing_period_start >= :period_start AND sb.billing_period_start <= NOW())
                OR (sb.payment_date >= :period_start AND sb.payment_date <= NOW())
                OR (sb.created_at >= :period_start AND sb.created_at <= NOW())
            )
        """)
        expenses_result = db.session.execute(
            expenses_sql,
            {'user_id': current_user.id, 'period_start': period_start}
        ).mappings().first()
        total_expenses = float(expenses_result['total_expenses']) if expenses_result else 0.0
        total_expenses = round(total_expenses, 2)
        net_income = round(total_revenue - total_expenses, 2)
        
        # Get property performance data
        property_performance = []
        for prop in properties_result:
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
                'property': prop.get('title') or prop.get('building_name') or f'Property {prop_id}',
                'occupancy': prop_occupancy,
                'revenue': prop_revenue
            })
        
        # Generate monthly data (last 3 months)
        monthly_data = []
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
            
            # Calculate monthly expenses from subscription bills
            month_expenses_sql = text("""
                SELECT COALESCE(SUM(sb.amount), 0) as expenses
                FROM subscription_bills sb
                WHERE sb.user_id = :user_id
                AND sb.status IN ('paid', 'verified', 'completed')
                AND (
                    (sb.billing_period_start >= :month_start AND sb.billing_period_start <= :month_end)
                    OR (sb.payment_date >= :month_start AND sb.payment_date <= :month_end)
                    OR (sb.created_at >= :month_start AND sb.created_at <= :month_end)
                )
            """)
            month_expenses_result = db.session.execute(
                month_expenses_sql,
                {'user_id': current_user.id, 'month_start': month_start, 'month_end': month_end}
            ).mappings().first()
            month_expenses = float(month_expenses_result['expenses']) if month_expenses_result else 0.0
            month_expenses = round(month_expenses, 2)
            
            monthly_data.append({
                'month': month_date.strftime('%b'),
                'revenue': round(month_revenue, 2),
                'expenses': month_expenses
            })
        
        result = {
            'totalRevenue': round(total_revenue, 2),
            'totalExpenses': round(total_expenses, 2),
            'netIncome': round(net_income, 2),
            'occupancyRate': occupancy_rate,
            'maintenanceRequests': maintenance_requests,
            'tenantSatisfaction': tenant_satisfaction,
            'monthlyData': monthly_data,
            'propertyPerformance': property_performance[:10]  # Limit to 10 properties
        }

        return jsonify(result), 200

    except Exception as e:
        current_app.logger.error(f'Get manager analytics error: {e}', exc_info=True)
        # Return safe default values instead of crashing
        return jsonify({
            'totalRevenue': 0.0,
            'totalExpenses': 0.0,
            'netIncome': 0.0,
            'occupancyRate': 0.0,
            'maintenanceRequests': 0,
            'tenantSatisfaction': 0.0,
            'monthlyData': [],
            'propertyPerformance': [],
            'error': 'Failed to retrieve analytics data'
        }), 200  # Return 200 with error in response to prevent frontend crashes
