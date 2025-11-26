import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const AdminSettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'JACS Property Management',
    siteDescription: 'Professional property management platform',
    maintenanceMode: false,
    emailNotifications: true,
    smsNotifications: false,
    autoBackup: true,
    backupFrequency: 'daily',
    maxFileSize: '10',
    allowedFileTypes: ['jpg', 'png', 'pdf', 'doc'],
    sessionTimeout: '30',
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  });

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // For now, we'll use localStorage to simulate API
      const savedSettings = localStorage.getItem('adminSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      // Simulate API call - replace with actual API when available
      localStorage.setItem('adminSettings', JSON.stringify(settings));
      
      // Show success message
      alert('Settings saved successfully!');
      
      // Close modal after successful save
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      setSettings({
        siteName: 'JACS Property Management',
        siteDescription: 'Professional property management platform',
        maintenanceMode: false,
        emailNotifications: true,
        smsNotifications: false,
        autoBackup: true,
        backupFrequency: 'daily',
        maxFileSize: '10',
        allowedFileTypes: ['jpg', 'png', 'pdf', 'doc'],
        sessionTimeout: '30',
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true
        }
      });
    }
  };

  const createBackup = async () => {
    try {
      setLoading(true);
      // Simulate backup creation
      const backupData = {
        timestamp: new Date().toISOString(),
        settings: settings,
        version: '1.0.0'
      };
      
      // Create downloadable backup file
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `jacs-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      alert('Backup created and downloaded successfully!');
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Failed to create backup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleInputChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePasswordPolicyChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      passwordPolicy: {
        ...prev.passwordPolicy,
        [key]: value
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-black text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">System Settings</h2>
                <p className="text-gray-300 text-sm mt-1">Configure platform settings and preferences</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex h-[calc(90vh-160px)]">
            {/* Sidebar Tabs */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
              <nav className="space-y-2">
                {[
                  { id: 'general', name: 'General' },
                  { id: 'notifications', name: 'Notifications' },
                  { id: 'security', name: 'Security' },
                  { id: 'backup', name: 'Backup & Storage' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeTab === tab.id
                        ? 'bg-black text-white shadow-lg'
                        : 'text-black hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                  <span className="ml-3 text-gray-600">Loading settings...</span>
                </div>
              )}
              {!loading && activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    General Settings
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-black mb-2">Site Name</label>
                      <input
                        type="text"
                        value={settings.siteName}
                        onChange={(e) => handleInputChange('siteName', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                        placeholder="Enter site name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-black mb-2">Site Description</label>
                      <input
                        type="text"
                        value={settings.siteDescription}
                        onChange={(e) => handleInputChange('siteDescription', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                        placeholder="Enter site description"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-black mb-2">Session Timeout</label>
                      <select
                        value={settings.sessionTimeout}
                        onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="120">2 hours</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-black mb-2">Maximum File Size (MB)</label>
                      <input
                        type="number"
                        value={settings.maxFileSize}
                        onChange={(e) => handleInputChange('maxFileSize', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                        placeholder="10"
                        min="1"
                        max="100"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">Maintenance Mode</h4>
                        <p className="text-gray-600 mt-1">Temporarily disable the platform for maintenance</p>
                      </div>
                      <button
                        onClick={() => handleToggle('maintenanceMode')}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ${
                          settings.maintenanceMode ? 'bg-black shadow-lg' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                            settings.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!loading && activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Notification Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg">
                            Email Notifications
                          </h4>
                          <p className="text-gray-600 mt-1">Receive important notifications via email</p>
                        </div>
                        <button
                          onClick={() => handleToggle('emailNotifications')}
                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ${
                            settings.emailNotifications ? 'bg-black shadow-lg' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                              settings.emailNotifications ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg">
                            SMS Notifications
                          </h4>
                          <p className="text-gray-600 mt-1">Receive urgent notifications via SMS</p>
                        </div>
                        <button
                          onClick={() => handleToggle('smsNotifications')}
                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ${
                            settings.smsNotifications ? 'bg-black shadow-lg' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                              settings.smsNotifications ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!loading && activeTab === 'security' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Security Settings
                  </h3>
                  
                  <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
                    <h4 className="font-bold text-gray-900 text-lg mb-6">
                      Password Policy
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-black mb-2">Minimum Length</label>
                        <input
                          type="number"
                          value={settings.passwordPolicy.minLength}
                          onChange={(e) => handlePasswordPolicyChange('minLength', e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                          min="6"
                          max="20"
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                          <input
                            type="checkbox"
                            checked={settings.passwordPolicy.requireUppercase}
                            onChange={(e) => handlePasswordPolicyChange('requireUppercase', e.target.checked)}
                            className="w-5 h-5 text-black border-2 border-gray-300 rounded focus:ring-black"
                          />
                          <label className="ml-3 text-sm font-medium text-gray-700">Require uppercase letters (A-Z)</label>
                        </div>
                        
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                          <input
                            type="checkbox"
                            checked={settings.passwordPolicy.requireLowercase}
                            onChange={(e) => handlePasswordPolicyChange('requireLowercase', e.target.checked)}
                            className="w-5 h-5 text-black border-2 border-gray-300 rounded focus:ring-black"
                          />
                          <label className="ml-3 text-sm font-medium text-gray-700">Require lowercase letters (a-z)</label>
                        </div>
                        
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                          <input
                            type="checkbox"
                            checked={settings.passwordPolicy.requireNumbers}
                            onChange={(e) => handlePasswordPolicyChange('requireNumbers', e.target.checked)}
                            className="w-5 h-5 text-black border-2 border-gray-300 rounded focus:ring-black"
                          />
                          <label className="ml-3 text-sm font-medium text-gray-700">Require numbers (0-9)</label>
                        </div>
                        
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                          <input
                            type="checkbox"
                            checked={settings.passwordPolicy.requireSpecialChars}
                            onChange={(e) => handlePasswordPolicyChange('requireSpecialChars', e.target.checked)}
                            className="w-5 h-5 text-black border-2 border-gray-300 rounded focus:ring-black"
                          />
                          <label className="ml-3 text-sm font-medium text-gray-700">Require special characters (!@#$%)</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!loading && activeTab === 'backup' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Backup & Storage Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg">
                            Automatic Backup
                          </h4>
                          <p className="text-gray-600 mt-1">Automatically backup system data regularly</p>
                        </div>
                        <button
                          onClick={() => handleToggle('autoBackup')}
                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ${
                            settings.autoBackup ? 'bg-black shadow-lg' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                              settings.autoBackup ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
                      <label className="block text-sm font-bold text-black mb-3">Backup Frequency</label>
                      <select
                        value={settings.backupFrequency}
                        onChange={(e) => handleInputChange('backupFrequency', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                        disabled={!settings.autoBackup}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-2xl border-2 border-gray-200">
                      <h4 className="font-bold text-gray-900 text-lg mb-3">
                        Manual Backup
                      </h4>
                      <p className="text-gray-600 mb-4">Create an immediate backup of all system data and settings</p>
                      <button 
                        onClick={createBackup}
                        disabled={loading}
                        className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating Backup...
                          </span>
                        ) : (
                          'Create Backup Now'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={resetToDefaults}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
            >
              Reset to Defaults
            </button>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
