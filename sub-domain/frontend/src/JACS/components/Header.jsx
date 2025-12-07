import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Building2, User, MessageCircle, Settings, LogOut, ChevronDown, Bell, Edit, CreditCard, Wrench, BarChart3, Calendar } from 'lucide-react';
import { apiService } from '../../services/api';
import { useProperty } from './PropertyContext';
import ProfileEditModal from '../pages/property manager/ProfileEditModal';
import StaffProfileEditModal from '../pages/staff/StaffProfileEditModal';
import TenantProfileEditModal from '../pages/tenant/TenantProfileEditModal';
import SettingsModal from '../pages/property manager/SettingsModal';
import StaffSettingsModal from '../pages/staff/StaffSettingsModal';
import TenantSettingsModal from '../pages/tenant/TenantSettingsModal';
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
  const [showChats, setShowChats] = useState(false);
  const [showPMChats, setShowPMChats] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const user = apiService.getStoredUser();
    setCurrentUser(user);
    // Initialize property context based on host
    apiService.getDashboardContext().catch(() => {});
    
    // Listen for user updates (e.g., after profile image upload)
    const handleUserUpdate = () => {
      const updatedUser = apiService.getStoredUser();
      setCurrentUser(updatedUser);
    };
    
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
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
      // Read feature flag from property display settings (property-specific)
      // Check if display_settings exists and is an object (parsed JSON)
      const displaySettings = property?.display_settings;
      const hasDisplaySettings = displaySettings && typeof displaySettings === 'object' && displaySettings !== null;
      
      // If display_settings exists, use the value (defaults to true if not explicitly set)
      // If display_settings doesn't exist, default to true for backward compatibility
      const staffEnabled = hasDisplaySettings
        ? (displaySettings.staffManagementEnabled !== false) // true if not explicitly false
        : true; // Default to true for backward compatibility

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

  // React to feature flag changes at runtime and property updates
  // Component automatically re-renders when `property` from context changes
  // Event listeners provide immediate feedback when settings are updated
  useEffect(() => {
    // Listen for display settings updates (e.g., when logo is uploaded)
    const handleDisplaySettingsUpdate = () => {
      // Property context will automatically refresh via propertyContextRefresh event
      // This effect will re-run when property changes, updating the logo
    };

    window.addEventListener('displaySettingsUpdated', handleDisplaySettingsUpdate);

    return () => {
      window.removeEventListener('displaySettingsUpdated', handleDisplaySettingsUpdate);
    };
  }, []);

  // Re-render when property or display settings change
  useEffect(() => {
    // No-op effect - just ensures component re-evaluates when property changes
    // The getNavigationItems function will automatically use the updated property value
  }, [property, property?.display_settings?.staffManagementEnabled, property?.display_settings?.logoUrl]);

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
          {/* Logo Icon - Uses uploaded logo from display settings */}
          <div className={`w-16 h-16 ${isTenant ? 'bg-gray-800' : 'bg-white'} rounded-2xl flex items-center justify-center shadow-xl overflow-hidden relative border-2 ${isTenant ? 'border-gray-700/50' : 'border-gray-200/80'} transition-all duration-300 hover:shadow-2xl hover:scale-105`}>
            {/* Decorative curved accent - subtle glow effects */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full ${isTenant ? 'bg-white/10' : 'bg-gray-100/60'} blur-md`}></div>
              <div className={`absolute -bottom-2 -left-2 w-6 h-6 rounded-full ${isTenant ? 'bg-white/10' : 'bg-gray-100/60'} blur-md`}></div>
              {/* Subtle gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${isTenant ? 'from-white/5 to-transparent' : 'from-gray-50/50 to-transparent'} rounded-2xl`}></div>
            </div>
            
            {property?.display_settings?.logoUrl && property.display_settings.logoUrl.trim() !== '' ? (
              <img
                key={`header-logo-${property.display_settings.logoUrl}-${property?.id || 'none'}`}
                src={(() => {
                  const logoUrl = property.display_settings.logoUrl;
                  let fullUrl;
                  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
                    fullUrl = logoUrl;
                  } else if (logoUrl.startsWith('/api/')) {
                    // Already has /api/ prefix (e.g., /api/properties/11/logo/filename.png)
                    fullUrl = `http://localhost:5001${logoUrl}`;
                  } else if (logoUrl.startsWith('/')) {
                    // Starts with / but not /api/
                    fullUrl = `http://localhost:5001${logoUrl}`;
                  } else {
                    // No leading slash
                    fullUrl = `http://localhost:5001/api/${logoUrl}`;
                  }
                  // Add cache busting query parameter to ensure fresh logo loads when updated
                  // Use property ID and logo URL hash to create a stable but unique cache buster
                  const cacheBuster = property?.id ? `${property.id}-${logoUrl.split('/').pop()}` : Date.now();
                  return `${fullUrl}?v=${cacheBuster}`;
                })()}
                alt="Property Logo"
                className="w-full h-full object-contain object-center relative z-10"
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  console.error('Header: Failed to load logo:', {
                    logoUrl: property.display_settings.logoUrl,
                    src: e.target.src,
                    propertyId: property?.id
                  });
                  e.target.style.display = 'none';
                  const fallback = e.target.parentElement.querySelector('.logo-fallback');
                  if (fallback) {
                    fallback.style.display = 'flex';
                    fallback.classList.remove('hidden');
                  }
                }}
                onLoad={(e) => {
                  console.log('Header: Logo loaded successfully:', e.target.src);
                  const fallback = e.target.parentElement.querySelector('.logo-fallback');
                  if (fallback) {
                    fallback.style.display = 'none';
                    fallback.classList.add('hidden');
                  }
                }}
              />
            ) : null}
            <div 
              className={`logo-fallback w-full h-full flex items-center justify-center relative z-10 ${property?.display_settings?.logoUrl && property.display_settings.logoUrl.trim() !== '' ? 'hidden' : ''}`}
              style={{ 
                display: property?.display_settings?.logoUrl && property.display_settings.logoUrl.trim() !== '' ? 'none' : 'flex',
                position: 'absolute',
                inset: 0
              }}
            >
              <Building2 className={`w-8 h-8 ${isTenant ? 'text-white' : 'text-gray-900'}`} />
            </div>
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
              <div className={`w-8 h-8 ${isTenant ? 'bg-gray-300' : 'bg-gray-600'} rounded-full flex items-center justify-center overflow-hidden relative`}>
                {currentUser?.profile_image_url || currentUser?.avatar_url ? (
                  <img
                    src={(() => {
                      const imageUrl = currentUser.profile_image_url || currentUser.avatar_url;
                      // If it's already a full URL, use it as-is
                      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                        return imageUrl;
                      }
                      // If it starts with /uploads/, it's from main-domain (port 5000)
                      else if (imageUrl.startsWith('/uploads/')) {
                        return `http://localhost:5000${imageUrl}`;
                      }
                      // If it starts with /api/users/profile/image/, it's from sub-domain (port 5001)
                      else if (imageUrl.startsWith('/api/users/profile/image/')) {
                        return `http://localhost:5001${imageUrl}`;
                      }
                      // If it starts with /api/, assume sub-domain
                      else if (imageUrl.startsWith('/api/')) {
                        return `http://localhost:5001${imageUrl}`;
                      }
                      // If it starts with /, assume sub-domain
                      else if (imageUrl.startsWith('/')) {
                        return `http://localhost:5001${imageUrl}`;
                      }
                      // Otherwise, prepend sub-domain API path
                      else {
                        return `http://localhost:5001/api${imageUrl}`;
                      }
                    })()}
                    alt={`${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 'Profile'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.nextSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-full h-full flex items-center justify-center ${currentUser?.profile_image_url || currentUser?.avatar_url ? 'hidden' : ''}`}
                  style={{ display: (currentUser?.profile_image_url || currentUser?.avatar_url) ? 'none' : 'flex' }}
                >
                  <User className={`w-5 h-5 ${isTenant ? 'text-gray-600' : 'text-white'}`} />
                </div>
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
