import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Bell, Shield, User, Settings, Palette, Globe, Lock, Eye, EyeOff, Download, Upload, Trash2, AlertTriangle, CheckCircle, Image, Building, Paintbrush, Monitor, Smartphone, Tablet } from 'lucide-react';
import { apiService } from '../../../services/api';
import { useProperty } from '../../components/PropertyContext';

const SettingsModal = ({ isOpen, onClose, currentUser, isTenant = false }) => {
  const { property, refresh: refreshProperty } = useProperty();
  const [loadingDisplaySettings, setLoadingDisplaySettings] = useState(false);
  const [savingDisplaySettings, setSavingDisplaySettings] = useState(false);
  const loadedPropertyIdRef = useRef(null); // Track which property ID we've loaded settings for
  const [notifications, setNotifications] = useState({
    email: true,
    system: true,
    maintenance: true,
    bills: true,
    announcements: true,
    security: true
  });

  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    autoSave: true,
    compactMode: false
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: 30,
    loginAlerts: true,
    passwordExpiry: 90
  });

  // Email-based 2FA doesn't require setup - removed TOTP setup state

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [displaySettings, setDisplaySettings] = useState({
    propertyName: '',
    logoUrl: '',
    primaryColor: '#000000',
    secondaryColor: '#3B82F6',
    accentColor: '#10B981',
    backgroundImage: '',
    loginLayout: 'modern',
    websiteTheme: 'light',
    headerStyle: 'fixed',
    sidebarStyle: 'collapsible',
    borderRadius: 'medium',
    fontFamily: 'inter',
    fontSize: 'medium'
  });

  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColorField, setSelectedColorField] = useState('');
  const [activeTab, setActiveTab] = useState('account');

  // Feature flags - loaded from property display settings
  const [featureFlags, setFeatureFlags] = useState({
    staffManagementEnabled: true // Default to true, will be loaded from backend
  });

  const handleNotificationChange = (type) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSecurityChange = (field, value) => {
    setSecurity(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleStaffManagement = async () => {
    if (savingDisplaySettings) {
      console.warn('Already saving, please wait...');
      return;
    }

    const newValue = !featureFlags.staffManagementEnabled;
    
    console.log('Toggling staff management:', { 
      currentValue: featureFlags.staffManagementEnabled, 
      newValue, 
      propertyId: property?.id,
      property: property 
    });
    
    // Update local state immediately for responsive UI
    setFeatureFlags(prev => ({
      ...prev,
      staffManagementEnabled: newValue
    }));

    // Get property ID - try from property context first
    let propertyIdToUse = property?.id;
    
    console.log('Initial propertyIdToUse:', propertyIdToUse);
    
    // If property not loaded yet, try multiple methods to get it
    if (!propertyIdToUse) {
      try {
        // Method 1: Refresh property context
        if (refreshProperty) {
          await refreshProperty(true); // Force refresh
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 300));
          propertyIdToUse = property?.id; // Check again after refresh
        }
        
        // Method 2: Try to get property from API directly
        if (!propertyIdToUse) {
          try {
            console.log('Fetching properties from API...');
            const properties = await apiService.makeRequest('/properties/', {
              baseURL: apiService.propertyBaseURL
            });
            
            console.log('Properties response:', properties);
            
            if (properties && Array.isArray(properties) && properties.length > 0) {
              propertyIdToUse = properties[0].id;
              console.log('Found property ID from array:', propertyIdToUse);
            } else if (properties && properties.id) {
              propertyIdToUse = properties.id;
              console.log('Found property ID from object:', propertyIdToUse);
            } else if (properties && !Array.isArray(properties) && properties.property?.id) {
              propertyIdToUse = properties.property.id;
              console.log('Found property ID from nested object:', propertyIdToUse);
            } else {
              console.warn('No property found in response:', properties);
            }
          } catch (apiError) {
            console.error('Failed to fetch from /properties/ endpoint:', apiError);
          }
        }
        
        // Method 3: Try getDashboardContext
        if (!propertyIdToUse) {
          try {
            const context = await apiService.getDashboardContext();
            if (context?.property?.id) {
              propertyIdToUse = context.property.id;
            } else if (context?.property_id) {
              propertyIdToUse = context.property_id;
            }
          } catch (ctxError) {
            console.warn('Failed to fetch from getDashboardContext:', ctxError);
          }
        }
        
        // If still no property ID, show error
        if (!propertyIdToUse) {
          // Revert state change
          setFeatureFlags(prev => ({
            ...prev,
            staffManagementEnabled: !newValue
          }));
          alert('Property not found. Please ensure you are accessing the correct property subdomain and that you are logged in as a property manager.');
          return;
        }
      } catch (e) {
        console.error('Failed to get property:', e);
        // Revert state change
        setFeatureFlags(prev => ({
          ...prev,
          staffManagementEnabled: !newValue
        }));
        alert('Failed to load property. Please refresh the page and try again.');
        return;
      }
    }

    try {
      setSavingDisplaySettings(true);
      
      // Save to backend via display settings
      // Always use real property name from database, not from displaySettings
      const settingsToSave = {
        ...displaySettings,
        companyName: property?.name || '', // Always use real property name from database
        staffManagementEnabled: newValue
      };
      // Remove propertyName if it exists in displaySettings
      delete settingsToSave.propertyName;
      await apiService.updateDisplaySettings(propertyIdToUse, settingsToSave);
      
      // Update display settings state
      setDisplaySettings(prev => ({
        ...prev,
        staffManagementEnabled: newValue
      }));
      
      // Dispatch event for other components (like Header) to react
      try {
        window.dispatchEvent(new CustomEvent('featureFlagsChanged', { 
          detail: { 
            key: 'staffManagementEnabled', 
            value: newValue,
            propertyId: propertyIdToUse
          } 
        }));
      } catch (e) {
        console.warn('Failed to dispatch featureFlagsChanged event:', e);
      }
      
      // Clear property context cache so it reloads with updated display_settings
      try {
        sessionStorage.removeItem('property_context');
        window.dispatchEvent(new CustomEvent('propertyContextRefresh'));
      } catch (e) {
        console.warn('Failed to refresh property context:', e);
      }
      
    } catch (error) {
      console.error('Failed to save staff management setting:', error);
      // Revert on error
      setFeatureFlags(prev => ({
        ...prev,
        staffManagementEnabled: !newValue
      }));
      alert('Failed to save setting. Please try again.');
    } finally {
      setSavingDisplaySettings(false);
    }
  };

  const handlePasswordChange = () => {
    setShowPasswordForm(true);
  };

  const handlePasswordSubmit = async () => {
    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('All password fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New password and confirm password do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('New password must be at least 8 characters long');
      return;
    }

    try {
      const { apiService } = await import('../../../services/api');
      
      const response = await apiService.makeRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });

      if (response && response.message) {
        alert('Password changed successfully!');
        setShowPasswordForm(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error) {
      console.error('Password change error:', error);
      const errorMessage = error.message || error.error || 'Failed to change password. Please check your current password and try again.';
      alert(errorMessage);
    }
  };

  useEffect(() => {
    // Load 2FA status on mount
    const load2FAStatus = async () => {
      try {
        const status = await apiService.getTwoFactorStatus();
        setSecurity(prev => ({
          ...prev,
          twoFactor: status.enabled || false
        }));
      } catch (error) {
        console.error('Failed to load 2FA status:', error);
      }
    };
    
    if (isOpen) {
      load2FAStatus();
    }
  }, [isOpen]);

  // Load display settings when modal opens and property is available
  useEffect(() => {
    // Only load if modal is open and we have a property ID
    if (!isOpen || !property?.id) {
      // Reset loading state when modal closes or property is not available
      if (!isOpen) {
        setLoadingDisplaySettings(false);
        loadedPropertyIdRef.current = null;
      }
      return;
    }

    // Don't reload if we've already loaded settings for this property ID
    if (loadedPropertyIdRef.current === property.id) {
      return;
    }

    let isMounted = true;

    const loadDisplaySettings = async () => {
      try {
        setLoadingDisplaySettings(true);
        const settings = await apiService.getDisplaySettings(property.id);
        
        if (!isMounted) return;
        
        if (settings) {
          // Don't map propertyName from settings - always use real property name from database
          // Remove propertyName from settings if it exists
          const { propertyName, ...settingsWithoutPropertyName } = settings;
          
          setDisplaySettings(prev => ({
            ...prev,
            ...settingsWithoutPropertyName
          }));
          
          // Load staff management enabled from display settings (property-specific)
          const staffManagementEnabled = settings.staffManagementEnabled !== undefined 
            ? settings.staffManagementEnabled 
            : true; // Default to true if not set
          
          setFeatureFlags(prev => ({
            ...prev,
            staffManagementEnabled: staffManagementEnabled
          }));
        }
        
        // Mark this property ID as loaded
        loadedPropertyIdRef.current = property.id;
      } catch (error) {
        console.error('Failed to load display settings:', error);
        // Use defaults if loading fails
      } finally {
        if (isMounted) {
          setLoadingDisplaySettings(false);
        }
      }
    };
    
    loadDisplaySettings();

    return () => {
      isMounted = false;
    };
  }, [isOpen, property?.id]); // Only depend on isOpen and property?.id to prevent infinite loops

  const handleTwoFactorToggle = async () => {
    if (security.twoFactor) {
      // Disable 2FA - require password
      const password = prompt('Enter your password to disable 2FA:');
      if (!password) return;
      
      try {
        await apiService.disableTwoFactor(password);
        setSecurity(prev => ({
          ...prev,
          twoFactor: false
        }));
        alert('2FA disabled successfully');
      } catch (error) {
        console.error('Failed to disable 2FA:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(errorMessage || 'Failed to disable 2FA. Please check your password and try again.');
      }
    } else {
      // Enable 2FA
      try {
        await apiService.enableTwoFactor();
        setSecurity(prev => ({
          ...prev,
          twoFactor: true
        }));
        alert('2FA enabled successfully! You will receive verification codes via email when logging in.');
      } catch (error) {
        console.error('Failed to enable 2FA:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(errorMessage || 'Failed to enable 2FA');
      }
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleDataExport = () => {
    // TODO: Implement data export functionality
    console.log('Export data clicked');
  };

  const handleAccountDeletion = () => {
    // TODO: Implement account deletion functionality
    console.log('Delete account clicked');
  };

  const handleDisplaySettingChange = async (field, value) => {
    // Don't allow editing propertyName - it comes from database
    if (field === 'propertyName') {
      return;
    }
    
    // Update local state immediately
    setDisplaySettings(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Save to backend
    if (property?.id) {
      try {
        setSavingDisplaySettings(true);
        // Don't include propertyName in settings to save - use actual property name from database
        const settingsToSave = {
          ...displaySettings,
          [field]: value,
          companyName: property?.name || '' // Always use real property name from database
        };
        // Remove propertyName from settings if it exists
        delete settingsToSave.propertyName;
        await apiService.updateDisplaySettings(property.id, settingsToSave);
      } catch (error) {
        console.error('Failed to save display settings:', error);
        // Revert on error
        setDisplaySettings(prev => ({
          ...prev,
          [field]: displaySettings[field] // Revert to previous value
        }));
        alert('Failed to save setting. Please try again.');
      } finally {
        setSavingDisplaySettings(false);
      }
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload PNG, JPG, GIF, or SVG.');
      return;
    }
    
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit.');
      return;
    }
    
    if (!property?.id) {
      alert('Property not found. Please refresh the page.');
      return;
    }
    
    try {
      setSavingDisplaySettings(true);
      const response = await apiService.uploadLogo(property.id, file);
      
      if (response.logoUrl) {
        // Update display settings with the new logo URL
        setDisplaySettings(prev => ({
          ...prev,
          logoUrl: response.logoUrl
        }));
        
        // Logo upload already updates display_settings in the backend, but refresh property context
        // to ensure login page gets the updated logo
        try {
          // Clear property context cache so it reloads with updated display_settings
          sessionStorage.removeItem('property_context');
          window.dispatchEvent(new CustomEvent('propertyContextRefresh'));
          
          // Also dispatch event for login page to refresh
          window.dispatchEvent(new CustomEvent('displaySettingsUpdated', { 
            detail: { 
              propertyId: property.id,
              logoUrl: response.logoUrl
            } 
          }));
        } catch (e) {
          console.warn('Failed to refresh property context:', e);
        }
        
        alert('Logo uploaded successfully! The login page will show the new logo.');
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to upload logo: ${errorMessage}`);
    } finally {
      setSavingDisplaySettings(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const openColorPicker = (field) => {
    setSelectedColorField(field);
    setShowColorPicker(true);
  };

  const handleColorChange = async (color) => {
    if (selectedColorField) {
      await handleDisplaySettingChange(selectedColorField, color);
    }
    setShowColorPicker(false);
  };

  const resetDisplaySettings = async () => {
    if (!confirm('Are you sure you want to reset all display settings to defaults?')) {
      return;
    }
    
    const defaults = {
      companyName: property?.name || '', // Always use real property name from database
      logoUrl: '',
      primaryColor: '#000000',
      secondaryColor: '#3B82F6',
      accentColor: '#10B981',
      backgroundImage: '',
      loginLayout: 'modern',
      websiteTheme: 'light',
      headerStyle: 'fixed',
      sidebarStyle: 'collapsible',
      borderRadius: 'medium',
      fontFamily: 'inter',
      fontSize: 'medium'
    };
    
    setDisplaySettings(defaults);
    
    if (property?.id) {
      try {
        setSavingDisplaySettings(true);
        await apiService.updateDisplaySettings(property.id, defaults);
        alert('Display settings reset successfully!');
      } catch (error) {
        console.error('Failed to reset display settings:', error);
        alert('Failed to reset settings. Please try again.');
      } finally {
        setSavingDisplaySettings(false);
      }
    }
  };

  const previewLoginPage = async () => {
    // Ensure display settings are loaded before showing preview
    if (property?.id && (!displaySettings.logoUrl || Object.keys(displaySettings).length < 3)) {
      try {
        const settings = await apiService.getDisplaySettings(property.id);
        if (settings) {
          const { propertyName, ...settingsWithoutPropertyName } = settings;
          setDisplaySettings(prev => ({
            ...prev,
            ...settingsWithoutPropertyName
          }));
        }
      } catch (error) {
        console.error('Failed to load display settings for preview:', error);
      }
    }
    setShowPreviewModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Settings & Preferences</h2>
                <p className="text-sm text-gray-500">Manage your account settings and preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'account', name: 'Account', icon: User },
              { id: 'security', name: 'Security', icon: Shield },
              { id: 'notifications', name: 'Notifications', icon: Bell },
              { id: 'preferences', name: 'Preferences', icon: Settings },
              { id: 'display', name: 'Display', icon: Paintbrush },
              { id: 'data', name: 'Data', icon: Download }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            {/* Account Information Tab */}
            {activeTab === 'account' && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-600">Full Name</span>
                    <span className="text-sm text-gray-900">{currentUser?.first_name} {currentUser?.last_name}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-600">Email</span>
                    <span className="text-sm text-gray-900">{currentUser?.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-600">Role</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {isTenant ? 'Tenant' : 'Property Manager'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-600">User ID</span>
                    <span className="text-sm text-gray-900 font-mono">{currentUser?.id || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
                </div>
                <div className="space-y-4">
                  <button 
                    onClick={handlePasswordChange}
                    className="w-full flex items-center justify-between p-4 text-left bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Key className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Change Password</p>
                        <p className="text-sm text-gray-500">Update your account password</p>
                      </div>
                    </div>
                    <span className="text-gray-400">→</span>
                  </button>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-500">
                          {security.twoFactor 
                            ? 'Enabled - You will receive verification codes via email when logging in'
                            : 'Disabled - Add an extra layer of security via email'
                          }
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={security.twoFactor}
                        onChange={handleTwoFactorToggle}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* 2FA Info */}
                  {security.twoFactor && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">How Email-Based 2FA Works</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        When 2FA is enabled, you'll receive a 6-digit verification code via email each time you log in.
                      </p>
                      <p className="text-sm text-gray-700">
                        Simply enter the code sent to your email address to complete your login. No authenticator app required!
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <select
                      value={security.sessionTimeout}
                      onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
                </div>
                <div className="space-y-4">
                  {Object.entries(notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-sm text-gray-500">
                          {key === 'email' && 'Receive email notifications'}
                          {key === 'system' && 'System updates and maintenance alerts'}
                          {key === 'maintenance' && 'Maintenance requests and updates'}
                          {key === 'bills' && 'Bill notifications and payment reminders'}
                          {key === 'announcements' && 'Community announcements and news'}
                          {key === 'security' && 'Security alerts and login notifications'}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={value}
                          onChange={() => handleNotificationChange(key)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Settings className="w-4 h-4 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">User Preferences</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Theme
                    </label>
                    <select
                      value={preferences.theme}
                      onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language
                    </label>
                    <select
                      value={preferences.language}
                      onChange={(e) => handlePreferenceChange('language', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={preferences.timezone}
                      onChange={(e) => handlePreferenceChange('timezone', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="PST">Pacific Time</option>
                      <option value="EST">Eastern Time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Format
                    </label>
                    <select
                      value={preferences.dateFormat}
                      onChange={(e) => handlePreferenceChange('dateFormat', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={preferences.currency}
                      onChange={(e) => handlePreferenceChange('currency', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Feature Toggles</h4>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Staff Management</p>
                      <p className="text-sm text-gray-500">Enable or disable staff management pages for this property</p>
                    </div>
                    <div className="flex items-center">
                      <label 
                        className={`relative inline-flex items-center ${savingDisplaySettings ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={featureFlags.staffManagementEnabled}
                          onChange={(e) => {
                            if (savingDisplaySettings) {
                              e.preventDefault();
                              return;
                            }
                            // Call toggle function which handles state update and backend save
                            toggleStaffManagement();
                          }}
                          disabled={savingDisplaySettings}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${savingDisplaySettings ? 'opacity-50' : ''}`}></div>
                      </label>
                    </div>
                  </div>
                  {savingDisplaySettings && (
                    <p className="text-xs text-gray-500 mt-2">Saving...</p>
                  )}
                </div>
              </div>
            )}

            {/* Display Tab */}
            {activeTab === 'display' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Paintbrush className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Display & Branding</h3>
                  </div>
                  {savingDisplaySettings && (
                    <span className="text-sm text-gray-500">Saving...</span>
                  )}
                </div>
                {loadingDisplaySettings ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span className="ml-2 text-gray-600">Loading display settings...</span>
                  </div>
                ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Name
                    </label>
                    <input
                      type="text"
                      value={property?.name || property?.property_name || property?.title || property?.building_name || 'N/A'}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                      placeholder="Property name from database"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This is the property name from the database and cannot be edited here. It will appear on the login page for this property subdomain.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Logo
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 relative">
                        {displaySettings.logoUrl ? (
                          <img 
                            src={displaySettings.logoUrl.startsWith('http') 
                              ? displaySettings.logoUrl 
                              : displaySettings.logoUrl.startsWith('/')
                              ? `http://localhost:5001${displaySettings.logoUrl}`
                              : `http://localhost:5001/api${displaySettings.logoUrl}`} 
                            alt="Company Logo" 
                            className="w-full h-full object-contain rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : null}
                        {!displaySettings.logoUrl && (
                          <Image className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Logo
                        </label>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer"
                          style={{ backgroundColor: displaySettings.primaryColor }}
                          onClick={() => openColorPicker('primaryColor')}
                        />
                        <input
                          type="text"
                          value={displaySettings.primaryColor}
                          onChange={(e) => handleDisplaySettingChange('primaryColor', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Secondary Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer"
                          style={{ backgroundColor: displaySettings.secondaryColor }}
                          onClick={() => openColorPicker('secondaryColor')}
                        />
                        <input
                          type="text"
                          value={displaySettings.secondaryColor}
                          onChange={(e) => handleDisplaySettingChange('secondaryColor', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accent Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer"
                          style={{ backgroundColor: displaySettings.accentColor }}
                          onClick={() => openColorPicker('accentColor')}
                        />
                        <input
                          type="text"
                          value={displaySettings.accentColor}
                          onChange={(e) => handleDisplaySettingChange('accentColor', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Login Page Layout
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['modern', 'classic', 'minimal'].map((layout) => (
                        <button
                          key={layout}
                          onClick={() => handleDisplaySettingChange('loginLayout', layout)}
                          className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                            displaySettings.loginLayout === layout
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {layout.charAt(0).toUpperCase() + layout.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={previewLoginPage}
                      className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Monitor className="w-4 h-4 mr-2" />
                      Preview Login Page
                    </button>
                    <button
                      onClick={resetDisplaySettings}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Download className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
                </div>
                <div className="space-y-4">
                  <button 
                    onClick={handleDataExport}
                    className="w-full flex items-center justify-between p-4 text-left bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Download className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Export Data</p>
                        <p className="text-sm text-gray-500">Download your account data</p>
                      </div>
                    </div>
                    <span className="text-gray-400">→</span>
                  </button>
                  
                  <button 
                    onClick={handleAccountDeletion}
                    className="w-full flex items-center justify-between p-4 text-left bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Trash2 className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="font-medium text-red-900">Delete Account</p>
                        <p className="text-sm text-red-500">Permanently delete your account</p>
                      </div>
                    </div>
                    <span className="text-red-400">→</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password Change Modal */}
        {showPasswordForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
                  <button
                    onClick={() => setShowPasswordForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('current')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.current ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('new')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.new ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirm')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowPasswordForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordSubmit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color Picker Modal */}
        {showColorPicker && selectedColorField && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-70 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Choose {selectedColorField === 'primaryColor' ? 'Primary' : selectedColorField === 'secondaryColor' ? 'Secondary' : 'Accent'} Color
                  </h3>
                  <button
                    onClick={() => {
                      setShowColorPicker(false);
                      setSelectedColorField('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color Value (Hex)
                    </label>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-12 h-12 rounded-lg border-2 border-gray-300"
                        style={{ backgroundColor: displaySettings[selectedColorField] || '#000000' }}
                      />
                      <input
                        type="text"
                        value={displaySettings[selectedColorField] || '#000000'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                            handleDisplaySettingChange(selectedColorField, value);
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preset Colors
                    </label>
                    <div className="grid grid-cols-8 gap-2">
                      {[
                        '#000000', '#FFFFFF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
                        '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6'
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                            displaySettings[selectedColorField] === color
                              ? 'border-blue-500 scale-110'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowColorPicker(false);
                      setSelectedColorField('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Page Preview Modal */}
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Login Page Preview</h3>
                    <p className="text-sm text-gray-500 mt-1">Preview how your login page will look to users</p>
                  </div>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Preview */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-900">Live Preview</h4>
                    <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                      <div className="min-h-[500px] flex">
                        {/* Left Panel - Dark Theme */}
                        <div 
                          className="w-1/2 p-8 flex flex-col justify-between"
                          style={{ 
                            backgroundColor: '#1F2937',
                            backgroundImage: 'linear-gradient(135deg, #374151 0%, #1F2937 100%)'
                          }}
                        >
                          {/* Top Logo Section - Matches actual login page */}
                          <div className="flex items-center space-x-4 justify-start">
                            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 backdrop-blur flex items-center justify-center shadow-lg overflow-hidden relative">
                              {displaySettings.logoUrl && displaySettings.logoUrl.trim() !== '' ? (
                                <img 
                                  key={`preview-logo-${displaySettings.logoUrl}-${property?.id || 'none'}`}
                                  src={(() => {
                                    const logoUrl = displaySettings.logoUrl;
                                    let fullUrl;
                                    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
                                      fullUrl = logoUrl;
                                    } else if (logoUrl.startsWith('/api/')) {
                                      fullUrl = `http://localhost:5001${logoUrl}`;
                                    } else if (logoUrl.startsWith('/')) {
                                      fullUrl = `http://localhost:5001${logoUrl}`;
                                    } else {
                                      fullUrl = `http://localhost:5001/api/${logoUrl}`;
                                    }
                                    return fullUrl;
                                  })()}
                                  alt="Property Logo" 
                                  className="w-full h-full object-contain p-1"
                                  style={{ display: 'block' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    const fallback = e.target.parentElement.querySelector('.logo-fallback');
                                    if (fallback) {
                                      fallback.style.display = 'block';
                                      fallback.classList.remove('hidden');
                                    }
                                  }}
                                  onLoad={(e) => {
                                    const fallback = e.target.parentElement.querySelector('.logo-fallback');
                                    if (fallback) {
                                      fallback.style.display = 'none';
                                      fallback.classList.add('hidden');
                                    }
                                  }}
                                />
                              ) : null}
                              <svg
                                className={`w-8 h-8 text-white logo-fallback ${displaySettings.logoUrl && displaySettings.logoUrl.trim() !== '' ? 'hidden' : ''}`}
                                style={{ 
                                  display: displaySettings.logoUrl && displaySettings.logoUrl.trim() !== '' ? 'none' : 'block',
                                  position: 'absolute'
                                }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 21h18" />
                                <path d="M5 21V9l7-5 7 5v12" />
                                <path d="M9 21v-6h6v6" />
                                <path d="M9 10h.01M15 10h.01M12 7h.01" />
                              </svg>
                            </div>
                            <div className="text-white">
                              <p className="uppercase text-xs tracking-[0.4em] text-white/70">
                                Property Portal
                              </p>
                              <p className="text-xl font-semibold">{property?.name || property?.property_name || property?.title || property?.building_name || 'JACS'}</p>
                            </div>
                          </div>
                          
                          {/* Welcome Message */}
                          <div className="text-white space-y-4">
                            <h1 className="text-4xl font-bold leading-tight">
                              Welcome to {property?.name || property?.property_name || property?.title || property?.building_name || 'JACS'}
                            </h1>
                            <p className="text-xl opacity-90 font-light">by JACS</p>
                          </div>
                        </div>

                        {/* Right Panel - Light Theme */}
                        <div className="w-1/2 p-8 flex flex-col justify-center bg-white">
                          <div className="max-w-sm mx-auto w-full">
                            {/* Header - Matches actual login form */}
                            <div className="mb-8 text-center">
                              <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
                              <p className="text-sm text-gray-500 mt-1">Sign in to continue to your dashboard</p>
                            </div>

                            {/* Login Form */}
                            <div className="space-y-6 bg-white/80 backdrop-blur rounded-2xl border border-gray-100 p-6 shadow-sm">
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  placeholder="Enter Username"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="relative">
                                  <input
                                    type="password"
                                    className="w-full h-12 px-4 pr-10 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="Enter Password"
                                  />
                                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <Eye className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>

                              {/* Remember Me & Forgot Password */}
                              <div className="flex items-center justify-between">
                                <label className="flex items-center space-x-2">
                                  <input type="checkbox" className="w-4 h-4" />
                                  <span className="text-sm text-gray-600">Remember Me</span>
                                </label>
                                <button className="text-sm text-gray-600 hover:text-black transition-colors">
                                  Forgot Password?
                                </button>
                              </div>

                              {/* Login Button */}
                              <button
                                className="w-full h-12 text-white font-medium rounded-lg transition-all duration-300 shadow-sm"
                                style={{ backgroundColor: displaySettings.primaryColor || '#000000' }}
                              >
                                LOGIN
                              </button>

                              {/* Terms and Privacy Policy */}
                              <p className="text-xs text-center text-gray-400">
                                By continuing, you agree to the Terms and Privacy Policy
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settings Summary */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-900">Current Settings</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Property Name:</span>
                        <span className="text-sm text-gray-900">{property?.name || property?.property_name || property?.title || property?.building_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Layout:</span>
                        <span className="text-sm text-gray-900 capitalize">{displaySettings.loginLayout}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Theme:</span>
                        <span className="text-sm text-gray-900 capitalize">{displaySettings.websiteTheme}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Font:</span>
                        <span className="text-sm text-gray-900 capitalize">{displaySettings.fontFamily}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Border Radius:</span>
                        <span className="text-sm text-gray-900 capitalize">{displaySettings.borderRadius}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-700">Color Palette</h5>
                      <div className="flex space-x-2">
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300"
                          style={{ backgroundColor: displaySettings.primaryColor }}
                          title="Primary"
                        />
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300"
                          style={{ backgroundColor: displaySettings.secondaryColor }}
                          title="Secondary"
                        />
                        <div 
                          className="w-8 h-8 rounded-lg border border-gray-300"
                          style={{ backgroundColor: displaySettings.accentColor }}
                          title="Accent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
