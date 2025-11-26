import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';
import defaultProfile from '../../assets/images/default_profile.png';

const Profile = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [realStats, setRealStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    personalInfo: {
      name: 'Loading...',
      email: '',
      phone: '',
      position: 'Property Manager',
      location: '',
      bio: 'Loading profile information...',
      avatar: defaultProfile
    },
    stats: {
      totalProperties: 0,
      activeListings: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      monthlyRevenue: '₱0',
      averageOccupancy: '0%',
      responseRate: '0%',
      averageRating: 0
    },
    recentActivity: []
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Backend expects an object under personalInfo for update
      const apiData = {
        personalInfo: {
          name: profileData.personalInfo.name,
          email: profileData.personalInfo.email,
          phone: profileData.personalInfo.phone,
          position: profileData.personalInfo.position,
          location: profileData.personalInfo.location,
          bio: profileData.personalInfo.bio
        }
      };

      const data = await ApiService.updateManagerProfile(apiData);
      const updated = data?.profile?.personalInfo || apiData.personalInfo;

      setProfileData(prev => ({
        ...prev,
        personalInfo: {
          ...prev.personalInfo,
          ...updated
        }
      }));
      
      setIsEditing(false);
      alert('✅ Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error.message || 'Failed to update profile');
      alert('❌ Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Fetch profile data
  const fetchProfileData = async () => {
    try {
      const data = await ApiService.getManagerProfile();
      const profile = data?.profile?.personalInfo || data?.personalInfo || data?.profile || {};
      
      setProfileData(prev => ({
        ...prev,
        personalInfo: {
          name: profile.name || prev.personalInfo.name,
          email: profile.email || prev.personalInfo.email,
          phone: profile.phone || prev.personalInfo.phone,
          position: profile.position || prev.personalInfo.position,
          location: profile.location || prev.personalInfo.location,
          bio: profile.bio || prev.personalInfo.bio,
          avatar: profile.avatar || defaultProfile
        },
        recentActivity: data?.recentActivity || prev.recentActivity
      }));
    } catch (error) {
      console.error('Profile fetch error:', error);
      setError('Failed to load profile data');
    }
  };

  // Fetch real property statistics and profile data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch both stats and profile data in parallel
        const token = localStorage.getItem('token');
        // Fetch stats data
        try {
          const statsData = await ApiService.request('/api/manager/properties/dashboard-stats');
          if (statsData) {
            setRealStats({
              totalProperties: statsData.stats?.total_properties || 0,
              activeListings: statsData.stats?.active_properties || 0,
              totalUnits: statsData.stats?.total_units || 0,
              occupiedUnits: statsData.stats?.occupied_units || 0,
              monthlyRevenue: `₱${(statsData.stats?.total_monthly_revenue || 0).toLocaleString()}`,
              averageOccupancy: `${Math.round(((statsData.stats?.occupied_units || 0) / (statsData.stats?.total_units || 1)) * 100)}%`,
              responseRate: '98%', // This would come from a different endpoint
              averageRating: 4.8 // This would come from a different endpoint
            });
          }
        } catch (error) {
          console.error('Stats fetch error:', error);
        }

        // Fetch profile data
        await fetchProfileData();

      } catch (error) {
        console.error('Data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (section, field, value) => {
    setProfileData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Hero Profile Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-6 lg:space-y-0 lg:space-x-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-2xl overflow-hidden ring-4 ring-white/20 shadow-2xl">
                <img
                  src={profileData.personalInfo.avatar || defaultProfile}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = defaultProfile; }}
                />
              </div>
              <button className="absolute -bottom-2 -right-2 bg-white text-gray-800 p-3 rounded-xl shadow-lg hover:bg-gray-100 transition-all duration-200 group-hover:scale-105">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold">{profileData.personalInfo.name}</h1>
                <div className="flex items-center space-x-1 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{profileData.stats.averageRating}</span>
                </div>
              </div>
              <p className="text-xl text-gray-300 mb-1">{profileData.personalInfo.position}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {profileData.personalInfo.location}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {profileData.personalInfo.phone}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-sm text-black bg-gray-100 px-2 py-1 rounded-full">+8.2%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{loading ? '...' : (realStats?.totalProperties || profileData.stats.totalProperties)}</h3>
          <p className="text-gray-600 text-sm">Total Properties</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-black bg-gray-100 px-2 py-1 rounded-full">+12.5%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{loading ? '...' : (realStats?.activeListings || profileData.stats.activeListings)}</h3>
          <p className="text-gray-600 text-sm">Active Listings</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm text-black bg-gray-100 px-2 py-1 rounded-full">+3.1%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{profileData.stats.averageOccupancy}</h3>
          <p className="text-gray-600 text-sm">Occupancy Rate</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <span className="text-sm text-black bg-gray-100 px-2 py-1 rounded-full">+15.3%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{profileData.stats.monthlyRevenue}</h3>
          <p className="text-gray-600 text-sm">Monthly Revenue</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
            <button className="text-black hover:text-gray-700 font-medium text-sm">View All</button>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {profileData.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  activity.status === 'success' ? 'bg-gray-100 text-black' :
                  activity.status === 'warning' ? 'bg-gray-200 text-black' :
                  'bg-gray-100 text-black'
                }`}>
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{activity.action}</p>
                  <p className="text-sm text-gray-600 mb-1">{activity.property}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'success' ? 'bg-black' :
                  activity.status === 'warning' ? 'bg-gray-600' :
                  'bg-black'
                }`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
            <p className="text-gray-600 mt-1">Update your personal details and contact information</p>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl transition-all duration-200 font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              value={profileData.personalInfo.name}
              onChange={(e) => handleInputChange('personalInfo', 'name', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              value={profileData.personalInfo.email}
              onChange={(e) => handleInputChange('personalInfo', 'email', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              value={profileData.personalInfo.phone}
              onChange={(e) => handleInputChange('personalInfo', 'phone', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              value={profileData.personalInfo.position}
              onChange={(e) => handleInputChange('personalInfo', 'position', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              value={profileData.personalInfo.location}
              onChange={(e) => handleInputChange('personalInfo', 'location', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
            <textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 resize-none"
              rows={4}
              value={profileData.personalInfo.bio}
              onChange={(e) => handleInputChange('personalInfo', 'bio', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </div>
        {isEditing && (
          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={() => setIsEditing(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-3 rounded-xl transition-all duration-200 font-medium ${
                saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
              } text-white`}
            >
              {saving ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="bg-black bg-opacity-50 fixed inset-0" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 h-[85vh] flex flex-col relative z-10 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Modal Header */}
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Property Manager Profile</h1>
              <p className="text-gray-600">Manage your account settings and view your property statistics</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">

            {/* Tab Navigation */}
            <div className="mb-8">
          <nav className="flex space-x-8 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'personal', label: 'Personal Info', icon: '👤' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'personal' && renderPersonalInfo()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
