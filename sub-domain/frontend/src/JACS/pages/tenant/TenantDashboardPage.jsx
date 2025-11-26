import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Bell, Wrench, Receipt, RefreshCw, TrendingUp, Calendar, AlertTriangle, CheckCircle, ArrowRight, Home, CreditCard, MessageSquare, Settings } from 'lucide-react';
import { apiService } from '../../../services/api';
import Header from '../../components/Header';

const TenantDashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [bills, setBills] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = apiService.getStoredUser();
    setCurrentUser(user);

    // If the logged-in user is not a tenant, redirect to PM dashboard
    if (user && user.role !== 'tenant') {
      navigate('/dashboard');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get dashboard data
        try {
          const data = await apiService.getDashboardData();
          if (data) {
            setDashboardData(data);
          } else {
            setDashboardData({
              metrics: {
                total_income: 0,
                active_tenants: 0,
                active_staff: 0,
                current_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                total_properties: 0,
              },
              sales_data: [],
              announcements: [],
            });
          }
        } catch (err) {
          console.warn('Dashboard data not available:', err);
          setDashboardData({
            metrics: {
              total_income: 0,
              active_tenants: 0,
              active_staff: 0,
              current_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
              total_properties: 0,
            },
            sales_data: [],
            announcements: [],
          });
        }

        // Fetch tenant record and related data
        try {
          const myTenant = await apiService.getMyTenant();
          if (myTenant) {
            setTenant(myTenant);
            
            // Fetch bills for this tenant
            try {
              const billsData = await apiService.getBills(undefined, undefined, undefined, myTenant.id);
              setBills(Array.isArray(billsData) ? billsData : []);
            } catch (billsErr) {
              console.warn('Bills not available:', billsErr);
              setBills([]);
            }
            
            // Fetch requests for this tenant
            try {
              const reqsData = await apiService.getMaintenanceRequests(undefined, undefined, undefined, myTenant.id);
              setRequests(Array.isArray(reqsData) ? reqsData : []);
            } catch (reqsErr) {
              console.warn('Requests not available:', reqsErr);
              setRequests([]);
            }
          } else {
            setTenant(null);
            setBills([]);
            setRequests([]);
          }
        } catch (tenantErr) {
          console.warn('No tenant record found:', tenantErr);
          setTenant(null);
          setBills([]);
          setRequests([]);
        }

      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError('Failed to load dashboard. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const refreshData = async () => {
    try {
      setRefreshing(true);
      const data = await apiService.getDashboardData();
      if (data) {
        setDashboardData(data);
      } else {
        setDashboardData({
          metrics: {
            total_income: 0,
            active_tenants: 0,
            active_staff: 0,
            current_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
            total_properties: 0,
          },
          sales_data: [],
          announcements: [],
        });
      }

      try {
        const myTenant = await apiService.getMyTenant();
        if (myTenant) {
          setTenant(myTenant);
          const billsData = await apiService.getBills(undefined, undefined, undefined, myTenant.id);
          setBills(Array.isArray(billsData) ? billsData : []);
          const reqsData = await apiService.getMaintenanceRequests(undefined, undefined, undefined, myTenant.id);
          setRequests(Array.isArray(reqsData) ? reqsData : []);
        } else {
          setTenant(null);
          setBills([]);
          setRequests([]);
        }
      } catch (e) {
        console.warn('Error refreshing tenant data:', e);
        setTenant(null);
        setBills([]);
        setRequests([]);
      }

      setError(null);
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading tenant dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      {/* Header */}
      <Header userType="tenant" />

      {/* Main Content */}
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h1>
              <p className="text-gray-600">Here's what's happening with your account</p>
            </div>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          
          {/* No Tenant Record Message removed for frontend-only demo */}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Balance Due</p>
                  <p className="text-2xl font-bold text-gray-900">₱{bills.filter(b => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">unpaid total</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <CreditCard className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Next Due Date</p>
                  <p className="text-2xl font-bold text-gray-900">{(() => {
                    const upcoming = bills.filter(b => b.status !== 'Paid').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
                    return upcoming ? new Date(upcoming.due_date).toLocaleDateString() : '—';
                  })()}</p>
                  <p className="text-xs text-gray-500 mt-1">soonest bill</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Open Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{requests.filter(r => r.status !== 'Completed').length}</p>
                  <p className="text-xs text-gray-500 mt-1">awaiting action</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Wrench className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{requests.filter(r => r.status === 'Completed').length}</p>
                  <p className="text-xs text-gray-500 mt-1">resolved issues</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link 
                to="/tenant/bills" 
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all duration-200 border border-blue-200"
              >
                <div className="p-2 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">View Bills</p>
                  <p className="text-sm text-gray-600">Check your payments</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </Link>

              <Link 
                to="/tenant/requests" 
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg transition-all duration-200 border border-green-200"
              >
                <div className="p-2 bg-green-600 rounded-lg group-hover:bg-green-700 transition-colors">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Submit Request</p>
                  <p className="text-sm text-gray-600">Report an issue</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </Link>

              <Link 
                to="/tenant/chats" 
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg transition-all duration-200 border border-purple-200"
              >
                <div className="p-2 bg-purple-600 rounded-lg group-hover:bg-purple-700 transition-colors">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Chats</p>
                  <p className="text-sm text-gray-600">Send a message</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </Link>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Announcements */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Announcements</h2>
                <Bell className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {dashboardData.announcements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No announcements yet</p>
                  </div>
                ) : (
                  dashboardData.announcements.slice(0, 3).map((a) => (
                    <div key={a.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <h3 className="font-semibold text-gray-900 mb-2">{a.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{a.content}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</span>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
              <div className="space-y-4">
                {bills.slice(0, 3).map(b => (
                  <div key={b.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${b.status === 'Paid' ? 'bg-green-100' : b.status === 'Overdue' ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <Receipt className={`w-4 h-4 ${b.status === 'Paid' ? 'text-green-600' : b.status === 'Overdue' ? 'text-red-600' : 'text-amber-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.bill_type}</p>
                      <p className="text-xs text-gray-500">₱{b.amount.toLocaleString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${b.status === 'Paid' ? 'bg-green-100 text-green-800' : b.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.status}
                    </span>
                  </div>
                ))}
                {requests.slice(0, 2).map(r => (
                  <div key={r.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${r.status === 'Completed' ? 'bg-green-100' : 'bg-blue-100'}`}>
                      <Wrench className={`w-4 h-4 ${r.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.issue}</p>
                      <p className="text-xs text-gray-500">{r.issue_category}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${r.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {r.status}
                    </span>
                  </div>
                ))}
                {bills.length === 0 && requests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantDashboardPage;