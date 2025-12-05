import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../../services/api';
import defaultProfile from '../../assets/images/default_profile.png';
import Inquiries from './Inquiries';
import Settings from './Settings';
import Profile from './Profile';

const ProfileDropdown = ({ onPageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showInquiriesModal, setShowInquiriesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dropdownRef = useRef(null);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    profileImageUrl: defaultProfile
  });

  // Fetch profile data
  const fetchProfile = async () => {
    try {
      const data = await ApiService.getManagerProfile();
      const p = data?.profile?.personalInfo || data?.personalInfo || {};
      if (p && (p.name || p.email)) {
        // Parse name into first and last name
        const fullName = p.name || '';
        const nameParts = fullName.split(' ', 2);
        setProfileData({
          firstName: nameParts[0] || '',
          lastName: nameParts[1] || '',
          profileImageUrl: p.avatar || p.profile_image_url || defaultProfile
        });
        
        // If no avatar in profile, try to get from /auth/me
        if (!p.avatar && !p.profile_image_url) {
          try {
            const meData = await ApiService.me();
            const profileImageUrl = meData?.user?.profile_image_url || defaultProfile;
            setProfileData(prev => ({
              ...prev,
              profileImageUrl
            }));
          } catch (e) {
            console.error('Failed to fetch profile image from /auth/me:', e);
          }
        }
        return;
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }

    // Fallback: use /auth/me for basic user info
    try {
      const me = await ApiService.me();
      const u = me?.user || {};
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      const nameParts = fullName.split(' ', 2);
      setProfileData({
        firstName: nameParts[0] || '',
        lastName: nameParts[1] || '',
        profileImageUrl: u.profile_image_url || defaultProfile
      });
    } catch (e) {
      console.error('Fallback profile fetch error:', e);
    }
  };

  useEffect(() => {
    fetchProfile();

    // Listen for profile update events
    const handleProfileUpdate = () => {
      fetchProfile();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    window.addEventListener('notification-refresh', handleProfileUpdate);

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
      window.removeEventListener('notification-refresh', handleProfileUpdate);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOptionClick = (option) => {
    if (option === 'inquiries') {
      setShowInquiriesModal(true);
    } else if (option === 'settings') {
      setShowSettingsModal(true);
    } else if (option === 'profile') {
      setShowProfileModal(true);
    } else {
      onPageChange(option);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-white hover:border-gray-300 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
      >
        <img
          src={profileData.profileImageUrl || defaultProfile}
          alt={`${profileData.firstName} ${profileData.lastName}`.trim() || 'Profile'}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = defaultProfile; }}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          <button
            onClick={() => handleOptionClick('profile')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Profile</span>
          </button>

          <button
            onClick={() => handleOptionClick('analyticsReports')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 13l3 3 7-7" />
            </svg>
            <span>Analytics and Reports</span>
          </button>

          <button
            onClick={() => handleOptionClick('inquiries')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Inquiries</span>
          </button>

          <button
            onClick={() => handleOptionClick('manageProperty')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
            </svg>
            <span>Manage Property</span>
          </button>

          <button
            onClick={() => handleOptionClick('settings')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>

          <button
            onClick={() => handleOptionClick('billingPayment')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>Subscription Plan</span>
          </button>

          <button
            onClick={() => handleOptionClick('logout')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      )}
      
      {/* Inquiries Modal */}
      <Inquiries 
        isOpen={showInquiriesModal} 
        onClose={() => setShowInquiriesModal(false)} 
      />
      
      {/* Settings Modal */}
      <Settings 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
      
      {/* Profile Modal */}
      <Profile 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />
    </div>
  );
};

export default ProfileDropdown;


