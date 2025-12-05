import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../../services/api';
import defaultProfile from '../../assets/images/default_profile.png';
import Inquiries from './Inquiries';
import Profile from './Profile';
import Settings from './Settings';

const ProfileDropdown = ({ onPageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showInquiries, setShowInquiries] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    profileImageUrl: defaultProfile
  });
  const dropdownRef = useRef(null);

  // Fetch profile data
  const fetchProfile = async () => {
    try {
      const data = await ApiService.getTenantProfile();
      const p = data?.profile || {};
      if (p && (p.first_name || p.email)) {
        setProfileData({
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          profileImageUrl: p.profile_image_url || defaultProfile
        });
        return;
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }

    // Fallback: use /auth/me for basic user info
    try {
      const me = await ApiService.me();
      const u = me?.user || {};
      setProfileData({
        firstName: u.first_name || '',
        lastName: u.last_name || '',
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
    window.addEventListener('notification-refresh', handleProfileUpdate); // Also listen to existing event

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
      window.removeEventListener('notification-refresh', handleProfileUpdate);
    };
  }, []);

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

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (option) => {
    if (option === 'inquiries') {
      setShowInquiries(true);
    } else if (option === 'profile') {
      setShowProfile(true);
    } else if (option === 'settings') {
      setShowSettings(true);
    } else {
      onPageChange(option);
    }
    setIsOpen(false);
  };

  return (
    <>
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
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
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
              onClick={() => handleOptionClick('inquiries')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Inquiries</span>
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
      </div>

      {/* Modals */}
      {showInquiries && (
        <Inquiries onClose={() => setShowInquiries(false)} />
      )}
      
      {showProfile && (
        <Profile onClose={() => setShowProfile(false)} />
      )}
      
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default ProfileDropdown;
