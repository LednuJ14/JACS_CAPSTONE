import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';
import defaultProfile from '../../assets/images/default_profile.png';

const Profile = ({ onClose }) => {
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: '',
    bio: ''
  });
  
  const [originalProfileData, setOriginalProfileData] = useState(null);

  const [stats, setStats] = useState({
    totalInquiries: 0,
    activeInquiries: 0,
    memberSince: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalizeDateForInput = (value) => {
    if (!value) return '';
    // Accept 'YYYY-MM-DD' or ISO strings
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    // Accept 'MM/DD/YYYY'
    const us = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (us) return `${us[3]}-${us[1]}-${us[2]}`;
    try {
      const d = new Date(value);
      if (!isNaN(d)) {
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
      }
    } catch (_) {}
    return '';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // If a new image is selected, upload it first so subsequent profile fetch includes new URL
      if (selectedFile) {
        try {
          const up = await ApiService.uploadTenantProfileImage(selectedFile);
          if (up?.profile_image_url) {
            setPreviewUrl(up.profile_image_url);
          }
        } catch (e) {
          console.error('Profile image upload error:', e);
          alert(e?.message || 'Failed to upload profile image');
          setSaving(false);
          return;
        }
      }

      const payload = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        phone_number: profileData.phone || null,
        date_of_birth: normalizeDateForInput(profileData.dateOfBirth) || null,
        address: profileData.address || null,
        city: profileData.city || null,
        province: profileData.province || null,
        postal_code: profileData.postalCode || null,
        country: profileData.country || null,
        bio: profileData.bio || null,
      };
      const res = await ApiService.updateTenantProfile(payload);
      const updated = res?.profile || {};
      const updatedData = {
        firstName: updated.first_name || profileData.firstName,
        lastName: updated.last_name || profileData.lastName,
        email: updated.email || profileData.email,
        phone: updated.phone_number || profileData.phone,
        dateOfBirth: normalizeDateForInput(updated.date_of_birth) || profileData.dateOfBirth,
        address: updated.address || profileData.address,
        city: updated.city || profileData.city,
        province: updated.province || profileData.province,
        postalCode: updated.postal_code || profileData.postalCode,
        country: updated.country || profileData.country,
        bio: updated.bio || profileData.bio,
      };
      setProfileData(updatedData);
      if (updated.statistics) {
        setStats({
          totalInquiries: updated.statistics.total_inquiries || 0,
          activeInquiries: updated.statistics.active_inquiries || 0,
          memberSince: updated.statistics.member_since || ''
        });
      }
      // Ensure we have latest server data when modal is reopened
      try {
        const fresh = await ApiService.getTenantProfile();
        const p = fresh?.profile || {};
        const freshData = {
          firstName: p.first_name || profileData.firstName,
          lastName: p.last_name || profileData.lastName,
          email: p.email || profileData.email,
          phone: p.phone_number || profileData.phone,
          dateOfBirth: normalizeDateForInput(p.date_of_birth) || profileData.dateOfBirth,
          address: p.address || profileData.address,
          city: p.city || profileData.city,
          province: p.province || profileData.province,
          postalCode: p.postal_code || profileData.postalCode,
          country: p.country || profileData.country,
          bio: p.bio || profileData.bio,
        };
        setProfileData(freshData);
        if (p.statistics) {
          setStats({
            totalInquiries: p.statistics.total_inquiries || 0,
            activeInquiries: p.statistics.active_inquiries || 0,
            memberSince: p.statistics.member_since || ''
          });
        }
      } catch (_) {}
      setIsEditing(false);
      setSelectedFile(null);
      alert('Profile updated successfully!');
      
      // Trigger profile refresh in header
      window.dispatchEvent(new Event('profile-updated'));
      // Trigger notification refresh
      window.dispatchEvent(new Event('notification-refresh'));
    } catch (error) {
      console.error('Tenant profile update error:', error);
      alert(error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original fetched data
    if (originalProfileData) {
      setProfileData({ ...originalProfileData });
    }
    setIsEditing(false);
    setSelectedFile(null);
    setPreviewUrl(originalProfileData?.profileImageUrl || defaultProfile);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await ApiService.getTenantProfile();
        const p = data?.profile || {};
        if (p && (p.first_name || p.email)) {
          const fetchedData = {
            firstName: p.first_name || '',
            lastName: p.last_name || '',
            email: p.email || '',
            phone: p.phone_number || '',
            dateOfBirth: normalizeDateForInput(p.date_of_birth) || '',
            // Fetch address fields from registration/user record
            address: p.address || '',
            city: p.city || '',
            province: p.province || '',
            postalCode: p.postal_code || '',
            country: p.country || 'Philippines', // Default to Philippines if not set
            bio: p.bio || '',
          };
          setProfileData(fetchedData);
          setOriginalProfileData({ ...fetchedData, profileImageUrl: p.profile_image_url || defaultProfile });
          if (p.profile_image_url) setPreviewUrl(p.profile_image_url);
          else setPreviewUrl(defaultProfile);
          if (p.statistics) {
            setStats({
              totalInquiries: p.statistics.total_inquiries || 0,
              activeInquiries: p.statistics.active_inquiries || 0,
              memberSince: p.statistics.member_since || ''
            });
          }
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Tenant profile fetch error:', error);
      }

      // Fallback: use /auth/me for basic user info if tenant route fails or user is not tenant
      // This ensures we fetch address data from the User model (where registration data is stored)
      try {
        const me = await ApiService.me();
        const u = me?.user || {};
        const fallbackData = {
          firstName: u.first_name || '',
          lastName: u.last_name || '',
          email: u.email || '',
          phone: u.phone_number || '',
          dateOfBirth: normalizeDateForInput(u.date_of_birth) || '',
          // Fetch address fields from user record (includes registration address)
          address: u.address || '',
          city: u.city || '',
          province: u.province || '',
          postalCode: u.postal_code || '',
          country: u.country || 'Philippines', // Default to Philippines if not set
          bio: u.bio || '',
        };
        setProfileData(fallbackData);
        setOriginalProfileData({ ...fallbackData, profileImageUrl: u.profile_image_url || defaultProfile });
        if (u.profile_image_url) setPreviewUrl(u.profile_image_url);
        else setPreviewUrl(defaultProfile);
      } catch (e) {
        console.error('Fallback /auth/me fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[95vh] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        {/* Modern Header */}
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
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">My Profile</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your personal information and preferences</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-6 py-2.5 text-sm font-semibold text-white rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2 ${
                      saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
                    }`}
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-black rounded-2xl hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(95vh-140px)] overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
              {/* Left Column - Profile Photo */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-200/60 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-xl mx-auto bg-gradient-to-br from-gray-100 to-gray-200">
                        <img
                          src={previewUrl || defaultProfile}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = defaultProfile; }}
                        />
                      </div>
                      {isEditing && (
                        <label className="absolute bottom-2 right-2 w-12 h-12 bg-black rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all duration-200 shadow-lg hover:scale-105">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    <div className="mt-6">
                      <h3 className="text-2xl font-bold text-black">
                        {profileData.firstName} {profileData.lastName}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{profileData.email}</p>
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        Active Tenant
                      </div>
                    </div>
                    
                    {/* Enhanced Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-6">
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 hover:shadow-sm transition-all duration-200">
                        <div className="text-2xl font-bold text-black">{stats.totalInquiries}</div>
                        <div className="text-xs text-gray-500 font-medium">Total Inquiries</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 hover:shadow-sm transition-all duration-200">
                        <div className="text-2xl font-bold text-black">{stats.activeInquiries}</div>
                        <div className="text-xs text-gray-500 font-medium">Active</div>
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 hover:shadow-sm transition-all duration-200">
                        <div className="text-2xl font-bold text-black">{stats.memberSince ? new Date(stats.memberSince).getFullYear() : '-'}</div>
                        <div className="text-xs text-gray-500 font-medium">Member Since</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Profile Information */}
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-3xl p-8 border border-gray-200/60 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-black">Personal Information</h3>
                        <p className="text-sm text-black">Your basic profile details</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">First Name</label>
                        <input
                          type="text"
                          name="firstName"
                          value={profileData.firstName}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">Last Name</label>
                        <input
                          type="text"
                          name="lastName"
                          value={profileData.lastName}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">Email Address</label>
                        <input
                          type="email"
                          name="email"
                          value={profileData.email}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">Phone Number</label>
                        <input
                          type="tel"
                          name="phone"
                          value={profileData.phone}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-sm font-semibold text-black">Date of Birth</label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={profileData.dateOfBirth || ''}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-3xl p-8 border border-gray-200/60 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-black">Address Information</h3>
                        <p className="text-sm text-black">Your location details</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-sm font-semibold text-black">Address</label>
                        <textarea
                          name="address"
                          value={profileData.address}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="Enter your full address (street, apartment, suite, etc.)"
                          rows={3}
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 resize-none ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileData.city}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="Enter your city"
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">Province/State</label>
                        <input
                          type="text"
                          name="province"
                          value={profileData.province}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="Enter your province or state"
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">Postal Code</label>
                        <input
                          type="text"
                          name="postalCode"
                          value={profileData.postalCode}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="Enter postal code"
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-black">Country</label>
                        <input
                          type="text"
                          name="country"
                          value={profileData.country}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="Enter your country"
                          className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 ${
                            isEditing 
                              ? 'border-gray-200 bg-white hover:border-gray-300' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* About Me */}
                  <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-3xl p-8 border border-gray-200/60 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-black">About Me</h3>
                        <p className="text-sm text-gray-500">Tell others about yourself</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <textarea
                        name="bio"
                        value={profileData.bio || ''}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        rows={6}
                        placeholder="Write a brief description about yourself, your interests, and what you're looking for in accommodation..."
                        className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/20 focus:border-black transition-all duration-200 text-black placeholder-gray-400 resize-none leading-relaxed ${
                          isEditing 
                            ? 'border-gray-200 bg-white hover:border-gray-300' 
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      />
                      {!isEditing && !profileData.bio && (
                        <p className="text-sm text-gray-400 italic">No bio information provided yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
