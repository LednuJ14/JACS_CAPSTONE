import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const AnalyticsReports = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReport, setSelectedReport] = useState('overview');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Fetch analytics data from API
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);

        // Fetch manager's properties using ApiService (handles auth)
        const propsRes = await apiService.getMyProperties();
        setProperties(propsRes?.properties || []);

        // Fetch analytics data
        const analyticsRes = await apiService.managerAnalytics({ property: selectedProperty, period: selectedPeriod });
        setAnalyticsData(analyticsRes);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        // Fallback data
        setAnalyticsData({
          totalRevenue: 0,
          totalExpenses: 0,
          netIncome: 0,
          occupancyRate: 0,
          maintenanceRequests: 0,
          tenantSatisfaction: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedProperty, selectedPeriod]);

  const handleDownloadReport = async (format) => {
    try {
      setDownloading(true);
      const params = {
        property: selectedProperty,
        period: selectedPeriod,
        report_type: selectedReport
      };
      
      const blob = await apiService.downloadAnalyticsReport(format, params);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const periodStr = selectedPeriod.replace(' ', '_');
      const formatExt = format === 'excel' ? 'xlsx' : format;
      link.download = `analytics_report_${periodStr}_${new Date().toISOString().split('T')[0]}.${formatExt}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert(`Failed to download ${format.toUpperCase()} report: ${error.message || 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading analytics...</p>
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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Analytics & Reports</h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Comprehensive insights and performance metrics for your property portfolio
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent bg-white font-medium text-gray-900"
            >
              <option value="all">All Properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent bg-white font-medium text-gray-900"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          {/* Download Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleDownloadReport('pdf')}
              disabled={downloading || !analyticsData}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {downloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDownloadReport('excel')}
              disabled={downloading || !analyticsData}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {downloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download Excel</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDownloadReport('csv')}
              disabled={downloading || !analyticsData}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {downloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download CSV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Report Type Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="p-2">
            <nav className="flex flex-wrap gap-2">
              {['overview', 'revenue', 'occupancy'].map((report) => (
                <button
                  key={report}
                  onClick={() => setSelectedReport(report)}
                  className={`py-3 px-6 font-semibold text-sm capitalize rounded-xl transition-all ${
                    selectedReport === report
                      ? 'bg-black text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {report}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Report */}
        {selectedReport === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900">₱{Number(analyticsData?.totalRevenue || 0).toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Expenses</p>
                    <p className="text-3xl font-bold text-gray-900">₱{Number(analyticsData?.totalExpenses || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">Subscription costs</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Net Income</p>
                    <p className="text-3xl font-bold text-gray-900">₱{Number(analyticsData?.netIncome || 0).toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Occupancy Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{analyticsData?.occupancyRate || 0}%</p>
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
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Maintenance Requests</p>
                    <p className="text-3xl font-bold text-gray-900">{analyticsData?.maintenanceRequests || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Tenant Satisfaction</p>
                    <p className="text-3xl font-bold text-gray-900">{analyticsData?.tenantSatisfaction || 0}/5</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Properties Performance */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
              <div className="px-8 py-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Properties Performance</h3>
                    <p className="text-gray-600 mt-1">Detailed overview of all your properties</p>
                  </div>
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">{properties.length} Properties</span>
                </div>
              </div>
              <div className="p-8">
                {properties.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">No properties data available</h4>
                    <p className="text-gray-600">Add properties to see performance analytics here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Property</th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Monthly Rent</th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Portal</th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {properties.map((property) => {
                          const statusUpper = (property.status || '').toString().toUpperCase();
                          return (
                            <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-6 whitespace-nowrap">
                                <div className="text-lg font-bold text-gray-900">{property.title}</div>
                              </td>
                              <td className="px-6 py-6 whitespace-nowrap">
                                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                                  statusUpper === 'ACTIVE' ? 'bg-gray-100 text-gray-800' :
                                  statusUpper === 'PENDING_APPROVAL' ? 'bg-gray-100 text-gray-600' :
                                  statusUpper === 'RENTED' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {statusUpper.replace('_', ' ') || 'UNKNOWN'}
                                </span>
                              </td>
                              <td className="px-6 py-6 whitespace-nowrap text-lg font-bold text-gray-900">
                                ₱{Number(property.monthly_rent || property?.pricing?.monthly_rent || 0).toLocaleString()}
                              </td>
                              <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-600">
                                {property.portal_subdomain ? (
                                  <span className="font-medium text-gray-900">{property.portal_subdomain}.localhost:3000</span>
                                ) : (
                                  <span className="text-gray-400">Not configured</span>
                                )}
                              </td>
                              <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-600">
                                {(property.city || property?.address?.city) || ''}, {(property.province || property?.address?.province) || ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Revenue Report */}
        {selectedReport === 'revenue' && (
          <div className="space-y-8">
            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">₱{Number(analyticsData?.totalRevenue || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Monthly recurring revenue</p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Expenses</p>
                <p className="text-3xl font-bold text-gray-900">₱{Number(analyticsData?.totalExpenses || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Subscription costs</p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Net Income</p>
                <p className="text-3xl font-bold text-gray-900">₱{Number(analyticsData?.netIncome || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">Revenue minus expenses</p>
              </div>
            </div>

            {/* Monthly Revenue Chart */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Monthly Revenue Trend</h3>
              {analyticsData?.monthlyData && analyticsData.monthlyData.length > 0 ? (
                <div className="space-y-4">
                  {analyticsData.monthlyData.map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{month.month}</p>
                        <div className="mt-2 flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Revenue: ₱{Number(month.revenue || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Expenses: ₱{Number(month.expenses || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">₱{Number((month.revenue || 0) - (month.expenses || 0)).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Net</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No monthly revenue data available</p>
                </div>
              )}
            </div>

            {/* Property Performance by Revenue */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Property Performance by Revenue</h3>
              {analyticsData?.propertyPerformance && analyticsData.propertyPerformance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Property</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Monthly Revenue</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analyticsData.propertyPerformance.map((property, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-lg font-bold text-gray-900">{property.property}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-gray-900">
                            ₱{Number(property.revenue || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                              {property.occupancy || 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No property performance data available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Occupancy Report */}
        {selectedReport === 'occupancy' && (
          <div className="space-y-8">
            {/* Occupancy Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Overall Occupancy Rate</p>
                    <p className="text-4xl font-bold text-gray-900">{analyticsData?.occupancyRate || 0}%</p>
                  </div>
                  <div className="w-16 h-16 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gray-900 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(analyticsData?.occupancyRate || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Revenue</p>
                    <p className="text-4xl font-bold text-gray-900">₱{Number(analyticsData?.totalRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">From occupied units</p>
            </div>
                  <div className="w-16 h-16 bg-gray-900 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Performance by Occupancy */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Property Occupancy Details</h3>
              {analyticsData?.propertyPerformance && analyticsData.propertyPerformance.length > 0 ? (
                <div className="space-y-4">
                  {analyticsData.propertyPerformance.map((property, index) => (
                    <div key={index} className="p-6 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-900">{property.property}</h4>
                        <span className="inline-flex px-4 py-2 text-sm font-semibold rounded-full bg-gray-900 text-white">
                          {property.occupancy || 0}% Occupied
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div 
                          className="bg-gray-900 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(property.occupancy || 0, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-sm text-gray-500">Monthly Revenue</p>
                          <p className="text-lg font-bold text-gray-900">₱{Number(property.revenue || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No property occupancy data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default AnalyticsReports;