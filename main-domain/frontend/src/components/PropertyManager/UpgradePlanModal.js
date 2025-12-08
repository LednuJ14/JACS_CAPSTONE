import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';

const UpgradePlanModal = ({ isOpen, onClose, onUpgrade }) => {
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      fetchCurrentSubscription();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      const plansRes = await ApiService.getSubscriptionPlans();
      const rawPlans = plansRes?.plans || plansRes?.data || plansRes || [];
      const normalizedPlans = (Array.isArray(rawPlans) ? rawPlans : []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        monthly_price: Number(p.monthly_price || 0),
        yearly_price: p.yearly_price !== undefined && p.yearly_price !== null ? Number(p.yearly_price) : null,
        max_properties: p.max_properties === null || p.max_properties === undefined ? 0 : Number(p.max_properties),
        analytics_enabled: !!p.analytics_enabled,
        priority_support: !!p.priority_support,
        subdomain_access: !!p.subdomain_access,
      })).filter(p => p.monthly_price > 0) // Only show paid plans
        .sort((a, b) => a.monthly_price - b.monthly_price);
      setSubscriptionPlans(normalizedPlans);
    } catch (error) {
      // Error handled silently to reduce log noise
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const subRes = await ApiService.getCurrentSubscription();
      setCurrentPlan(subRes?.subscription || subRes);
    } catch (error) {
      // Error handled silently to reduce log noise
    }
  };

  const handleUpgradeClick = (plan) => {
    if (onUpgrade) {
      onUpgrade(plan);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-t-2xl px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Upgrade Your Plan</h2>
              <p className="text-gray-300">Unlock more features and grow your property portfolio</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Current Plan Info */}
          {currentPlan && (
            <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Plan</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentPlan?.plan?.name || 'Free Plan'}
              </p>
              {currentPlan?.plan?.max_properties !== undefined && (
                <p className="text-gray-600 mt-2">
                  {currentPlan.plan.max_properties === -1 
                    ? 'Unlimited properties' 
                    : `Up to ${currentPlan.plan.max_properties} properties`}
                </p>
              )}
            </div>
          )}

          {/* Benefits Section */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Why Upgrade?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">More Properties</h4>
                </div>
                <p className="text-sm text-gray-600">Add unlimited properties to your portfolio</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Advanced Analytics</h4>
                </div>
                <p className="text-sm text-gray-600">Get detailed insights and reports</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Priority Support</h4>
                </div>
                <p className="text-sm text-gray-600">Get help when you need it most</p>
              </div>
            </div>
          </div>

          {/* Available Plans */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading plans...</p>
            </div>
          ) : subscriptionPlans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No upgrade plans available at the moment.</p>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-6">Available Plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-gray-900 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-2xl font-bold text-gray-900">{plan.name}</h4>
                      <div>
                        <span className="text-3xl font-bold text-gray-900">₱{plan.monthly_price.toLocaleString()}</span>
                        <span className="text-gray-600">/month</span>
                      </div>
                    </div>
                    {plan.description && (
                      <p className="text-gray-600 mb-4">{plan.description}</p>
                    )}
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center text-sm text-gray-700">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {plan.max_properties === -1 
                          ? 'Unlimited properties' 
                          : `Up to ${plan.max_properties} properties`}
                      </div>
                      {plan.analytics_enabled && (
                        <div className="flex items-center text-sm text-gray-700">
                          <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Advanced Analytics
                        </div>
                      )}
                      {plan.priority_support && (
                        <div className="flex items-center text-sm text-gray-700">
                          <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Priority Support
                        </div>
                      )}
                      {plan.subdomain_access && (
                        <div className="flex items-center text-sm text-gray-700">
                          <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Custom Subdomain
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUpgradeClick(plan)}
                      className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                    >
                      Upgrade to {plan.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Maybe Later
              </button>
              <p className="text-sm text-gray-500">
                You can upgrade anytime from your billing settings
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanModal;

