import React, { useEffect, useState } from 'react';
import { X, Save, User, Mail, Phone, Briefcase, Wrench, Clock, Sparkles, AlertCircle, Camera, Upload } from 'lucide-react';
import { apiService } from '../../../services/api';

// Staff-only Profile Edit Modal (UI-only)
// Props: isOpen, onClose, currentUser, onSave
const StaffProfileEditModal = ({ isOpen, onClose, currentUser, onSave }) => {
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    skills: '',
    shift_preference: 'Day',
    bio: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfile({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        department: currentUser.department || '',
        position: currentUser.position || '',
        skills: currentUser.skills || '',
        shift_preference: currentUser.shift_preference || 'Day',
        bio: currentUser.bio || ''
      });
      
      // Set profile image preview
      if (currentUser.profile_image_url || currentUser.avatar_url) {
        const imageUrl = currentUser.profile_image_url || currentUser.avatar_url;
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
      
      setProfileImage(null);
    }
  }, [currentUser]);

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!profile.first_name.trim()) next.first_name = 'First name is required';
    if (!profile.last_name.trim()) next.last_name = 'Last name is required';
    if (!profile.email.trim()) next.email = 'Email is required';
    if (profile.email && !/\S+@\S+\.\S+/.test(profile.email)) next.email = 'Email is invalid';
    if (!profile.phone.trim()) next.phone = 'Phone is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrors({ submit: 'Invalid file type. Please upload PNG, JPG, JPEG, GIF, or WEBP.' });
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) {
        setErrors({ submit: 'File size exceeds 2MB limit.' });
        return;
      }
      
      setProfileImage(file);
      setErrors({ submit: '' });
      
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
        localStorage.setItem('user', JSON.stringify(response.user));
        
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
        
        if (onSave) {
          await onSave(response.user);
        }
        
        window.dispatchEvent(new CustomEvent('userUpdated'));
        
        setProfileImage(null);
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      const errorMessage = error.message || error.error || 'Failed to upload profile image. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Upload profile image first if a new one was selected
      if (profileImage) {
        await handleImageUpload();
      }
      
      await (onSave ? onSave(profile) : Promise.resolve());
      onClose && onClose();
    } catch (e) {
      // swallow for UI-only
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Staff Profile</h2>
              <p className="text-sm text-gray-500">Update staff details and preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile Image Section */}
          <div className="flex justify-center mb-6">
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
                htmlFor="staff-profile-image-upload"
                className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg"
              >
                <Camera className="w-5 h-5 text-white" />
                <input
                  id="staff-profile-image-upload"
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

          {/* Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                value={profile.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.first_name ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Enter first name"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.first_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                value={profile.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.last_name ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Enter last name"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="Enter email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={profile.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="Enter phone number"
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.phone}</p>
              )}
            </div>
          </div>

          {/* Role/Department */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-600" /> Position</label>
              <input
                value={profile.position}
                onChange={(e) => updateField('position', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Maintenance Staff"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Wrench className="w-4 h-4 text-green-600" /> Department</label>
              <select
                value={profile.department}
                onChange={(e) => updateField('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Front Desk">Front Desk</option>
                <option value="Security">Security</option>
                <option value="Administration">Administration</option>
              </select>
            </div>
          </div>

          {/* Skills and Shift */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-600" /> Skills</label>
              <input
                value={profile.skills}
                onChange={(e) => updateField('skills', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Plumbing, Electrical"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-rose-600" /> Shift Preference</label>
              <select
                value={profile.shift_preference}
                onChange={(e) => updateField('shift_preference', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Day</option>
                <option>Mid</option>
                <option>Night</option>
                <option>Rotational</option>
              </select>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
            <textarea
              rows={3}
              value={profile.bio}
              onChange={(e) => updateField('bio', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief introduction..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2 rounded-lg border text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffProfileEditModal;



