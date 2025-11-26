import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import { apiService } from '../../../services/api';
import { Bell, Megaphone, CalendarDays, Tag, Loader2, RefreshCw, Edit, X, Send, FileText, Settings, Pin, Plus } from 'lucide-react';

const StaffAnnouncementsPage = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [createError, setCreateError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    announcement_type: 'general',
    priority: 'medium',
    is_pinned: false,
    send_notification: false,
    target_audience: 'all'
  });

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    const user = apiService.getStoredUser();
    setCurrentUser(user);
    fetchAnnouncements();
  }, [navigate]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAnnouncements();
      setAnnouncements(response.data.announcements || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setError(err?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  };

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      announcement_type: announcement.announcement_type || 'general',
      priority: announcement.priority || 'medium',
      is_pinned: announcement.is_pinned || false,
      send_notification: false,
      target_audience: 'all'
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingAnnouncement(null);
    setForm({
      title: '',
      content: '',
      announcement_type: 'general',
      priority: 'medium',
      is_pinned: false,
      send_notification: false,
      target_audience: 'all'
    });
    setSaving(false);
    setEditError(null);
  };

  const handleUpdateAnnouncement = async () => {
    setEditError(null);
    if (!form.title || !form.content) {
      setEditError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.updateAnnouncement(editingAnnouncement.id, form);
      
      // Update the announcement in the list
      const updatedAnnouncement = response.data.announcement;
      setAnnouncements(announcements.map(a => 
        a.id === updatedAnnouncement.id ? updatedAnnouncement : a
      ));
      closeEditModal();
    } catch (e) {
      console.error('Update announcement error:', e);
      setEditError(e?.response?.data?.error || e?.message || 'Failed to update announcement');
    } finally {
      setSaving(false);
    }
  };

  // Check if current user is the author of an announcement
  const isAuthor = (announcement) => {
    if (!currentUser || !announcement) return false;
    // Check by user ID or published_by
    return (announcement.published_by === currentUser.id) || 
           (announcement.author && announcement.author.id === currentUser.id);
  };

  const openCreateModal = () => {
    setCreateError(null);
    setForm({
      title: '',
      content: '',
      announcement_type: 'general',
      priority: 'medium',
      is_pinned: false,
      send_notification: true,
      target_audience: 'all'
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm({
      title: '',
      content: '',
      announcement_type: 'general',
      priority: 'medium',
      is_pinned: false,
      send_notification: true,
      target_audience: 'all'
    });
    setSaving(false);
    setCreateError(null);
  };

  const handleCreateAnnouncement = async () => {
    setCreateError(null);
    if (!form.title || !form.content) {
      setCreateError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.createAnnouncement(form);
      
      // Add the new announcement to the list
      const newAnnouncement = response.data.announcement;
      setAnnouncements([newAnnouncement, ...announcements]);
      closeCreateModal();
    } catch (e) {
      console.error('Create announcement error:', e);
      setCreateError(e?.response?.data?.error || e?.message || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading announcements...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchAnnouncements}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="staff" />

      <main className="px-4 py-8 w-full">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Announcements</h1>
              <p className="text-gray-600 text-sm">Latest updates from management</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={openCreateModal}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Create Announcement</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  <Megaphone className="w-4 h-4 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                  {ann.is_pinned && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Pinned</span>
                  )}
                </div>
                {/* Show edit button only if current user is the author */}
                {isAuthor(ann) && (
                  <button
                    onClick={() => handleEditAnnouncement(ann)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Edit announcement"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> 
                  {new Date(ann.created_at).toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Tag className="w-3 h-3" /> 
                  {ann.announcement_type}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  ann.priority === 'high' ? 'bg-red-100 text-red-800' :
                  ann.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {ann.priority} priority
                </span>
              </div>
              <p className="text-sm text-gray-700">{ann.content}</p>
              {ann.author && (
                <div className="mt-2 text-xs text-gray-500">
                  By {ann.author.first_name} {ann.author.last_name}
                </div>
              )}
            </div>
          ))}
          </div>

          {announcements.length === 0 && (
            <div className="bg-white border rounded-xl p-8 text-center text-sm text-gray-600">
              No announcements available.
            </div>
          )}
        </div>
      </main>

      {/* Edit Announcement Modal */}
      {showEditModal && editingAnnouncement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit Announcement</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">
                {editError}
              </div>
            )}

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Basic Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter announcement title..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter announcement content..."
                      rows={6}
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={form.announcement_type}
                      onChange={(e) => setForm({ ...form, announcement_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="general">General</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="payment">Payment</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                    <select
                      value={form.target_audience}
                      onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All (Staff & Tenants)</option>
                      <option value="tenants">Tenants Only</option>
                      <option value="staff">Staff Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Options
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="edit_is_pinned"
                      checked={form.is_pinned}
                      onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="edit_is_pinned" className="text-sm font-medium text-gray-700 flex items-center">
                      <Pin className="w-4 h-4 mr-1" />
                      Pin this announcement to the top
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="edit_send_notification"
                      checked={form.send_notification}
                      onChange={(e) => setForm({ ...form, send_notification: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="edit_send_notification" className="text-sm font-medium text-gray-700 flex items-center">
                      <Bell className="w-4 h-4 mr-1" />
                      Send push notification to residents
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAnnouncement}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Update Announcement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create New Announcement</h2>
              <button
                onClick={closeCreateModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">
                {createError}
              </div>
            )}

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Basic Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter announcement title..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter announcement content..."
                      rows={6}
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={form.announcement_type}
                      onChange={(e) => setForm({ ...form, announcement_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="general">General</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="payment">Payment</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                    <select
                      value={form.target_audience}
                      onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All (Staff & Tenants)</option>
                      <option value="tenants">Tenants Only</option>
                      <option value="staff">Staff Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Options
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="create_is_pinned"
                      checked={form.is_pinned}
                      onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="create_is_pinned" className="text-sm font-medium text-gray-700 flex items-center">
                      <Pin className="w-4 h-4 mr-1" />
                      Pin this announcement to the top
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="create_send_notification"
                      checked={form.send_notification}
                      onChange={(e) => setForm({ ...form, send_notification: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="create_send_notification" className="text-sm font-medium text-gray-700 flex items-center">
                      <Bell className="w-4 h-4 mr-1" />
                      Send push notification to residents
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeCreateModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAnnouncement}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Create Announcement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAnnouncementsPage;


