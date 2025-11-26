import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building, Phone, Mail, Search, Filter, Plus, Edit, Trash2, MoreVertical, Eye, CheckCircle, Clock, AlertTriangle, ArrowRight, Users, Home, CreditCard, MessageSquare, Wrench, X } from 'lucide-react';
import { apiService } from '../../../services/api';
import Header from '../../components/Header';

const TenantsPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    property_id: ''
  });
  const [properties, setProperties] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTenant, setViewingTenant] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('TenantsPage: Component mounted');
    // Get current user info
    const user = apiService.getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
    // Fetch properties and tenants data on page load
    fetchProperties();
    fetchTenantsData();
  }, []);

  const fetchProperties = async () => {
    try {
      // Try to get property ID from subdomain
      const propertyIdOrSubdomain = apiService.getPropertyIdFromSubdomain();
      
      // Try to fetch properties from API
      try {
        const propertiesData = await apiService.get('/properties/');
        if (Array.isArray(propertiesData) && propertiesData.length > 0) {
          setProperties(propertiesData);
          
          // If we have a subdomain, auto-select the matching property
          if (propertyIdOrSubdomain) {
            const matchingProperty = propertiesData.find(p => {
              const id = typeof propertyIdOrSubdomain === 'number' ? propertyIdOrSubdomain : parseInt(propertyIdOrSubdomain);
              return p.id === id || 
                     p.portal_subdomain === propertyIdOrSubdomain ||
                     (p.title && p.title.toLowerCase() === propertyIdOrSubdomain.toLowerCase());
            });
            if (matchingProperty && !formData.property_id) {
              setFormData(prev => ({ ...prev, property_id: matchingProperty.id }));
            }
          }
        }
      } catch (err) {
        console.log('Could not fetch properties from API, using subdomain property ID');
        // If API fails but we have subdomain property ID, use it
        if (propertyIdOrSubdomain) {
          const propertyId = typeof propertyIdOrSubdomain === 'number' 
            ? propertyIdOrSubdomain 
            : parseInt(propertyIdOrSubdomain) || propertyIdOrSubdomain;
          setProperties([{ id: propertyId, name: 'Current Property', title: 'Current Property' }]);
        }
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchTenantsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching tenants data...');
      try {
        const tenantsData = await apiService.getTenants();
        console.log('Tenants data received:', tenantsData);
        setTenants(Array.isArray(tenantsData) ? tenantsData : []);
        setError(null);
      } catch (apiError) {
        console.error('Failed to fetch tenants from API:', apiError);
        setError('Failed to load tenants from server. Please check your connection and try again.');
        setTenants([]);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError('Failed to load tenants. Please try again.');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    navigate('/login');
  };

  const resetForm = () => {
    // Get property_id from subdomain if available
    const propertyId = apiService.getPropertyIdFromSubdomain();
    setFormData({
      email: '',
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      phone_number: '',
      property_id: propertyId || ''
    });
  };

  const handleAddTenant = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      email: tenant.user?.email || tenant.email || '',
      username: tenant.user?.username || '',
      password: '', // Don't prefill password for editing
      first_name: tenant.user?.first_name || '',
      last_name: tenant.user?.last_name || '',
      phone_number: tenant.user?.phone_number || tenant.phone_number || '',
      property_id: tenant?.property_id || tenant?.property?.id || ''
    });
    setShowEditModal(true);
  };

  const handleViewTenant = (tenant) => {
    setViewingTenant(tenant);
    setShowViewModal(true);
  };

  const handleDeleteTenant = async (tenantId) => {
    if (!confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      return;
    }
    
    try {
      await apiService.deleteTenant(tenantId);
      await fetchTenantsData(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      alert('Failed to delete tenant. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Get property_id - required for simplified schema
      let propertyId = formData.property_id;
      if (!propertyId) {
        // Try to get from subdomain
        const subdomainProperty = apiService.getPropertyIdFromSubdomain();
        if (subdomainProperty) {
          // If subdomain property is a number, use it directly
          // Otherwise, we'll let backend handle matching
          if (typeof subdomainProperty === 'number') {
            propertyId = subdomainProperty;
          } else if (!isNaN(parseInt(subdomainProperty))) {
            propertyId = parseInt(subdomainProperty);
          } else {
            // String subdomain - backend will match it
            propertyId = subdomainProperty;
          }
        }
      }
      
      if (!propertyId && !editingTenant) {
        alert('Property is required. Please select a property or ensure you are accessing through a property subdomain.');
        setLoading(false);
        return;
      }
      
      // Clean up data before sending - only send fields that exist in simplified schema
      const cleanedData = {
        email: formData.email.trim() || '',
        username: formData.username.trim() || '',
        first_name: formData.first_name.trim() || '',
        last_name: formData.last_name.trim() || '',
        phone_number: formData.phone_number.trim() || ''
      };
      
      // Add password for new tenants (required)
      if (!editingTenant) {
        if (!formData.password || formData.password.trim() === '') {
          alert('Password is required for new tenants.');
          setLoading(false);
          return;
        }
        cleanedData.password = formData.password;
      } else {
        // For editing, only send password if provided
        if (formData.password && formData.password.trim() !== '') {
          cleanedData.password = formData.password;
        }
      }
      
      // Add property_id
      if (propertyId) {
        cleanedData.property_id = propertyId;
      } else if (editingTenant && editingTenant.property_id) {
        // Keep existing property_id when editing if not changed
        cleanedData.property_id = editingTenant.property_id;
      }
      
      console.log('Submitting tenant data:', cleanedData);
      
      if (editingTenant) {
        // Update existing tenant
        await apiService.updateTenant(editingTenant.id, cleanedData);
      } else {
        // Create new tenant
        await apiService.createTenant(cleanedData);
      }
      
      // Close modal and refresh data
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingTenant(null);
      resetForm();
      
      // Show success message
      alert(editingTenant ? 'Tenant updated successfully!' : 'Tenant created successfully!');
      
      await fetchTenantsData();
      
    } catch (error) {
      console.error('Failed to save tenant:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save tenant. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Filter tenants based on search and filters
  const filteredTenants = tenants.filter(tenant => {
    // Safe access to nested properties
    const userName = tenant?.user?.first_name || tenant?.user?.last_name || '';
    const userEmail = tenant?.user?.email || tenant?.email || '';
    const roomNumber = tenant?.room_number || tenant?.unit?.unit_name || tenant?.unit?.unit_number || '';
    
    const matchesSearch = searchTerm === '' || 
                         userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status check - handle multiple status formats
    const tenantStatus = tenant?.status || (tenant?.is_approved ? 'Active' : 'Pending') || 'Pending';
    const matchesStatus = selectedStatus === 'all' || tenantStatus === selectedStatus;
    
    // Property check - handle different property formats
    const propertyName = tenant?.property?.name || 
                        tenant?.property?.title || 
                        tenant?.property_name ||
                        (tenant?.property_id ? `Property ${tenant.property_id}` : 'Unknown');
    const matchesProperty = selectedProperty === 'all' || propertyName === selectedProperty;
    
    return matchesSearch && matchesStatus && matchesProperty;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTenants = filteredTenants.slice(startIndex, endIndex);


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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tenants Management</h1>
              <p className="text-gray-600">Manage and monitor all tenants in your properties</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleAddTenant}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Tenant</span>
              </button>
              <button
                onClick={fetchTenantsData}
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
                    <span>Load Tenants</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchTenantsData}
                className="text-red-600 hover:text-red-800 underline font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-600" />
                <p className="text-gray-600 font-medium">Loading tenants...</p>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          {!loading && tenants.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Tenants</p>
                    <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
                    <p className="text-xs text-gray-500 mt-1">all properties</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Active Tenants</p>
                    <p className="text-2xl font-bold text-green-600">
                      {tenants.filter(t => {
                        const status = t?.status || (t?.is_approved ? 'Active' : 'Pending') || 'Pending';
                        return status === 'Active';
                      }).length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">currently renting</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {tenants.filter(t => {
                        const status = t?.status || (t?.is_approved ? 'Active' : 'Pending') || 'Pending';
                        return status === 'Pending';
                      }).length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">awaiting approval</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Properties</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {new Set(tenants.map(t => {
                        return t?.property?.name || 
                               t?.property?.title || 
                               t?.property_name ||
                               (t?.property_id ? `Property ${t.property_id}` : 'Unknown');
                      })).size}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">managed buildings</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Building className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filter Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tenants by name, email, or room..."
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
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Properties</option>
                {[...new Set(tenants.map(t => {
                  const propName = t?.property?.name || 
                                  t?.property?.title || 
                                  t?.property_name ||
                                  (t?.property_id ? `Property ${t.property_id}` : 'Unknown');
                  return propName;
                }))].map(propName => (
                  <option key={propName} value={propName}>{propName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tenants Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Tenants List</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{currentTenants.length} of {filteredTenants.length} tenants</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TENANT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROOM</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CONTACT INFO</th>
                    
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {currentTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {tenant?.user?.first_name || ''} {tenant?.user?.last_name || ''}
                            </div>
                            <div className="text-xs text-gray-500">ID: {tenant.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {(() => {
                              const unitInfo = tenant?.unit?.unit_name || 
                                              tenant?.unit?.unit_number || 
                                              tenant?.room_number || 
                                              tenant?.assigned_room || 
                                              null;
                              return unitInfo && unitInfo !== 'N/A' ? unitInfo : 'Unassigned';
                            })()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {tenant?.user?.email || tenant?.email || 'No email'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {tenant?.user?.phone_number || tenant?.user?.phone || tenant?.phone_number || 'No phone'}
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                          (() => {
                            const status = tenant?.status || (tenant?.is_approved ? 'Active' : 'Pending') || 'Pending';
                            return status === 'Active' ? 'bg-green-100 text-green-800' :
                                   status === 'Inactive' ? 'bg-red-100 text-red-800' :
                                   'bg-amber-100 text-amber-800';
                          })()
                        }`}>
                          {(() => {
                            const status = tenant?.status || (tenant?.is_approved ? 'Active' : 'Pending') || 'Pending';
                            if (status === 'Active') return <><CheckCircle className="w-3 h-3 mr-1" />{status}</>;
                            if (status === 'Inactive') return <><AlertTriangle className="w-3 h-3 mr-1" />{status}</>;
                            return <><Clock className="w-3 h-3 mr-1" />{status}</>;
                          })()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleViewTenant(tenant)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="View tenant details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditTenant(tenant)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit tenant"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteTenant(tenant.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete tenant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {!loading && currentTenants.length === 0 && !error && (
              <div className="text-center py-12">
                <div className="text-gray-300 mb-6">
                  <Users className="w-20 h-20 mx-auto" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No tenants found</h3>
                <p className="text-gray-600 mb-6">Click "Load Tenants" to fetch tenants from the server</p>
                <button
                  onClick={fetchTenantsData}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center space-x-2 mx-auto shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <Users className="w-5 h-5" />
                  <span>Load Tenants</span>
                </button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
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
                          currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
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
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTenants.length)} of {filteredTenants.length} results
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Tenant Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingTenant(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
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
                </div>

                {/* Login Credentials Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Login Credentials</h3>
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
                        Password {editingTenant ? '(leave blank to keep current)' : '*'}
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={!editingTenant}
                      />
                    </div>
                  </div>
                </div>

                {/* Property Assignment Section */}
                {properties.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Property Assignment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                        <select
                          value={formData.property_id}
                          onChange={(e) => handleInputChange('property_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Property</option>
                          {properties.map(property => (
                            <option key={property.id} value={property.id}>
                              {property.name || property.title || `Property ${property.id}`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Select the property for this tenant</p>
                      </div>
                    </div>
                  </div>
                )}



                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingTenant(null);
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
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin inline" />
                        Saving...
                      </>
                    ) : (
                      editingTenant ? 'Update Tenant' : 'Create Tenant'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Tenant Details Modal */}
      {showViewModal && viewingTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Tenant Details</h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingTenant(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">First Name</label>
                      <p className="text-sm text-gray-900">{viewingTenant?.user?.first_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Last Name</label>
                      <p className="text-sm text-gray-900">{viewingTenant?.user?.last_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                      <p className="text-sm text-gray-900">{viewingTenant?.user?.email || viewingTenant?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                      <p className="text-sm text-gray-900">{viewingTenant?.user?.phone_number || viewingTenant?.phone_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Property & Unit Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Property & Unit Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Property</label>
                      <p className="text-sm text-gray-900">
                        {viewingTenant?.property?.name || 
                         viewingTenant?.property?.title || 
                         viewingTenant?.property_name ||
                         (viewingTenant?.property_id ? `Property ${viewingTenant.property_id}` : 'N/A')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Unit/Room</label>
                      <p className="text-sm text-gray-900">
                        {viewingTenant?.unit?.unit_name || 
                         viewingTenant?.unit?.unit_number || 
                         viewingTenant?.room_number || 
                         viewingTenant?.assigned_room || 
                         'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Status Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                        (() => {
                          const status = viewingTenant?.status || (viewingTenant?.is_approved ? 'Active' : 'Pending') || 'Pending';
                          return status === 'Active' ? 'bg-green-100 text-green-800' :
                                 status === 'Inactive' ? 'bg-red-100 text-red-800' :
                                 'bg-amber-100 text-amber-800';
                        })()
                      }`}>
                        {(() => {
                          const status = viewingTenant?.status || (viewingTenant?.is_approved ? 'Active' : 'Pending') || 'Pending';
                          if (status === 'Active') return <><CheckCircle className="w-3 h-3 mr-1" />{status}</>;
                          if (status === 'Inactive') return <><AlertTriangle className="w-3 h-3 mr-1" />{status}</>;
                          return <><Clock className="w-3 h-3 mr-1" />{status}</>;
                        })()}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Tenant ID</label>
                      <p className="text-sm text-gray-900">{viewingTenant?.id || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowViewModal(false);
                      handleEditTenant(viewingTenant);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowViewModal(false);
                      setViewingTenant(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantsPage;
