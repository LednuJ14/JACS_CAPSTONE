import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, MapPin, Shield, AlertCircle, CheckCircle, Camera, Upload } from 'lucide-react';
import { apiService } from '../../../services/api';

const ProfileEditModal = ({ isOpen, onClose, currentUser, onSave }) => {
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (currentUser) {
      // Ensure address is always a string (handle case where it might be an object)
      let addressValue = '';
      if (currentUser.address) {
        if (typeof currentUser.address === 'string') {
          addressValue = currentUser.address;
        } else if (typeof currentUser.address === 'object') {
          // If address is an object, convert to string or use empty string
          addressValue = '';
        }
      }
      
      setProfileData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone_number: currentUser.phone_number || currentUser.phone || '',
        address: addressValue,
        emergency_contact_name: currentUser.emergency_contact_name || currentUser.emergency_contact || '',
        emergency_contact_phone: currentUser.emergency_contact_phone || currentUser.emergency_phone || ''
      });
      
      // Set profile image preview
      if (currentUser.profile_image_url || currentUser.avatar_url) {
        const imageUrl = currentUser.profile_image_url || currentUser.avatar_url;
        // Construct full URL if it's a relative path
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          setProfileImagePreview(imageUrl);
        } else if (imageUrl.startsWith('/uploads/')) {
          // Images from main-domain (port 5000)
          setProfileImagePreview(`http://localhost:5000${imageUrl}`);
        } else if (imageUrl.startsWith('/api/users/profile/image/')) {
          // Images from sub-domain (port 5001)
          setProfileImagePreview(`http://localhost:5001${imageUrl}`);
        } else if (imageUrl.startsWith('/api/')) {
          setProfileImagePreview(`http://localhost:5001${imageUrl}`);
        } else if (imageUrl.startsWith('/')) {
          setProfileImagePreview(`http://localhost:5001${imageUrl}`);
        } else {
          setProfileImagePreview(`http://localhost:5001/api${imageUrl}`);
        }
      } else {
        setProfileImagePreview(null);
      }
      
      setErrors({});
      setSuccessMessage('');
      setProfileImage(null);
    }
  }, [currentUser, isOpen]);

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrors({ submit: 'Invalid file type. Please upload PNG, JPG, JPEG, GIF, or WEBP.' });
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        setErrors({ submit: 'File size exceeds 2MB limit.' });
        return;
      }
      
      setProfileImage(file);
      setErrors({ submit: '' });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!profileImage) return;
    
    setUploadingImage(true);
    setErrors({});
    
    try {
      const response = await apiService.uploadProfileImage(profileImage);
      
      if (response && response.user) {
        // Update stored user data
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Update preview with new URL
        if (response.image_url) {
          const imageUrl = response.image_url;
          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            setProfileImagePreview(imageUrl);
          } else if (imageUrl.startsWith('/api/users/profile/image/')) {
            setProfileImagePreview(`http://localhost:5001${imageUrl}`);
          } else if (imageUrl.startsWith('/api/')) {
            setProfileImagePreview(`http://localhost:5001${imageUrl}`);
          } else {
            setProfileImagePreview(`http://localhost:5001/api${imageUrl}`);
          }
        }
        
        // Call parent callback if provided
        if (onSave) {
          await onSave(response.user);
        }
        
        // Dispatch event to notify Header component
        window.dispatchEvent(new CustomEvent('userUpdated'));
        
        setProfileImage(null);
        setSuccessMessage('Profile image uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      const errorMessage = error.message || error.error || 'Failed to upload profile image. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!profileData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    if (!profileData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    if (!profileData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!profileData.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setSuccessMessage('');
    setErrors({});
    
    try {
      // Upload profile image first if a new one was selected
      if (profileImage) {
        await handleImageUpload();
      }
      
      // Prepare data for API (match backend field names)
      // Ensure all string fields are properly converted to strings before trimming
      const updateData = {
        first_name: String(profileData.first_name || '').trim(),
        last_name: String(profileData.last_name || '').trim(),
        phone_number: String(profileData.phone_number || '').trim(),
        address: profileData.address ? String(profileData.address).trim() || null : null,
        emergency_contact_name: profileData.emergency_contact_name ? String(profileData.emergency_contact_name).trim() || null : null,
        emergency_contact_phone: profileData.emergency_contact_phone ? String(profileData.emergency_contact_phone).trim() || null : null
      };

      // Call API to update profile - use property base URL (subdomain backend)
      const response = await apiService.updateProfile(updateData);

      if (response && response.user) {
        // Update stored user data
        localStorage.setItem('user', JSON.stringify(response.user));
        setSuccessMessage('Profile updated successfully!');
        
        // Call parent callback if provided
        if (onSave) {
          await onSave(response.user);
        }
        
        // Dispatch event to notify Header component
        window.dispatchEvent(new CustomEvent('userUpdated'));
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      const errorMessage = error.message || error.error || 'Failed to update profile. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset profile data to original values
    if (currentUser) {
      setProfileData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone_number: currentUser.phone_number || currentUser.phone || '',
        address: currentUser.address || '',
        emergency_contact_name: currentUser.emergency_contact_name || currentUser.emergency_contact || '',
        emergency_contact_phone: currentUser.emergency_contact_phone || currentUser.emergency_phone || ''
      });
      
      // Reset profile image
      if (currentUser.profile_image_url || currentUser.avatar_url) {
        const imageUrl = currentUser.profile_image_url || currentUser.avatar_url;
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          setProfileImagePreview(imageUrl);
        } else if (imageUrl.startsWith('/uploads/')) {
          setProfileImagePreview(`http://localhost:5000${imageUrl}`);
        } else if (imageUrl.startsWith('/api/users/profile/image/')) {
          setProfileImagePreview(`http://localhost:5001${imageUrl}`);
        } else if (imageUrl.startsWith('/api/')) {
          setProfileImagePreview(`http://localhost:5001${imageUrl}`);
        } else if (imageUrl.startsWith('/')) {
          setProfileImagePreview(`http://localhost:5001${imageUrl}`);
        } else {
          setProfileImagePreview(`http://localhost:5001/api${imageUrl}`);
        }
      } else {
        setProfileImagePreview(null);
      }
    }
    setProfileImage(null);
    setErrors({});
    setSuccessMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
                <p className="text-sm text-gray-500">Update your personal information and preferences</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Profile Image Section */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 bg-gray-100 flex items-center justify-center">
                {profileImagePreview ? (
                  <img
                    src={profileImagePreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${profileImagePreview ? 'hidden' : ''}`}>
                  <User className="w-16 h-16 text-gray-400" />
                </div>
              </div>
              <label
                htmlFor="profile-image-upload"
                className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg"
              >
                <Camera className="w-5 h-5 text-white" />
                <input
                  id="profile-image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {profileImage && (
                <button
                  onClick={handleImageUpload}
                  disabled={uploadingImage}
                  className="mt-2 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload Image</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Personal & Contact Info */}
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  Personal Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={profileData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.first_name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter first name"
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.first_name}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={profileData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.last_name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter last name"
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.last_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Mail className="w-5 h-5 mr-2 text-green-600" />
                  Contact Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="email"
                        value={profileData.email}
                        disabled
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        placeholder="Email address"
                      />
                      <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="tel"
                        value={profileData.phone_number}
                        onChange={(e) => handleInputChange('phone_number', e.target.value)}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.phone_number ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter phone number"
                      />
                    </div>
                    {errors.phone_number && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.phone_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-orange-600" />
                  Address
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter street address"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Emergency Contact */}
            <div className="space-y-6">
              {/* Emergency Contact */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-red-600" />
                  Emergency Contact
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={profileData.emergency_contact_name}
                      onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter emergency contact name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={profileData.emergency_contact_phone}
                      onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter emergency contact phone"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
