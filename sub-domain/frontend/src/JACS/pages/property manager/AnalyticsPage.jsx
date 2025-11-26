import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, LineChart, TrendingUp, Users, Building, Wrench, MessageSquare, Loader2, CreditCard } from 'lucide-react';
import Header from '../../components/Header';
import { apiService } from '../../../services/api';

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    fetchAnalyticsData();
  }, [navigate]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use propertyBaseURL to ensure subdomain is included in Origin header
      const propertyBaseURL = apiService.propertyBaseURL || 'http://localhost:5001/api';
      
      // Fetch all analytics data - property-specific based on subdomain
      const [dashboardData, financialData, occupancyData] = await Promise.allSettled([
        apiService.get('/analytics/dashboard', { baseURL: propertyBaseURL }),
        apiService.get('/analytics/financial-summary', { baseURL: propertyBaseURL }),
        apiService.get('/analytics/occupancy-report', { baseURL: propertyBaseURL })
      ]);
      
      // Extract dashboard data
      const dashboard = dashboardData.status === 'fulfilled' ? dashboardData.value : null;
      const financial = financialData.status === 'fulfilled' ? financialData.value : null;
      const occupancy = occupancyData.status === 'fulfilled' ? occupancyData.value : null;
      
      // Calculate additional metrics
      const openRequestsCount = dashboard?.maintenance_requests?.length || 0;
      const pendingTasksCount = dashboard?.pending_tasks?.length || 0;
      
      // Calculate average monthly rent from bills or units
      const avgMonthlyRent = dashboard?.metrics?.total_income || 0;
      
      // Calculate average resolution days (placeholder - would need request completion dates)
      const avgResolutionDays = 0; // TODO: Calculate from maintenance requests
      
      // Calculate bookings today (tenants moved in today)
      const bookingsToday = 0; // TODO: Calculate from tenant_units move_in_date = today
      
      // Calculate inquiries this month (placeholder)
      const inquiriesThisMonth = 0; // TODO: Calculate from inquiries table
      
      // Transform backend data to match frontend expectations
      const transformedData = {
        propertyId: dashboard?.property_id || null,
        propertyName: dashboard?.property_name || financial?.property_name || occupancy?.property_name || 'Property Analytics',
        kpis: {
          totalRevenue: dashboard?.metrics?.total_income || financial?.totals?.total_revenue || 0,
          occupancyRate: dashboard?.properties?.occupancy_rate || occupancy?.overall_occupancy?.occupancy_rate || 0,
          activeStays: dashboard?.metrics?.active_tenants || 0,
          openRequests: openRequestsCount,
          pendingTasks: pendingTasksCount,
          outstandingBalance: dashboard?.metrics?.outstanding_balance || financial?.totals?.outstanding_balance || 0,
          overdueBills: financial?.totals?.overdue_bills_count || 0,
          bookingsToday: bookingsToday,
          inquiriesThisMonth: inquiriesThisMonth,
          avgResolutionDays: avgResolutionDays,
          avgMonthlyRent: avgMonthlyRent
        },
        revenueTrend: dashboard?.sales_data?.map(item => ({
          month: item.month,
          value: typeof item.trend === 'number' ? item.trend : (typeof item.actual === 'number' ? item.actual : 0)
        })) || financial?.monthly_revenue?.map(item => ({
          month: item.month,
          value: item.revenue || 0
        })) || [],
        occupancyByUnitType: occupancy?.unit_type_breakdown?.map(item => ({
          type: item.type || 'All Units',
          occupancy: item.occupancy_rate || 0
        })) || [
          {
            type: 'All Units',
            occupancy: occupancy?.overall_occupancy?.occupancy_rate || dashboard?.properties?.occupancy_rate || 0
          }
        ],
        financial: {
          monthlyRevenue: financial?.monthly_revenue || [],
          totalRevenue: financial?.totals?.total_revenue || 0,
          outstandingBalance: financial?.totals?.outstanding_balance || 0,
          overdueBills: financial?.totals?.overdue_bills_count || 0
        },
        occupancy: {
          totalUnits: occupancy?.overall_occupancy?.total_units || dashboard?.properties?.total_units || 0,
          occupiedUnits: occupancy?.overall_occupancy?.occupied_units || dashboard?.properties?.occupied_units || 0,
          availableUnits: occupancy?.overall_occupancy?.available_units || dashboard?.properties?.available_units || 0,
          occupancyRate: occupancy?.overall_occupancy?.occupancy_rate || dashboard?.properties?.occupancy_rate || 0
        }
      };
      
      setData(transformedData);
    } catch (e) {
      console.error('Failed to load analytics:', e);
      setError(e.message || 'Failed to load analytics data.');
      setData({
        propertyId: null,
        propertyName: 'Property Analytics',
        kpis: {
          totalRevenue: 0,
          occupancyRate: 0,
          activeStays: 0,
          openRequests: 0,
          pendingTasks: 0,
          outstandingBalance: 0,
          overdueBills: 0,
          bookingsToday: 0,
          inquiriesThisMonth: 0,
          avgResolutionDays: 0,
          avgMonthlyRent: 0
        },
        revenueTrend: [],
        occupancyByUnitType: [],
        financial: {
          monthlyRevenue: [],
          totalRevenue: 0,
          outstandingBalance: 0,
          overdueBills: 0
        },
        occupancy: {
          totalUnits: 0,
          occupiedUnits: 0,
          availableUnits: 0,
          occupancyRate: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Retry</button>
        </div>
      </div>
    );
  }

  const { propertyName, kpis, revenueTrend, occupancyByUnitType } = data || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="manager" />

      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Property Analytics</h1>
              <p className="text-gray-600">
                {data?.propertyName 
                  ? `Performance for ${data.propertyName}` 
                  : 'Loading property information...'}
              </p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue (MTD)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₱{kpis?.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {kpis?.occupancyRate ? kpis.occupancyRate.toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data?.occupancy?.occupiedUnits || 0} / {data?.occupancy?.totalUnits || 0} units
                  </p>
                </div>
                <Building className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Stays</p>
                  <p className="text-2xl font-bold text-gray-900">{kpis?.activeStays ?? 0}</p>
                </div>
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₱{kpis?.outstandingBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                  {kpis?.overdueBills > 0 && (
                    <p className="text-xs text-red-600 mt-1">{kpis.overdueBills} overdue bills</p>
                  )}
                </div>
                <CreditCard className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Secondary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Open Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{kpis?.openRequests ?? 0}</p>
                </div>
                <Wrench className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{kpis?.pendingTasks ?? 0}</p>
                </div>
                <MessageSquare className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Units</p>
                  <p className="text-2xl font-bold text-gray-900">{data?.occupancy?.availableUnits ?? 0}</p>
                </div>
                <Building className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Units</p>
                  <p className="text-2xl font-bold text-gray-900">{data?.occupancy?.totalUnits ?? 0}</p>
                </div>
                <Building className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          {/* Booking Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Bookings Today</p>
                  <p className="text-2xl font-bold text-gray-900">{kpis?.bookingsToday ?? 0}</p>
                </div>
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inquiries This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{kpis?.inquiriesThisMonth ?? 0}</p>
                </div>
                <MessageSquare className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* Revenue Trend (simple bars) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><LineChart className="w-5 h-5" /> Revenue Trend</h2>
            </div>
            <div className="grid grid-cols-6 gap-4 items-end h-48">
              {(revenueTrend || []).map((pt) => (
                <div key={pt.month} className="flex flex-col items-center gap-2">
                  <div className="w-full bg-blue-100 rounded" style={{ height: `${Math.max(10, (pt.value / Math.max(...(revenueTrend || []).map(p => p.value))) * 100)}%` }}>
                    <div className="w-full h-full bg-blue-500 rounded"></div>
                  </div>
                  <span className="text-xs text-gray-600">{pt.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Removed Lease Status section for short-term rental scope */}

          {/* Occupancy by Unit Type */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Occupancy by Unit Type</h2>
            </div>
            <div className="space-y-3">
              {(occupancyByUnitType || []).map((p) => (
                <div key={p.type} className="">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-800">{p.type}</span>
                    <span className="text-gray-600">{p.occupancy}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-3 bg-green-500" style={{ width: `${p.occupancy}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service & Communication Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Wrench className="w-5 h-5" /> Maintenance</h2>
              </div>
              <p className="text-sm text-gray-600">Open requests: <span className="font-semibold text-gray-900">{kpis?.openRequests ?? 0}</span></p>
              <p className="text-sm text-gray-600">Avg resolution: <span className="font-semibold text-gray-900">{kpis?.avgResolutionDays ?? 0} days</span></p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Inquiries</h2>
              </div>
              <p className="text-sm text-gray-600">This month: <span className="font-semibold text-gray-900">{kpis?.inquiriesThisMonth ?? 0}</span></p>
              <p className="text-sm text-gray-600">Avg monthly rent: <span className="font-semibold text-gray-900">₱{kpis?.avgMonthlyRent?.toLocaleString?.() || 0}</span></p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;


