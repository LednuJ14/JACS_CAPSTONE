import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Download, Edit, Check, X, Loader2, ChevronLeft, ChevronRight, Wrench, AlertTriangle, Clock, CheckCircle, Building, User, Filter, MoreVertical, Eye, ArrowRight, Calendar, Activity, Trash2, UserPlus, FileText, MessageSquare } from 'lucide-react';
import { apiService } from '../../../services/api';
import AccountSettings from '../../components/AccountSettings';
import ErrorBoundary from '../../components/ErrorBoundary';
import Header from '../../components/Header';

const RequestsPage = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  
  // Modal and action states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fullRequestData, setFullRequestData] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(null); // Track which request's menu is open
  const [editForm, setEditForm] = useState({
    status: '',
    priority: '',
    assigned_to: '',
    scheduled_date: '',
    work_notes: '',
    resolution_notes: ''
  });
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [staffIdInput, setStaffIdInput] = useState('');
  const [taskForm, setTaskForm] = useState({
    assigned_to: '',
    due_date: '',
    priority: 'medium'
  });

  useEffect(() => {
    // Check if user is authenticated
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchRequestsData();
  }, [navigate]);


  const fetchRequestsData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from API first
      try {
        // Only fetch requests - compute dashboard stats from the list
        const requestsData = await apiService.getMaintenanceRequests();

        // Transform API data to match frontend interface (be defensive with real backend data)
        const transformedRequests = (requestsData || []).map((request) => {
          try {
            const tenant = request.tenant || {};
            const user = tenant.user || {};
            const unit = request.unit || {};
            const property =
              unit.property ||
              unit.property_obj ||
              tenant.property ||
              tenant.property_obj ||
              request.property ||
              {};

            const tenantName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Tenant';
            const tenantPhone = user.phone || user.mobile || user.contact_number || user.phone_number || 'N/A';

            // Get unit/room number from multiple sources (prioritize unit from request)
            const unitNumber = unit.unit_number || unit.unit_name || unit.name || null;
            const tenantRoom = tenant.room_number || tenant.unit_number || tenant.assigned_room || null;
            const roomNumber = unitNumber || tenantRoom || 'N/A';

            // Get property name from multiple sources
            const propertyName = 
              property.name ||
              property.title ||
              property.building_name ||
              (property.id ? `Property ${property.id}` : null) ||
              'Unknown Property';

            // Map backend status to frontend display status
            const backendStatus = (request.status || 'pending').toLowerCase();
            let displayStatus = 'Pending';
            if (backendStatus === 'in_progress') {
              displayStatus = 'In Progress';
            } else if (backendStatus === 'completed') {
              displayStatus = 'Completed';
            } else if (backendStatus === 'cancelled') {
              displayStatus = 'Disapproved';
            } else if (backendStatus === 'approved' || backendStatus === 'on_hold') {
              displayStatus = 'Approved';
            }

            // Map priority to display format
            const priority = request.priority || request.priority_level || 'medium';
            const priorityLevel = priority.charAt(0).toUpperCase() + priority.slice(1);

            return {
              id: request.id,
              request_id: request.request_number || request.request_id || `REQ-${request.id}`,
              tenant_name: tenantName,
              tenant_phone: tenantPhone,
              property_name: propertyName,
              room_number: roomNumber,
              issue: request.title || request.issue || 'Maintenance Request',
              issue_category: request.category || request.issue_category || 'General',
              priority_level: priorityLevel,
              status: displayStatus, // Use mapped display status
              backend_status: backendStatus, // Keep original for filtering
              date: request.created_at || request.date,
              created_at: request.created_at,
              // Store full request data for modals
              _fullData: request
            };
          } catch (err) {
            console.error('Error transforming maintenance request:', err, request);
            // Fallback minimal structure so the table still renders
            return {
              id: request?.id || 0,
              request_id: request?.request_number || request?.request_id || `REQ-${request?.id || 'N/A'}`,
              tenant_name: 'Unknown Tenant',
              tenant_phone: 'N/A',
              property_name: 'Unknown Property',
              room_number: request?.unit?.unit_number || request?.unit?.unit_name || 'N/A',
              issue: request?.title || request?.issue || 'Maintenance Request',
              issue_category: request?.category || request?.issue_category || 'General',
              priority_level: request?.priority ? (request.priority.charAt(0).toUpperCase() + request.priority.slice(1)) : 'Medium',
              status: 'Pending',
              backend_status: request?.status || 'pending',
              date: request?.created_at || request?.date || new Date().toISOString(),
              created_at: request?.created_at || new Date().toISOString(),
              _fullData: request
            };
          }
        });

        // Compute dashboard stats from the requests list
        const stats = {
          total_requests: transformedRequests.length,
          approved: transformedRequests.filter(r => r.status === 'Approved').length,
          in_progress: transformedRequests.filter(r => r.status === 'In Progress').length,
          pending: transformedRequests.filter(r => r.status === 'Pending').length,
          completed: transformedRequests.filter(r => r.status === 'Completed').length,
          disapproved: transformedRequests.filter(r => r.status === 'Disapproved').length,
          high_priority_requests: transformedRequests.filter(r => 
            (r.priority_level || '').toLowerCase() === 'high' || 
            (r.priority_level || '').toLowerCase() === 'urgent'
          ).length
        };

        setRequests(Array.isArray(transformedRequests) ? transformedRequests : []);
        setDashboardData(stats);
        setError(null);
      } catch (apiError) {
        console.warn('API not available:', apiError);
        setRequests([]);
        setDashboardData({
          total_requests: 0,
          approved: 0,
          in_progress: 0,
          pending: 0,
          completed: 0,
          disapproved: 0,
          high_priority_requests: 0
        });
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch requests data:', err);
      setError('Failed to load requests data');
    } finally {
      setLoading(false);
    }
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'text-blue-600';
      case 'In Progress': return 'text-orange-600';
      case 'Pending': return 'text-yellow-600';
      case 'Completed': return 'text-green-600';
      case 'Disapproved': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'Approved': return 'bg-blue-500';
      case 'In Progress': return 'bg-orange-500';
      case 'Pending': return 'bg-yellow-500';
      case 'Completed': return 'bg-green-500';
      case 'Disapproved': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Emergency': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Fetch staff list for assignment
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const staff = await apiService.getStaff();
        setStaffList(Array.isArray(staff) ? staff : []);
      } catch (err) {
        console.warn('Failed to fetch staff:', err);
        setStaffList([]);
      }
    };
    if (apiService.isAuthenticated()) {
      fetchStaff();
    }
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMoreMenu && !event.target.closest('.relative')) {
        setShowMoreMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Fetch full request details
  const fetchFullRequestDetails = async (requestId) => {
    try {
      const fullData = await apiService.getMaintenanceRequest(requestId);
      setFullRequestData(fullData);
      return fullData;
    } catch (err) {
      console.error('Failed to fetch full request details:', err);
      setActionError('Failed to load request details');
      return null;
    }
  };

  // Handle view request details
  const handleViewRequest = async (request) => {
    setSelectedRequest(request);
    setActionError(null);
    setShowViewModal(true);
    // Fetch full details if not already loaded
    if (!request._fullData || !request._fullData.description) {
      await fetchFullRequestDetails(request.id);
    } else {
      setFullRequestData(request._fullData);
    }
  };

  // Handle edit request
  const handleEditRequest = async (request) => {
    setSelectedRequest(request);
    setActionError(null);
    
    // Fetch full details
    const fullData = request._fullData || await fetchFullRequestDetails(request.id);
    
    if (fullData) {
      // Format scheduled_date for datetime-local input (YYYY-MM-DDTHH:mm)
      let scheduledDate = '';
      if (fullData.scheduled_date) {
        const date = new Date(fullData.scheduled_date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        scheduledDate = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
      
      setEditForm({
        status: fullData.status || request.backend_status || 'pending',
        priority: fullData.priority || request.priority_level || 'medium',
        assigned_to: fullData.assigned_to || fullData.assigned_staff?.id || '',
        scheduled_date: scheduledDate,
        work_notes: fullData.work_notes || '',
        resolution_notes: fullData.resolution_notes || ''
      });
      setShowEditModal(true);
    }
  };

  // Handle update request
  const handleUpdateRequest = async () => {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const updateData = {};
      
      if (editForm.status) updateData.status = editForm.status.toLowerCase();
      if (editForm.priority) updateData.priority = editForm.priority.toLowerCase();
      if (editForm.assigned_to) updateData.assigned_to = parseInt(editForm.assigned_to) || null;
      if (editForm.scheduled_date) {
        updateData.scheduled_date = new Date(editForm.scheduled_date).toISOString();
      }
      if (editForm.work_notes !== undefined) updateData.work_notes = editForm.work_notes;
      if (editForm.resolution_notes !== undefined) updateData.resolution_notes = editForm.resolution_notes;
      
      await apiService.updateMaintenanceRequest(selectedRequest.id, updateData);
      
      setShowEditModal(false);
      setSelectedRequest(null);
      await fetchRequestsData();
    } catch (err) {
      console.error('Failed to update request:', err);
      setActionError(err?.message || err?.error || 'Failed to update request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle approve request
  const handleApproveRequest = async (request) => {
    if (!confirm(`Approve request ${request.request_id}?`)) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      await apiService.updateMaintenanceRequest(request.id, { status: 'in_progress' });
      await fetchRequestsData();
    } catch (err) {
      console.error('Failed to approve request:', err);
      setActionError(err?.message || err?.error || 'Failed to approve request');
      alert(err?.message || err?.error || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle reject request
  const handleRejectRequest = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setActionError(null);
    setShowRejectModal(true);
  };

  const confirmRejectRequest = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      await apiService.updateMaintenanceRequest(selectedRequest.id, { 
        status: 'cancelled',
        work_notes: `Rejected: ${rejectionReason}`
      });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await fetchRequestsData();
    } catch (err) {
      console.error('Failed to reject request:', err);
      setActionError(err?.message || err?.error || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle complete request
  const handleCompleteRequest = (request) => {
    setSelectedRequest(request);
    setResolutionNotes('');
    setActionError(null);
    setShowCompleteModal(true);
  };

  const confirmCompleteRequest = async () => {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const updateData = { status: 'completed' };
      if (resolutionNotes.trim()) {
        updateData.resolution_notes = resolutionNotes.trim();
      }
      
      await apiService.updateMaintenanceRequest(selectedRequest.id, updateData);
      setShowCompleteModal(false);
      setSelectedRequest(null);
      setResolutionNotes('');
      await fetchRequestsData();
    } catch (err) {
      console.error('Failed to complete request:', err);
      setActionError(err?.message || err?.error || 'Failed to complete request');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle assign staff
  const handleAssignStaffClick = (request) => {
    setSelectedRequest(request);
    setStaffIdInput('');
    setActionError(null);
    setShowMoreMenu(null);
    setShowAssignStaffModal(true);
  };

  const confirmAssignStaff = async () => {
    if (!selectedRequest) return;
    if (!staffIdInput.trim()) {
      setActionError('Please enter a Staff ID');
      return;
    }
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const staffId = parseInt(staffIdInput.trim());
      if (isNaN(staffId)) {
        setActionError('Please enter a valid Staff ID (number)');
        setActionLoading(false);
        return;
      }
      
      await apiService.updateMaintenanceRequest(selectedRequest.id, { 
        assigned_to: staffId,
        status: 'in_progress'
      });
      setShowAssignStaffModal(false);
      setSelectedRequest(null);
      setStaffIdInput('');
      await fetchRequestsData();
    } catch (err) {
      console.error('Failed to assign staff:', err);
      setActionError(err?.message || err?.error || 'Failed to assign staff');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignStaffFromList = async (request, staffId) => {
    setActionLoading(true);
    setActionError(null);
    
    try {
      await apiService.updateMaintenanceRequest(request.id, { 
        assigned_to: parseInt(staffId),
        status: 'in_progress'
      });
      setShowMoreMenu(null);
      await fetchRequestsData();
    } catch (err) {
      console.error('Failed to assign staff:', err);
      setActionError(err?.message || err?.error || 'Failed to assign staff');
      alert(err?.message || err?.error || 'Failed to assign staff');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle create task from maintenance request
  const handleCreateTaskClick = (request) => {
    setSelectedRequest(request);
    setTaskForm({
      assigned_to: '',
      due_date: '',
      priority: (request.priority_level || 'medium').toLowerCase()
    });
    setActionError(null);
    setShowMoreMenu(null);
    setShowCreateTaskModal(true);
  };

  const submitTaskFromRequest = async () => {
    if (!selectedRequest) return;
    if (!taskForm.assigned_to) {
      setActionError('Please select a staff to assign.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const body = {
        title: selectedRequest.issue || 'Maintenance Task',
        description: `Request ID: ${selectedRequest.request_id}\nTenant: ${selectedRequest.tenant_name}\nProperty: ${selectedRequest.property_name}\nUnit: ${selectedRequest.room_number || 'N/A'}`,
        priority: taskForm.priority || 'medium',
        assigned_to: parseInt(taskForm.assigned_to),
        due_date: taskForm.due_date || null
      };
      await apiService.post('/tasks', body);
      setShowCreateTaskModal(false);
      setSelectedRequest(null);
      setTaskForm({
        assigned_to: '',
        due_date: '',
        priority: 'medium'
      });
      alert('Task created and assigned to staff.');
    } catch (err) {
      console.error('Failed to create task:', err);
      setActionError(err?.message || err?.error || 'Failed to create task from request');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.request_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || request.priority_level === selectedPriority;
    const matchesProperty = selectedProperty === 'all' || request.property_name === selectedProperty;
    return matchesSearch && matchesStatus && matchesPriority && matchesProperty;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading requests...</span>
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
            onClick={fetchRequestsData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Requests</h1>
              <p className="text-gray-600">Manage and monitor maintenance issues with ease</p>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{dashboardData?.approved || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">ready to start</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{dashboardData?.in_progress || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">being worked on</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{dashboardData?.pending || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">awaiting review</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.completed || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">resolved issues</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Disapproved</p>
                  <p className="text-2xl font-bold text-red-600">{dashboardData?.disapproved || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">rejected requests</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <X className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search requests, tenants, or issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Disapproved">Disapproved</option>
              </select>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priority</option>
                <option value="Emergency">Emergency</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Units</option>
                <option value="Building A">Building A</option>
                <option value="Building B">Building B</option>
                <option value="Building C">Building C</option>
                <option value="Building D">Building D</option>
                <option value="Building E">Building E</option>
              </select>
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Maintenance Requests</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{paginatedRequests.length} of {requests.length} requests</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">REQUEST ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TENANT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UNIT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISSUE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRIORITY</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <Wrench className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{request.request_id}</div>
                            <div className="text-xs text-gray-500">#{request.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{request.tenant_name}</div>
                            {request.tenant_phone && request.tenant_phone !== 'N/A' && (
                              <div className="text-xs text-gray-500">{request.tenant_phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-900">{request.property_name}</div>
                            {request.room_number && request.room_number !== 'N/A' && (
                              <div className="text-xs text-gray-500">Unit {request.room_number}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="max-w-xs">
                          <div className="text-sm text-gray-900 truncate">{request.issue}</div>
                          <div className="text-xs text-gray-500">{request.issue_category}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(request.priority_level)}`}>
                          {request.priority_level === 'Emergency' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {request.priority_level === 'High' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {request.priority_level === 'Medium' && <Clock className="w-3 h-3 mr-1" />}
                          {request.priority_level === 'Low' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {request.priority_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusDotColor(request.status)}`}></div>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full text-xs ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{new Date(request.date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2 relative">
                          <button 
                            onClick={() => handleViewRequest(request)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditRequest(request)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit request"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {request.status === 'Pending' && (
                            <>
                              <button 
                                onClick={() => handleApproveRequest(request)}
                                disabled={actionLoading}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Approve request"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRejectRequest(request)}
                                disabled={actionLoading}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Reject request"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {request.status === 'In Progress' && (
                            <button 
                              onClick={() => handleCompleteRequest(request)}
                              disabled={actionLoading}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                              title="Mark as completed"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <div className="relative">
                            <button 
                              onClick={() => setShowMoreMenu(showMoreMenu === request.id ? null : request.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="More options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {showMoreMenu === request.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                <div className="py-1">
                                  {request.status !== 'Completed' && request.status !== 'Disapproved' && (
                                    <>
                                      <button
                                        onClick={() => handleAssignStaffClick(request)}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                      >
                                        <UserPlus className="w-4 h-4" />
                                        <span>Assign Staff</span>
                                      </button>
                                      {staffList.length > 0 && (
                                        <div className="border-t border-gray-200">
                                          <div className="px-4 py-2 text-xs font-semibold text-gray-500">Quick Assign:</div>
                                          {staffList.slice(0, 3).map(staff => (
                                            <button
                                              key={staff.id}
                                              onClick={() => handleAssignStaffFromList(request, staff.id)}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                              {staff.user?.first_name} {staff.user?.last_name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {request.status === 'In Progress' && (
                                    <button
                                      onClick={() => handleCompleteRequest(request)}
                                      className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center space-x-2"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      <span>Mark Complete</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleCreateTaskClick(request)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span>Create Task</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredRequests.length)} of {filteredRequests.length} results
                </div>
              </div>
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
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {actionError}
                </div>
              )}

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
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Tenant</h3>
                      <p className="text-lg font-semibold text-gray-900">{selectedRequest.tenant_name}</p>
                      <p className="text-sm text-gray-500">{selectedRequest.tenant_phone}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Unit</h3>
                      <p className="text-lg font-semibold text-gray-900">{selectedRequest.property_name}</p>
                      <p className="text-sm text-gray-500">Room {selectedRequest.room_number}</p>
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
                        {fullRequestData.priority || selectedRequest.priority_level}
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

      {/* Edit Request Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Edit Request</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRequest(null);
                  setEditForm({
                    status: '',
                    priority: '',
                    assigned_to: '',
                    scheduled_date: '',
                    work_notes: '',
                    resolution_notes: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Staff</label>
                  <select
                    value={editForm.assigned_to}
                    onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.user?.first_name} {staff.user?.last_name} {staff.employee_id ? `(${staff.employee_id})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={editForm.scheduled_date}
                    onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Notes</label>
                <textarea
                  value={editForm.work_notes}
                  onChange={(e) => setEditForm({ ...editForm, work_notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Add work notes..."
                />
              </div>

              {editForm.status === 'completed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Notes</label>
                  <textarea
                    value={editForm.resolution_notes}
                    onChange={(e) => setEditForm({ ...editForm, resolution_notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Add resolution notes..."
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRequest(null);
                    setEditForm({
                      status: '',
                      priority: '',
                      assigned_to: '',
                      scheduled_date: '',
                      work_notes: '',
                      resolution_notes: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRequest}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Request</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Request Modal */}
      {showCompleteModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Complete Request</h2>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <p className="text-gray-700 mb-4">
                Complete request <span className="font-semibold">{selectedRequest.request_id}</span>?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Notes <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Add resolution notes..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedRequest(null);
                  setResolutionNotes('');
                  setActionError(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmCompleteRequest}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Completing...</span>
                  </>
                ) : (
                  <span>Complete Request</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Request Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Reject Request</h2>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <p className="text-gray-700 mb-4">
                Reject request <span className="font-semibold">{selectedRequest.request_id}</span>?
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Please provide a reason for rejection..."
                  required
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectionReason('');
                  setActionError(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectRequest}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Reject Request</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Task from Request</h2>
              <button
                onClick={() => {
                  setShowCreateTaskModal(false);
                  setSelectedRequest(null);
                  setTaskForm({ assigned_to: '', due_date: '', priority: 'medium' });
                  setActionError(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Request</h3>
                <p className="text-lg font-semibold text-gray-900">{selectedRequest.request_id}</p>
                <p className="text-sm text-gray-600">{selectedRequest.issue}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Staff *</label>
                <select
                  value={taskForm.assigned_to}
                  onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select staff</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.user?.first_name} {staff.user?.last_name} {staff.employee_id ? `(${staff.employee_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateTaskModal(false);
                  setSelectedRequest(null);
                  setTaskForm({ assigned_to: '', due_date: '', priority: 'medium' });
                  setActionError(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitTaskFromRequest}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Task</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignStaffModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Assign Staff</h2>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {actionError}
                </div>
              )}

              <p className="text-gray-700 mb-4">
                Assign staff to request <span className="font-semibold">{selectedRequest.request_id}</span>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={staffIdInput}
                  onChange={(e) => setStaffIdInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter Staff ID"
                  required
                />
              </div>

              {staffList.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or select from list:
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setStaffIdInput(e.target.value);
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Staff...</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.user?.first_name} {staff.user?.last_name} {staff.employee_id ? `(${staff.employee_id})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAssignStaffModal(false);
                  setSelectedRequest(null);
                  setStaffIdInput('');
                  setActionError(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAssignStaff}
                disabled={actionLoading || !staffIdInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <span>Assign Staff</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Account Settings</h2>
              <button
                onClick={() => setShowAccountSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-600">Loading account settings...</span>
                </div>
              }
            >
              <AccountSettings />
              <ErrorBoundary />
            </React.Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
