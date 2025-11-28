import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Building, Phone, Mail, Calendar, Search, Filter, Plus, Edit, Trash2, ChevronDown, Settings, LogOut, X, Briefcase, Clock, MoreVertical, Eye, CheckCircle, AlertTriangle, ArrowRight, Users, Home, CreditCard, MessageSquare, Wrench, Activity } from 'lucide-react';
import { apiService } from '../../../services/api';
import { useProperty } from '../../components/PropertyContext';
import Header from '../../components/Header';

const StaffPage = () => {
  const { property } = useProperty();
  
  // Feature flag: if disabled, show a friendly notice and avoid any actions
  // Read from property display settings (property-specific), default to true
  const staffEnabled = property?.display_settings?.staffManagementEnabled !== undefined
    ? property.display_settings.staffManagementEnabled
    : true;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    employee_id: '',
    staff_role: 'maintenance'
    // Removed fields that don't exist in database: job_title, department, hire_date, monthly_salary, hourly_rate, employment_type, has_master_key
  });
  const navigate = useNavigate();

  useEffect(() => {
    console.log('StaffPage: Component mounted');
    // Get current user info
    const user = apiService.getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
    // Automatically fetch staff data on page load
    fetchStaffData();
  }, []);
  
  // Add a separate useEffect to fetch data when the component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStaffData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching staff data...');
      let staffData = [];
      try {
        staffData = await apiService.getStaff();
        console.log('Staff data fetched:', staffData);
        setStaff(Array.isArray(staffData) ? staffData : []);
      } catch (apiError) {
        console.error('Failed to fetch staff from API:', apiError);
        setError('Failed to load staff from server. Please check your connection and try again.');
        setStaff([]);
      }
    } catch (err) {
      console.error('Unexpected error fetching staff:', err);
      if (!error) {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    navigate('/login');
  };

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      phone_number: '',
      employee_id: '',
      staff_role: 'maintenance'
      // Removed fields that don't exist in database
    });
  };

  const handleAddStaff = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditStaff = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      email: staffMember.user?.email || '',
      username: staffMember.user?.username || '',
      password: '', // Don't prefill password for editing
      first_name: staffMember.user?.first_name || '',
      last_name: staffMember.user?.last_name || '',
      phone_number: staffMember.user?.phone_number || '',
      employee_id: staffMember.employee_id || '',
      staff_role: staffMember.staff_role || 'maintenance'
      // Removed fields that don't exist in database
    });
    setShowEditModal(true);
  };

  const handleDeleteStaff = async (staffId) => {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
      return;
    }
    
    try {
      await apiService.deleteStaff(staffId);
      await fetchStaffData(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete staff:', error);
      alert('Failed to delete staff member. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Clean up data before sending (only include fields that exist in database)
      const cleanedData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number || '',
        employee_id: formData.employee_id,
        staff_role: formData.staff_role
        // Removed fields that don't exist in database
      };
      
      // Debug: Log the data being sent
      console.log('Submitting staff data:', cleanedData);
      
      if (editingStaff) {
        // Update existing staff
        await apiService.updateStaff(editingStaff.id, cleanedData);
      } else {
        // Create new staff
        await apiService.createStaff(cleanedData);
      }
      
      // Close modal and refresh data
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingStaff(null);
      await fetchStaffData();
      resetForm();
      
    } catch (error) {
      console.error('Failed to save staff:', error);
      const errorMessage = error.message || 'Failed to save staff member. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Filter staff based on search and filters
  const filteredStaff = staff.filter(staffMember => {
    const matchesSearch = staffMember.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staffMember.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staffMember.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staffMember.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || staffMember.status === selectedStatus;
        // Department filtering removed since department doesn't exist in database
        const matchesDepartment = true;  // Always match since department filtering is not available
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStaff = filteredStaff.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  if (!staffEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userType="manager" />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-gray-400 mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Staff Management is disabled</h1>
            <p className="text-gray-600 mb-6">You can enable this feature in Settings → Preferences → Feature Toggles.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Return to Dashboard
            </button>
          </div>
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
            onClick={fetchStaffData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
      <div className="px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Management</h1>
              <p className="text-gray-600">Manage and monitor all staff members in your organization</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleAddStaff}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Staff</span>
              </button>
              <button
                onClick={fetchStaffData}
                disabled={loading}
                className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5" />
                    <span>Load Staff</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Departments</option>
                  <option value="Management">Management</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Security">Security</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position & Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Info</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employment Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentStaff.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <User className="w-12 h-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No staff found</h3>
                          <p className="text-gray-500 mb-4">
                            {error ? error : 'Click "Load Staff" to fetch staff from the server.'}
                          </p>
                          <button
                            onClick={fetchStaffData}
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading ? 'Loading...' : 'Load Staff'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentStaff.map((staffMember) => (
                    <tr key={staffMember.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {staffMember.user.first_name} {staffMember.user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">ID: {staffMember.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{staffMember.position}</div>
                        <div className="text-sm text-gray-500">{staffMember.staff_role ? staffMember.staff_role.charAt(0).toUpperCase() + staffMember.staff_role.slice(1).replace('_', ' ') : 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{staffMember.user.email}</div>
                        <div className="text-sm text-gray-500">{staffMember.user.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {staffMember.created_at ? `Member Since: ${new Date(staffMember.created_at).toLocaleDateString()}` : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Hours: {staffMember.working_hours}
                        </div>
                        {staffMember.supervisor !== 'N/A' && (
                          <div className="text-sm text-gray-500">
                            Supervisor: {staffMember.supervisor}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          staffMember.status === 'Active' ? 'bg-green-100 text-green-800' :
                          staffMember.status === 'Inactive' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {staffMember.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleEditStaff(staffMember)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit staff member"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteStaff(staffMember.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete staff member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 border border-gray-300 rounded-md text-sm ${
                          currentPage === page ? 'bg-black text-white' : 'hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredStaff.length)} of {filteredStaff.length} results
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Staff Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingStaff(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Login Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password {editingStaff ? '(leave blank to keep current)' : '*'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={!editingStaff}
                    />
                  </div>
                </div>

                {/* Employment Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
                    <input
                      type="text"
                      value={formData.employee_id}
                      onChange={(e) => handleInputChange('employee_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff Role *</label>
                    <select
                      value={formData.staff_role}
                      onChange={(e) => handleInputChange('staff_role', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="maintenance">Maintenance</option>
                      <option value="security">Security</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="manager">Manager</option>
                      <option value="admin_assistant">Admin Assistant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Note: Additional fields like job_title, department, hire_date, salary, etc. are managed through the staff_role and are automatically calculated from the database */}

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingStaff(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : (editingStaff ? 'Update Staff' : 'Create Staff')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPage;
