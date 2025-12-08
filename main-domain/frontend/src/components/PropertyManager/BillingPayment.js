import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';

const BillingPayment = () => {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  // Payment methods removed (manual payments only)
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Card payment modals removed
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showManualProofModal, setShowManualProofModal] = useState(false);
  const [proofForm, setProofForm] = useState({
    billingId: null,
    file: null,
    proofUrl: '',
    reference: '',
    remarks: '',
    payment_method: 'GCash',
    amount: 0,
    invoiceNumber: null
  });
  const [error, setError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancellingBillingId, setCancellingBillingId] = useState(null);
  const [showCancelBillingModal, setShowCancelBillingModal] = useState(false);
  const [billingToCancel, setBillingToCancel] = useState(null);
  // Card form removed

  // Utility functions
  const isSubscriptionExpiring = (nextBilling) => {
    if (!nextBilling) return false;
    const now = new Date();
    const billingDate = new Date(nextBilling);
    const daysUntilExpiry = Math.ceil((billingDate - now) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const openProofForBilling = (billing) => {
    setProofForm({
      billingId: billing?.id || null,
      file: null,
      proofUrl: '',
      reference: '',
      remarks: '',
      payment_method: 'GCash',
      amount: Number(billing?.amount || 0),
      invoiceNumber: billing?.invoice_number || null
    });
    setShowManualProofModal(true);
  };

  const isSubscriptionExpired = (nextBilling, status) => {
    if (!nextBilling || status === 'cancelled') return true;
    const now = new Date();
    const billingDate = new Date(nextBilling);
    return billingDate < now;
  };


  useEffect(() => {
    fetchBillingData();
  }, []);

  // Auto-ensure Basic plan on first load if no subscription
  const [basicEnsured, setBasicEnsured] = useState(false);
  useEffect(() => {
    (async () => {
      if (basicEnsured) return;
      // When plans and currentPlan are ready, ensure a free Basic plan is applied
      const basic = subscriptionPlans.find(p => (p.name || '').toLowerCase() === 'basic' && Number(p.monthly_price || 0) === 0);
      if (!basic) return;
      const hasSub = !!(currentPlan && (currentPlan.plan || currentPlan.status));
      if (!hasSub || currentPlan?.status === 'inactive') {
        try {
          await ApiService.upgradePlan(basic.id, null); // backend activates free plans immediately
          await fetchBillingData();
        } catch (_) {}
        setBasicEnsured(true);
      }
    })();
  }, [subscriptionPlans, currentPlan, basicEnsured]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [planRes, historyRes, plansRes] = await Promise.all([
        ApiService.getCurrentSubscription(),
        ApiService.getBillingHistory(),
        ApiService.getSubscriptionPlans()
      ]);

      setCurrentPlan(planRes?.subscription || planRes);
      const history = historyRes?.billing_history || historyRes || [];
      
      // Use the real status from the database - don't override with local state
      setBillingHistory(Array.isArray(history) ? history : []);
      // Payment methods removed
      
      // Normalize plans from backend and sort by monthly price
      const rawPlans = plansRes?.plans || plansRes?.data || plansRes || [];
      const normalizedPlans = (Array.isArray(rawPlans) ? rawPlans : []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        monthly_price: Number(p.monthly_price || 0),
        yearly_price: p.yearly_price !== undefined && p.yearly_price !== null ? Number(p.yearly_price) : null,
        yearly_discount_percentage: Number(p.yearly_discount_percentage || 0),
        max_properties: p.max_properties === null || p.max_properties === undefined ? 0 : Number(p.max_properties),
        analytics_enabled: !!p.analytics_enabled,
        priority_support: !!p.priority_support,
        api_access: !!p.api_access,
        advanced_reporting: !!p.advanced_reporting,
        staff_management_enabled: !!p.staff_management_enabled,
        subdomain_access: !!p.subdomain_access,
        trial_days: Number(p.trial_days || 0),
      })).sort((a, b) => a.monthly_price - b.monthly_price || a.id - b.id);
      setSubscriptionPlans(normalizedPlans);

    } catch (error) {
      console.error('Error fetching billing data:', error);
      setError('Failed to load billing information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if there's a pending billing (use real database status)
  const hasPendingBilling = () => {
    return billingHistory.some(billing => {
      const status = (billing.status || '').toLowerCase();
      return status === 'pending';
    });
  };

  const handlePlanUpgrade = (plan) => {
    // Check for pending billing before allowing plan selection
    if (hasPendingBilling()) {
      const pendingBilling = billingHistory.find(b => {
        const status = (b.status || '').toLowerCase();
        return status === 'pending';
      });
      const invoiceText = pendingBilling?.invoice_number 
        ? ` (Invoice: ${pendingBilling.invoice_number})` 
        : '';
      setErrorMessage(`You have a pending billing${invoiceText} that needs to be paid or cancelled before selecting a new plan. Please upload proof of payment or cancel the pending subscription first.`);
      setShowErrorModal(true);
      return;
    }
    
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      setError(null);
      
      // Find the pending billing
      const pendingBilling = billingHistory.find(b => {
        const status = (b.status || '').toLowerCase();
        return status === 'pending';
      });
      
      if (!pendingBilling) {
        setError('No pending subscription found to cancel.');
        setShowCancelModal(false);
        return;
      }

      // Call cancel subscription API
      await ApiService.cancelSubscription();
      
      // Refresh billing data
      await fetchBillingData();
      
      setShowCancelModal(false);
      // No popup - user will see the updated status
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError(error.message || 'Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelBilling = (billing) => {
    setBillingToCancel(billing);
    setShowCancelBillingModal(true);
  };

  const confirmCancelBilling = async () => {
    if (!billingToCancel) return;
    
    try {
      setCancellingBillingId(billingToCancel.id);
      setError(null);
      
      // Call API to cancel the specific billing entry
      const response = await fetch(`/api/subscriptions/billing/${billingToCancel.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
        }
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || responseData.error || 'Failed to cancel billing entry');
      }

      // Verify success response
      if (!responseData.success && !responseData.message) {
        throw new Error('Unexpected response from server');
      }

      // Close modal first
      setShowCancelBillingModal(false);
      setBillingToCancel(null);
      
      // Fetch fresh data from server to get the real updated status from database
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay to ensure DB commit
      
      // Fetch fresh data to show the real database status
      await fetchBillingData();
      
      // No popup - user will see the updated status
    } catch (error) {
      console.error('Error cancelling billing:', error);
      setError(error.message || 'Failed to cancel billing entry. Please try again.');
    } finally {
      setCancellingBillingId(null);
    }
  };

  const confirmUpgrade = async () => {
    try {
      setProcessingPayment(true);
      setError(null);
      
      const response = await ApiService.upgradePlan(selectedPlan.id, null);
      
      // Close upgrade modal first
      setShowUpgradeModal(false);
      setSelectedPlan(null);

      // Prepare manual proof modal with the created billing id
      // No success popup - directly open proof upload modal
      if (response?.billing?.id) {
        setProofForm({
          billingId: response.billing.id,
          file: null,
          proofUrl: '',
          reference: '',
          remarks: '',
          subscriptionId: response?.subscription?.id || null,
          planId: selectedPlan?.id || null,
          amount: Number(selectedPlan?.monthly_price || 0),
          payment_method: 'GCash',
          invoiceNumber: response.billing?.invoice_number || null
        });
        setShowManualProofModal(true);
      } else {
        setError('Failed to create billing entry. Please try again.');
      }

      // Refresh billing list
      await fetchBillingData();
    } catch (error) {
      console.error('Error upgrading plan:', error);
      setError(error.message || 'Failed to upgrade plan. Please try again.');
      setShowUpgradeModal(false);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Payment method management removed

  // Manual payment proof handlers
  const handleProofFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setProcessingPayment(true);
      // Reuse manager image upload endpoint to get a URL we can reference
      const uploadRes = await ApiService.uploadPropertyImage(file);
      if (uploadRes?.url) {
        setProofForm(prev => ({ ...prev, file, proofUrl: uploadRes.url }));
      } else {
        alert('Failed to upload image. Please try again.');
      }
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setProcessingPayment(false);
      e.target.value = '';
    }
  };

  const submitManualProof = async () => {
    try {
      if (!proofForm.billingId) {
        alert('Missing billing reference. Please re-open this page.');
        return;
      }
      if (!proofForm.proofUrl) {
        alert('Please upload a screenshot or receipt image.');
        return;
      }
      setProcessingPayment(true);

      // Create a payment_transactions record for admin verification
      const payload = {
        subscription_id: proofForm.subscriptionId || (currentPlan?.id || currentPlan?.subscription?.id) || null,
        user_id: Number(localStorage.getItem('user_id')) || null,
        plan_id: proofForm.planId || (selectedPlan?.id || currentPlan?.plan?.id) || null,
        payment_reference: proofForm.reference || null,
        payment_method: proofForm.payment_method || 'GCash',
        amount: Number(proofForm.amount ?? 0),
        proof_of_payment: proofForm.proofUrl,
        remarks: proofForm.remarks || '',
        payment_status: 'Pending'
      };

      await fetch('/api/admin/payment-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      // No popup - just close modal and refresh
      // Admin will send notification when payment is approved
      setShowManualProofModal(false);
      setProofForm({ billingId: null, file: null, proofUrl: '', reference: '', remarks: '', payment_method: 'GCash', amount: 0, invoiceNumber: null });
      
      // Refresh billing data to show updated status
      await fetchBillingData();
    } catch (err) {
      alert(err.message || 'Failed to submit proof');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Card payment flow removed

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-red-800 font-medium">{error}</p>
              <button
                onClick={fetchBillingData}
                className="mt-2 text-red-600 hover:text-red-800 font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Subscription Plans</h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Manage your subscription plans and billing history
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Current Plan */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">Current Subscription</h2>
            <p className="text-gray-600 mt-1">Your active plan and billing information</p>
          </div>
          <div className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center space-x-6 mb-6 lg:mb-0">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  isSubscriptionExpired(currentPlan?.next_billing_date, currentPlan?.status)
                    ? 'bg-red-500'
                    : isSubscriptionExpiring(currentPlan?.next_billing_date)
                    ? 'bg-yellow-500'
                    : 'bg-gray-900'
                }`}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {currentPlan?.plan?.name || (currentPlan?.status === 'inactive' ? 'No Active Plan' : 'No Plan')}
                  </h3>
                  <p className="text-gray-600 text-lg">
                    {currentPlan?.plan?.monthly_price ? 
                      `₱${parseFloat(currentPlan.plan.monthly_price).toLocaleString()}/month` : 
                      'Free'
                    }
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {currentPlan?.next_billing_date ? (
                      <>Next billing: {new Date(currentPlan.next_billing_date).toLocaleDateString()}</>
                    ) : (
                      currentPlan?.status === 'inactive' ? 'No active subscription' : 'No billing scheduled'
                    )}
                  </p>
                  {isSubscriptionExpired(currentPlan?.next_billing_date, currentPlan?.status) && (
                    <p className="text-sm text-red-600 font-medium mt-1">⚠️ Subscription Expired</p>
                  )}
                  {isSubscriptionExpiring(currentPlan?.next_billing_date) && (
                    <p className="text-sm text-yellow-600 font-medium mt-1">⚠️ Expires Soon</p>
                  )}
                  {currentPlan?.status === 'inactive' && (
                    <p className="text-sm text-blue-600 font-medium mt-1">💡 Choose a plan to get started</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <span className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                  currentPlan?.status === 'active' && !isSubscriptionExpired(currentPlan?.next_billing_date, currentPlan?.status)
                    ? 'bg-green-100 text-green-800' 
                    : currentPlan?.status === 'cancelled'
                    ? 'bg-red-100 text-red-800'
                    : isSubscriptionExpired(currentPlan?.next_billing_date, currentPlan?.status)
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isSubscriptionExpired(currentPlan?.next_billing_date, currentPlan?.status) 
                    ? 'EXPIRED' 
                    : currentPlan?.status?.toUpperCase() || 'INACTIVE'
                  }
                </span>
                {isSubscriptionExpired(currentPlan?.next_billing_date, currentPlan?.status) || currentPlan?.status === 'inactive' ? (
                  <button 
                    onClick={() => {
                      if (hasPendingBilling()) {
                        const pendingBilling = billingHistory.find(b => {
                          const status = (b.status || '').toLowerCase();
                          return status === 'pending';
                        });
                        const invoiceText = pendingBilling?.invoice_number 
                          ? ` (Invoice: ${pendingBilling.invoice_number})` 
                          : '';
                        setErrorMessage(`You have a pending billing${invoiceText} that needs to be paid or cancelled before selecting a new plan. Please upload proof of payment or cancel the pending subscription first.`);
                        setShowErrorModal(true);
                        return;
                      }
                      if (subscriptionPlans.length > 0) {
                        handlePlanUpgrade(subscriptionPlans[0]);
                      }
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                  >
                    {currentPlan?.status === 'inactive' ? 'Choose Plan' : 'Renew Now'}
                  </button>
                ) : hasPendingBilling() ? (
                  <>
                    <button 
                      onClick={() => {
                        const pendingBilling = billingHistory.find(b => {
                          const status = (b.status || '').toLowerCase();
                          return status === 'pending';
                        });
                        if (pendingBilling) {
                          openProofForBilling(pendingBilling);
                        }
                      }}
                      className="bg-black text-white px-6 py-2 rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                    >
                      Upload Proof
                    </button>
                    <button 
                      onClick={() => setShowCancelModal(true)}
                      className="bg-red-600 text-white px-6 py-2 rounded-xl hover:bg-red-700 transition-colors font-semibold"
                    >
                      Cancel Subscription
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setShowManualProofModal(true)}
                    className="bg-black text-white px-6 py-2 rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                  >
                    Upload Proof
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">Subscription Plans</h2>
            <p className="text-gray-600 mt-1">Choose the plan that best fits your needs</p>
          </div>
          <div className="p-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-600">Loading subscription plans...</p>
              </div>
            ) : subscriptionPlans.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscription Plans Available</h3>
                <p className="text-gray-600 mb-4">Subscription plans haven't been set up yet.</p>
                <p className="text-sm text-gray-500">Please contact the administrator to configure subscription plans.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border-2 p-8 border-gray-200 bg-white hover:border-gray-300 transition-all`}
                  >
                    
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                      <div className="mb-1">
                        <span className="text-4xl font-bold text-gray-900">
                          ₱{parseFloat(plan.monthly_price || 0).toLocaleString()}
                        </span>
                        <span className="text-gray-600">/month</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        ₱{(plan.yearly_price !== null && plan.yearly_price !== undefined
                              ? parseFloat(plan.yearly_price)
                              : parseFloat(plan.monthly_price || 0) * 12
                          ).toLocaleString()}/year
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700">
                          {plan.max_properties === -1 ? 'Unlimited properties' : `Up to ${plan.max_properties || 0} properties`}
                        </span>
                      </li>
                      {plan.analytics_enabled && (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">Advanced analytics & reports</span>
                        </li>
                      )}
                      {plan.staff_management_enabled && (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">Staff Management</span>
                        </li>
                      )}
                      {plan.subdomain_access && (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">Subdomain Access</span>
                        </li>
                      )}
                      {plan.priority_support ? (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">Priority support</span>
                        </li>
                      ) : (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">Email support</span>
                        </li>
                      )}
                      {plan.api_access && (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">API access</span>
                        </li>
                      )}
                      {plan.advanced_reporting && (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-gray-900 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">Advanced reporting</span>
                        </li>
                      )}
                      {plan.trial_days > 0 && (
                        <li className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-blue-700 font-medium">{plan.trial_days}-day free trial</span>
                        </li>
                      )}
                    </ul>

                    <button
                      onClick={() => handlePlanUpgrade(plan)}
                      disabled={currentPlan?.plan?.id === plan.id || hasPendingBilling()}
                      className={`w-full py-3 px-6 rounded-xl font-semibold transition-colors ${
                        currentPlan?.plan?.id === plan.id
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : hasPendingBilling()
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-gray-700'
                      }`}
                    >
                      {currentPlan?.plan?.id === plan.id 
                        ? 'Current Plan' 
                        : hasPendingBilling()
                        ? 'Pending Payment Required'
                        : `Choose ${plan.name}`
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      <div>
          {/* Billing History */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Billing History</h2>
              <p className="text-gray-600 mt-1">Your recent transactions</p>
            </div>
            <div className="p-8">
              {billingHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Billing History</h4>
                  <p className="text-gray-600">Your billing transactions will appear here once you have an active subscription.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {billingHistory.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900">{transaction.plan_name || transaction.plan} Plan</p>
                        <p className="text-sm text-gray-600">
                          {transaction.billing_date ? new Date(transaction.billing_date).toLocaleDateString() : 
                           transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}
                        </p>
                        {transaction.invoice_number && (
                          <p className="text-xs text-gray-500">Invoice: {transaction.invoice_number}</p>
                        )}
                      </div>
                      <div className="text-right flex items-center space-x-4">
                        <div>
                          <p className="font-bold text-gray-900">₱{Number(transaction.amount || 0).toLocaleString()}</p>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            (() => {
                              const status = (transaction.status || '').toLowerCase();
                              if (status === 'paid') return 'bg-green-100 text-green-800';
                              if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
                              if (status === 'cancelled') return 'bg-red-100 text-red-800';
                              return 'bg-gray-100 text-gray-500';
                            })()
                          }`}>
                            {((transaction.status || 'pending').toUpperCase())}
                          </span>
                        </div>
                        {(() => {
                          const status = (transaction.status || '').toLowerCase();
                          if (status === 'pending') {
                            return (
                              <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openProofForBilling(transaction)}
                            className="bg-black text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                          >
                            Upload Proof
                          </button>
                                <button
                                  onClick={() => handleCancelBilling(transaction)}
                                  disabled={cancellingBillingId === transaction.id}
                                  className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {cancellingBillingId === transaction.id ? 'Cancelling...' : 'Cancel'}
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods removed for manual payment flow */}
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Confirm Plan Upgrade</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to select the {selectedPlan?.name} plan for ₱{parseFloat(selectedPlan?.monthly_price || 0).toLocaleString()}/month?
            </p>
            <div className={`border rounded-lg p-4 mb-4 bg-blue-50 border-blue-200`}>
              <p className="text-sm text-blue-800">
                This will create a subscription and a billing entry. Please pay via GCash or Bank Transfer, then upload your proof of payment for admin verification.
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowUpgradeModal(false)}
                disabled={processingPayment}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpgrade}
                disabled={processingPayment}
                className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Proof Modal */}
      {showManualProofModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Header - Fixed */}
            <div className="p-8 pb-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Proof of Payment</h3>
              {proofForm.invoiceNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <p className="font-semibold">Invoice: {proofForm.invoiceNumber}</p>
                </div>
              )}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                <p className="font-semibold mb-1">Payment Instructions</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>GCash: 09XXXXXXXXX (Account Name: JACS Platform)</li>
                  <li>Bank Transfer: ABC Bank, Account #######, Jun P.</li>
                  <li>
                    Amount: ₱{
                      Number(
                        (proofForm.amount ?? (selectedPlan?.monthly_price || 0)) || 0
                      ).toLocaleString()
                    } (Monthly)
                  </li>
                </ul>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot / Receipt</label>
                  <input type="file" accept="image/*" onChange={handleProofFileChange} className="block w-full text-sm text-gray-700" />
                  {proofForm.proofUrl && (
                    <div className="mt-3 flex justify-center">
                      <img
                        src={proofForm.proofUrl}
                        alt="Proof"
                        className="max-h-64 max-w-full rounded-lg border object-contain"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={proofForm.payment_method || 'GCash'}
                    onChange={(e) => setProofForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
                  >
                    <option value="GCash">GCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={
                      (proofForm.amount ?? Number(selectedPlan?.monthly_price || 0))
                    }
                    onChange={(e) => setProofForm(prev => ({ ...prev, amount: Number(e.target.value || 0) }))}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number (optional)</label>
                  <input
                    type="text"
                    value={proofForm.reference}
                    onChange={(e) => setProofForm(prev => ({ ...prev, reference: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
                    placeholder="e.g., GCASH-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
                  <textarea
                    rows={3}
                    value={proofForm.remarks}
                    onChange={(e) => setProofForm(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-black"
                    placeholder="Any notes for the admin"
                  />
                </div>
              </div>
            </div>

            {/* Footer - Fixed */}
            <div className="p-8 pt-4 border-t border-gray-200 flex-shrink-0">
              <div className="flex space-x-4">
                <button
                  onClick={() => { 
                    setShowManualProofModal(false); 
                    setProofForm({ billingId: null, file: null, proofUrl: '', reference: '', remarks: '', payment_method: 'GCash', amount: 0, invoiceNumber: null }); 
                  }}
                  disabled={processingPayment}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // minimal front-end validation
                    const amt = Number(proofForm.amount ?? 0);
                    if (!proofForm.proofUrl) { alert('Please upload a screenshot or receipt image.'); return; }
                    if (!(amt > 0)) { alert('Please enter a valid amount.'); return; }
                    submitManualProof();
                  }}
                  disabled={processingPayment}
                  className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold disabled:opacity-50"
                >
                  {processingPayment ? 'Submitting...' : 'Submit for Verification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Cancel Pending Subscription</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel your pending subscription? This will cancel the pending billing entry and allow you to select a new plan.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Cancelling will remove the pending billing entry. You will need to select a plan again if you want to subscribe.
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Cannot Select Plan</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {errorMessage || 'You have a pending billing that needs to be resolved before selecting a new plan.'}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorMessage('');
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
              >
                Close
              </button>
              {hasPendingBilling() && (
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    setShowCancelModal(true);
                  }}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Billing Modal */}
      {showCancelBillingModal && billingToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Cancel Pending Billing</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this pending billing entry?
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Plan:</span> {billingToCancel.plan_name || billingToCancel.plan} Plan</p>
                <p><span className="font-semibold">Amount:</span> ₱{Number(billingToCancel.amount || 0).toLocaleString()}</p>
                {billingToCancel.invoice_number && (
                  <p><span className="font-semibold">Invoice:</span> {billingToCancel.invoice_number}</p>
                )}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Cancelling this billing entry will allow you to select a new plan. The pending subscription will be cancelled.
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowCancelBillingModal(false);
                  setBillingToCancel(null);
                }}
                disabled={cancellingBillingId === billingToCancel.id}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50"
              >
                Keep Billing
              </button>
              <button
                onClick={confirmCancelBilling}
                disabled={cancellingBillingId === billingToCancel.id}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center"
              >
                {cancellingBillingId === billingToCancel.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelling...
                  </>
                ) : (
                  'Cancel Billing'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPayment;
