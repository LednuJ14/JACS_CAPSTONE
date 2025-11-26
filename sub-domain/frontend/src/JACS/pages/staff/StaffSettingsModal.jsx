import React, { useState, useEffect } from 'react';
import { X, Bell, Moon, Sun, Shield, Languages, Globe, Save, AlertCircle } from 'lucide-react';

// UI-only Staff Settings Modal
const StaffSettingsModal = ({ isOpen, onClose, currentUser }) => {
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    notifications: {
      announcements: true,
      requests: true,
      schedule: true,
      messages: true,
    },
    privacy: {
      showEmail: true,
      showPhone: false,
    },
  });

  useEffect(() => {
    // Could hydrate from localStorage in future; UI-only now
  }, []);

  if (!isOpen) return null;

  const setNotif = (key, value) => setPreferences(p => ({ ...p, notifications: { ...p.notifications, [key]: value } }));
  const setPriv = (key, value) => setPreferences(p => ({ ...p, privacy: { ...p.privacy, [key]: value } }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Settings</h2>
              <p className="text-sm text-gray-500">Personalize your experience</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Moon className="w-4 h-4" /> Appearance</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreferences(p => ({ ...p, theme: 'light' }))} className={`px-3 py-2 rounded-lg border text-sm ${preferences.theme === 'light' ? 'bg-white border-gray-900 text-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>Light</button>
              <button onClick={() => setPreferences(p => ({ ...p, theme: 'dark' }))} className={`px-3 py-2 rounded-lg border text-sm ${preferences.theme === 'dark' ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>Dark</button>
              <button onClick={() => setPreferences(p => ({ ...p, theme: 'system' }))} className={`px-3 py-2 rounded-lg border text-sm ${preferences.theme === 'system' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>System</button>
            </div>
          </div>

          {/* Language & Timezone */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Languages className="w-4 h-4" /> Language & Time</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Language</label>
                <select value={preferences.language} onChange={(e) => setPreferences(p => ({ ...p, language: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="en">English</option>
                  <option value="fil">Filipino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Timezone</label>
                <select value={preferences.timezone} onChange={(e) => setPreferences(p => ({ ...p, timezone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="UTC">UTC</option>
                  <option value="Asia/Manila">Asia/Manila</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(preferences.notifications).map(([key, val]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-gray-700">
                  <input type="checkbox" checked={val} onChange={(e) => setNotif(key, e.target.checked)} className="w-4 h-4" />
                  <span className="capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Privacy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(preferences.privacy).map(([key, val]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-gray-700">
                  <input type="checkbox" checked={val} onChange={(e) => setPriv(key, e.target.checked)} className="w-4 h-4" />
                  <span className="capitalize">{key.replace('show', 'Show ')}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> These settings only affect what others see in the app.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border text-gray-700 bg-white hover:bg-gray-100">Close</button>
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
        </div>
      </div>
    </div>
  );
};

export default StaffSettingsModal;


