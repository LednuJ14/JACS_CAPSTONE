import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';
import { getImageUrl } from '../../config/api';
import defaultProfile from '../../assets/images/default_profile.png';

const Profile = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [realStats, setRealStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    personalInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: 'Property Manager',
      avatar: defaultProfile
    },
    stats: {
      totalProperties: 0,
      activeListings: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      monthlyRevenue: 0,
      averageOccupancy: 0
    },
    recentActivity: []
  });

  const [originalProfileData, setOriginalProfileData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(defaultProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    
    try {
      // If a new image is selected, upload it first
      if (selectedFile) {
        try {
          const uploadResponse = await ApiService.uploadManagerProfileImage(selectedFile);
          if (uploadResponse?.profile_image_url) {
            setPreviewUrl(getImageUrl(uploadResponse.profile_image_url));
            setProfileData(prev => ({
              ...prev,
              personalInfo: {
                ...prev.personalInfo,
                avatar: uploadResponse.profile_image_url
              }
            }));
          }
        } catch (uploadError) {
          console.error('Profile image upload error:', uploadError);
          alert('Failed to upload profile image. Profile will be updated without image change.');
        }
      }

      const fullName = `${profileData.personalInfo.firstName} ${profileData.personalInfo.lastName}`.trim();
      
      const apiData = {
        personalInfo: {
          name: fullName,
          email: profileData.personalInfo.email,
          phone: profileData.personalInfo.phone || null,
          position: profileData.personalInfo.position
        }
      };

      const data = await ApiService.updateManagerProfile(apiData);
      const updated = data?.profile?.personalInfo || {};

      const updatedName = updated.name || fullName;
      const nameParts = updatedName.split(' ', 2);
      
      const updatedData = {
        personalInfo: {
          firstName: nameParts[0] || profileData.personalInfo.firstName,
          lastName: nameParts[1] || profileData.personalInfo.lastName,
          email: updated.email || profileData.personalInfo.email,
          phone: updated.phone || profileData.personalInfo.phone,
          position: updated.position || profileData.personalInfo.position,
          avatar: updated.avatar || profileData.personalInfo.avatar || previewUrl
        }
      };

      setProfileData(prev => ({
        ...prev,
        ...updatedData
      }));
      
      setOriginalProfileData(prev => prev ? { ...prev, ...updatedData } : null);
      setIsEditing(false);
      setSelectedFile(null);
      alert('✅ Profile updated successfully!');
      
      window.dispatchEvent(new Event('profile-updated'));
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error.message || 'Failed to update profile');
      alert('❌ Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fetchProfileData = async () => {
    try {
      const data = await ApiService.getManagerProfile();
      const profile = data?.profile?.personalInfo || data?.personalInfo || data?.profile || {};
      
      const fullName = profile.name || '';
      const nameParts = fullName.split(' ', 2);
      const firstName = nameParts[0] || '';
      const lastName = nameParts[1] || '';
      
      let profileImageUrl = profile.avatar || profile.profile_image_url || defaultProfile;
      if (!profile.avatar && !profile.profile_image_url) {
        try {
          const meData = await ApiService.me();
          const imageUrl = meData?.user?.profile_image_url;
          profileImageUrl = imageUrl ? getImageUrl(imageUrl) : defaultProfile;
        } catch (e) {
          console.error('Failed to fetch profile image from /auth/me:', e);
        }
      } else {
        profileImageUrl = getImageUrl(profileImageUrl) || defaultProfile;
      }
      
      const fetchedData = {
        personalInfo: {
          firstName: firstName,
          lastName: lastName,
          email: profile.email || '',
          phone: profile.phone || '',
          position: profile.position || 'Property Manager',
          avatar: profileImageUrl
        },
        recentActivity: data?.profile?.recentActivity || data?.recentActivity || []
      };
      
      setProfileData(prev => ({
        ...prev,
        ...fetchedData
      }));
      
      setOriginalProfileData(fetchedData);
      setPreviewUrl(profileImageUrl);
    } catch (error) {
      console.error('Profile fetch error:', error);
      setError('Failed to load profile data');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch dashboard stats
        try {
          const statsData = await ApiService.request('/api/manager/properties/dashboard-stats');
          if (statsData && statsData.stats) {
            const stats = statsData.stats;
            
            // Fetch properties to calculate units
            let totalUnits = 0;
            let occupiedUnits = 0;
            try {
              const propertiesData = await ApiService.getMyProperties({ page: 1, per_page: 1000 });
              if (propertiesData && propertiesData.properties) {
                // Calculate total units and occupied units from properties
                propertiesData.properties.forEach(property => {
                  if (property.total_units) totalUnits += parseInt(property.total_units) || 0;
                  if (property.occupied_units) occupiedUnits += parseInt(property.occupied_units) || 0;
                });
              }
            } catch (unitsError) {
              console.warn('Failed to fetch units data:', unitsError);
            }
            
            // Calculate occupancy rate
            const occupancyRate = totalUnits > 0 
              ? Math.round((occupiedUnits / totalUnits) * 100) 
              : 0;
            
            setRealStats({
              totalProperties: stats.total_properties || 0,
              activeListings: stats.active_properties || 0,
              pendingProperties: stats.pending_properties || 0,
              rejectedProperties: stats.rejected_properties || 0,
              totalUnits: totalUnits,
              occupiedUnits: occupiedUnits,
              monthlyRevenue: stats.total_monthly_revenue || 0,
              averageOccupancy: occupancyRate,
              portalsEnabled: stats.portals_enabled || 0,
              averageRent: stats.average_rent || 0
            });
          }
        } catch (error) {
          console.error('Stats fetch error:', error);
        }

        await fetchProfileData();

      } catch (error) {
        console.error('Data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleInputChange = (section, field, value) => {
    setProfileData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleCancel = () => {
    if (originalProfileData) {
      setProfileData(prev => ({
        ...prev,
        personalInfo: { ...originalProfileData.personalInfo }
      }));
      setPreviewUrl(originalProfileData.personalInfo.avatar || defaultProfile);
    }
    setIsEditing(false);
    setSelectedFile(null);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="relative overflow-hidden bg-black rounded-3xl shadow-2xl">
        <div className="relative p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
            {/* Profile Image */}
            <div className="relative group">
              <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-3xl overflow-hidden ring-4 ring-white/10 shadow-2xl bg-gray-900">
                <img
                  src={previewUrl || profileData.personalInfo.avatar || defaultProfile}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = defaultProfile; }}
                />
              </div>
              {isEditing && (
                <label className="absolute -bottom-2 -right-2 bg-white hover:bg-gray-100 text-black p-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group-hover:scale-105 border-2 border-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Profile Info */}
            <div className="flex-1 text-white">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <h1 className="text-3xl lg:text-4xl font-bold">
                  {`${profileData.personalInfo.firstName} ${profileData.personalInfo.lastName}`.trim() || 'Property Manager'}
                </h1>
              </div>
              <p className="text-xl text-gray-300 mb-4 font-medium">{profileData.personalInfo.position}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {profileData.personalInfo.email}
                </span>
                {profileData.personalInfo.phone && (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {profileData.personalInfo.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:shadow-2xl hover:border-black transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-black mb-1">{loading ? '...' : (realStats?.totalProperties || 0)}</h3>
          <p className="text-sm font-medium text-gray-600">Total Properties</p>
        </div>

        <div className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:shadow-2xl hover:border-black transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-black mb-1">{loading ? '...' : (realStats?.activeListings || 0)}</h3>
          <p className="text-sm font-medium text-gray-600">Active Listings</p>
        </div>

        <div className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:shadow-2xl hover:border-black transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-black mb-1">{realStats?.averageOccupancy || 0}%</h3>
          <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
        </div>

        <div className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:shadow-2xl hover:border-black transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-black mb-1">₱{loading ? '...' : ((realStats?.monthlyRevenue || 0).toLocaleString())}</h3>
          <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-black">Total Units</h3>
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          </div>
          <div className="text-4xl font-bold text-black mb-2">{loading ? '...' : (realStats?.totalUnits || 0)}</div>
          <p className="text-sm text-gray-600">{loading ? '...' : (realStats?.occupiedUnits || 0)} units occupied</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-black">Pending Properties</h3>
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-4xl font-bold text-black mb-2">{loading ? '...' : (realStats?.pendingProperties || 0)}</div>
          <p className="text-sm text-gray-600">Awaiting approval</p>
        </div>
      </div>

      {/* Recent Activity */}
      {profileData.recentActivity && profileData.recentActivity.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
              <button className="text-sm font-semibold text-gray-600 hover:text-black transition-colors">View All</button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {profileData.recentActivity.map((activity, idx) => (
                <div key={activity.id || idx} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-gray-100 text-black border-2 border-gray-200">
                    {activity.icon || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black mb-1">{activity.action}</p>
                    <p className="text-sm text-gray-600 mb-1">{activity.property}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-black"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 lg:p-8 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Personal Information</h3>
            <p className="text-gray-600">Update your personal details and contact information</p>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-6 py-3 rounded-2xl transition-all duration-200 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl ${
              isEditing 
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-gray-200' 
                : 'bg-black hover:bg-gray-800 text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isEditing ? "M6 18L18 6M6 6l12 12" : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
            </svg>
            <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </button>
        </div>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">First Name</label>
            <input
              type="text"
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-black/10 focus:border-black transition-all duration-200 font-medium ${
                isEditing 
                  ? 'border-gray-300 bg-white hover:border-gray-400' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              value={profileData.personalInfo.firstName}
              onChange={(e) => handleInputChange('personalInfo', 'firstName', e.target.value)}
              disabled={!isEditing}
              placeholder="Enter first name"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">Last Name</label>
            <input
              type="text"
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-black/10 focus:border-black transition-all duration-200 font-medium ${
                isEditing 
                  ? 'border-gray-300 bg-white hover:border-gray-400' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              value={profileData.personalInfo.lastName}
              onChange={(e) => handleInputChange('personalInfo', 'lastName', e.target.value)}
              disabled={!isEditing}
              placeholder="Enter last name"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">Email Address</label>
            <input
              type="email"
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-black/10 focus:border-black transition-all duration-200 font-medium ${
                isEditing 
                  ? 'border-gray-300 bg-white hover:border-gray-400' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              value={profileData.personalInfo.email}
              onChange={(e) => handleInputChange('personalInfo', 'email', e.target.value)}
              disabled={!isEditing}
              placeholder="Enter email address"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">Phone Number</label>
            <input
              type="tel"
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-black/10 focus:border-black transition-all duration-200 font-medium ${
                isEditing 
                  ? 'border-gray-300 bg-white hover:border-gray-400' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              value={profileData.personalInfo.phone}
              onChange={(e) => handleInputChange('personalInfo', 'phone', e.target.value)}
              disabled={!isEditing}
              placeholder="Enter phone number"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-bold text-gray-900">Position</label>
            <input
              type="text"
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-black/10 focus:border-black transition-all duration-200 font-medium ${
                isEditing 
                  ? 'border-gray-300 bg-white hover:border-gray-400' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              value={profileData.personalInfo.position}
              onChange={(e) => handleInputChange('personalInfo', 'position', e.target.value)}
              disabled={!isEditing}
              placeholder="Enter position"
            />
          </div>
        </div>
        {isEditing && (
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={handleCancel}
              className="px-6 py-3.5 border-2 border-gray-300 text-gray-700 rounded-2xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-3.5 rounded-2xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl ${
                saving 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-black hover:bg-gray-800 text-white'
              }`}
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Changes</span>
                </div>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="bg-black/60 backdrop-blur-sm fixed inset-0 transition-opacity" 
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-7xl w-full h-[90vh] max-h-[90vh] flex flex-col relative z-10 overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 p-6 lg:p-8 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Property Manager Profile</h1>
              <p className="text-gray-600">Manage your account settings and view your property statistics</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white hover:bg-gray-100 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-200"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 lg:px-8 pt-6 border-b border-gray-200 flex-shrink-0">
          <nav className="flex space-x-1">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'personal', label: 'Personal Info', icon: '👤' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-6 border-b-3 font-semibold text-sm transition-all duration-200 rounded-t-2xl ${
                  activeTab === tab.id
                    ? 'border-black text-black bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'personal' && renderPersonalInfo()}
        </div>
      </div>
    </div>
  );
};

export default Profile;
