import React, { useState, useEffect } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { apiService } from '../../services/api';

const AccountSettings = () => {
  const [twoFactorStatus, setTwoFactorStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Check if user is authenticated before fetching 2FA status
    if (apiService.isAuthenticated()) {
      fetchTwoFactorStatus();
    } else {
      setMessage({ type: 'error', text: 'You must be logged in to access account settings.' });
      setInitialLoading(false);
    }
  }, []);

  const fetchTwoFactorStatus = async () => {
    try {
      setInitialLoading(true);
      const status = await apiService.getTwoFactorStatus();
      setTwoFactorStatus(status);
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setMessage({ type: 'error', text: 'Your session has expired. Please log in again.' });
      } else {
        setMessage({ type: 'error', text: `Failed to load 2FA status: ${errorMessage}` });
      }
    } finally {
      setInitialLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-black mb-6">Account Security Settings</h2>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading security settings...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if not authenticated
  if (!apiService.isAuthenticated()) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-black mb-6">Account Security Settings</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-600 mb-4">
              You must be logged in to access account security settings.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-black mb-6">Account Security Settings</h2>

      {message && (
        <div className={`p-3 rounded-lg mb-4 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            {message.type === 'error' && (
              <button
                onClick={fetchTwoFactorStatus}
                className="text-sm underline hover:no-underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Two-Factor Authentication */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-600">
                  {twoFactorStatus?.enabled 
                    ? 'Enabled - Your account is protected with email-based 2FA' 
                    : 'Disabled - 2FA will be enabled automatically when you log in if configured'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {twoFactorStatus?.enabled ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Check className="w-3 h-3 mr-1" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  <X className="w-3 h-3 mr-1" />
                  Inactive
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>How it works:</strong> When 2FA is enabled, you'll receive a 6-digit verification code via email each time you log in. 
              Simply enter the code to complete your login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
