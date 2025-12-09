import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Edit, Eye, Reply, Archive, Loader2, X, Star, MessageSquare, AlertTriangle, CheckCircle, Clock, Filter, MoreVertical, ArrowRight, Users, Home, CreditCard, Wrench, Activity, User, Building, Phone, Mail, Calendar } from 'lucide-react';
import { apiService } from '../../../services/api';
import AccountSettings from '../../components/AccountSettings';
import ErrorBoundary from '../../components/ErrorBoundary';
import Header from '../../components/Header';

const FeedbackPage = () => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    fetchFeedbackData();
  }, [navigate]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [feedbackData, dashboardData] = await Promise.all([
        apiService.getFeedback(),
        apiService.getFeedbackDashboard()
      ]);

      // Transform API data to match frontend interface
      // Backend already provides most fields we need
      const transformedFeedback = (feedbackData || []).map((item) => {
        // Map backend status 'reviewed' to frontend 'in_review'
        let status = item.status || 'new';
        if (status === 'reviewed') {
          status = 'in_review';
        }
        
        return {
          id: item.id,
          feedback_id: item.feedback_id || `FB-${String(item.id).padStart(3, '0')}`,
          tenant_name: item.tenant_name || item.submitter_name || 'Unknown Tenant',
          tenant_email: item.tenant_email || 'N/A',
          tenant_phone: item.tenant_phone || 'N/A',
          unit: item.unit || item.unit_name || 'N/A',
          type: item.type || item.feedback_type || 'other',
          category: item.category || 'General',
          subject: item.subject || 'No Subject',
          message: item.message || item.content || '',
          priority: item.priority || 'medium', // Default priority
          status: status,
          rating: item.rating || null,
          created_at: item.created_at,
          updated_at: item.updated_at || item.created_at,
          response: item.response || null,
          responded_at: item.responded_at || null,
          responded_by: item.responded_by || null
        };
      });

      setFeedback(transformedFeedback);
      setDashboardData(dashboardData || {});
      setError(null);
    } catch (err) {
      console.error('Failed to load feedback data:', err);
      setError('Failed to load feedback data. Please try again.');
      setFeedback([]);
      setDashboardData({});
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'text-blue-600';
      case 'in_review': return 'text-orange-600';
      case 'responded': return 'text-purple-600';
      case 'resolved': return 'text-green-600';
      case 'closed': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'in_review': return 'bg-orange-500';
      case 'responded': return 'bg-purple-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feedback': return <MessageSquare className="w-4 h-4" />;
      case 'complaint': return <AlertTriangle className="w-4 h-4" />;
      case 'suggestion': return <Star className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'feedback': return 'text-blue-600';
      case 'complaint': return 'text-red-600';
      case 'suggestion': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const handleReply = (feedbackItem) => {
    setSelectedFeedback(feedbackItem);
    setReplyText('');
    setShowReplyModal(true);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !selectedFeedback) return;

    try {
      setReplying(true);
      
      // Update feedback status to 'responded'
      await apiService.updateFeedbackStatus(selectedFeedback.id, {
        status: 'responded'
      });
      
      setShowReplyModal(false);
      setReplyText('');
      setSelectedFeedback(null);
      fetchFeedbackData(); // Refresh data
    } catch (err) {
      console.error('Failed to submit reply:', err);
      alert('Failed to submit reply. Please try again.');
    } finally {
      setReplying(false);
    }
  };

  const handleStatusUpdate = async (feedbackId, newStatus) => {
    try {
      // Map frontend status 'in_review' to backend 'reviewed'
      let backendStatus = newStatus;
      if (newStatus === 'in_review') {
        backendStatus = 'reviewed';
      }
      
      await apiService.updateFeedbackStatus(feedbackId, { status: backendStatus });
      fetchFeedbackData(); // Refresh data
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update feedback status. Please try again.');
    }
  };

  const filteredFeedback = feedback.filter(item => {
    const matchesSearch = item.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.feedback_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesPriority = selectedPriority === 'all' || item.priority === selectedPriority;
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredFeedback.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFeedback = filteredFeedback.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading feedback...</span>
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
            onClick={fetchFeedbackData}
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback & Complaints</h1>
              <p className="text-gray-600">Manage tenant feedback, complaints, and suggestions effectively</p>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">New</p>
                  <p className="text-2xl font-bold text-blue-600">{dashboardData?.new || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">unread feedback</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">In Review</p>
                  <p className="text-2xl font-bold text-amber-600">{dashboardData?.in_review || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">being reviewed</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Responded</p>
                  <p className="text-2xl font-bold text-purple-600">{dashboardData?.responded || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">with responses</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Reply className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{dashboardData?.resolved || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">completed cases</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.total || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">all feedback</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Activity className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search feedback, complaints, or suggestions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="in_review">In Review</option>
                <option value="responded">Responded</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="feedback">Feedback</option>
                <option value="complaint">Complaint</option>
                <option value="suggestion">Suggestion</option>
              </select>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Feedback Management */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Feedback & Complaints Management</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{paginatedFeedback.length} of {filteredFeedback.length} feedback items</span>
                </div>
              </div>
            </div>

            {/* Feedback Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TENANT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TYPE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SUBJECT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRIORITY</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RATING</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedFeedback.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{item.feedback_id}</div>
                            <div className="text-xs text-gray-500">#{item.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{item.tenant_name}</div>
                            <div className="text-xs text-gray-500">{item.unit}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1 rounded ${getTypeColor(item.type)}`}>
                            {getTypeIcon(item.type)}
                          </div>
                          <span className="text-sm font-medium text-gray-900 capitalize">{item.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="max-w-xs">
                          <div className="text-sm text-gray-900 truncate">{item.subject}</div>
                          <div className="text-xs text-gray-500">{item.category}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
                          {item.priority === 'urgent' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {item.priority === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {item.priority === 'medium' && <Clock className="w-3 h-3 mr-1" />}
                          {item.priority === 'low' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {item.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusDotColor(item.status)}`}></div>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full text-xs ${getStatusColor(item.status)}`}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.rating ? (
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-semibold text-gray-900">{item.rating}/5</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No rating</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleReply(item)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Reply"
                          >
                            <Reply className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedFeedback(item);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {item.status === 'new' && (
                            <button 
                              onClick={() => handleStatusUpdate(item.id, 'in_review')}
                              className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Mark as In Review"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                          {item.status === 'responded' && (
                            <button 
                              onClick={() => handleStatusUpdate(item.id, 'resolved')}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark as Resolved"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex flex-col items-center space-y-4">
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
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredFeedback.length)} of {filteredFeedback.length} results
                </div>
              </div>
            </div>
          </div>
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

      {/* Reply Modal */}
      {showReplyModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Reply to Feedback</h2>
              <button
                onClick={() => setShowReplyModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Feedback Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{selectedFeedback.subject}</h3>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedFeedback.priority)}`}>
                  {selectedFeedback.priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">From: {selectedFeedback.tenant_name} ({selectedFeedback.unit})</p>
              <p className="text-sm text-gray-700">{selectedFeedback.message}</p>
            </div>

            {/* Reply Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Response
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={6}
                  placeholder="Type your response here..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowReplyModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || replying}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {replying ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Details Modal */}
      {showDetailsModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Feedback Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedFeedback(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Header Info */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getTypeIcon(selectedFeedback.type)}
                    <h3 className="text-lg font-semibold text-gray-900">{selectedFeedback.subject}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedFeedback.priority)}`}>
                      {selectedFeedback.priority.toUpperCase()}
                    </span>
                    <span className={`text-sm font-medium px-2 py-1 rounded-full text-xs ${getStatusColor(selectedFeedback.status)}`}>
                      {selectedFeedback.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-gray-600">Feedback ID:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.feedback_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 font-semibold text-gray-900 capitalize">{selectedFeedback.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Category:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {selectedFeedback.created_at ? new Date(selectedFeedback.created_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tenant Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Tenant Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.tenant_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Unit:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.tenant_email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedFeedback.tenant_phone}</span>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Message</h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedFeedback.message}</p>
                </div>
              </div>

              {/* Rating */}
              {selectedFeedback.rating && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Rating</h4>
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-current" />
                    <span className="text-lg font-semibold text-gray-900">{selectedFeedback.rating} / 5</span>
                  </div>
                </div>
              )}

              {/* Response (if any) */}
              {selectedFeedback.response && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedFeedback.response}</p>
                    {selectedFeedback.responded_at && (
                      <p className="text-xs text-gray-500 mt-2">
                        Responded on: {new Date(selectedFeedback.responded_at).toLocaleString()}
                        {selectedFeedback.responded_by && ` by ${selectedFeedback.responded_by}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                {selectedFeedback.status === 'new' && (
                  <button
                    onClick={() => {
                      handleStatusUpdate(selectedFeedback.id, 'in_review');
                      setShowDetailsModal(false);
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Mark as In Review
                  </button>
                )}
                {selectedFeedback.status !== 'responded' && (
                  <button
                    onClick={() => {
                      setShowReplyModal(true);
                      setShowDetailsModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reply
                  </button>
                )}
                {selectedFeedback.status === 'responded' && (
                  <button
                    onClick={() => {
                      handleStatusUpdate(selectedFeedback.id, 'resolved');
                      setShowDetailsModal(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Mark as Resolved
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedFeedback(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
