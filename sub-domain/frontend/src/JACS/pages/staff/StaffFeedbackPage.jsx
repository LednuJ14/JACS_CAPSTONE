import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageSquare, AlertTriangle, CheckCircle, Clock, Filter, Search, Plus, Eye, X, Star, FileText } from 'lucide-react';
import { apiService } from '../../../services/api';
import Header from '../../components/Header';

const StaffFeedbackPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    feedback_type: 'other',
    rating: null
  });

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = apiService.getStoredUser();
    if (user && user.role !== 'staff') {
      navigate('/dashboard');
      return;
    }

    fetchFeedbackData();
  }, [navigate]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {};
      if (typeFilter !== 'all') filters.type = typeFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;
      
      const feedbackData = await apiService.getFeedback(filters);
      setFeedback(Array.isArray(feedbackData) ? feedbackData : []);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setError('Failed to load feedback. Please try again.');
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFeedback = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (!formData.message.trim()) {
        setSubmitError('Message is required');
        setSubmitting(false);
        return;
      }

      const feedbackData = {
        subject: formData.subject.trim() || null,
        message: formData.message.trim(),
        feedback_type: formData.feedback_type,
        rating: formData.rating || null,
        status: 'new'
      };

      await apiService.createFeedback(feedbackData);
      
      // Refresh feedback list
      await fetchFeedbackData();
      
      // Reset form and close modal
      setFormData({
        subject: '',
        message: '',
        feedback_type: 'other',
        rating: null
      });
      setShowCreateModal(false);
      setSubmitError(null);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setSubmitError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (feedbackId) => {
    try {
      const feedbackDetail = await apiService.getFeedbackById(feedbackId);
      setSelectedFeedback(feedbackDetail);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Failed to load feedback details:', err);
    }
  };

  // Filter feedback based on search, type, and status
  const filteredFeedback = feedback.filter(item => {
    const subject = item.subject || '';
    const message = item.message || item.content || '';
    const matchesSearch = subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || (item.feedback_type || item.type || '').toLowerCase() === typeFilter.toLowerCase();
    const status = item.status || 'new';
    const normalizedStatus = status === 'reviewed' ? 'in_review' : status;
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeIcon = (type) => {
    const normalized = (type || 'other').toLowerCase();
    switch (normalized) {
      case 'complaint': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'suggestion': return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'compliment': return <Star className="w-5 h-5 text-yellow-600" />;
      default: return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeDisplay = (type) => {
    const normalized = (type || 'other').toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const getStatusIcon = (status) => {
    const normalized = (status || 'new').toLowerCase();
    const statusValue = normalized === 'reviewed' ? 'in_review' : normalized;
    switch (statusValue) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'responded': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'in_review': return <Clock className="w-4 h-4 text-amber-600" />;
      case 'new': return <Clock className="w-4 h-4 text-gray-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusDisplay = (status) => {
    const normalized = (status || 'new').toLowerCase();
    const statusValue = normalized === 'reviewed' ? 'in_review' : normalized;
    return statusValue.replace('_', ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStatusColor = (status) => {
    const normalized = (status || 'new').toLowerCase();
    const statusValue = normalized === 'reviewed' ? 'in_review' : normalized;
    switch (statusValue) {
      case 'resolved': return 'bg-green-50 text-green-700 border-green-200';
      case 'responded': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in_review': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'new': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Summary statistics
  const totalFeedback = feedback.length;
  const complaintsCount = feedback.filter(f => (f.feedback_type || f.type || '').toLowerCase() === 'complaint').length;
  const newCount = feedback.filter(f => (f.status || '').toLowerCase() === 'new').length;
  const resolvedCount = feedback.filter(f => (f.status || '').toLowerCase() === 'resolved').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="staff" />
      
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback & Suggestions</h1>
              <p className="text-gray-600">View feedback and submit your own suggestions or concerns</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-5 h-5" />
              <span>Submit Feedback</span>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Feedback</p>
                  <p className="text-2xl font-bold text-gray-900">{totalFeedback}</p>
                  <p className="text-xs text-gray-500 mt-1">all submissions</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Complaints</p>
                  <p className="text-2xl font-bold text-red-600">{complaintsCount}</p>
                  <p className="text-xs text-gray-500 mt-1">issues reported</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">New</p>
                  <p className="text-2xl font-bold text-amber-600">{newCount}</p>
                  <p className="text-xs text-gray-500 mt-1">pending review</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
                  <p className="text-xs text-gray-500 mt-1">completed</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search feedback..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="complaint">Complaint</option>
                <option value="suggestion">Suggestion</option>
                <option value="compliment">Compliment</option>
                <option value="other">Other</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="in_review">In Review</option>
                <option value="responded">Responded</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Feedback List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Feedback</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{filteredFeedback.length} of {feedback.length} feedback</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredFeedback.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No feedback found</p>
                  <p className="text-sm text-gray-500">Submit your first feedback or suggestion to get started</p>
                </div>
              ) : (
                filteredFeedback.map((item) => (
                  <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-150">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getTypeIcon(item.feedback_type || item.type)}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {item.subject || 'No Subject'}
                            </h3>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-sm text-gray-500">
                                {getTypeDisplay(item.feedback_type || item.type)}
                              </span>
                              {item.rating && (
                                <div className="flex items-center space-x-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                  <span className="text-sm text-gray-600">{item.rating}</span>
                                </div>
                              )}
                              <span className="text-xs text-gray-400">
                                {item.tenant_name || item.submitter_name || 'Unknown'}
                                {item.unit && ` - ${item.unit}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {item.message || item.content || ''}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</span>
                          <span className={`px-2 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(item.status)}
                              <span>{getStatusDisplay(item.status)}</span>
                            </div>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewDetails(item.id)}
                        className="ml-4 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Feedback Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Submit Feedback</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    subject: '',
                    message: '',
                    feedback_type: 'other',
                    rating: null
                  });
                  setSubmitError(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateFeedback} className="px-6 py-4 space-y-6">
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.feedback_type}
                  onChange={(e) => setFormData({ ...formData, feedback_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="complaint">Complaint</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="compliment">Compliment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Brief summary of your feedback"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Please provide details about your feedback, complaint, or suggestion..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rating (Optional) - Rate your experience (1-5 stars)
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className={`transition-colors ${
                        formData.rating && formData.rating >= star
                          ? 'text-yellow-500'
                          : 'text-gray-300 hover:text-yellow-400'
                      }`}
                    >
                      <Star className="w-8 h-8 fill-current" />
                    </button>
                  ))}
                  {formData.rating && (
                    <span className="ml-2 text-sm text-gray-600">{formData.rating} / 5</span>
                  )}
                  {formData.rating && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: null })}
                      className="ml-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      subject: '',
                      message: '',
                      feedback_type: 'other',
                      rating: null
                    });
                    setSubmitError(null);
                  }}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.message.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Submit Feedback</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Details Modal - Staff can view but NOT respond */}
      {showDetailsModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Feedback Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedFeedback(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                {getTypeIcon(selectedFeedback.feedback_type || selectedFeedback.type)}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedFeedback.subject || 'No Subject'}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-gray-600">
                      {getTypeDisplay(selectedFeedback.feedback_type || selectedFeedback.type)}
                    </span>
                    {selectedFeedback.rating && (
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm text-gray-600">{selectedFeedback.rating} / 5</span>
                      </div>
                    )}
                    <span className={`px-2 py-1 rounded-full border text-xs ${getStatusColor(selectedFeedback.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(selectedFeedback.status)}
                        <span>{getStatusDisplay(selectedFeedback.status)}</span>
                      </div>
                    </span>
                  </div>
                </div>
              </div>

              {/* Submitter Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Submitted By</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {selectedFeedback.tenant_name || selectedFeedback.submitter_name || 'Unknown'}
                    </span>
                  </div>
                  {selectedFeedback.unit && (
                    <div>
                      <span className="text-gray-600">Unit:</span>
                      <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.unit}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Message</h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedFeedback.message || selectedFeedback.content || 'No message provided'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Submitted</h4>
                  <p className="text-sm text-gray-600">
                    {selectedFeedback.created_at
                      ? new Date(selectedFeedback.created_at).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                {selectedFeedback.property_name && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Property</h4>
                    <p className="text-sm text-gray-600">{selectedFeedback.property_name}</p>
                  </div>
                )}
              </div>

              {/* Note: Staff cannot respond - no action buttons */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffFeedbackPage;

