import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';

const Settings = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  
  // Basic settings
  const [settings, setSettings] = useState({
    emailNotifications: true,
    language: 'English',
    theme: 'Light'
  });

  // Security state
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changing, setChanging] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [twofa, setTwofa] = useState({ enabled: false, qr: '', secret: '', code: '' });

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tenant_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (_) {}
  }, []);

  // Fetch 2FA status
  useEffect(() => {
    (async () => {
      try {
        const data = await ApiService.getTenantProfile();
        const p = data?.profile || {};
        if (typeof p.two_factor_enabled === 'boolean') {
          setTwofa(s => ({ ...s, enabled: p.two_factor_enabled }));
        }
      } catch (_) {}
    })();
  }, []);

  const handleSettingChange = (setting, value) => {
    const newSettings = { ...settings, [setting]: value };
    setSettings(newSettings);
    localStorage.setItem('tenant_settings', JSON.stringify(newSettings));
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      alert('Please fill in all password fields.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      alert('New password and confirmation do not match.');
      return;
    }
    setChanging(true);
    try {
      await ApiService.changeTenantPassword(passwords.current, passwords.next, passwords.confirm);
      alert('Password changed successfully.');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (e) {
      console.error('Change password error:', e);
      alert(e?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        {/* Modern Header with Gradient */}
        <div className="relative bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-200/60">
          <div className="flex items-center justify-between p-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={onClose}
                className="group w-10 h-10 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center hover:bg-white shadow-sm border border-gray-200/50 transition-all duration-200 hover:scale-105"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Account Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Customize your preferences and security options</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500 font-medium">Auto-saved</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(95vh-170px)] flex flex-col">
          {/* Modern Tab Navigation */}
          <div className="flex bg-gray-50/50 px-8 pt-6 pb-2">
            <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-200/60">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'profile'
                    ? 'bg-black text-white shadow-lg shadow-black/20'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Profile</span>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center space-x-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'security'
                    ? 'bg-black text-white shadow-lg shadow-black/20'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Security</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Notifications Card */}
                <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h11a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black">Notifications</h3>
                      <p className="text-sm text-black">Manage how you receive updates</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <p className="font-semibold text-black">Email Notifications</p>
                      <p className="text-sm text-black mt-1">Get property updates and important announcements</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.emailNotifications}
                        onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>
                </div>

                {/* Preferences Card */}
                <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black">Preferences</h3>
                      <p className="text-sm text-black">Customize your experience</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Language */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-black">Language</label>
                      <div className="relative">
                        <select
                          value={settings.language}
                          onChange={(e) => handleSettingChange('language', e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 appearance-none cursor-pointer font-medium text-black"
                        >
                          <option value="English">English</option>
                          <option value="Filipino">Filipino</option>
                          <option value="Spanish">Spanish</option>
                        </select>
                        <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Theme */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-black">Theme</label>
                      <div className="relative">
                        <select
                          value={settings.theme}
                          onChange={(e) => handleSettingChange('theme', e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 appearance-none cursor-pointer font-medium text-black"
                        >
                          <option value="Light">Light</option>
                          <option value="Dark">Dark</option>
                          <option value="Auto">Auto</option>
                        </select>
                        <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Two-Factor Authentication Card */}
                <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black">Two-Factor Authentication</h3>
                      <p className="text-sm text-black">Add an extra layer of security to your account</p>
                    </div>
                  </div>
                  
                  {twofa.enabled ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-xl flex items-center justify-center">
                            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-black">2FA is Active</p>
                            <p className="text-sm text-black">Your account is protected with two-factor authentication</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await ApiService.twofaEmailDisable();
                              setTwofa({ enabled: false, qr: '', secret: '', code: '' });
                              alert('Two-factor authentication disabled');
                            } catch (e) {
                              alert(e?.message || 'Failed to disable 2FA');
                            }
                          }}
                          className="px-6 py-2.5 text-sm font-semibold text-white bg-black rounded-2xl hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          Disable 2FA
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {twofa.qr ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                          <p className="text-sm text-black mb-4 font-medium">Scan this QR code with your authenticator app:</p>
                          <div className="flex flex-col sm:flex-row items-start gap-4">
                            <img src={twofa.qr} alt="2FA QR Code" className="w-32 h-32 border-2 border-gray-200 rounded-2xl bg-white p-2" />
                            <div className="flex-1 space-y-3">
                              <input
                                type="text"
                                value={twofa.code}
                                onChange={(e) => setTwofa(s => ({ ...s, code: e.target.value }))}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 font-mono text-center text-lg tracking-wider text-black"
                                placeholder="000000"
                                maxLength={6}
                              />
                              <button
                                onClick={async () => {
                                  try {
                                    await ApiService.twofaEnable(twofa.code);
                                    setTwofa({ enabled: true, qr: '', secret: '', code: '' });
                                    alert('Two-factor authentication enabled');
                                  } catch (e) {
                                    alert(e?.message || 'Failed to enable 2FA');
                                  }
                                }}
                                className="w-full px-6 py-3 text-sm font-semibold text-white bg-black rounded-2xl hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                Verify & Enable
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                          <p className="text-sm text-black mb-4 font-medium">Choose your preferred 2FA method:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              onClick={async () => {
                                try {
                                  await ApiService.twofaEmailEnable();
                                  setTwofa({ enabled: true, qr: '', secret: '', code: '' });
                                  alert('Email-based 2FA enabled');
                                } catch (e) {
                                  alert(e?.message || 'Failed to enable email 2FA');
                                }
                              }}
                              className="flex items-center justify-center space-x-2 px-6 py-3 text-sm font-semibold text-white bg-black rounded-2xl hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span>Enable via Email</span>
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await ApiService.twofaSetup();
                                  setTwofa(s => ({ ...s, qr: res?.qr_data_url || '', secret: res?.secret || '' }));
                                } catch (e) {
                                  alert(e?.message || 'Failed to setup authenticator');
                                }
                              }}
                              className="flex items-center justify-center space-x-2 px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200/60 rounded-2xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <span>Setup Authenticator</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Password Change Card */}
                <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black">Change Password</h3>
                      <p className="text-sm text-black">Update your account password</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-black mb-2">Current Password</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwords.current}
                        onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-black mb-2">New Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwords.next}
                          onChange={(e) => setPasswords(p => ({ ...p, next: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-black mb-2">Confirm Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwords.confirm}
                          onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black"
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center space-x-3 text-sm text-black cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                        />
                        <span className="font-medium">Show passwords</span>
                      </label>
                      <button
                        onClick={handleChangePassword}
                        disabled={changing}
                        className={`px-8 py-3 text-sm font-semibold text-white rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md ${
                          changing ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
                        }`}
                      >
                        {changing ? 'Changing...' : 'Update Password'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
