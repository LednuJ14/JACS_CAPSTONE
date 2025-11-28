import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Wrench, Plus, Clock, CheckCircle, AlertCircle, Search, Filter, MoreVertical, Calendar, AlertTriangle, Settings, FileText, X, Eye } from 'lucide-react';
import { apiService } from '../../../services/api';
import Header from '../../components/Header';

const TenantRequestsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fullRequestData, setFullRequestData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [newRequest, setNewRequest] = useState({
    issue: '',
    issue_category: '',
    priority_level: 'Medium',
    description: ''
  });

  // Using centralized mock data for frontend-only mode

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = apiService.getStoredUser();
    if (user && user.role !== 'tenant') {
      navigate('/dashboard');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        try {
          const myTenant = await apiService.getMyTenant();
          if (myTenant) {
            setTenant(myTenant);
            
            try {
              const requestsData = await apiService.getMaintenanceRequests(myTenant.id);
              
              // Transform API data to match frontend interface
              const transformedRequests = (requestsData || []).map((request) => {
                try {
                  // Map backend status to frontend display status
                  const backendStatus = (request.status || 'pending').toLowerCase();
                  let displayStatus = 'Pending';
                  if (backendStatus === 'in_progress') {
                    displayStatus = 'In Progress';
                  } else if (backendStatus === 'completed') {
                    displayStatus = 'Completed';
                  } else if (backendStatus === 'cancelled') {
                    displayStatus = 'Cancelled';
                  } else if (backendStatus === 'approved' || backendStatus === 'on_hold') {
                    displayStatus = 'Approved';
                  }

                  return {
                    id: request.id,
                    request_id: request.request_number || request.request_id || `REQ-${request.id}`,
                    issue: request.title || request.issue || 'Maintenance Request',
                    issue_category: request.category || request.issue_category || 'General',
                    priority_level: request.priority ? 
                      (request.priority.charAt(0).toUpperCase() + request.priority.slice(1)) : 
                      'Medium',
                    status: displayStatus,
                    backend_status: backendStatus,
                    description: request.description || '',
                    created_at: request.created_at || request.date || new Date().toISOString(),
                    scheduled_date: request.scheduled_date,
                    actual_completion: request.actual_completion,
                    assigned_staff: request.assigned_staff,
                    work_notes: request.work_notes,
                    resolution_notes: request.resolution_notes,
                    _fullData: request // Store full data for view modal
                  };
                } catch (err) {
                  console.error('Error transforming request:', err, request);
                  return {
                    id: request?.id || 0,
                    request_id: `REQ-${request?.id || 'N/A'}`,
                    issue: request?.title || request?.issue || 'Maintenance Request',
                    issue_category: request?.category || 'General',
                    priority_level: 'Medium',
                    status: 'Pending',
                    backend_status: request?.status || 'pending',
                    description: request?.description || '',
                    created_at: request?.created_at || new Date().toISOString(),
                    _fullData: request
                  };
                }
              });
              
              setRequests(Array.isArray(transformedRequests) ? transformedRequests : []);
            } catch (reqsErr) {
              console.warn('Requests not available:', reqsErr);
              setRequests([]);
            }
          } else {
            setTenant(null);
            setRequests([]);
          }
        } catch (tenantErr) {
          console.warn('No tenant record found:', tenantErr);
          setTenant(null);
          setRequests([]);
        }
      } catch (err) {
        console.error('Failed to load requests:', err);
        setError('Failed to load requests. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // Fetch full request details
  const fetchFullRequestDetails = async (requestId) => {
    try {
      const fullData = await apiService.getMaintenanceRequest(requestId);
      setFullRequestData(fullData);
      return fullData;
    } catch (err) {
      console.error('Failed to fetch full request details:', err);
      return null;
    }
  };

  // Handle view request details
  const handleViewRequest = async (request) => {
    setSelectedRequest(request);
    setShowViewModal(true);
    // Fetch full details if not already loaded
    if (!request._fullData || !request._fullData.description) {
      await fetchFullRequestDetails(request.id);
    } else {
      setFullRequestData(request._fullData);
    }
  };

  // Refresh requests list
  const refreshRequests = async () => {
    if (!tenant) return;
    try {
      const requestsData = await apiService.getMaintenanceRequests(tenant.id);
      
      // Transform API data
      const transformedRequests = (requestsData || []).map((request) => {
        try {
          const backendStatus = (request.status || 'pending').toLowerCase();
          let displayStatus = 'Pending';
          if (backendStatus === 'in_progress') {
            displayStatus = 'In Progress';
          } else if (backendStatus === 'completed') {
            displayStatus = 'Completed';
          } else if (backendStatus === 'cancelled') {
            displayStatus = 'Cancelled';
          } else if (backendStatus === 'approved' || backendStatus === 'on_hold') {
            displayStatus = 'Approved';
          }

          return {
            id: request.id,
            request_id: request.request_number || request.request_id || `REQ-${request.id}`,
            issue: request.title || request.issue || 'Maintenance Request',
            issue_category: request.category || request.issue_category || 'General',
            priority_level: request.priority ? 
              (request.priority.charAt(0).toUpperCase() + request.priority.slice(1)) : 
              'Medium',
            status: displayStatus,
            backend_status: backendStatus,
            description: request.description || '',
            created_at: request.created_at || request.date || new Date().toISOString(),
            scheduled_date: request.scheduled_date,
            actual_completion: request.actual_completion,
            assigned_staff: request.assigned_staff,
            work_notes: request.work_notes,
            resolution_notes: request.resolution_notes,
            _fullData: request
          };
        } catch (err) {
          console.error('Error transforming request:', err, request);
          return {
            id: request?.id || 0,
            request_id: `REQ-${request?.id || 'N/A'}`,
            issue: request?.title || request?.issue || 'Maintenance Request',
            issue_category: request?.category || 'General',
            priority_level: 'Medium',
            status: 'Pending',
            backend_status: request?.status || 'pending',
            description: request?.description || '',
            created_at: request?.created_at || new Date().toISOString(),
            _fullData: request
          };
        }
      });
      
      setRequests(Array.isArray(transformedRequests) ? transformedRequests : []);
    } catch (err) {
      console.error('Failed to refresh requests:', err);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage('');
      
      if (!tenant) {
        setError('Tenant profile not found. Please try logging in again.');
        return;
      }

      // Map frontend fields to backend format
      await apiService.createMaintenanceRequest({
        title: newRequest.issue,
        description: newRequest.description,
        category: newRequest.issue_category.toLowerCase(),
        priority: newRequest.priority_level.toLowerCase(),
        tenant_id: tenant.id
      });

      setShowCreateForm(false);
      setNewRequest({ issue: '', issue_category: '', priority_level: 'Medium', description: '' });
      setSuccessMessage('Maintenance request submitted successfully!');
      
      // Refresh the requests list
      await refreshRequests();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to create request:', err);
      setError(err?.message || err?.error || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your requests...</span>
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

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'completed') return 'text-green-600 bg-green-50';
    if (statusLower === 'in progress') return 'text-blue-600 bg-blue-50';
    if (statusLower === 'pending') return 'text-amber-600 bg-amber-50';
    if (statusLower === 'cancelled' || statusLower === 'disapproved') return 'text-red-600 bg-red-50';
    if (statusLower === 'approved') return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-50';
      case 'Medium': return 'text-amber-600 bg-amber-50';
      case 'Low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const openRequests = requests.filter(r => r.status !== 'Completed').length;
  const completedRequests = requests.filter(r => r.status === 'Completed').length;

  // Filter requests based on search, status, and priority
  const filteredRequests = requests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
                         (request.issue || '').toLowerCase().includes(searchLower) ||
                         (request.description || '').toLowerCase().includes(searchLower) ||
                         (request.issue_category || '').toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || 
                         (request.status || '').toLowerCase() === statusFilter.toLowerCase() ||
                         (request.backend_status || '').toLowerCase() === statusFilter.toLowerCase();
    
    const matchesPriority = priorityFilter === 'all' || 
                           (request.priority_level || '').toLowerCase() === priorityFilter.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'High': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'Medium': return <Clock className="w-4 h-4 text-amber-600" />;
      case 'Low': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="tenant" />
      
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Requests</h1>
              <p className="text-gray-600">Submit and track your maintenance requests</p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={!tenant}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>New Request</span>
            </button>
          </div>

          {/* No Tenant Record Message removed for frontend-only demo */}

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Open Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{openRequests}</p>
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
                  <p className="text-2xl font-bold text-green-600">{completedRequests}</p>
                  <p className="text-xs text-gray-500 mt-1">resolved</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
                  <p className="text-xs text-gray-500 mt-1">all requests</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">High Priority</p>
                  <p className="text-2xl font-bold text-red-600">{requests.filter(r => r.priority_level === 'High').length}</p>
                  <p className="text-xs text-gray-500 mt-1">urgent issues</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Create Request Form Modal */}
          {showCreateForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Create New Request</h2>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setError(null);
                        setNewRequest({ issue: '', issue_category: '', priority_level: 'Medium', description: '' });
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <form onSubmit={handleCreateRequest} className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Issue Title</label>
                    <input
                      type="text"
                      value={newRequest.issue}
                      onChange={(e) => setNewRequest({...newRequest, issue: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of the issue"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        value={newRequest.issue_category}
                        onChange={(e) => setNewRequest({...newRequest, issue_category: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select category</option>
                        <option value="plumbing">Plumbing</option>
                        <option value="electrical">Electrical</option>
                        <option value="hvac">HVAC</option>
                        <option value="appliance">Appliance</option>
                        <option value="carpentry">Carpentry</option>
                        <option value="painting">Painting</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="pest_control">Pest Control</option>
                        <option value="security">Security</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select
                        value={newRequest.priority_level}
                        onChange={(e) => setNewRequest({...newRequest, priority_level: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={newRequest.description}
                      onChange={(e) => setNewRequest({...newRequest, description: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="4"
                      placeholder="Provide detailed information about the issue..."
                      required
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setError(null);
                        setNewRequest({ issue: '', issue_category: '', priority_level: 'Medium', description: '' });
                      }}
                      disabled={submitting}
                      className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors font-medium"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Requests List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Request History</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{filteredRequests.length} of {requests.length} requests</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredRequests.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No requests found</p>
                  <p className="text-sm">Click "New Request" to create your first maintenance request</p>
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <div key={request.id} className="px-6 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${request.priority_level === 'High' ? 'bg-red-50' : request.priority_level === 'Medium' ? 'bg-amber-50' : 'bg-green-50'}`}>
                          {getPriorityIcon(request.priority_level)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{request.issue}</h3>
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(request.priority_level)}`}>
                              {request.priority_level}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{request.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(request.created_at).toLocaleDateString()}</span>
                            </div>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{request.issue_category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                          {request.status === 'Completed' && (
                            <div className="flex items-center space-x-1 text-green-600 mt-2">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs">Resolved</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleViewRequest(request)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Request Details Modal */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRequest(null);
                  setFullRequestData(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {fullRequestData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Request Number</h3>
                      <p className="text-lg font-semibold text-gray-900">{fullRequestData.request_number || selectedRequest.request_id}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRequest.status)}`}>
                        {selectedRequest.status}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Issue</h3>
                      <p className="text-lg font-semibold text-gray-900">{fullRequestData.title || selectedRequest.issue}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
                      <p className="text-lg font-semibold text-gray-900 capitalize">{fullRequestData.category || selectedRequest.issue_category}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Priority</h3>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedRequest.priority_level)}`}>
                        {fullRequestData.priority ? (fullRequestData.priority.charAt(0).toUpperCase() + fullRequestData.priority.slice(1)) : selectedRequest.priority_level}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Created Date</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {fullRequestData.description && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                      <p className="text-gray-900 whitespace-pre-wrap">{fullRequestData.description}</p>
                    </div>
                  )}

                  {fullRequestData.assigned_staff && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Assigned Staff</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {fullRequestData.assigned_staff.user?.first_name} {fullRequestData.assigned_staff.user?.last_name}
                      </p>
                    </div>
                  )}

                  {fullRequestData.scheduled_date && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Scheduled Date</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(fullRequestData.scheduled_date).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {fullRequestData.work_notes && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Work Notes</h3>
                      <p className="text-gray-900 whitespace-pre-wrap">{fullRequestData.work_notes}</p>
                    </div>
                  )}

                  {fullRequestData.resolution_notes && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Resolution Notes</h3>
                      <p className="text-gray-900 whitespace-pre-wrap">{fullRequestData.resolution_notes}</p>
                    </div>
                  )}

                  {fullRequestData.actual_completion && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Completed Date</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(fullRequestData.actual_completion).toLocaleString()}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-600">Loading request details...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantRequestsPage;
