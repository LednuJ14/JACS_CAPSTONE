import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Building2, User, MessageCircle, Settings, LogOut, ChevronDown, Bell, Edit, CreditCard, Wrench, HelpCircle, BarChart3, Calendar } from 'lucide-react';
import { apiService } from '../../services/api';
import { useProperty } from './PropertyContext';
import ProfileEditModal from '../pages/property manager/ProfileEditModal';
import StaffProfileEditModal from '../pages/staff/StaffProfileEditModal';
import TenantProfileEditModal from '../pages/tenant/TenantProfileEditModal';
import SettingsModal from '../pages/property manager/SettingsModal';
import StaffSettingsModal from '../pages/staff/StaffSettingsModal';
import TenantSettingsModal from '../pages/tenant/TenantSettingsModal';
import TenantHelpModal from '../pages/tenant/TenantHelpModal';
import TenantChatsModal from '../pages/tenant/TenantChatsModal';
import ChatsModal from '../pages/property manager/ChatsModal';
import StaffChatsModal from '../pages/staff/StaffChatsModal';
import StaffScheduleModal from '../pages/staff/StaffScheduleModal';
import NotificationBell from './NotificationBell';

const Header = ({ userType = 'manager' }) => {
  const { property, loading: propertyLoading } = useProperty();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const [showPMChats, setShowPMChats] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const user = apiService.getStoredUser();
    setCurrentUser(user);
    // Initialize property context based on host
    apiService.getDashboardContext().catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-dropdown')) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    apiService.logout();
    navigate('/login');
  };

  const handleProfileEdit = () => {
    setShowProfileEdit(true);
    setProfileDropdownOpen(false);
  };

  const handleSettings = () => {
    setShowSettings(true);
    setProfileDropdownOpen(false);
  };

  const handleProfileSave = async (updatedUser) => {
    try {
      // Update local state with the updated user data from API
      if (updatedUser) {
        setCurrentUser(updatedUser);
        // Also update stored user in localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating user state:', error);
    }
  };

  const handleProfileClose = () => {
    setShowProfileEdit(false);
  };

  const handleSettingsClose = () => {
    setShowSettings(false);
  };

  const handleHelpClose = () => {
    setShowHelp(false);
  };

  const handleChatsClose = () => {
    setShowChats(false);
  };

  const handlePMChatsClose = () => {
    setShowPMChats(false);
  };
  const handleScheduleClose = () => {
    setShowSchedule(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Determine user context based on prop or current route
  const isTenant = userType === 'tenant' || 
    (location.pathname.startsWith('/tenant/') || location.pathname === '/tenant');
  const isStaff = userType === 'staff' || 
    (location.pathname === '/staff' || location.pathname.startsWith('/staff/'));

  // Navigation items based on user type
  const getNavigationItems = () => {
    if (isTenant) {
      return [
        { path: '/tenant', label: 'Dashboard' },
        { path: '/tenant/bills', label: 'My Bills' },
        { path: '/tenant/requests', label: 'My Requests' },
        { path: '/tenant/announcements', label: 'Announcements' },
        { path: '/tenant/documents', label: 'Documents' },
        { path: '/tenant/feedback', label: 'Feedback' }
      ];
    } else if (isStaff) {
      return [
        { path: '/staff', label: 'Dashboard' },
        { path: '/staff/tasks', label: 'Tasks' },
        { path: '/staff/requests', label: 'Requests' },
        { path: '/staff/announcements', label: 'Announcements' },
        { path: '/staff/documents', label: 'Documents' },
        { path: '/staff/feedback', label: 'Feedback' }
      ];
    } else {
      // Read feature flag from localStorage (default true)
      let staffEnabled = true;
      try {
        const stored = localStorage.getItem('feature.staffManagementEnabled');
        staffEnabled = stored === null ? true : JSON.parse(stored);
      } catch (e) {
        staffEnabled = true;
      }

      const items = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/bills', label: 'Bills' },
        { path: '/requests', label: 'Requests' },
        { path: '/feedback', label: 'Feedback' },
        { path: '/announcements', label: 'Announcements' },
        { path: '/documents', label: 'Documents' },
        { path: '/tasks', label: 'Tasks' },
        { path: '/tenants', label: 'Tenants' },
        // Conditionally include Staffs based on feature flag
        ...(staffEnabled ? [{ path: '/staffs', label: 'Staffs' }] : [])
      ];
      return items;
    }
  };

  // React to feature flag changes at runtime
  useEffect(() => {
    const handler = () => {
      // force re-render by toggling state (no-op state here)
      setProfileDropdownOpen(prev => prev); // minimal state touch to trigger render
    };
    window.addEventListener('featureFlagsChanged', handler);
    return () => window.removeEventListener('featureFlagsChanged', handler);
  }, []);

  const getFallbackPropertyName = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (!host) return null;
    const segment = host.split('.')[0];
    if (!segment || segment.toLowerCase() === 'localhost') return null;
    return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  const propertyName =
    property?.property_name ||
    property?.name ||
    property?.title ||
    property?.building_name ||
    getFallbackPropertyName() ||
    'Property Portal';

  return (
    <header className={`${isTenant ? 'bg-white shadow-sm border-b border-gray-200' : 'bg-black'} px-6 py-4 w-full`}>
      <div className="flex items-center justify-between">
        {/* Left Side - Branding */}
        <div className="flex items-center space-x-4">
          {/* Logo Icon */}
          <div className={`w-16 h-16 ${isTenant ? 'bg-gray-800' : 'bg-white'} rounded-2xl flex items-center justify-center shadow-lg`}>
            <Building2 className={`w-8 h-8 ${isTenant ? 'text-white' : 'text-gray-900'}`} />
          </div>
          
          {/* Brand Text */}
          <div>
            <h1 className={`text-2xl font-bold ${isTenant ? 'text-black' : 'text-white'}`}>{propertyName}</h1>
            <p className={`text-sm ${isTenant ? 'text-gray-600' : 'text-blue-100'}`}>
              {property?.tagline || 'Property Management Portal'}
            </p>
          </div>
        </div>

        {/* Middle - Navigation */}
        <div className="flex items-center space-x-6">
          {getNavigationItems().map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isActive(item.path)
                  ? isTenant 
                    ? 'bg-gray-100 text-black' 
                    : 'bg-white text-black'
                  : isTenant
                    ? 'text-gray-600 hover:text-black'
                    : 'text-white hover:text-gray-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right Side - User Profile */}
        <div className="flex items-center space-x-4">
          {/* Notifications (for tenant, property manager, and staff) */}
          <NotificationBell isDarkMode={!isTenant} />

          {/* Profile Dropdown */}
          <div className="relative profile-dropdown">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className={`flex items-center space-x-2 transition-colors p-2 rounded-lg hover:bg-gray-100 ${
                isTenant 
                  ? 'text-gray-600 hover:text-gray-800' 
                  : 'text-white hover:text-gray-300'
              }`}
            >
              <div className={`w-8 h-8 ${isTenant ? 'bg-gray-300' : 'bg-gray-600'} rounded-full flex items-center justify-center`}>
                <User className={`w-5 h-5 ${isTenant ? 'text-gray-600' : 'text-white'}`} />
              </div>
              {isTenant && (
                <span className="text-sm font-medium">{currentUser?.first_name || 'Profile'}</span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {currentUser?.first_name} {currentUser?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{currentUser?.email}</p>
                  {isTenant ? (
                    <p className="text-xs text-blue-600 mt-1">Tenant Account</p>
                  ) : isStaff ? (
                    <p className="text-xs text-amber-600 mt-1">Staff Account</p>
                  ) : (
                    <p className="text-xs text-green-600 mt-1">Property Manager Account</p>
                  )}
                </div>
                
                {/* Tenant Dropdown */}
                {isTenant && (
                  <>
                    <button 
                      onClick={handleProfileEdit}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </button>

                    <button 
                      onClick={() => {
                        setShowChats(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chats</span>
                    </button>

                    <button 
                      onClick={handleSettings}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setShowHelp(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>Help & Support</span>
                    </button>
                  </>
                )}

                {/* Staff Dropdown */}
                {!isTenant && isStaff && (
                  <>
                    <button 
                      onClick={handleProfileEdit}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </button>

                    <button 
                      onClick={() => {
                        setShowPMChats(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chats</span>
                    </button>
                    <button 
                      onClick={() => {
                        setShowSchedule(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Schedule</span>
                    </button>
                    
                    <button 
                      onClick={handleSettings}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                  </>
                )}

                {/* Property Manager Dropdown */}
                {!isTenant && !isStaff && (
                  <>
                    <button 
                      onClick={handleProfileEdit}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </button>

                    <button 
                      onClick={() => {
                        navigate('/analytics');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Analytics</span>
                    </button>

                    <button 
                      onClick={() => {
                        setShowPMChats(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chats</span>
                    </button>
                    
                    <button 
                      onClick={handleSettings}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                  </>
                )}
                
                <div className="border-t border-gray-100 my-1"></div>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {isTenant ? (
        <TenantProfileEditModal
          isOpen={showProfileEdit}
          onClose={handleProfileClose}
          currentUser={currentUser}
          onSave={handleProfileSave}
        />
      ) : isStaff ? (
        <StaffProfileEditModal
          isOpen={showProfileEdit}
          onClose={handleProfileClose}
          currentUser={currentUser}
          onSave={handleProfileSave}
        />
      ) : (
        <ProfileEditModal
          isOpen={showProfileEdit}
          onClose={handleProfileClose}
          currentUser={currentUser}
          onSave={handleProfileSave}
        />
      )}

      {/* Settings Modal */}
      {isTenant ? (
        <TenantSettingsModal
          isOpen={showSettings}
          onClose={handleSettingsClose}
          currentUser={currentUser}
        />
      ) : isStaff ? (
        <StaffSettingsModal
          isOpen={showSettings}
          onClose={handleSettingsClose}
          currentUser={currentUser}
        />
      ) : (
        <SettingsModal
          isOpen={showSettings}
          onClose={handleSettingsClose}
          currentUser={currentUser}
          isTenant={isTenant}
        />
      )}

      {/* Help Modal */}
      {isTenant && (
        <TenantHelpModal
          isOpen={showHelp}
          onClose={handleHelpClose}
        />
      )}

      {/* Chats Modal */}
      {isTenant && (
        <TenantChatsModal
          isOpen={showChats}
          onClose={handleChatsClose}
        />
      )}

      {/* Property Manager / Staff Chats Modal */}
      {!isTenant && (
        isStaff ? (
          <StaffChatsModal isOpen={showPMChats} onClose={handlePMChatsClose} />
        ) : (
          <ChatsModal isOpen={showPMChats} onClose={handlePMChatsClose} />
        )
      )}

      {/* Staff Schedule Modal */}
      {isStaff && (
        <StaffScheduleModal
          isOpen={showSchedule}
          onClose={handleScheduleClose}
          shifts={[
            { day: 'Mon', time: '8:00 AM - 4:00 PM', role: 'Maintenance' },
            { day: 'Wed', time: '8:00 AM - 4:00 PM', role: 'Front Desk' },
            { day: 'Fri', time: '12:00 PM - 8:00 PM', role: 'Maintenance' },
          ]}
        />
      )}
    </header>
  );
};

export default Header;
