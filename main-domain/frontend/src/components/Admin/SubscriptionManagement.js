import React, { useState, useEffect, useMemo } from 'react';
import ApiService from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';

const SubscriptionManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Data states
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionStats, setSubscriptionStats] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [billingHistory, setBillingHistory] = useState([]);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProof, setSelectedProof] = useState(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showAddBillingModal, setShowAddBillingModal] = useState(false);
  const [showViewSubscriberModal, setShowViewSubscriberModal] = useState(false);
  const [showEditSubscriberModal, setShowEditSubscriberModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedSubscriber, setSelectedSubscriber] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  // Form states
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    monthly_price: '',
    yearly_price: '',
    max_properties: '',
    analytics_enabled: false,
    staff_management_enabled: false,
    subdomain_access: false,
    priority_support: false,
    api_access: false,
    advanced_reporting: false,
    is_active: true,
    trial_days: 0
  });

  // Billing form state
  const [billingForm, setBillingForm] = useState({
    customer_name: '',
    email: '',
    plan_name: '',
    amount: '',
    billing_date: '',
    payment_method: 'Credit Card',
    status: 'pending',
    invoice_number: ''
  });

  // Load subscription plans and data
  useEffect(() => {
    fetchSubscriptionPlans();
    fetchSubscriptionStats();
    fetchBillingHistory(); // Load billing history for revenue chart
  }, []);

  const fetchSubscriptionPlans = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await ApiService.getAdminSubscriptionPlans();
      const plans = response.data || response || [];
      
      // Calculate subscriber count for each plan if subscribers are loaded
      const plansWithCounts = plans.map(plan => {
        if (subscribers.length > 0) {
          const planSubscribers = subscribers.filter(sub => {
            const subPlanName = sub.subscription?.plan_name || '';
            return subPlanName === plan.name || subPlanName.toLowerCase() === plan.name.toLowerCase();
          });
          return {
            ...plan,
            subscriber_count: planSubscribers.length,
            active_subscriber_count: planSubscribers.filter(sub => {
              const status = (sub.subscription?.status || '').toLowerCase();
              return status === 'active';
            }).length
          };
        }
        return {
          ...plan,
          subscriber_count: 0,
          active_subscriber_count: 0
        };
      });
      
      setSubscriptionPlans(plansWithCounts);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      setError('Failed to load subscription plans');
      setSubscriptionPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionStats = async () => {
    try {
      setError('');
      const response = await ApiService.getAdminSubscriptionStats();
      const stats = response.data || response || {};
      
      // Calculate change percentages (compare with previous period - simplified)
      const totalSubscribers = stats.total_subscribers || 0;
      const activeSubscriptions = stats.active_subscriptions || 0;
      const monthlyRevenue = stats.monthly_revenue || 0;
      const pendingRenewals = stats.pending_renewals || 0;
      
      setSubscriptionStats([
        { title: 'Total Subscribers', value: String(totalSubscribers), change: '+0%', icon: 'users', color: 'text-black' },
        { title: 'Active Subscriptions', value: String(activeSubscriptions), change: '+0%', icon: 'check', color: 'text-black' },
        { title: 'Monthly Revenue', value: `₱${Number(monthlyRevenue).toLocaleString()}`, change: '+0%', icon: 'money', color: 'text-black' },
        { title: 'Pending Renewals', value: String(pendingRenewals), change: '+0%', icon: 'clock', color: 'text-black' }
      ]);
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
      // Set default stats on error
      setSubscriptionStats([
        { title: 'Total Subscribers', value: '0', change: '+0%', icon: 'users', color: 'text-black' },
        { title: 'Active Subscriptions', value: '0', change: '+0%', icon: 'check', color: 'text-black' },
        { title: 'Monthly Revenue', value: '₱0', change: '+0%', icon: 'money', color: 'text-black' },
        { title: 'Pending Renewals', value: '0', change: '+0%', icon: 'clock', color: 'text-black' }
      ]);
    }
  };

  // Fetch functions for new tabs
  const fetchSubscribers = async () => {
    try {
      setError('');
      const response = await ApiService.getAdminSubscribers();
      const subs = response.data || response || [];
      setSubscribers(Array.isArray(subs) ? subs : []);
      
      // Refresh plans to update subscriber counts
      if (subscriptionPlans.length > 0) {
        fetchSubscriptionPlans();
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      setSubscribers([]);
    }
  };

  const fetchBillingHistory = async (enrichWithTransactions = true) => {
    try {
      setError('');
      setLoading(true);
      const response = await ApiService.getAdminBillingHistory();
      const bills = response.data || response || [];
      
      // Enrich billing history with payment transaction data
      // Payment transactions contain the actual payment method used by the user
      let enrichedBills = Array.isArray(bills) ? bills : [];
      
      if (enrichWithTransactions && paymentTransactions.length > 0) {
        enrichedBills = enrichedBills.map(bill => {
          // Find matching payment transaction for this bill
          // Match by user_id and plan_id, or by subscription_id
          const matchingTransaction = paymentTransactions.find(pt => 
            (pt.user_id === bill.user_id && pt.plan_id === bill.plan_id) ||
            (pt.subscription_id && bill.subscription_id && pt.subscription_id === bill.subscription_id)
          );
          
          // If a matching payment transaction exists, use its payment method
          if (matchingTransaction && matchingTransaction.payment_method) {
            return {
              ...bill,
              payment_method: matchingTransaction.payment_method,
              // Keep other transaction data for reference
              payment_transaction_id: matchingTransaction.id,
              payment_reference: matchingTransaction.payment_reference || bill.payment_reference
            };
          }
          
          // Otherwise, use the payment method from the bill
          return bill;
        });
      }
      
      // Use the real status from the database - no local state manipulation
      setBillingHistory(enrichedBills);
    } catch (error) {
      console.error('Error fetching billing history:', error);
      setBillingHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentTransactions = async () => {
    try {
      setError('');
      const response = await ApiService.request(API_ENDPOINTS.ADMIN.PAYMENT_TRANSACTIONS);
      const data = response?.data || response || [];
      // Enrich payment transactions with plan and user info
      const enrichedTransactions = Array.isArray(data) ? data.map(pt => {
        // Try to find plan name from subscription plans
        const plan = subscriptionPlans.find(p => p.id === pt.plan_id);
        // Get user email if available
        let customerName = pt.customer_name;
        let userEmail = pt.user_email || pt.email;
        
        return {
          ...pt,
          plan_name: plan?.name || pt.plan_name || `Plan #${pt.plan_id || 'N/A'}`,
          status: pt.payment_status || pt.status || 'Pending',
          customer_name: customerName || userEmail || `User #${pt.user_id || 'N/A'}`,
          user_email: userEmail
        };
      }) : [];
      setPaymentTransactions(enrichedTransactions);
    } catch (e) {
      console.error('Error fetching payment transactions:', e);
      // If backend route isn't available, keep list empty
      setPaymentTransactions([]);
    }
  };


  const approveProof = async (pt) => {
    try {
      setLoading(true);
      setError('');
      const url = API_ENDPOINTS.ADMIN.VERIFY_PAYMENT(pt.id);
      await ApiService.request(url, { 
        method: 'POST', 
        body: JSON.stringify({ status: 'Verified' }) 
      });
      setSuccess('Payment marked as Verified');
      await fetchPaymentTransactions();
      await fetchBillingHistory();
      await fetchSubscriptionStats(); // Refresh stats
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      console.error('Error approving payment:', e);
      setError(e.message || 'Failed to verify payment');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const rejectProof = async (pt) => {
    try {
      setLoading(true);
      setError('');
      const url = API_ENDPOINTS.ADMIN.VERIFY_PAYMENT(pt.id);
      await ApiService.request(url, { 
        method: 'POST', 
        body: JSON.stringify({ status: 'Rejected' }) 
      });
      setSuccess('Payment marked as Rejected');
      await fetchPaymentTransactions();
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      console.error('Error rejecting payment:', e);
      setError(e.message || 'Failed to reject payment');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'subscribers') {
      fetchSubscribers();
    } else if (activeTab === 'billing') {
      // Fetch payment transactions first, then billing history
      const loadBillingData = async () => {
        await fetchPaymentTransactions();
        fetchBillingHistory(true);
      };
      loadBillingData();
    }
  }, [activeTab]);

  // Enrich billing history when payment transactions are loaded or updated
  useEffect(() => {
    if (activeTab === 'billing' && paymentTransactions.length > 0) {
      // Re-enrich billing history with payment transactions
      fetchBillingHistory(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentTransactions.length, activeTab]);

  // Refresh billing history periodically when on billing tab to get real-time status updates
  useEffect(() => {
    if (activeTab === 'billing') {
      const interval = setInterval(() => {
        fetchBillingHistory(true);
        fetchPaymentTransactions();
      }, 10000); // Refresh every 10 seconds when on billing tab

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Refresh payment transactions when plans are loaded (to enrich with plan names)
  useEffect(() => {
    if (activeTab === 'billing' && subscriptionPlans.length > 0) {
      // Only refresh if we have payment transactions but they might need plan names
      if (paymentTransactions.length > 0) {
        const needsRefresh = paymentTransactions.some(pt => !pt.plan_name && pt.plan_id);
        if (needsRefresh) {
          fetchPaymentTransactions();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionPlans.length]);

  // Update plan subscriber counts when subscribers change
  useEffect(() => {
    if (subscribers.length > 0 && subscriptionPlans.length > 0) {
      setSubscriptionPlans(prevPlans => {
        return prevPlans.map(plan => {
          const planSubscribers = subscribers.filter(sub => {
            const subPlanName = sub.subscription?.plan_name || '';
            return subPlanName === plan.name || subPlanName.toLowerCase() === plan.name.toLowerCase();
          });
          return {
            ...plan,
            subscriber_count: planSubscribers.length,
            active_subscriber_count: planSubscribers.filter(sub => {
              const status = (sub.subscription?.status || '').toLowerCase();
              return status === 'active';
            }).length
          };
        });
      });
    }
  }, [subscribers]);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPlanForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBillingInputChange = (e) => {
    const { name, value } = e.target;
    setBillingForm(prev => {
      const updated = {
        ...prev,
        [name]: value
      };
      
      // Auto-fill amount when plan is selected
      if (name === 'plan_name' && value) {
        const selectedPlan = subscriptionPlans.find(p => p.name === value);
        if (selectedPlan && !prev.amount) {
          updated.amount = selectedPlan.monthly_price || '';
        }
      }
      
      return updated;
    });
  };

  const resetForm = () => {
    setPlanForm({
      name: '',
      description: '',
      monthly_price: '',
      yearly_price: '',
      max_properties: '',
      analytics_enabled: false,
      staff_management_enabled: false,
      subdomain_access: false,
      priority_support: false,
      api_access: false,
      advanced_reporting: false,
      is_active: true,
      trial_days: 0
    });
    setSelectedPlan(null);
    setError('');
    setSuccess('');
  };

  const resetBillingForm = () => {
    setBillingForm({
      customer_name: '',
      email: '',
      plan_name: '',
      amount: '',
      billing_date: '',
      payment_method: 'Credit Card',
      status: 'pending',
      invoice_number: ''
    });
    setError('');
    setSuccess('');
  };

  const handleAddBilling = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      // Prepare billing data for API
      const billingData = {
        customer_name: billingForm.customer_name,
        customer_email: billingForm.email,
        plan_name: billingForm.plan_name,
        amount: parseFloat(billingForm.amount),
        due_date: billingForm.billing_date || new Date().toISOString().split('T')[0],
        payment_method: billingForm.payment_method,
        status: billingForm.status,
        bill_type: 'subscription',
        invoice_number: billingForm.invoice_number || undefined,
        notes: `Manually created by admin`
      };
      
      // Call API to create billing entry
      const response = await ApiService.createBillingEntry(billingData);
      
      setSuccess('Billing entry created successfully!');
      setShowAddBillingModal(false);
      resetBillingForm();
      
      // Refresh billing history and stats to get latest data
      await fetchBillingHistory();
      await fetchSubscriptionStats();
      
      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to create billing entry');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (bill) => {
    setSelectedInvoice(bill);
    setShowInvoiceModal(true);
  };

  const handleResendInvoice = async (bill) => {
    if (!window.confirm(`Resend invoice ${bill.invoice_number || `INV-${bill.id}`} to ${bill.email || bill.customer_name || 'customer'}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Call API to resend invoice email
      const url = API_ENDPOINTS.ADMIN.RESEND_INVOICE(bill.id);
      await ApiService.request(url, {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      setSuccess(`Invoice ${bill.invoice_number || `INV-${bill.id}`} resent successfully to ${bill.email || bill.customer_name || 'customer'}!`);
      
      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error resending invoice:', error);
      setError(error.message || 'Failed to resend invoice. The endpoint may not be implemented yet.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Operations
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      // Build sanitized payload matching backend schema
      const payload = {
        name: String(planForm.name || '').trim(),
        description: planForm.description || '',
        // Send prices as strings to avoid float precision / ORM Decimal issues
        monthly_price: (Number.isFinite(parseFloat(planForm.monthly_price)) ? parseFloat(planForm.monthly_price).toFixed(2) : '0.00'),
        max_properties: planForm.max_properties === '' || planForm.max_properties === null ? 0 : parseInt(planForm.max_properties, 10),
        analytics_enabled: !!planForm.analytics_enabled,
        staff_management_enabled: !!planForm.staff_management_enabled,
        subdomain_access: !!planForm.subdomain_access,
        priority_support: !!planForm.priority_support,
        api_access: !!planForm.api_access,
        advanced_reporting: !!planForm.advanced_reporting,
        is_active: !!planForm.is_active,
        trial_days: planForm.trial_days === '' || planForm.trial_days === null ? 0 : parseInt(planForm.trial_days, 10),
      };
      if (planForm.yearly_price !== '' && planForm.yearly_price !== null && planForm.yearly_price !== undefined) {
        payload.yearly_price = (Number.isFinite(parseFloat(planForm.yearly_price)) ? parseFloat(planForm.yearly_price).toFixed(2) : '0.00');
      }
      const response = await ApiService.createSubscriptionPlan(payload);
      
      // If we get here without throwing, it was successful
      setSuccess('Subscription plan created successfully!');
      setShowCreateModal(false);
      resetForm();
      await fetchSubscriptionPlans();
      await fetchSubscriptionStats();
      
      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to create subscription plan');
      // Auto-dismiss error message
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      // Build sanitized payload matching backend schema
      const payload = {
        name: String(planForm.name || '').trim(),
        description: planForm.description || '',
        monthly_price: (Number.isFinite(parseFloat(planForm.monthly_price)) ? parseFloat(planForm.monthly_price).toFixed(2) : '0.00'),
        max_properties: planForm.max_properties === '' || planForm.max_properties === null ? 0 : parseInt(planForm.max_properties, 10),
        analytics_enabled: !!planForm.analytics_enabled,
        staff_management_enabled: !!planForm.staff_management_enabled,
        subdomain_access: !!planForm.subdomain_access,
        priority_support: !!planForm.priority_support,
        api_access: !!planForm.api_access,
        advanced_reporting: !!planForm.advanced_reporting,
        is_active: !!planForm.is_active,
        trial_days: planForm.trial_days === '' || planForm.trial_days === null ? 0 : parseInt(planForm.trial_days, 10),
      };
      if (planForm.yearly_price !== '' && planForm.yearly_price !== null && planForm.yearly_price !== undefined) {
        payload.yearly_price = (Number.isFinite(parseFloat(planForm.yearly_price)) ? parseFloat(planForm.yearly_price).toFixed(2) : '0.00');
      }
      const response = await ApiService.updateSubscriptionPlan(selectedPlan.id, payload);
      
      // If we get here without throwing, it was successful
      setSuccess('Subscription plan updated successfully!');
      setShowEditModal(false);
      resetForm();
      await fetchSubscriptionPlans();
      await fetchSubscriptionStats();
      
      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to update subscription plan');
      // Auto-dismiss error message
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this subscription plan?')) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await ApiService.deleteSubscriptionPlan(planId);
      
      // If we get here without throwing, it was successful
      setSuccess('Subscription plan deleted successfully!');
      await fetchSubscriptionPlans();
      await fetchSubscriptionStats();
      
      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to delete subscription plan');
      // Auto-dismiss error message
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Modal handlers
  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (plan) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name || '',
      description: plan.description || '',
      monthly_price: (plan.monthly_price === 0 || plan.monthly_price)
        ? String(plan.monthly_price)
        : '',
      yearly_price: (plan.yearly_price === 0 || plan.yearly_price)
        ? String(plan.yearly_price)
        : (Number.isFinite(Number(plan.monthly_price))
            ? (Number(plan.monthly_price) * 12).toFixed(2)
            : ''),
      max_properties: (plan.max_properties === 0 || plan.max_properties)
        ? String(plan.max_properties)
        : '',
      analytics_enabled: plan.analytics_enabled || false,
      staff_management_enabled: plan.staff_management_enabled || false,
      subdomain_access: plan.subdomain_access || false,
      priority_support: plan.priority_support || false,
      api_access: plan.api_access || false,
      advanced_reporting: plan.advanced_reporting || false,
      is_active: plan.is_active !== false,
      trial_days: (plan.trial_days === 0 || plan.trial_days) ? String(plan.trial_days) : '0'
    });
    setShowEditModal(true);
  };

  const openFeaturesModal = (plan) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name || '',
      description: plan.description || '',
      monthly_price: (plan.monthly_price === 0 || plan.monthly_price)
        ? String(plan.monthly_price)
        : '',
      yearly_price: (plan.yearly_price === 0 || plan.yearly_price)
        ? String(plan.yearly_price)
        : '',
      max_properties: (plan.max_properties === 0 || plan.max_properties)
        ? String(plan.max_properties)
        : '',
      analytics_enabled: plan.analytics_enabled || false,
      staff_management_enabled: plan.staff_management_enabled || false,
      subdomain_access: plan.subdomain_access || false,
      priority_support: plan.priority_support || false,
      api_access: plan.api_access || false,
      advanced_reporting: plan.advanced_reporting || false,
      is_active: plan.is_active !== false,
      trial_days: (plan.trial_days === 0 || plan.trial_days) ? String(plan.trial_days) : '0'
    });
    setShowFeaturesModal(true);
  };

  const openAddBillingModal = () => {
    resetBillingForm();
    setShowAddBillingModal(true);
  };

  const handleUpdateFeatures = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      const featuresData = {
        analytics_enabled: planForm.analytics_enabled,
        staff_management_enabled: planForm.staff_management_enabled,
        subdomain_access: planForm.subdomain_access,
        priority_support: planForm.priority_support,
        api_access: planForm.api_access,
        advanced_reporting: planForm.advanced_reporting,
        max_properties: planForm.max_properties,
      };
      
      const response = await ApiService.updateSubscriptionPlanFeatures(selectedPlan.id, featuresData);
      
      // If we get here without throwing, it was successful
      setSuccess('Plan features updated successfully!');
      setShowFeaturesModal(false);
      resetForm();
      await fetchSubscriptionPlans();
      await fetchSubscriptionStats();
      
      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Failed to update plan features');
      // Auto-dismiss error message
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName) => {
    const iconProps = { className: "w-8 h-8", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" };
    
    switch (iconName) {
      case 'users':
        return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>;
      case 'check':
        return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
      case 'money':
        return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>;
      case 'clock':
        return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      default:
        return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
  };

  // Calculate revenue data from billing history
  const revenueData = useMemo(() => {
    if (!billingHistory || billingHistory.length === 0) {
      // Return empty data for last 6 months if no billing history
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          basic: 0,
          pro: 0,
          enterprise: 0
        });
      }
      return months;
    }

    // Group billing history by month and plan
    const revenueByMonth = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[monthKey] = {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        basic: 0,
        pro: 0,
        enterprise: 0
      };
    }

    // Process billing history - only count paid bills
    billingHistory.forEach(bill => {
      // Only count paid bills for revenue
      const status = (bill.status || '').toLowerCase();
      if (status !== 'paid') return;
      
      if (!bill.billing_date && !bill.created_at) return;
      
      try {
        const billDate = bill.billing_date ? new Date(bill.billing_date) : new Date(bill.created_at);
        if (isNaN(billDate.getTime())) return;
        
        const monthKey = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (revenueByMonth[monthKey]) {
          const planName = (bill.plan_name || '').toLowerCase();
          const amount = Number(bill.amount || 0);
          
          if (planName.includes('basic')) {
            revenueByMonth[monthKey].basic += amount;
          } else if (planName.includes('professional') || planName.includes('pro')) {
            revenueByMonth[monthKey].pro += amount;
          } else if (planName.includes('enterprise')) {
            revenueByMonth[monthKey].enterprise += amount;
          } else {
            // If plan name doesn't match, add to basic as default
            revenueByMonth[monthKey].basic += amount;
          }
        }
      } catch (e) {
        console.warn('Error processing billing entry:', e, bill);
      }
    });

    return Object.values(revenueByMonth);
  }, [billingHistory]);

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {subscriptionStats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border-2 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{stat.title}</p>
                <p className={`text-2xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
              </div>
              <div className="text-black">{getIcon(stat.icon)}</div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${
                stat.change.startsWith('+') ? 'text-black' : 'text-gray-600'
              }`}>
                {stat.change}
              </span>
              <span className="text-sm text-gray-600 ml-1">from last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Performance */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <h3 className="text-xl font-semibold text-black mb-6">Plan Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.length === 0 && !loading ? (
            <div className="col-span-3 text-center py-8">
              <p className="text-gray-600 mb-4">No subscription plans found.</p>
              <button 
                onClick={openCreateModal}
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Create Your First Plan
              </button>
            </div>
          ) : (
            subscriptionPlans.map((plan) => {
            const features = [];
            if (plan.max_properties) features.push(`Up to ${plan.max_properties === -1 ? 'unlimited' : plan.max_properties} properties`);
            if (plan.analytics_enabled) features.push('Advanced Analytics');
            if (plan.staff_management_enabled) features.push('Staff Management');
            if (plan.subdomain_access) features.push('Subdomain Access');
            if (plan.priority_support) features.push('Priority Support');
            if (plan.api_access) features.push('API Access');
            if (plan.custom_branding) features.push('Custom Branding');
            if (plan.advanced_reporting) features.push('Advanced Reporting');
            
            return (
              <div key={plan.id} className="border-2 border-black rounded-xl p-6">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold text-black mb-2">{plan.name}</h4>
                  <div className="text-2xl font-bold text-black mb-1">₱{parseFloat(plan.monthly_price || 0).toLocaleString()}</div>
                  <div className="text-sm text-gray-600">per month</div>
                  {plan.yearly_price && (
                    <div className="text-sm text-gray-500 mt-1">₱{parseFloat(plan.yearly_price).toLocaleString()}/year</div>
                  )}
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Subscribers:</span>
                    <span className="font-medium">{plan.subscriber_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Active Subscribers:</span>
                    <span className="font-medium">{plan.active_subscriber_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Monthly Revenue:</span>
                    <span className="font-medium text-black">₱{Number((plan.active_subscriber_count || 0) * parseFloat(plan.monthly_price || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Status:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                      plan.is_active ? 'bg-white border-black text-black' : 'bg-gray-100 border-gray-600 text-gray-600'
                    }`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {plan.is_featured && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Featured:</span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full border bg-black text-white">
                        Featured
                      </span>
                    </div>
                  )}
                </div>
                
                <ul className="text-sm text-gray-700 space-y-1 mb-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-4 h-4 text-black mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="flex flex-col space-y-2">
                  <button 
                    onClick={() => openEditModal(plan)}
                    className="w-full bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    Edit Plan
                  </button>
                  <button 
                    onClick={() => openFeaturesModal(plan)}
                    className="w-full bg-white text-black border-2 border-black px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                  >
                    Manage Features
                  </button>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <h3 className="text-xl font-semibold text-black mb-6">Subscription Trends</h3>
        <div className="h-80 flex items-end justify-between space-x-4">
          {revenueData.map((data, index) => {
            const totalRevenue = Number(data.basic || 0) + Number(data.pro || 0) + Number(data.enterprise || 0);
            const allTotals = revenueData.map(d => Number(d.basic || 0) + Number(d.pro || 0) + Number(d.enterprise || 0));
            const maxRevenue = Math.max(...allTotals, 1); // Ensure at least 1 to avoid division by zero
            
            const basicHeight = maxRevenue > 0 ? (Number(data.basic || 0) / maxRevenue) * 200 : 0;
            const proHeight = maxRevenue > 0 ? (Number(data.pro || 0) / maxRevenue) * 200 : 0;
            const enterpriseHeight = maxRevenue > 0 ? (Number(data.enterprise || 0) / maxRevenue) * 200 : 0;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                {/* Revenue Values */}
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium text-black">
                    ₱{totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    Total Revenue
                  </div>
                </div>
                
                {/* Stacked Bar Chart */}
                <div className="w-full flex flex-col space-y-1" style={{ minHeight: '200px' }}>
                  {/* Basic Plan */}
                  {basicHeight > 0 && (
                    <div 
                      className="w-full bg-black rounded-t transition-all duration-300 hover:bg-gray-800"
                      style={{ 
                        height: `${basicHeight}px`,
                        minHeight: basicHeight > 0 ? '4px' : '0px'
                      }}
                      title={`Basic: ₱${Number(data.basic || 0).toLocaleString()}`}
                    ></div>
                  )}
                  
                  {/* Professional Plan */}
                  {proHeight > 0 && (
                    <div 
                      className="w-full bg-gray-600 transition-all duration-300 hover:bg-gray-700"
                      style={{ 
                        height: `${proHeight}px`,
                        minHeight: proHeight > 0 ? '4px' : '0px'
                      }}
                      title={`Professional: ₱${Number(data.pro || 0).toLocaleString()}`}
                    ></div>
                  )}
                  
                  {/* Enterprise Plan */}
                  {enterpriseHeight > 0 && (
                    <div 
                      className="w-full bg-gray-400 rounded-b transition-all duration-300 hover:bg-gray-500"
                      style={{ 
                        height: `${enterpriseHeight}px`,
                        minHeight: enterpriseHeight > 0 ? '4px' : '0px'
                      }}
                      title={`Enterprise: ₱${Number(data.enterprise || 0).toLocaleString()}`}
                    ></div>
                  )}
                  
                  {/* Empty state indicator */}
                  {totalRevenue === 0 && (
                    <div className="w-full bg-gray-100 rounded" style={{ height: '4px' }} title="No revenue"></div>
                  )}
                </div>
                
                {/* Month Label */}
                <div className="text-sm text-gray-700 font-medium">{data.month}</div>
                
                {/* Plan Breakdown */}
                <div className="text-center space-y-1 mt-2">
                  <div className="text-xs text-black">
                    Basic: ₱{Number(data.basic || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    Pro: ₱{Number(data.pro || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    Enterprise: ₱{Number(data.enterprise || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex justify-center space-x-8 mt-6">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-black rounded mr-2"></div>
            <span className="text-sm font-medium text-black">Basic Plan</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-600 rounded mr-2"></div>
            <span className="text-sm font-medium text-black">Professional Plan</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-400 rounded mr-2"></div>
            <span className="text-sm font-medium text-black">Enterprise Plan</span>
          </div>
        </div>
        
        {/* Chart Summary */}
        {revenueData.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border-2 border-black">
              <div className="text-lg font-bold text-black">
                ₱{Number(revenueData[revenueData.length - 1]?.basic || 0).toLocaleString()}
              </div>
              <div className="text-sm text-black">Basic Plan Revenue</div>
              {revenueData[0]?.basic > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {revenueData[revenueData.length - 1]?.basic > revenueData[0]?.basic ? '+' : ''}
                  {((Number(revenueData[revenueData.length - 1]?.basic || 0) - Number(revenueData[0]?.basic || 0)) / Number(revenueData[0]?.basic || 1) * 100).toFixed(1)}% from {revenueData[0]?.month || 'start'}
                </div>
              )}
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg border-2 border-black">
              <div className="text-lg font-bold text-black">
                ₱{Number(revenueData[revenueData.length - 1]?.pro || 0).toLocaleString()}
              </div>
              <div className="text-sm text-black">Professional Plan Revenue</div>
              {revenueData[0]?.pro > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {revenueData[revenueData.length - 1]?.pro > revenueData[0]?.pro ? '+' : ''}
                  {((Number(revenueData[revenueData.length - 1]?.pro || 0) - Number(revenueData[0]?.pro || 0)) / Number(revenueData[0]?.pro || 1) * 100).toFixed(1)}% from {revenueData[0]?.month || 'start'}
                </div>
              )}
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg border-2 border-black">
              <div className="text-lg font-bold text-black">
                ₱{Number(revenueData[revenueData.length - 1]?.enterprise || 0).toLocaleString()}
              </div>
              <div className="text-sm text-black">Enterprise Plan Revenue</div>
              {revenueData[0]?.enterprise > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {revenueData[revenueData.length - 1]?.enterprise > revenueData[0]?.enterprise ? '+' : ''}
                  {((Number(revenueData[revenueData.length - 1]?.enterprise || 0) - Number(revenueData[0]?.enterprise || 0)) / Number(revenueData[0]?.enterprise || 1) * 100).toFixed(1)}% from {revenueData[0]?.month || 'start'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );


  const renderSettings = () => (
    <div className="space-y-8">
      {/* Plan Management */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <h3 className="text-xl font-semibold text-black mb-4">Plan Management</h3>
        <div className="space-y-6">
          {subscriptionPlans.map((plan) => (
            <div key={plan.id} className="border-2 border-black rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-black">{plan.name} Plan</h4>
                  <p className="text-sm text-gray-600">₱{parseFloat(plan.monthly_price || 0).toLocaleString()} per month</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => openEditModal(plan)}
                    className="text-black hover:text-gray-600 text-sm font-medium"
                  >
                    Edit Plan
                  </button>
                  <button 
                    onClick={() => openFeaturesModal(plan)}
                    className="text-black hover:text-gray-600 text-sm font-medium"
                  >
                    Manage Features
                  </button>
                  <button 
                    onClick={() => handleDeletePlan(plan.id)}
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                  >
                    Delete Plan
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          <div className="border-2 border-black rounded-xl p-6 flex items-center justify-center">
            <button 
              onClick={openCreateModal}
              className="w-full border-2 border-dashed border-black rounded-lg p-6 text-black hover:text-gray-600 hover:border-gray-600 transition-colors"
            >
              <div className="text-center">
                <svg className="mx-auto h-8 w-8 mb-2 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="font-medium">Create New Plan</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <h3 className="text-xl font-semibold text-black mb-4">System Settings</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-black">Auto-renewal</h4>
              <p className="text-sm text-gray-600">Allow automatic subscription renewals</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-black">Payment reminders</h4>
              <p className="text-sm text-gray-600">Send payment reminders before expiration</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-black">Usage tracking</h4>
              <p className="text-sm text-gray-600">Track property usage and send alerts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubscribers = () => (
    <div className="space-y-8">
      {/* Subscribers Table */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-black">Property Manager Subscribers</h3>
          <div className="flex items-center space-x-4">
            <select 
              value={selectedFilter} 
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="border-2 border-black rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Subscribers</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="trial">Trial</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Properties</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Monthly Fee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Join Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscribers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-600">
                      No subscribers found.
                    </td>
                  </tr>
                ) : (
                  subscribers.map((subscriber) => {
                    const sub = subscriber.subscription || {};
                    const status = (sub.status || 'inactive').toLowerCase();
                    return (
                      <tr key={subscriber.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-black">{subscriber.full_name || subscriber.email || 'Unknown'}</div>
                            <div className="text-sm text-gray-600">{subscriber.email || ''}</div>
                            {subscriber.phone && <div className="text-sm text-gray-500">{subscriber.phone}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-black">{sub.plan_name || 'No Plan'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 ${
                            status === 'active' 
                              ? 'bg-white border-green-600 text-green-600'
                              : status === 'trial'
                              ? 'bg-white border-blue-600 text-blue-600'
                              : 'bg-white border-gray-600 text-gray-600'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                          {sub.properties_used || 0} / {sub.max_properties === -1 ? '∞' : (sub.max_properties || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                          ₱{Number(sub.monthly_fee || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {subscriber.user_created_at ? new Date(subscriber.user_created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={async () => {
                              setSelectedSubscriber(subscriber);
                              // Ensure billing history is loaded before showing modal
                              if (billingHistory.length === 0) {
                                await fetchBillingHistory();
                              }
                              setShowViewSubscriberModal(true);
                            }}
                            className="text-black hover:text-gray-600 mr-3"
                          >
                            View
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedSubscriber(subscriber);
                              setShowEditSubscriberModal(true);
                            }}
                            className="text-black hover:text-gray-600"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
          </div>
        )}
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-8">
      {/* Pending Proofs (payment_transactions) */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-black">Pending Proofs</h3>
          <button onClick={fetchPaymentTransactions} className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">Refresh</button>
        </div>
        {paymentTransactions.filter(p => (p.payment_status || p.status || 'Pending').toLowerCase() === 'pending').length === 0 ? (
          <div className="text-center py-8 text-gray-600">No pending proofs.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Proof</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentTransactions.filter(p => (p.payment_status || p.status || 'Pending').toLowerCase() === 'pending').map((pt) => (
                  <tr key={pt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-black">{pt.customer_name || pt.user_email || `User #${pt.user_id}`}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-black">{pt.plan_name || pt.plan || `Plan #${pt.plan_id}`}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-black">{pt.payment_method || 'GCash'}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-black">₱{Number(pt.amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{pt.payment_reference || '—'}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {pt.proof_of_payment ? (
                        <img src={pt.proof_of_payment} alt="proof" className="h-12 w-auto rounded border cursor-pointer"
                          onClick={() => { setSelectedProof(pt); setShowProofModal(true); }} />
                      ) : (
                        <span className="text-xs text-gray-500">No image</span>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                      <button onClick={() => { setSelectedProof(pt); setShowProofModal(true); }} className="mr-2 bg-black text-white px-3 py-1 rounded-lg hover:bg-gray-800">Review</button>
                      <button onClick={() => approveProof(pt)} className="mr-2 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">Approve</button>
                      <button onClick={() => rejectProof(pt)} className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Billing History Table */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-black">Billing History</h3>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                fetchBillingHistory();
                fetchPaymentTransactions();
              }}
              className="bg-white text-black border-2 border-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh billing history"
            >
              Refresh
            </button>
            <button 
              onClick={openAddBillingModal}
              className="bg-white text-black border-2 border-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Add Billing
            </button>
            <button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Billing Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {billingHistory.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-600">
                      No billing history found.
                    </td>
                  </tr>
                ) : (
                  billingHistory.map((bill) => {
                    const status = (bill.status || 'pending').toLowerCase();
                    return (
                      <tr key={bill.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-black">{bill.invoice_number || `INV-${bill.id}`}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-black">{bill.customer_name || 'Unknown'}</div>
                            <div className="text-sm text-gray-600">{bill.email || ''}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-black">{bill.plan_name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-black">₱{Number(bill.amount || 0).toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 ${
                            status === 'paid' 
                              ? 'bg-white border-green-600 text-green-600'
                              : status === 'pending'
                              ? 'bg-white border-yellow-600 text-yellow-600'
                              : 'bg-white border-red-600 text-red-600'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {bill.billing_date ? new Date(bill.billing_date).toLocaleDateString() : 
                           bill.created_at ? new Date(bill.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-black font-medium">
                            {(() => {
                              const method = bill.payment_method || bill.paymentMethod || '';
                              if (!method) return 'N/A';
                              // Format payment method: capitalize first letter of each word
                              return method.split(' ').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                              ).join(' ');
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => handleViewInvoice(bill)}
                            className="text-black hover:text-gray-600 mr-3"
                          >
                            View Invoice
                          </button>
                          <button 
                            onClick={() => handleResendInvoice(bill)}
                            className="text-black hover:text-gray-600"
                            disabled={loading}
                          >
                            Resend
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
          </div>
        )}
      </div>

      {/* Billing Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
          <h4 className="text-lg font-semibold text-black mb-2">Total Revenue</h4>
          <div className="text-2xl font-bold text-black">
            ₱{billingHistory.reduce((sum, bill) => sum + Number(bill.amount || 0), 0).toLocaleString()}
          </div>
          <p className="text-sm text-gray-600 mt-1">All time</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
          <h4 className="text-lg font-semibold text-black mb-2">Paid Invoices</h4>
          <div className="text-2xl font-bold text-black">
            {billingHistory.filter(bill => (bill.status || '').toLowerCase() === 'paid').length}
          </div>
          <p className="text-sm text-gray-600 mt-1">Successfully processed</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border-2 border-black p-6">
          <h4 className="text-lg font-semibold text-black mb-2">Pending Payments</h4>
          <div className="text-2xl font-bold text-black">
            {billingHistory.filter(bill => (bill.status || '').toLowerCase() === 'pending').length}
          </div>
          <p className="text-sm text-gray-600 mt-1">Awaiting payment</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Subscription Management</h1>
              <p className="text-gray-300 mt-1">Manage all property manager subscriptions</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-300">
                Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-black mb-8">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('subscribers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'subscribers'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
              }`}
            >
              Subscribers
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'billing'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
              }`}
            >
              Billing
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'settings'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-black'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'subscribers' && renderSubscribers()}
        {activeTab === 'billing' && renderBilling()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* Success/Error Messages */}
      {(success || error) && (
        <div className="fixed top-4 right-4 z-50">
          {success && (
            <div className="bg-white border-2 border-black text-black px-4 py-2 rounded-lg shadow-lg">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-white border-2 border-red-500 text-red-600 px-4 py-2 rounded-lg shadow-lg">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-black">
              <h2 className="text-xl font-bold text-black">Create New Subscription Plan</h2>
            </div>
            <form onSubmit={handleCreatePlan} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Plan Name</label>
                  <input
                    type="text"
                    name="name"
                    value={planForm.name}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-black mb-1">Description</label>
                  <textarea
                    name="description"
                    value={planForm.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Monthly Price (₱)</label>
                  <input
                    type="number"
                    name="monthly_price"
                    value={planForm.monthly_price}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Yearly Price (₱)</label>
                  <input
                    type="number"
                    name="yearly_price"
                    value={planForm.yearly_price}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Max Properties</label>
                  <input
                    type="number"
                    name="max_properties"
                    value={planForm.max_properties}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    placeholder="-1 for unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Trial Days</label>
                  <input
                    type="number"
                    name="trial_days"
                    value={planForm.trial_days}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-black mb-4">Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="analytics_enabled"
                      checked={planForm.analytics_enabled}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">Analytics Enabled</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="staff_management_enabled"
                      checked={planForm.staff_management_enabled}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">Staff Management</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="priority_support"
                      checked={planForm.priority_support}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">Priority Support</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="api_access"
                      checked={planForm.api_access}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">API Access</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="advanced_reporting"
                      checked={planForm.advanced_reporting}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">Advanced Reporting</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="subdomain_access"
                      checked={planForm.subdomain_access}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">Subdomain Access</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-black">
              <h2 className="text-xl font-bold text-black">Edit Subscription Plan</h2>
            </div>
            <form onSubmit={handleEditPlan} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Plan Name</label>
                  <input
                    type="text"
                    name="name"
                    value={planForm.name}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-black mb-1">Description</label>
                  <textarea
                    name="description"
                    value={planForm.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Monthly Price (₱)</label>
                  <input
                    type="number"
                    name="monthly_price"
                    value={planForm.monthly_price}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Yearly Price (₱)</label>
                  <input
                    type="number"
                    name="yearly_price"
                    value={planForm.yearly_price}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Max Properties</label>
                  <input
                    type="number"
                    name="max_properties"
                    value={planForm.max_properties}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    placeholder="-1 for unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Trial Days</label>
                  <input
                    type="number"
                    name="trial_days"
                    value={planForm.trial_days}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-black mb-4">Status</h3>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={planForm.is_active}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <span className="text-black">Active Plan</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); resetForm(); }}
                  className="px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Features Modal */}
      {showFeaturesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b-2 border-black">
              <h2 className="text-xl font-bold text-black">Manage Plan Features</h2>
              <p className="text-gray-600 mt-1">{selectedPlan?.name} Plan</p>
            </div>
            <form onSubmit={handleUpdateFeatures} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Max Properties</label>
                  <input
                    type="number"
                    name="max_properties"
                    value={planForm.max_properties}
                    onChange={handleInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    placeholder="-1 for unlimited"
                  />
                </div>
                          
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Available Features</h3>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="analytics_enabled"
                        checked={planForm.analytics_enabled}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <span className="text-black">Advanced Analytics</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="staff_management_enabled"
                        checked={planForm.staff_management_enabled}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <span className="text-black">Staff Management</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="priority_support"
                        checked={planForm.priority_support}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <span className="text-black">Priority Support</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="api_access"
                        checked={planForm.api_access}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <span className="text-black">API Access</span>
                    </label>
                    {/* custom_branding removed */}
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="advanced_reporting"
                        checked={planForm.advanced_reporting}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <span className="text-black">Advanced Reporting</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="subdomain_access"
                        checked={planForm.subdomain_access}
                        onChange={handleInputChange}
                        className="mr-3"
                      />
                      <span className="text-black">Subdomain Access</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => { setShowFeaturesModal(false); resetForm(); }}
                  className="px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Features'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Billing Modal */}
      {showAddBillingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-black">
              <h2 className="text-xl font-bold text-black">Add Billing Entry</h2>
            </div>
            <form onSubmit={handleAddBilling} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Customer Name</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={billingForm.customer_name}
                    onChange={handleBillingInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={billingForm.email}
                    onChange={handleBillingInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Plan Name</label>
                  <select
                    name="plan_name"
                    value={billingForm.plan_name}
                    onChange={handleBillingInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  >
                    <option value="">Select Plan</option>
                    {subscriptionPlans.map((plan) => (
                      <option key={plan.id} value={plan.name}>
                        {plan.name} - ₱{Number(plan.monthly_price || 0).toLocaleString()}/month
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Amount (₱)</label>
                  <input
                    type="number"
                    name="amount"
                    value={billingForm.amount}
                    onChange={handleBillingInputChange}
                    step="0.01"
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Billing Date</label>
                  <input
                    type="date"
                    name="billing_date"
                    value={billingForm.billing_date}
                    onChange={handleBillingInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Payment Method</label>
                  <select
                    name="payment_method"
                    value={billingForm.payment_method}
                    onChange={handleBillingInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Status</label>
                  <select
                    name="status"
                    value={billingForm.status}
                    onChange={handleBillingInputChange}
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Invoice Number (Optional)</label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={billingForm.invoice_number}
                    onChange={handleBillingInputChange}
                    placeholder="Auto-generated if empty"
                    className="w-full border-2 border-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => { setShowAddBillingModal(false); resetBillingForm(); }}
                  className="px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Billing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Subscriber Modal */}
      {showViewSubscriberModal && selectedSubscriber && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-black">Subscriber Details</h3>
              <button 
                onClick={() => { setShowViewSubscriberModal(false); setSelectedSubscriber(null); }} 
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Subscriber Information */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-bold text-black mb-4">Subscriber Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Full Name</label>
                    <p className="text-black font-medium">{selectedSubscriber.full_name || selectedSubscriber.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-black">{selectedSubscriber.email || 'N/A'}</p>
                  </div>
                  {selectedSubscriber.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <p className="text-black">{selectedSubscriber.phone}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Join Date</label>
                    <p className="text-black">
                      {selectedSubscriber.user_created_at 
                        ? new Date(selectedSubscriber.user_created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription Information */}
              {selectedSubscriber.subscription && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-black mb-4">Subscription Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Plan</label>
                      <p className="text-black font-medium">{selectedSubscriber.subscription.plan_name || 'No Plan'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border-2 ${
                        (selectedSubscriber.subscription.status || '').toLowerCase() === 'active' 
                          ? 'bg-white border-green-600 text-green-600'
                          : (selectedSubscriber.subscription.status || '').toLowerCase() === 'trial'
                          ? 'bg-white border-blue-600 text-blue-600'
                          : 'bg-white border-gray-600 text-gray-600'
                      }`}>
                        {(selectedSubscriber.subscription.status || 'inactive').toLowerCase()}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Monthly Fee</label>
                      <p className="text-black">₱{Number(selectedSubscriber.subscription.monthly_fee || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Properties</label>
                      <p className="text-black">
                        {selectedSubscriber.subscription.properties_used || 0} / {selectedSubscriber.subscription.max_properties === -1 ? '∞' : (selectedSubscriber.subscription.max_properties || 0)}
                      </p>
                    </div>
                    {selectedSubscriber.subscription.next_billing_date && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Next Billing Date</label>
                        <p className="text-black">
                          {new Date(selectedSubscriber.subscription.next_billing_date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Billing History for this subscriber */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-bold text-black mb-4">Recent Billing History</h4>
                {(() => {
                  // Filter billing history by user_id or email
                  const subscriberBills = billingHistory.filter(bill => {
                    // Match by user_id if available
                    if (bill.user_id && selectedSubscriber.user_id) {
                      return bill.user_id === selectedSubscriber.user_id;
                    }
                    // Fallback: match by email if user_id is not available
                    if (bill.email && selectedSubscriber.email) {
                      return bill.email.toLowerCase() === selectedSubscriber.email.toLowerCase();
                    }
                    return false;
                  });

                  if (subscriberBills.length === 0) {
                    return <p className="text-gray-500 text-sm">No billing history available.</p>;
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-black text-white">
                            <th className="px-4 py-2 text-left text-xs font-medium">Invoice</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Plan</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Amount</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {subscriberBills.slice(0, 5).map((bill) => (
                            <tr key={bill.id}>
                              <td className="px-4 py-2 text-sm text-black">{bill.invoice_number || `#${bill.id}`}</td>
                              <td className="px-4 py-2 text-sm text-black">{bill.plan_name || 'N/A'}</td>
                              <td className="px-4 py-2 text-sm text-black">₱{Number(bill.amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  (bill.status || '').toLowerCase() === 'paid' 
                                    ? 'bg-green-100 text-green-800'
                                    : (bill.status || '').toLowerCase() === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {(bill.status || 'pending').toLowerCase()}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {bill.billing_date || bill.date 
                                  ? new Date(bill.billing_date || bill.date).toLocaleDateString()
                                  : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => { setShowViewSubscriberModal(false); setSelectedSubscriber(null); }}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscriber Modal */}
      {showEditSubscriberModal && selectedSubscriber && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-black">Edit Subscription</h3>
              <button 
                onClick={() => { setShowEditSubscriberModal(false); setSelectedSubscriber(null); }} 
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                setError('');
                setSuccess('');

                const subscription = selectedSubscriber.subscription;
                if (!subscription || !subscription.id) {
                  setError('Subscription not found');
                  return;
                }

                const formData = new FormData(e.target);
                const planId = formData.get('plan_id');
                const status = formData.get('status');

                const updateData = {};
                if (planId && planId !== '') {
                  updateData.plan_id = parseInt(planId);
                }
                if (status && status !== '') {
                  updateData.status = status;
                }

                if (Object.keys(updateData).length === 0) {
                  setError('Please select a plan or status to update');
                  return;
                }

                await ApiService.updateSubscription(subscription.id, updateData);
                setSuccess('Subscription updated successfully');
                
                // Refresh subscribers list
                await fetchSubscribers();
                
                setTimeout(() => {
                  setShowEditSubscriberModal(false);
                  setSelectedSubscriber(null);
                  setSuccess('');
                }, 1500);
              } catch (err) {
                console.error('Error updating subscription:', err);
                setError(err?.message || 'Failed to update subscription');
              } finally {
                setLoading(false);
              }
            }}>
              <div className="space-y-6">
                {/* Subscriber Info (read-only) */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Subscriber</h4>
                  <p className="text-black font-medium">{selectedSubscriber.full_name || selectedSubscriber.email}</p>
                </div>

                {/* Current Subscription Info */}
                {selectedSubscriber.subscription && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Current Subscription</h4>
                    <p className="text-black">
                      <span className="font-medium">Plan:</span> {selectedSubscriber.subscription.plan_name || 'No Plan'} | 
                      <span className="font-medium ml-2">Status:</span> {(selectedSubscriber.subscription.status || 'inactive').toLowerCase()}
                    </p>
                  </div>
                )}

                {/* Plan Selection */}
                <div>
                  <label htmlFor="plan_id" className="block text-sm font-medium text-black mb-2">
                    Change Plan (Optional)
                  </label>
                  <select
                    id="plan_id"
                    name="plan_id"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">Keep Current Plan</option>
                    {subscriptionPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - ₱{Number(plan.monthly_price || 0).toLocaleString()}/month
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Selection */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-black mb-2">
                    Change Status (Optional)
                  </label>
                  <select
                    id="status"
                    name="status"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">Keep Current Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="trial">Trial</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="suspended">Suspended</option>
                    <option value="past_due">Past Due</option>
                  </select>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-600">{success}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowEditSubscriberModal(false); setSelectedSubscriber(null); setError(''); setSuccess(''); }}
                  className="px-6 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-black">Invoice Details</h3>
              <button 
                onClick={() => { setShowInvoiceModal(false); setSelectedInvoice(null); }} 
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-black">Invoice #{selectedInvoice.invoice_number || `INV-${selectedInvoice.id}`}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Date: {selectedInvoice.billing_date 
                        ? new Date(selectedInvoice.billing_date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : selectedInvoice.created_at
                        ? new Date(selectedInvoice.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border-2 ${
                    (selectedInvoice.status || 'pending').toLowerCase() === 'paid' 
                      ? 'bg-white border-green-600 text-green-600'
                      : (selectedInvoice.status || 'pending').toLowerCase() === 'pending'
                      ? 'bg-white border-yellow-600 text-yellow-600'
                      : 'bg-white border-red-600 text-red-600'
                  }`}>
                    {(selectedInvoice.status || 'pending').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-bold text-black mb-4">Bill To</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer Name</label>
                    <p className="text-black font-medium">{selectedInvoice.customer_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-black">{selectedInvoice.email || selectedInvoice.user_email || 'N/A'}</p>
                  </div>
                  {selectedInvoice.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <p className="text-black">{selectedInvoice.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Details */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-bold text-black mb-4">Invoice Details</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-700">Plan</span>
                    <span className="text-black font-medium">{selectedInvoice.plan_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-700">Amount</span>
                    <span className="text-black font-medium text-lg">₱{Number(selectedInvoice.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-700">Payment Method</span>
                    <span className="text-black">{selectedInvoice.payment_method || 'N/A'}</span>
                  </div>
                  {selectedInvoice.due_date && (
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-gray-700">Due Date</span>
                      <span className="text-black">
                        {new Date(selectedInvoice.due_date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                  )}
                  {selectedInvoice.payment_date && (
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-gray-700">Payment Date</span>
                      <span className="text-black">
                        {new Date(selectedInvoice.payment_date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                  )}
                  {selectedInvoice.billing_period_start && selectedInvoice.billing_period_end && (
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-gray-700">Billing Period</span>
                      <span className="text-black text-sm">
                        {new Date(selectedInvoice.billing_period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                        {' '}{new Date(selectedInvoice.billing_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3">
                    <span className="text-lg font-bold text-black">Total</span>
                    <span className="text-lg font-bold text-black">₱{Number(selectedInvoice.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Notes/Remarks */}
              {(selectedInvoice.notes || selectedInvoice.remarks) && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-black mb-2">Notes</h4>
                  <p className="text-gray-700 text-sm">{selectedInvoice.notes || selectedInvoice.remarks}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t-2 border-black">
              <button
                onClick={() => { setShowInvoiceModal(false); setSelectedInvoice(null); }}
                className="px-6 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleResendInvoice(selectedInvoice)}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Resend Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Review Modal (no backend dependency) */}
      {showProofModal && selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">Review Payment Proof</h3>
              <button onClick={() => { setShowProofModal(false); setSelectedProof(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-700 space-y-1 mb-4">
                  <div><span className="font-medium">User:</span> {selectedProof.customer_name || selectedProof.user_email || `#${selectedProof.user_id}`}</div>
                  <div><span className="font-medium">Plan:</span> {selectedProof.plan_name || `#${selectedProof.plan_id}`}</div>
                  <div><span className="font-medium">Method:</span> {selectedProof.payment_method || 'GCash'}</div>
                  <div><span className="font-medium">Reference:</span> {selectedProof.payment_reference || '—'}</div>
                  <div><span className="font-medium">Amount:</span> ₱{Number(selectedProof.amount || 0).toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-500 bg-green-50 border border-green-200 rounded-lg p-3">
                  Approve will: mark proof Verified, mark the latest pending bill as Paid, and activate the user’s subscription to this plan.
                </div>
              </div>
              <div className="flex items-center justify-center">
                {selectedProof.proof_of_payment ? (
                  <img src={selectedProof.proof_of_payment} alt="Proof" className="max-h-96 w-auto rounded-lg border object-contain" />
                ) : (
                  <div className="text-gray-500">No image provided.</div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => approveProof(selectedProof)} className="mr-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
              <button onClick={() => rejectProof(selectedProof)} className="mr-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
              <button onClick={() => { setShowProofModal(false); setSelectedProof(null); }} className="px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
