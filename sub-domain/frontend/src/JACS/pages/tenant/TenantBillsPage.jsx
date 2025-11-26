import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Receipt, Calendar, AlertCircle, Eye, X, CreditCard, TrendingUp, Filter, Search, Download, MoreVertical, CheckCircle, Clock, AlertTriangle, Upload, FileText } from 'lucide-react';
import { apiService } from '../../../services/api';
import Header from '../../components/Header';

const TenantBillsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bills, setBills] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash',
    reference_number: '',
    proof_of_payment: '',
    remarks: ''
  });
  const [paymentError, setPaymentError] = useState(null);

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
              // Fetch bills for this tenant - correct API call signature
              const billsData = await apiService.getBills(myTenant.id);
              setBills(Array.isArray(billsData) ? billsData : []);
            } catch (billsErr) {
              console.warn('Bills not available:', billsErr);
              setBills([]);
            }
          } else {
            setTenant(null);
            setBills([]);
          }
        } catch (tenantErr) {
          console.warn('No tenant record found:', tenantErr);
          setTenant(null);
          setBills([]);
        }
      } catch (err) {
        console.error('Failed to load bills:', err);
        setError('Failed to load bills. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your bills...</span>
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

  // Helper function to normalize status (backend uses lowercase, frontend may use capitalized)
  const normalizeStatus = (status) => {
    if (!status) return 'pending';
    const statusLower = status.toLowerCase();
    // Map backend statuses to display format
    if (statusLower === 'paid') return 'paid';
    if (statusLower === 'overdue') return 'overdue';
    if (statusLower === 'pending') return 'pending';
    if (statusLower === 'partial') return 'pending'; // Treat partial as pending for display
    return statusLower;
  };

  const getStatusColor = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-amber-600 bg-amber-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Calculate total due using amount_due (remaining balance) not full amount
  const totalDue = bills
    .filter(b => normalizeStatus(b.status) !== 'paid')
    .reduce((sum, bill) => sum + (bill.amount_due || bill.amount || 0), 0);
  const overdueCount = bills.filter(b => normalizeStatus(b.status) === 'overdue').length;

  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setShowBillDetails(true);
    setShowPaymentForm(false);
    // Initialize payment form with amount_due as default
    const amountDue = bill.amount_due !== undefined ? bill.amount_due : (bill.amount || 0);
    setPaymentForm({
      amount: amountDue.toString(),
      payment_method: 'cash',
      reference_number: '',
      proof_of_payment: '',
      remarks: ''
    });
    setPaymentError(null);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBill) return;

    if (!paymentForm.proof_of_payment) {
      setPaymentError('Proof of payment is required');
      return;
    }

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setPaymentError('Please enter a valid payment amount');
      return;
    }

    try {
      setSubmittingPayment(true);
      setPaymentError(null);

      await apiService.submitPaymentProof(selectedBill.id, {
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number || undefined,
        proof_of_payment: paymentForm.proof_of_payment,
        remarks: paymentForm.remarks || undefined
      });

      // Reload bills after successful submission
      const myTenant = await apiService.getMyTenant();
      if (myTenant) {
        const billsData = await apiService.getBills(myTenant.id);
        setBills(Array.isArray(billsData) ? billsData : []);
      }

      alert('Payment proof submitted successfully! Waiting for manager approval.');
      setShowBillDetails(false);
      setShowPaymentForm(false);
    } catch (err) {
      console.error('Failed to submit payment:', err);
      setPaymentError(err.message || 'Failed to submit payment proof. Please try again.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleProofUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentForm({ ...paymentForm, proof_of_payment: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter bills based on search and status
  const filteredBills = bills.filter(bill => {
    const billType = bill.bill_type || '';
    const description = bill.description || '';
    const title = bill.title || '';
    const matchesSearch = billType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         title.toLowerCase().includes(searchTerm.toLowerCase());
    const billStatus = normalizeStatus(bill.status);
    const matchesStatus = statusFilter === 'all' || billStatus === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusDisplay = (status) => {
    const normalized = normalizeStatus(status);
    // Capitalize first letter for display
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="tenant" />
      
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bills</h1>
              <p className="text-gray-600">Manage your payments and billing information</p>
            </div>
            {overdueCount > 0 && (
              <div className="flex items-center space-x-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg border border-red-200">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{overdueCount} overdue bill{overdueCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* No Tenant Record Message removed for frontend-only demo */}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Due</p>
                  <p className="text-2xl font-bold text-gray-900">₱{totalDue.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">unpaid amount</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <CreditCard className="w-6 h-6 text-red-600" />
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
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Paid Bills</p>
                  <p className="text-2xl font-bold text-green-600">{bills.filter(b => normalizeStatus(b.status) === 'paid').length}</p>
                  <p className="text-xs text-gray-500 mt-1">completed</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                  <p className="text-xs text-gray-500 mt-1">urgent payments</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search bills..."
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
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          {/* Bills List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Bill History</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{filteredBills.length} of {bills.length} bills</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredBills.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No bills found</p>
                  <p className="text-sm">Your bills will appear here once they are generated</p>
                </div>
              ) : (
                filteredBills.map((bill) => (
                  <div key={bill.id} className="px-6 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${normalizeStatus(bill.status) === 'paid' ? 'bg-green-50' : normalizeStatus(bill.status) === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
                          {getStatusIcon(bill.status)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{bill.title || bill.bill_type || 'Bill'}</h3>
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                              {getStatusDisplay(bill.status)}
                            </span>
                            {bill.bill_number && (
                              <span className="text-xs text-gray-500">#{bill.bill_number}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due: {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : 'N/A'}</span>
                            </div>
                            {bill.description && (
                              <span className="truncate max-w-xs">{bill.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">₱{(bill.amount_due || bill.amount || 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-500">
                            {bill.amount_due !== undefined && bill.amount_due !== bill.amount ? 'Amount Due' : 'Amount'}
                            {bill.amount_paid > 0 && (
                              <span className="block text-green-600">Paid: ₱{bill.amount_paid.toLocaleString()}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewBill(bill)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bill Details Modal */}
          {showBillDetails && selectedBill && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl my-8 max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 capitalize">
                      {selectedBill.title || selectedBill.bill_type || 'Bill'} Details
                    </h2>
                    <button
                      onClick={() => {
                        setShowBillDetails(false);
                        setShowPaymentForm(false);
                        setPaymentError(null);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${normalizeStatus(selectedBill.status) === 'paid' ? 'bg-green-50' : normalizeStatus(selectedBill.status) === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
                      {getStatusIcon(selectedBill.status)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{selectedBill.title || selectedBill.bill_type || 'Bill'}</h3>
                      <p className="text-sm text-gray-500">Bill #{selectedBill.bill_number || selectedBill.id}</p>
                      <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full mt-2 ${getStatusColor(selectedBill.status)}`}>
                        {getStatusDisplay(selectedBill.status)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Total Amount</span>
                      <span className="text-2xl font-bold text-gray-900">₱{(selectedBill.amount || 0).toLocaleString()}</span>
                    </div>
                    {selectedBill.amount_paid > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Amount Paid</span>
                        <span className="text-lg font-semibold text-green-600">₱{(selectedBill.amount_paid || 0).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                      <span className="text-gray-600 font-medium">Amount Due</span>
                      <span className="text-xl font-bold text-red-600">₱{(selectedBill.amount_due || selectedBill.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Due Date</span>
                      <span className="text-gray-900 font-medium">{selectedBill.due_date ? new Date(selectedBill.due_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Bill Type</span>
                      <span className="text-gray-900 font-medium capitalize">{selectedBill.bill_type || 'Other'}</span>
                    </div>
                    {selectedBill.created_at && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Created</span>
                        <span className="text-gray-900">{new Date(selectedBill.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  {selectedBill.description && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-700 text-sm">{selectedBill.description}</p>
                    </div>
                  )}

                  {/* Payment Form */}
                  {!showPaymentForm && normalizeStatus(selectedBill.status) !== 'paid' && (selectedBill.amount_due || selectedBill.amount) > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-sm text-yellow-800 mb-3">
                        {normalizeStatus(selectedBill.status) === 'overdue' 
                          ? '⚠️ This bill is overdue. Please submit payment proof immediately.'
                          : 'Submit payment proof for manager approval.'}
                      </p>
                      <button
                        onClick={() => setShowPaymentForm(true)}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Submit Payment Proof</span>
                      </button>
                    </div>
                  )}

                  {showPaymentForm && (
                    <div className="bg-white border-2 border-blue-200 rounded-xl p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment Details</h4>
                      
                      {paymentError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                          {paymentError}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Payment Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={selectedBill.amount_due || selectedBill.amount}
                            value={paymentForm.amount}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow empty or valid number
                              if (val === '' || (!isNaN(val) && parseFloat(val) >= 0)) {
                                setPaymentForm({ ...paymentForm, amount: val });
                              }
                            }}
                            className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Maximum: ₱{(selectedBill.amount_due || selectedBill.amount || 0).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Payment Method <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={paymentForm.payment_method}
                          onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="cash">Cash</option>
                          <option value="gcash">GCash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="check">Check</option>
                        </select>
                      </div>

                      {(paymentForm.payment_method === 'gcash' || paymentForm.payment_method === 'bank_transfer') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                          <input
                            type="text"
                            value={paymentForm.reference_number}
                            onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter transaction/reference number"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Proof of Payment <span className="text-red-500">*</span>
                        </label>
                        <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                          paymentForm.proof_of_payment 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}>
                          {paymentForm.proof_of_payment ? (
                            <div className="space-y-2">
                              <FileText className="w-8 h-8 mx-auto text-green-600" />
                              <p className="text-sm font-medium text-green-700">Proof of payment uploaded</p>
                              <p className="text-xs text-gray-500">File ready for submission</p>
                              <button
                                type="button"
                                onClick={() => setPaymentForm({ ...paymentForm, proof_of_payment: '' })}
                                className="text-xs text-red-600 hover:text-red-700 font-medium underline"
                              >
                                Remove file
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                              <label className="cursor-pointer block">
                                <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">Click to upload</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={handleProofUpload}
                                  className="hidden"
                                  required
                                />
                              </label>
                              <p className="text-xs text-gray-500 mt-1">Upload screenshot or receipt (Image or PDF)</p>
                              <p className="text-xs text-gray-400 mt-1">Max file size: 5MB</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                        <textarea
                          value={paymentForm.remarks}
                          onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Add any notes or remarks..."
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="px-6 py-4 border-t border-gray-100 flex space-x-3 flex-shrink-0 bg-white">
                  {showPaymentForm ? (
                    <>
                      <button
                        onClick={() => {
                          setShowPaymentForm(false);
                          setPaymentError(null);
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                        disabled={submittingPayment}
                      >
                        Back
                      </button>
                      <button
                        onClick={handlePaymentSubmit}
                        disabled={submittingPayment || !paymentForm.proof_of_payment}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {submittingPayment ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <span>Submit Payment Proof</span>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowBillDetails(false)}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                      >
                        Close
                      </button>
                      {normalizeStatus(selectedBill.status) !== 'paid' && (selectedBill.amount_due || selectedBill.amount) > 0 && (
                        <button
                          onClick={() => setShowPaymentForm(true)}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                        >
                          Submit Payment
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantBillsPage;
