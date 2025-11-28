import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, Users, User, Plus, Image as ImageIcon, ExternalLink, Loader2, X, CreditCard, Wrench, MessageSquare, ArrowRight, DollarSign, BarChart3 } from 'lucide-react';
import { apiService } from '../../../services/api';
import AccountSettings from '../../components/AccountSettings';
import ErrorBoundary from '../../components/ErrorBoundary';
import Header from '../../components/Header';
import ChatsModal from './ChatsModal';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPost, setNewPost] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [accountsDropdownOpen, setAccountsDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showChatsModal, setShowChatsModal] = useState(false);

  useEffect(() => {
    // Since RouteProtection already handles authentication and user type checks,
    // we can directly fetch dashboard data
    console.log('DashboardPage: Starting to fetch dashboard data...');
    
    // Get current user info
    const user = apiService.getStoredUser();
    setCurrentUser(user);
    
    fetchDashboardData();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (!target.closest('.profile-dropdown')) {
        setProfileDropdownOpen(false);
      }
      if (!target.closest('.accounts-dropdown')) {
        setAccountsDropdownOpen(false);
      }
    };

    if (profileDropdownOpen || accountsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen, accountsDropdownOpen]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard data from backend (includes all metrics, sales_data, and announcements)
      const data = await apiService.getDashboardData();

      if (data) {
        // Extract metrics from backend response
        const metrics = data.metrics || {};
        
        // Use backend's sales_data directly (already calculated from payments)
        // Backend returns sales_data with month, trend, and actual fields
        const salesData = Array.isArray(data.sales_data) ? data.sales_data : [];
        
        // Use backend's announcements directly
        const announcements = Array.isArray(data.announcements) ? data.announcements : [];
        
        // Ensure all required fields have defaults
        const dashboardPayload = {
          metrics: {
            total_income: metrics.total_income ?? 0,
            active_tenants: metrics.active_tenants ?? 0,
            active_staff: metrics.active_staff ?? 0,
            current_month: metrics.current_month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
            total_properties: metrics.total_properties ?? 1,
            occupancy_rate: metrics.occupancy_rate ?? 0,
            outstanding_balance: metrics.outstanding_balance ?? 0,
            bookings_today: metrics.bookings_today ?? 0,
            inquiries_this_month: metrics.inquiries_this_month ?? 0,
            avg_resolution_days: metrics.avg_resolution_days ?? 0,
            avg_monthly_rent: metrics.avg_monthly_rent ?? 0,
          },
          sales_data: salesData,
          announcements: announcements,
          maintenance_requests: Array.isArray(data.maintenance_requests) ? data.maintenance_requests : [],
          pending_tasks: Array.isArray(data.pending_tasks) ? data.pending_tasks : [],
          property_id: data.property_id,
          property_name: data.property_name,
        };

        setDashboardData(dashboardPayload);
        setError(null);
      } else {
        // Set empty dashboard structure if no data
        setDashboardData({
          metrics: {
            total_income: 0,
            active_tenants: 0,
            active_staff: 0,
            current_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
            total_properties: 0,
            occupancy_rate: 0,
            outstanding_balance: 0,
            bookings_today: 0,
            inquiries_this_month: 0,
            avg_resolution_days: 0,
            avg_monthly_rent: 0,
          },
          sales_data: [],
          announcements: [],
          maintenance_requests: [],
          pending_tasks: [],
        });
        setError(null);
      }
    } catch (err) {
      console.error('DashboardPage: Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
      // Set empty structure on error too
      setDashboardData({
        metrics: {
          total_income: 0,
          active_tenants: 0,
          active_staff: 0,
          current_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          total_properties: 0,
          occupancy_rate: 0,
          outstanding_balance: 0,
          bookings_today: 0,
          inquiries_this_month: 0,
          avg_resolution_days: 0,
          avg_monthly_rent: 0,
        },
        sales_data: [],
        announcements: [],
        maintenance_requests: [],
        pending_tasks: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    navigate('/login');
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;
    // Local-only: prepend to announcements in state
    setDashboardData((prev) => {
      if (!prev) return prev;
      const newAnnouncement = {
        id: (prev.announcements?.[0]?.id || 0) + 1,
        title: 'New Post',
        content: newPost,
        announcement_type: 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return {
        ...prev,
        announcements: [newAnnouncement, ...(prev.announcements || [])],
      };
    });
    setNewPost('');
  };

  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  const closeProfileDropdown = () => {
    setProfileDropdownOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading dashboard...</span>
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
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      {/* Header */}
      <Header userType="manager" />

      {/* Main Content */}
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Property Manager Dashboard</h1>
              <p className="text-gray-600">Welcome back! Here's what's happening with your properties</p>
            </div>
            <button
              onClick={fetchDashboardData}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Income</p>
                  <p className="text-2xl font-bold text-gray-900">₱{(dashboardData.metrics?.total_income || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">for {dashboardData.metrics?.current_month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active Tenants</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.metrics?.active_tenants || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">currently renting</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active Staff</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.metrics?.active_staff || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">team members</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                to="/bills" 
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all duration-200 border border-blue-200"
              >
                <div className="p-2 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Bills</p>
                  <p className="text-sm text-gray-600">View & create bills</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </Link>

              <Link 
                to="/requests" 
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg transition-all duration-200 border border-green-200"
              >
                <div className="p-2 bg-green-600 rounded-lg group-hover:bg-green-700 transition-colors">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Maintenance</p>
                  <p className="text-sm text-gray-600">Handle requests</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </Link>

              <button
                type="button"
                onClick={() => setShowChatsModal(true)}
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg transition-all duration-200 border border-purple-200 text-left w-full"
              >
                <div className="p-2 bg-purple-600 rounded-lg group-hover:bg-purple-700 transition-colors">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Messages</p>
                  <p className="text-sm text-gray-600">Communicate</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </button>

              <Link 
                to="/tenants" 
                className="group flex items-center space-x-3 p-4 bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 rounded-lg transition-all duration-200 border border-amber-200"
              >
                <div className="p-2 bg-amber-600 rounded-lg group-hover:bg-amber-700 transition-colors">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Tenants</p>
                  <p className="text-sm text-gray-600">Manage residents</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
              </Link>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Revenue Trends</h2>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div className="h-80">
                {Array.isArray(dashboardData.sales_data) && dashboardData.sales_data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.sales_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Line type="monotone" dataKey="trend" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No revenue data available</p>
                      <p className="text-xs mt-1">Revenue trends will appear here once payments are recorded</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Post Creation */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="What's happening?"
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 text-sm">
                    <ImageIcon className="w-4 h-4" />
                    <span>Add Photo</span>
                  </button>
                  <button
                    onClick={handleCreatePost}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Post
                  </button>
                </div>
              </div>

              {/* Announcements List */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {dashboardData.announcements && dashboardData.announcements.length > 0 ? (
                  dashboardData.announcements.map((announcement) => (
                  <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{announcement.title}</h3>
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        #{announcement.announcement_type}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <p>No announcements yet</p>
                    <p className="text-xs mt-1">Create your first announcement above</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages / Chats Modal */}
      <ChatsModal isOpen={showChatsModal} onClose={() => setShowChatsModal(false)} />

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Account Settings</h2>
              <button
                onClick={() => setShowAccountSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="text-gray-600">Loading account settings...</span>
                    </div>
                  </div>
                }
              >
                <AccountSettings />
                <ErrorBoundary />
              </React.Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;