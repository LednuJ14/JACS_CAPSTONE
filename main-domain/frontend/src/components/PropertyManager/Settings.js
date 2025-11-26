import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';

const Settings = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('security');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [settings, setSettings] = useState({
    // Account Settings
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    language: 'English',
    timezone: 'Asia/Manila',
    
    // Security Settings
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: '24 hours',
    
    // Business Settings
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    taxId: '',
    businessPermit: '',
    
    // Property Management Settings
    autoApproveInquiries: false,
    requireDocumentation: true,
    defaultLeaseTerm: '12 months',
    latePaymentGracePeriod: '3 days',
    maintenanceRequestAutoAssign: true,
    
    // Notification Settings
    newInquiryNotifications: true,
    paymentNotifications: true,
    maintenanceNotifications: true,
    tenantMoveInOut: true,
    systemUpdates: false,
    
    // Display Settings
    theme: 'Light',
    fontSize: 'Medium',
    compactMode: false,
    showRevenue: true,
    showOccupancy: true
  });

  // Load settings from localStorage and profile from API
  useEffect(() => {
    if (isOpen) {
      loadInitialSettings();
    }
  }, [isOpen]);

  const loadInitialSettings = async () => {
    try {
      setLoading(true);
      
      // Load settings from localStorage
      const savedSettings = localStorage.getItem('manager_settings');
      if (savedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      }

      // Load profile from API to get 2FA status
      const profileData = await ApiService.getManagerProfile();
      setProfile(profileData.profile);
      
      // Update personal info from profile
      if (profileData.profile?.personalInfo) {
        const info = profileData.profile.personalInfo;
        setPersonalInfo({
          fullName: info.name || '',
          email: info.email || '',
          phone: info.phone || '',
          position: info.position || ''
        });
      }
      
      // Update 2FA setting from profile
      if (profileData.profile?.personalInfo?.two_factor_enabled !== undefined) {
        setSettings(prev => ({ 
          ...prev, 
          twoFactorAuth: profileData.profile.personalInfo.two_factor_enabled 
        }));
      }
    } catch (error) {
      console.error('Failed to load manager settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply theme and display settings live
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Apply theme
    if (settings.theme === 'Dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    
    // Apply font size
    html.style.fontSize = settings.fontSize === 'Small' ? '14px' : 
                         settings.fontSize === 'Large' ? '18px' : '16px';
    
    // Apply compact mode
    body.setAttribute('data-compact', settings.compactMode.toString());
  }, [settings.theme, settings.fontSize, settings.compactMode]);

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleSaveSettings = () => {
    try {
      // Save settings to localStorage
      localStorage.setItem('manager_settings', JSON.stringify(settings));
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      alert('New password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      await ApiService.changeManagerPassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword
      );
      
      alert('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Password change error:', error);
      alert(error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    try {
      setLoading(true);
      
      if (settings.twoFactorAuth) {
        // Disable 2FA
        await ApiService.managerTwofaEmailDisable();
        setSettings(prev => ({ ...prev, twoFactorAuth: false }));
        alert('2FA disabled successfully!');
      } else {
        // Enable 2FA
        await ApiService.managerTwofaEmailEnable();
        setSettings(prev => ({ ...prev, twoFactorAuth: true }));
        alert('2FA enabled successfully! You will receive verification codes via email during login.');
      }
    } catch (error) {
      console.error('2FA toggle error:', error);
      alert(error.message || 'Failed to update 2FA settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // TODO: Implement account deletion functionality
      alert('Account deletion functionality would be implemented here');
    }
  };

  const handlePersonalInfoChange = (field, value) => {
    setPersonalInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdatePersonalInfo = async () => {
    try {
      setIsUpdatingProfile(true);
      
      const updateData = {
        personalInfo: {
          name: personalInfo.fullName,
          email: personalInfo.email,
          phone: personalInfo.phone,
          position: personalInfo.position
        }
      };
      
      await ApiService.updateManagerProfile(updateData);
      
      // Reload profile data to get updated info
      const profileData = await ApiService.getManagerProfile();
      setProfile(profileData.profile);
      
      // Update personal info state with the new data
      if (profileData.profile?.personalInfo) {
        const info = profileData.profile.personalInfo;
        setPersonalInfo({
          fullName: info.name || '',
          email: info.email || '',
          phone: info.phone || '',
          position: info.position || ''
        });
      }
      
      alert('Personal information updated successfully!');
    } catch (error) {
      console.error('Failed to update personal information:', error);
      alert(error.message || 'Failed to update personal information. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Security</h3>
          <p className="text-gray-600 mt-1">Manage your account security</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Two-Factor Authentication (Email)</p>
                <p className="text-sm text-gray-600 mt-1">Receive verification codes via email during login</p>
              </div>
              <div className="flex items-center space-x-3">
                {settings.twoFactorAuth ? (
                  <button
                    onClick={handleToggle2FA}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Disable 2FA (Email)'}
                  </button>
                ) : (
                  <button
                    onClick={handleToggle2FA}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Enable 2FA via Email'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Login Alerts</p>
                <p className="text-sm text-gray-600 mt-1">Get notified of new login attempts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.loginAlerts}
                  onChange={(e) => handleSettingChange('loginAlerts', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Session Timeout</p>
                <p className="text-sm text-gray-600 mt-1">Automatically log out after inactivity</p>
              </div>
              <select
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="1 hour">1 hour</option>
                <option value="8 hours">8 hours</option>
                <option value="24 hours">24 hours</option>
                <option value="7 days">7 days</option>
              </select>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h4>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
                    required
                    minLength="8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
                    required
                    minLength="8"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span className="text-sm text-gray-700">Show passwords</span>
                </label>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBusinessSettings = () => (
    <div className="space-y-6">
      {/* Property Management Settings */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Property Management</h3>
          <p className="text-gray-600 mt-1">Configure your property management preferences</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Auto-Approve Inquiries</p>
                <p className="text-sm text-gray-600 mt-1">Automatically approve new tenant inquiries</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoApproveInquiries}
                  onChange={(e) => handleSettingChange('autoApproveInquiries', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Require Documentation</p>
                <p className="text-sm text-gray-600 mt-1">Require documents before approving tenants</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireDocumentation}
                  onChange={(e) => handleSettingChange('requireDocumentation', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Default Lease Term</p>
                <p className="text-sm text-gray-600 mt-1">Default duration for new leases</p>
              </div>
              <select
                value={settings.defaultLeaseTerm}
                onChange={(e) => handleSettingChange('defaultLeaseTerm', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="6 months">6 months</option>
                <option value="12 months">12 months</option>
                <option value="18 months">18 months</option>
                <option value="24 months">24 months</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Late Payment Grace Period</p>
                <p className="text-sm text-gray-600 mt-1">Days before late fees are applied</p>
              </div>
              <select
                value={settings.latePaymentGracePeriod}
                onChange={(e) => handleSettingChange('latePaymentGracePeriod', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="1 day">1 day</option>
                <option value="3 days">3 days</option>
                <option value="5 days">5 days</option>
                <option value="7 days">7 days</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  const renderDisplaySettings = () => (
    <div className="space-y-6">
      {/* Preferences */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Preferences</h3>
          <p className="text-gray-600 mt-1">Customize your experience</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Language</label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
              >
                <option value="English">English</option>
                <option value="Filipino">Filipino</option>
                <option value="Spanish">Spanish</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => handleSettingChange('timezone', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
              >
                <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                <option value="America/New_York">America/New_York (GMT-5)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Display Settings */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Display Settings</h3>
          <p className="text-gray-600 mt-1">Customize your dashboard appearance</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
              >
                <option value="Light">Light</option>
                <option value="Dark">Dark</option>
                <option value="Auto">Auto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Font Size</label>
              <select
                value={settings.fontSize}
                onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
              >
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Compact Mode</p>
                <p className="text-sm text-gray-600 mt-1">Show more information in less space</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Show Revenue</p>
                <p className="text-sm text-gray-600 mt-1">Display revenue information on dashboard</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showRevenue}
                  onChange={(e) => handleSettingChange('showRevenue', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
              <div>
                <p className="font-semibold text-gray-900">Show Occupancy</p>
                <p className="text-sm text-gray-600 mt-1">Display occupancy rates on dashboard</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showOccupancy}
                  onChange={(e) => handleSettingChange('showOccupancy', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="bg-black bg-opacity-50 fixed inset-0" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 h-[90vh] flex flex-col relative z-10 overflow-hidden manager-settings">
        <div className="flex-1 overflow-y-auto">
          {/* Modal Header */}
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
              <p className="text-gray-600">Manage your account and business preferences</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">

            {/* Tab Navigation */}
            <div className="mb-8">
          <nav className="flex space-x-8 border-b border-gray-200">
            {[
              { id: 'security', label: 'Security', icon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              ) },
              { id: 'business', label: 'Business', icon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
              ) },
              { id: 'display', label: 'Display', icon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1h-5v1h4a1 1 0 110 2H5a1 1 0 110-2h4v-1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clipRule="evenodd" />
                </svg>
              ) }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-gray-600">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
              {activeTab === 'security' && renderSecuritySettings()}
              {activeTab === 'business' && renderBusinessSettings()}
              {activeTab === 'display' && renderDisplaySettings()}
            </div>

            {/* Save Button */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSaveSettings}
                className="bg-black text-white px-8 py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
