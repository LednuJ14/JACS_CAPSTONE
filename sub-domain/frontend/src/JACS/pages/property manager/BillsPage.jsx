import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Loader2, X, CreditCard, DollarSign, Calendar, Filter, MoreVertical, CheckCircle, Clock, AlertTriangle, Building, User, Eye, ArrowRight, AlertCircle, Repeat, FileText, Hash, Bell, Mail, Image, FileCheck, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { apiService } from '../../../services/api';
import AccountSettings from '../../components/AccountSettings';
import ErrorBoundary from '../../components/ErrorBoundary';
import Header from '../../components/Header';

const BillsPage = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBillType, setSelectedBillType] = useState('all');
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [showEditBill, setShowEditBill] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [showPaymentProof, setShowPaymentProof] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [form, setForm] = useState({
    tenant_id: 0,
    bill_type: '',
    amount: '',
    due_date: '',
    description: '',
    priority_level: 'Medium',
    payment_method: '',
    late_fee_amount: '',
    is_recurring: false,
    recurring_frequency: '',
    bill_category: '',
    reference_number: '',
    reminder_days: 3,
    send_email_reminder: true,
  });

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchBillsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const fetchBillsData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from API first
      try {
        const [billsData, dashboardData] = await Promise.all([
          apiService.getBills(),
          apiService.getBillsDashboard()
        ]);

        const transformedBills = billsData.map((bill) => {
          try {
            // Safely extract tenant info
            const tenant = bill.tenant || {};
            const user = tenant.user || {};
            const unit = bill.unit || {};
            const payments = bill.payments || [];
            
            // Get property name - check multiple sources
            let propertyName = 'Unknown Property';
            let propertyId = null;
            
            // Try unit's property first
            if (unit.property_obj) {
              propertyName = unit.property_obj.name || unit.property_obj.title || unit.property_obj.building_name || `Property ${unit.property_obj.id}`;
              propertyId = unit.property_obj.id;
            } else if (unit.property) {
              propertyName = unit.property.name || unit.property.title || unit.property.building_name || `Property ${unit.property.id}`;
              propertyId = unit.property.id;
            } else if (unit.property_id) {
              propertyName = `Property ${unit.property_id}`;
              propertyId = unit.property_id;
            }
            
            // Fallback to tenant's property
            if (propertyName === 'Unknown Property' && tenant.property_obj) {
              propertyName = tenant.property_obj.name || tenant.property_obj.title || tenant.property_obj.building_name || `Property ${tenant.property_obj.id}`;
              propertyId = tenant.property_obj.id;
            } else if (propertyName === 'Unknown Property' && tenant.property) {
              propertyName = tenant.property.name || tenant.property.title || tenant.property.building_name || `Property ${tenant.property.id}`;
              propertyId = tenant.property.id;
            } else if (propertyName === 'Unknown Property' && tenant.property_id) {
              propertyName = `Property ${tenant.property_id}`;
              propertyId = tenant.property_id;
            }
            
            // Get unit number/name - check multiple sources
            // First, try to get from bill's unit directly
            // The backend returns unit_name from the database column 'unit_name'
            let unitNumber = null;
            if (unit && Object.keys(unit).length > 0) {
              // Check all possible field names - backend sets unit_name, unit_number, and name
              unitNumber = unit.unit_name || unit.unit_number || unit.name || null;
              
              // Debug logging (remove in production)
              if (process.env.NODE_ENV === 'development' && !unitNumber && (unit.id || bill.unit_id)) {
                console.warn(`Bill ${bill.id}: Unit ${unit.id || bill.unit_id} has no name. Unit object:`, unit);
              }
            }
            
            // Also check tenant's current_rent for unit info
            const currentRent = tenant.current_rent || {};
            const rentUnit = currentRent.unit || {};
            const rentUnitName = rentUnit ? (rentUnit.unit_name || rentUnit.unit_number || rentUnit.name || null) : null;
            
            // Check tenant's assigned room as fallback
            const tenantRoom = tenant.assigned_room || tenant.room_number || null;
            
            // Prioritize: unit from bill > unit from current_rent > tenant room
            // Only use unit ID as fallback if we truly have no name
            const roomNumber = unitNumber || rentUnitName || tenantRoom || null;
            
            return {
              id: bill.id,
              tenant_id: tenant.id || bill.tenant_id,
              tenant_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Tenant',
              tenant_user_id: user.id || tenant.user_id,
              property_id: propertyId || unit.property_id || tenant.property_id,
              property_name: propertyName,
              unit_id: unit.id || bill.unit_id,
              unit_number: unitNumber || rentUnitName || tenantRoom,
              room_number: roomNumber,
              unit_name: unitNumber || rentUnitName || tenantRoom, // Store unit name for easy access
              bill_type: bill.bill_type || 'other',
              amount: parseFloat(bill.amount || 0),
              amount_paid: parseFloat(bill.amount_paid || 0),
              amount_due: parseFloat(bill.amount_due || bill.amount || 0),
              due_date: bill.due_date,
              status: bill.status || 'pending',
              created_at: bill.created_at,
              bill_number: bill.bill_number,
              title: bill.title || '',
              description: bill.description || '',
              payments: payments, // Include payments for viewing proof
              // Store full bill data for modals
              _fullData: bill
            };
          } catch (err) {
            // Return minimal bill data if transformation fails
            return {
              id: bill.id || 0,
              tenant_name: 'Unknown',
              property_name: 'Unknown',
              room_number: 'N/A',
              bill_type: bill.bill_type || 'other',
              amount: parseFloat(bill.amount || 0),
              amount_paid: 0,
              amount_due: parseFloat(bill.amount || 0),
              due_date: bill.due_date || new Date().toISOString(),
              status: bill.status || 'pending',
              created_at: bill.created_at || new Date().toISOString(),
              bill_number: bill.bill_number || '',
              title: bill.title || '',
              description: bill.description || ''
            };
          }
        });

        setBills(Array.isArray(transformedBills) ? transformedBills : []);
        setDashboardData({
          total_revenue: dashboardData?.total_revenue || 0,
          pending_payments: dashboardData?.pending_payments || 0,
          overdue_amount: dashboardData?.overdue_amount || 0,
          total_bills: dashboardData?.total_bills || transformedBills.length || 0,
          paid_bills: dashboardData?.paid_bills || 0,
          pending_bills: dashboardData?.pending_bills || 0,
          overdue_bills: dashboardData?.overdue_bills || 0,
          total_amount: dashboardData?.total_revenue || 0,
          paid_amount: dashboardData?.total_revenue || 0,
          pending_amount: dashboardData?.pending_payments || 0
        });
        setError(null);
      } catch (apiError) {
        setBills([]);
        setDashboardData({
          total_revenue: 0,
          pending_payments: 0,
          overdue_amount: 0,
          total_bills: 0,
          paid_bills: 0,
          pending_bills: 0,
          overdue_bills: 0,
          total_amount: 0,
          paid_amount: 0,
          pending_amount: 0
        });
        setError(null);
      }
    } catch (err) {
      setError('Failed to load bills data');
    } finally {
      setLoading(false);
    }
  };


  const openAddBillModal = async () => {
    setAddError(null);
    setShowAddBill(true);
    try {
      if (tenants.length === 0) {
        const data = await apiService.getTenants();
        setTenants(data);
      }
    } catch (e) {
      setAddError('Failed to load tenants');
    }
  };

  const closeAddBillModal = () => {
    setShowAddBill(false);
    setForm({
      tenant_id: 0,
      bill_type: '',
      amount: '',
      due_date: '',
      description: '',
      priority_level: 'Medium',
      payment_method: '',
      late_fee_amount: '',
      is_recurring: false,
      recurring_frequency: '',
      bill_category: '',
      reference_number: '',
      reminder_days: 3,
      send_email_reminder: true,
    });
    setSaving(false);
    setAddError(null);
  };

  const closeEditBillModal = () => {
    setShowEditBill(false);
    setSelectedBill(null);
    setForm({
      tenant_id: 0,
      bill_type: '',
      amount: '',
      due_date: '',
      description: '',
      priority_level: 'Medium',
      payment_method: '',
      late_fee_amount: '',
      is_recurring: false,
      recurring_frequency: '',
      bill_category: '',
      reference_number: '',
      reminder_days: 3,
      send_email_reminder: true,
    });
    setSaving(false);
    setAddError(null);
  };

  const handleEditBill = async (bill) => {
    setAddError(null);
    setSelectedBill(bill);
    
    // Populate form with bill data
    const fullBill = bill._fullData || bill;
    setForm({
      tenant_id: bill.tenant_id || 0,
      bill_type: bill.bill_type || '',
      amount: bill.amount || '',
      due_date: bill.due_date ? (bill.due_date.includes('T') ? bill.due_date.split('T')[0] : bill.due_date) : '',
      description: bill.description || fullBill.description || '',
      priority_level: 'Medium',
      payment_method: '',
      late_fee_amount: '',
      is_recurring: fullBill.is_recurring || false,
      recurring_frequency: fullBill.recurring_frequency || '',
      bill_category: '',
      reference_number: fullBill.notes || '',
      reminder_days: 3,
      send_email_reminder: true,
    });
    
    // Load tenants if not already loaded
    try {
      if (tenants.length === 0) {
        const data = await apiService.getTenants();
        setTenants(data);
      }
    } catch (e) {
      // Silently handle tenant loading error
    }
    
    setShowEditBill(true);
  };

  const handleUpdateBill = async () => {
    setAddError(null);
    if (!selectedBill || !form.tenant_id || !form.bill_type || !form.amount || !form.due_date) {
      setAddError('Please fill in all required fields');
      return;
    }

    const amountNumber = Number(form.amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setAddError('Amount must be a positive number');
      return;
    }

    try {
      setSaving(true);
      
      // Format due_date (backend expects YYYY-MM-DD)
      const dueDateStr = form.due_date.includes('T') 
        ? form.due_date.split('T')[0] 
        : form.due_date;
      
      // Map bill_type to backend enum values (handle both frontend labels and backend values)
      const billTypeMap = {
        'Housing': 'rent',
        'Electricity': 'utilities',
        'Water': 'utilities',
        'Internet': 'utilities',
        'Maintenance': 'maintenance',
        'Parking': 'parking',
        'Other': 'other'
      };
      
      // If it's already a backend value (rent, utilities, etc.), use it directly
      // Otherwise, map from frontend label to backend value
      const backendBillType = billTypeMap[form.bill_type] || form.bill_type.toLowerCase();
      
      // Create title from bill type if not provided
      // Map backend value to display name for title
      const billTypeDisplayMap = {
        'rent': 'Rent',
        'utilities': 'Utilities',
        'maintenance': 'Maintenance',
        'parking': 'Parking',
        'other': 'Other'
      };
      const displayBillType = billTypeDisplayMap[backendBillType] || backendBillType.charAt(0).toUpperCase() + backendBillType.slice(1);
      const title = form.description 
        ? `${displayBillType} - ${form.description.substring(0, 50)}`
        : `${displayBillType} Bill`;
      
      await apiService.updateBill(selectedBill.id, {
        tenant_id: form.tenant_id,
        bill_type: backendBillType,
        title: title,
        amount: amountNumber,
        due_date: dueDateStr,
        description: form.description || '',
        is_recurring: form.is_recurring || false,
        recurring_frequency: form.recurring_frequency || null,
        notes: form.reference_number ? `Reference: ${form.reference_number}` : ''
      });
      
      closeEditBillModal();
      await fetchBillsData();
    } catch (e) {
      setAddError(e?.message || e?.error || 'Failed to update bill. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBill = async (bill) => {
    if (!confirm(`Are you sure you want to delete this bill? This action cannot be undone.\n\nBill: ${bill.bill_number || `#${bill.id}`}\nAmount: ₱${(bill.amount || 0).toLocaleString()}`)) {
      return;
    }
    
    try {
      setLoading(true);
      await apiService.deleteBill(bill.id);
      await fetchBillsData();
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to delete bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBill = async () => {
    setAddError(null);
    if (!form.tenant_id || !form.bill_type || !form.amount || !form.due_date) {
      setAddError('Please fill in all required fields');
      return;
    }

    const amountNumber = Number(form.amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setAddError('Amount must be a positive number');
      return;
    }

    try {
      setSaving(true);
      
      // Format due_date (backend expects YYYY-MM-DD)
      const dueDateStr = form.due_date.includes('T') 
        ? form.due_date.split('T')[0] 
        : form.due_date;
      
      // Map bill_type to backend enum values
      const billTypeMap = {
        'Housing': 'rent',
        'Electricity': 'utilities',
        'Water': 'utilities',
        'Internet': 'utilities',
        'Maintenance': 'maintenance',
        'Parking': 'parking',
        'Other': 'other'
      };
      
      const backendBillType = billTypeMap[form.bill_type] || form.bill_type.toLowerCase();
      
      // Create title from bill type if not provided
      const title = form.description 
        ? `${form.bill_type} - ${form.description.substring(0, 50)}`
        : `${form.bill_type} Bill`;
      
      await apiService.createBill({
        tenant_id: form.tenant_id,
        bill_type: backendBillType,
        title: title,
        amount: amountNumber,
        due_date: dueDateStr,
        description: form.description || '',
        is_recurring: form.is_recurring || false,
        recurring_frequency: form.recurring_frequency || null,
        notes: form.reference_number ? `Reference: ${form.reference_number}` : ''
      });
      
      closeAddBillModal();
      await fetchBillsData();
    } catch (e) {
      setAddError(e?.message || e?.error || 'Failed to create bill. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'paid': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'overdue': return 'text-red-600';
      case 'partial': return 'text-blue-600';
      case 'cancelled': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusDotColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'paid': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'overdue': return 'bg-red-500';
      case 'partial': return 'bg-blue-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };
  
  const formatStatus = (status) => {
    if (!status) return 'Pending';
    const statusLower = status.toLowerCase();
    return statusLower.charAt(0).toUpperCase() + statusLower.slice(1);
  };

  const filteredBills = bills.filter(bill => {
    const billStatusLower = (bill.status || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = !searchTerm || 
                         (bill.tenant_name || '').toLowerCase().includes(searchLower) ||
                         (bill.property_name || '').toLowerCase().includes(searchLower) ||
                         (bill.bill_type || '').toLowerCase().includes(searchLower) ||
                         (bill.bill_number || '').toLowerCase().includes(searchLower);
    
    const matchesTab = activeTab === 'all' ||
                      (activeTab === 'payment-records' && billStatusLower === 'paid') ||
                      (activeTab === 'overdue' && billStatusLower === 'overdue');
    
    const matchesProperty = selectedProperty === 'all' || bill.property_name === selectedProperty;
    const matchesStatus = selectedStatus === 'all' || billStatusLower === selectedStatus.toLowerCase();
    const matchesBillType = selectedBillType === 'all' || bill.bill_type === selectedBillType;
    
    return matchesSearch && matchesTab && matchesProperty && matchesStatus && matchesBillType;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBills = filteredBills.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading bills...</span>
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
            onClick={fetchBillsData}
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Bills & Payments</h1>
              <p className="text-gray-600">Manage community billing and track payments efficiently</p>
            </div>
            <button
              onClick={openAddBillModal}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Add Bill</span>
            </button>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₱{dashboardData?.total_revenue?.toLocaleString() || '0'}</p>
                  <p className="text-xs text-gray-500 mt-1">all time</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Pending Payments</p>
                  <p className="text-2xl font-bold text-amber-600">₱{dashboardData?.pending_payments?.toLocaleString() || '0'}</p>
                  <p className="text-xs text-gray-500 mt-1">awaiting payment</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Overdue Amount</p>
                  <p className="text-2xl font-bold text-red-600">₱{dashboardData?.overdue_amount?.toLocaleString() || '0'}</p>
                  <p className="text-xs text-gray-500 mt-1">past due date</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Bills</p>
                  <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
                  <p className="text-xs text-gray-500 mt-1">all bills</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  All Bills
                </button>
                <button
                  onClick={() => setActiveTab('payment-records')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'payment-records' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Payment Records
                </button>
                <button
                  onClick={() => setActiveTab('overdue')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'overdue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Overdue
                </button>
              </div>

            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mt-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tenant, unit, or bill type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Properties</option>
                <option value="Building A">Building A</option>
                <option value="Building B">Building B</option>
                <option value="Building C">Building C</option>
                <option value="Building D">Building D</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="partial">Partial</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={selectedBillType}
                onChange={(e) => setSelectedBillType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Bill Types</option>
                <option value="rent">Rent</option>
                <option value="utilities">Utilities</option>
                <option value="maintenance">Maintenance</option>
                <option value="parking">Parking</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Bills Management</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{paginatedBills.length} of {bills.length} bills</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TENANT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UNIT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BILL TYPE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AMOUNT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DUE DATE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{bill.tenant_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <div className="text-sm font-medium text-gray-900">
                            {bill.unit_name || bill.unit_number || bill.room_number || (bill.unit_id ? `Unit ${bill.unit_id}` : 'Unassigned')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900 capitalize">{bill.bill_type || 'other'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-semibold text-gray-900">₱{(bill.amount || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusDotColor(bill.status)}`}></div>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full text-xs ${getStatusColor(bill.status)}`}>
                            {formatStatus(bill.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedBill(bill);
                              setShowBillDetails(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {bill.payments && bill.payments.length > 0 && (
                            <button
                              onClick={() => {
                                // If there's only one payment, show it directly; otherwise show first payment
                                const firstPayment = bill.payments[0];
                                setSelectedPayment(firstPayment);
                                setShowPaymentProof(true);
                              }}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="View payment proof"
                            >
                              <FileCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleEditBill(bill)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit bill"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteBill(bill)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete bill"
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
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredBills.length)} of {filteredBills.length} results
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Edit Bill Modal */}
      {showEditBill && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit Bill</h2>
              <button
                onClick={closeEditBillModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">
                {addError}
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Basic Information Section */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
                    <select
                      value={form.tenant_id}
                      onChange={(e) => setForm({ ...form, tenant_id: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={0}>Select Tenant</option>
                      {tenants.map(t => {
                        const firstName = t.user?.first_name || '';
                        const lastName = t.user?.last_name || '';
                        const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Tenant';
                        
                        // Get unit name from various sources
                        const currentRent = t.current_rent;
                        const unitFromRent = currentRent?.unit;
                        const unitName = unitFromRent?.unit_name || 
                                        unitFromRent?.unit_number ||
                                        unitFromRent?.name ||
                                        t?.unit?.unit_name || 
                                        t?.unit?.unit_number || 
                                        t?.room_number || 
                                        t?.assigned_room || 
                                        null;
                        const unitDisplay = unitName && unitName !== 'N/A' ? ` - ${unitName}` : '';
                        
                        return (
                          <option key={t.id} value={t.id}>
                            {fullName}{unitDisplay}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bill Type *</label>
                    <select
                      value={form.bill_type}
                      onChange={(e) => setForm({ ...form, bill_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Bill Type</option>
                      <option value="rent">Rent</option>
                      <option value="utilities">Utilities</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="parking">Parking</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional details about this bill..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Advanced Settings Section */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Advanced Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
                    <select
                      value={form.priority_level}
                      onChange={(e) => setForm({ ...form, priority_level: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Payment Method</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Check">Check</option>
                      <option value="Online Payment">Online Payment</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee Amount</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.late_fee_amount}
                      onChange={(e) => setForm({ ...form, late_fee_amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                    <input
                      type="text"
                      value={form.reference_number}
                      onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., INV-2024-001"
                    />
                  </div>
                </div>
              </div>

              {/* Recurring Bill Section */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Repeat className="w-4 h-4 mr-2" />
                  Recurring Bill Settings
                </h3>
                
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="is_recurring_edit"
                    checked={form.is_recurring}
                    onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_recurring_edit" className="text-sm font-medium text-gray-700">
                    This is a recurring bill
                  </label>
                </div>

                {form.is_recurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Frequency</label>
                    <select
                      value={form.recurring_frequency}
                      onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Frequency</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Notification Settings Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Notification Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Days Before Due</label>
                    <select
                      value={form.reminder_days}
                      onChange={(e) => setForm({ ...form, reminder_days: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="send_email_reminder_edit"
                      checked={form.send_email_reminder}
                      onChange={(e) => setForm({ ...form, send_email_reminder: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="send_email_reminder_edit" className="text-sm font-medium text-gray-700 flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      Send email reminder
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeEditBillModal}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBill}
                disabled={saving}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bill Modal */}
      {showAddBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add New Bill</h2>
              <button
                onClick={closeAddBillModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">
                {addError}
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Basic Information Section */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
                    <select
                      value={form.tenant_id}
                      onChange={(e) => setForm({ ...form, tenant_id: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={0}>Select Tenant</option>
                      {tenants.map(t => {
                        const firstName = t.user?.first_name || '';
                        const lastName = t.user?.last_name || '';
                        const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Tenant';
                        
                        // Get unit name from various sources
                        const currentRent = t.current_rent;
                        const unitFromRent = currentRent?.unit;
                        const unitName = unitFromRent?.unit_name || 
                                        unitFromRent?.unit_number ||
                                        unitFromRent?.name ||
                                        t?.unit?.unit_name || 
                                        t?.unit?.unit_number || 
                                        t?.room_number || 
                                        t?.assigned_room || 
                                        null;
                        const unitDisplay = unitName && unitName !== 'N/A' ? ` - ${unitName}` : '';
                        
                        return (
                          <option key={t.id} value={t.id}>
                            {fullName}{unitDisplay}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bill Type *</label>
                    <select
                      value={form.bill_type}
                      onChange={(e) => setForm({ ...form, bill_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Bill Type</option>
                      <option value="rent">Rent</option>
                      <option value="utilities">Utilities</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="parking">Parking</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional details about this bill..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Advanced Settings Section */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Advanced Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
                    <select
                      value={form.priority_level}
                      onChange={(e) => setForm({ ...form, priority_level: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee Amount</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.late_fee_amount}
                      onChange={(e) => setForm({ ...form, late_fee_amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Recurring Bill Section */}
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Repeat className="w-4 h-4 mr-2" />
                  Recurring Bill Settings
                </h3>
                
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    checked={form.is_recurring}
                    onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700">
                    This is a recurring bill
                  </label>
                </div>

                {form.is_recurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Frequency</label>
                    <select
                      value={form.recurring_frequency}
                      onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Frequency</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Notification Settings Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Notification Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Days Before Due</label>
                    <select
                      value={form.reminder_days}
                      onChange={(e) => setForm({ ...form, reminder_days: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="send_email_reminder"
                      checked={form.send_email_reminder}
                      onChange={(e) => setForm({ ...form, send_email_reminder: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="send_email_reminder" className="text-sm font-medium text-gray-700 flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      Send email reminder
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeAddBillModal}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBill}
                disabled={saving}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Details Modal */}
      {showBillDetails && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Bill Details</h2>
              <button
                onClick={() => {
                  setShowBillDetails(false);
                  setSelectedBill(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Bill Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Bill Number</h3>
                  <p className="text-lg font-semibold text-gray-900">{selectedBill.bill_number || `#${selectedBill.id}`}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Bill Type</h3>
                  <p className="text-lg font-semibold text-gray-900 capitalize">{selectedBill.bill_type || 'Other'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tenant</h3>
                  <p className="text-lg font-semibold text-gray-900">{selectedBill.tenant_name || 'Unknown Tenant'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Unit</h3>
                  <p className="text-lg font-semibold text-gray-900">{selectedBill.property_name} - Unit {selectedBill.room_number}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Amount</h3>
                  <p className="text-lg font-semibold text-gray-900">₱{(selectedBill.amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Amount Due</h3>
                  <p className="text-lg font-semibold text-red-600">₱{(selectedBill.amount_due || 0).toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Due Date</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedBill.due_date ? new Date(selectedBill.due_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedBill.status)}`}>
                    {formatStatus(selectedBill.status)}
                  </span>
                </div>
              </div>

              {selectedBill.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                  <p className="text-gray-900">{selectedBill.description}</p>
                </div>
              )}

              {/* Payments Section */}
              {selectedBill.payments && selectedBill.payments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
                  <div className="space-y-3">
                    {selectedBill.payments.map((payment) => (
                      <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${
                              payment.status === 'approved' || payment.status === 'completed' ? 'bg-green-500' :
                              payment.status === 'rejected' ? 'bg-red-500' :
                              payment.status === 'pending_approval' ? 'bg-yellow-500' :
                              'bg-gray-400'
                            }`}></div>
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {payment.status?.replace('_', ' ') || 'Unknown'}
                            </span>
                          </div>
                          <span className="text-lg font-semibold text-gray-900">₱{parseFloat(payment.amount || 0).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500">Payment Method:</span>
                            <span className="ml-2 text-gray-900 capitalize">{payment.payment_method || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <span className="ml-2 text-gray-900">
                              {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          {payment.reference_number && (
                            <div>
                              <span className="text-gray-500">Reference:</span>
                              <span className="ml-2 text-gray-900">{payment.reference_number}</span>
                            </div>
                          )}
                          {payment.proof_of_payment && (
                            <div>
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setShowBillDetails(false); // Close bill details modal
                                  setShowPaymentProof(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                              >
                                <FileCheck className="w-4 h-4" />
                                <span>View Proof</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Modal */}
      {showPaymentProof && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Payment Proof</h2>
              <button
                onClick={() => {
                  setShowPaymentProof(false);
                  setSelectedPayment(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Single Payment Proof */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Amount</h3>
                    <p className="text-lg font-semibold text-gray-900">₱{parseFloat(selectedPayment.amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedPayment.status === 'approved' || selectedPayment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      selectedPayment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      selectedPayment.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedPayment.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Method</h3>
                    <p className="text-gray-900 capitalize">{selectedPayment.payment_method || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
                    <p className="text-gray-900">
                      {selectedPayment.payment_date ? new Date(selectedPayment.payment_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  {selectedPayment.reference_number && (
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Reference Number</h3>
                      <p className="text-gray-900">{selectedPayment.reference_number}</p>
                    </div>
                  )}
                  {selectedPayment.remarks && (
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Remarks</h3>
                      <p className="text-gray-900">{selectedPayment.remarks}</p>
                    </div>
                  )}
                </div>

                {/* Proof of Payment Image - Only show once */}
                {selectedPayment.proof_of_payment && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Proof of Payment</h3>
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      {selectedPayment.proof_of_payment.startsWith('data:image') || selectedPayment.proof_of_payment.startsWith('http') || selectedPayment.proof_of_payment.startsWith('/') ? (
                        <div className="relative">
                          <img
                            src={selectedPayment.proof_of_payment}
                            alt="Proof of Payment"
                            className="max-w-full h-auto rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open image in new tab/window
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                newWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Proof of Payment</title>
                                      <style>
                                        body {
                                          margin: 0;
                                          padding: 20px;
                                          display: flex;
                                          justify-content: center;
                                          align-items: center;
                                          min-height: 100vh;
                                          background-color: #f3f4f6;
                                        }
                                        img {
                                          max-width: 100%;
                                          max-height: 90vh;
                                          border-radius: 8px;
                                          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <img src="${selectedPayment.proof_of_payment}" alt="Proof of Payment" />
                                    </body>
                                  </html>
                                `);
                                newWindow.document.close();
                              }
                            }}
                          />
                          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                            Click to enlarge
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600 mb-2">Proof of payment available</p>
                          <a
                            href={selectedPayment.proof_of_payment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center justify-center space-x-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Open File</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Approval Actions (only if pending) */}
                {selectedPayment.status === 'pending_approval' && (
                  <div className="flex space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        try {
                          await apiService.makeRequest(`/billing/payments/${selectedPayment.id}/approve`, {
                            method: 'POST',
                            baseURL: apiService.propertyBaseURL
                          });
                          await fetchBillsData();
                          setShowPaymentProof(false);
                          setSelectedPayment(null);
                        } catch (error) {
                          alert('Failed to approve payment. Please try again.');
                        }
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Approve Payment</span>
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt('Please provide a reason for rejection:');
                        if (reason) {
                          try {
                            await apiService.makeRequest(`/billing/payments/${selectedPayment.id}/reject`, {
                              method: 'POST',
                              body: JSON.stringify({ rejection_reason: reason }),
                              baseURL: apiService.propertyBaseURL
                            });
                            await fetchBillsData();
                            setShowPaymentProof(false);
                            setSelectedPayment(null);
                          } catch (error) {
                            alert('Failed to reject payment. Please try again.');
                          }
                        }
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Reject Payment</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsPage;
