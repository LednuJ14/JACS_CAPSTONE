import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';

const ManagerDashboard = ({ onPageChange = () => {} }) => {
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Button click handlers
  const handleAddProperty = () => {
    onPageChange('manageProperty');
  };


  const handleViewAnalytics = () => {
    onPageChange('analyticsReports');
  };

  const handleViewDetails = (property) => {
    onPageChange('manageProperty');
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetching manager dashboard data...
      
      // Use ApiService instead of direct fetch
      const statsData = await ApiService.request(API_ENDPOINTS.MANAGER.DASHBOARD_STATS);
      const propertiesData = await ApiService.getMyProperties({ per_page: 5 });
      
      // Dashboard data loaded successfully
      
      setStats(statsData.stats);
      setProperties(propertiesData.properties);
      setError(null);
    } catch (error) {
      console.error('❌ Dashboard fetch error:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-gray-50 border border-gray-200 text-gray-800 px-6 py-4 rounded-xl mb-6">
            <p className="font-medium">{error}</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Property Manager Dashboard</h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Welcome back! Monitor your properties, track performance, and manage your real estate portfolio with ease.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Properties</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.total_properties || 0}</p>
              </div>
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Active Properties</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.active_properties || 0}</p>
              </div>
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Pending Approval</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.pending_properties || 0}</p>
              </div>
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Revenue</p>
                <p className="text-3xl font-bold text-gray-900">₱{Number(stats?.total_monthly_revenue || 0).toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Properties */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-12">
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">Recent Properties</h2>
            <p className="text-gray-600 mt-1">Your latest property listings</p>
          </div>
          <div className="p-8">
            {properties.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No properties yet</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">Start building your property portfolio by adding your first rental property.</p>
                <button 
                  onClick={handleAddProperty}
                  className="bg-black text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                >
                  Add Your First Property
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {properties.map((property) => (
                  <div key={property.id} className="flex items-center justify-between p-6 border border-gray-200 rounded-xl hover:shadow-md transition-all hover:border-gray-300">
                    <div className="flex items-center space-x-6">
                      {property.images?.[0]?.url ? (
                        <img
                          src={property.images[0].url}
                          alt={property.title}
                          className="w-20 h-20 object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{property.title}</h3>
                        <p className="text-gray-600 mb-2">{property.address?.city}, {property.address?.province}</p>
                        <p className="text-lg font-bold text-gray-900">₱{Number(property.pricing?.monthly_rent).toLocaleString()}/month</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        property.status === 'ACTIVE' ? 'bg-gray-100 text-gray-800' :
                        property.status === 'PENDING_APPROVAL' ? 'bg-gray-100 text-gray-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {property.status.replace('_', ' ')}
                      </span>
                      <button 
                        onClick={() => handleViewDetails(property)}
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Add New Property</h3>
            <p className="text-gray-600 mb-8 text-lg">Expand your portfolio by listing a new rental property</p>
            <button 
              onClick={handleAddProperty}
              className="bg-black text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-colors font-semibold text-lg"
            >
              Add Property
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">View Analytics</h3>
            <p className="text-gray-600 mb-8 text-lg">Track performance and insights for your properties</p>
            <button 
              onClick={handleViewAnalytics}
              className="bg-black text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-colors font-semibold text-lg"
            >
              View Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
