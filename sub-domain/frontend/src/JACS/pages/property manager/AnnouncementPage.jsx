import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Download, 
  Edit, 
  Trash2, 
  Loader2, 
  X, 
  Megaphone, 
  Calendar, 
  Filter, 
  MoreVertical, 
  Eye, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  Bell, 
  Users, 
  Tag,
  Send,
  Pin,
  Archive,
  Settings
} from 'lucide-react';
import { apiService } from '../../../services/api';
import AccountSettings from '../../components/AccountSettings';
import ErrorBoundary from '../../components/ErrorBoundary';
import Header from '../../components/Header';

const AnnouncementPage = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [showEditAnnouncement, setShowEditAnnouncement] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addError, setAddError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    announcement_type: 'general',
    priority: 'medium',
    is_pinned: false,
    send_notification: true,
    target_audience: 'all'
  });

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchAnnouncementsData();
  }, [navigate]);

  const fetchAnnouncementsData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAnnouncements();
      setAnnouncements(response.data.announcements || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch announcements data:', err);
      setError(err?.message || 'Failed to load announcements data');
    } finally {
      setLoading(false);
    }
  };

  const openAddAnnouncementModal = () => {
    setAddError(null);
    setShowAddAnnouncement(true);
  };

  const closeAddAnnouncementModal = () => {
    setShowAddAnnouncement(false);
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
    setAddError(null);
  };

  const handleCreateAnnouncement = async () => {
    setAddError(null);
    if (!form.title || !form.content) {
      setAddError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.createAnnouncement(form);
      
      // Add the new announcement to the list
      const newAnnouncement = response.data.announcement;
      setAnnouncements([newAnnouncement, ...announcements]);
      closeAddAnnouncementModal();
    } catch (e) {
      console.error('Create announcement error:', e);
      setAddError(e?.response?.data?.error || e?.message || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
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
    setAddError(null);
    setShowEditAnnouncement(true);
  };

  const closeEditAnnouncementModal = () => {
    setShowEditAnnouncement(false);
    setEditingAnnouncement(null);
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
    setAddError(null);
  };

  const handleUpdateAnnouncement = async () => {
    setAddError(null);
    if (!form.title || !form.content) {
      setAddError('Please fill in all required fields');
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
      closeEditAnnouncementModal();
    } catch (e) {
      console.error('Update announcement error:', e);
      setAddError(e?.response?.data?.error || e?.message || 'Failed to update announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      await apiService.deleteAnnouncement(announcementId);
      
      // Remove the announcement from the list
      setAnnouncements(announcements.filter(a => a.id !== announcementId));
    } catch (e) {
      console.error('Delete announcement error:', e);
      alert(e?.response?.data?.error || e?.message || 'Failed to delete announcement');
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'general': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'maintenance': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'payment': return 'text-green-600 bg-green-50 border-green-200';
      case 'emergency': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch = announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || announcement.announcement_type === selectedType;
    const matchesStatus = selectedStatus === 'all' || announcement.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredAnnouncements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAnnouncements = filteredAnnouncements.slice(startIndex, startIndex + itemsPerPage);

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
            onClick={fetchAnnouncementsData}
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
      {/* Header */}
      <Header userType="manager" />

      {/* Main Content */}
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Announcements</h1>
              <p className="text-gray-600">Manage community announcements and keep residents informed</p>
            </div>
            <button
              onClick={openAddAnnouncementModal}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Create Announcement</span>
            </button>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Announcements</p>
                  <p className="text-2xl font-bold text-gray-900">{announcements.length}</p>
                  <p className="text-xs text-gray-500 mt-1">all time</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Megaphone className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active Announcements</p>
                  <p className="text-2xl font-bold text-green-600">{announcements.filter(a => a.status === 'active').length}</p>
                  <p className="text-xs text-gray-500 mt-1">currently active</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Pinned Announcements</p>
                  <p className="text-2xl font-bold text-amber-600">{announcements.filter(a => a.is_pinned).length}</p>
                  <p className="text-xs text-gray-500 mt-1">featured posts</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Pin className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">This Month</p>
                  <p className="text-2xl font-bold text-purple-600">{announcements.filter(a => {
                    const createdDate = new Date(a.created_at);
                    const now = new Date();
                    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
                  }).length}</p>
                  <p className="text-xs text-gray-500 mt-1">new announcements</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search announcements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="payment">Payment</option>
                <option value="emergency">Emergency</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Announcements Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedAnnouncements.map((announcement) => (
              <div key={announcement.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {announcement.is_pinned && (
                        <Pin className="w-4 h-4 text-amber-500" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {announcement.title}
                      </h3>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {announcement.content}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTypeColor(announcement.announcement_type)}`}>
                      {announcement.announcement_type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(announcement.priority)}`}>
                      {announcement.priority}
                    </span>
                    {announcement.status === 'archived' && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full border text-gray-600 bg-gray-50 border-gray-200">
                        archived
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditAnnouncement(announcement)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit announcement"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        disabled={deleting}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Account Settings</h2>
              <button
                onClick={() => setShowAccountSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-600">Loading account settings...</span>
                </div>
              }
            >
              <AccountSettings />
              <ErrorBoundary />
            </React.Suspense>
          </div>
        </div>
      )}

      {/* Add Announcement Modal */}
      {showAddAnnouncement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create New Announcement</h2>
              <button
                onClick={closeAddAnnouncementModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">
                {addError}
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
                      id="is_pinned"
                      checked={form.is_pinned}
                      onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_pinned" className="text-sm font-medium text-gray-700 flex items-center">
                      <Pin className="w-4 h-4 mr-1" />
                      Pin this announcement to the top
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="send_notification"
                      checked={form.send_notification}
                      onChange={(e) => setForm({ ...form, send_notification: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="send_notification" className="text-sm font-medium text-gray-700 flex items-center">
                      <Bell className="w-4 h-4 mr-1" />
                      Send push notification to residents
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeAddAnnouncementModal}
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

      {/* Edit Announcement Modal */}
      {showEditAnnouncement && editingAnnouncement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit Announcement</h2>
              <button
                onClick={closeEditAnnouncementModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded p-2">
                {addError}
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
                onClick={closeEditAnnouncementModal}
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
    </div>
  );
};

export default AnnouncementPage;
