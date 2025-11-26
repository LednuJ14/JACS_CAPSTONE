import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState({});

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.adminDocuments();
      console.log('Raw documents response:', response);
      
      const documents = response.documents || [];
      console.log('Documents count:', documents.length);
      console.log('Documents data:', documents);
      
      // Remove duplicates based on document ID and property ID combination
      const uniqueDocuments = documents.filter((doc, index, self) => {
        const isUnique = index === self.findIndex(d => d.id === doc.id && d.property_id === doc.property_id);
        if (!isUnique) {
          console.warn('Duplicate document found:', doc);
        }
        return isUnique;
      });
      
      // Mark documents with blob URLs as not downloadable
      const documentsWithFlags = uniqueDocuments.map(doc => {
        const filePath = doc.file_path || doc.filePath || '';
        const hasBlobUrl = filePath.startsWith('blob:') || 
                          filePath.startsWith('http://localhost:') || 
                          filePath.startsWith('https://localhost:');
        return {
          ...doc,
          hasBlobUrl,
          isDownloadable: !hasBlobUrl && filePath && filePath.trim() !== ''
        };
      });
      
      console.log('Unique documents count:', documentsWithFlags.length);
      setDocuments(documentsWithFlags);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load documents. Please try again.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (documentId, newStatus) => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [documentId]: true }));
      await apiService.updateDocumentStatus(documentId, newStatus);
      
      // Update local state
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: newStatus }
            : doc
        )
      );
      alert(`Document ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating document status:', error);
      alert(`Failed to update document status: ${error.message || 'Unknown error'}`);
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const handleDownload = async (doc) => {
    try {
      const blob = await apiService.downloadDocument(doc.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name || doc.fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert(`Downloading ${doc.file_name || doc.fileName}...`);
    } catch (error) {
      console.error('Error downloading document:', error);
      
      // Check if error response has a message
      let errorMessage = 'Unknown error';
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        errorMessage = errorData.message || errorData.error || error.message || 'Unknown error';
        if (errorData.details) {
          errorMessage += `\n\nDetails: ${errorData.details}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Failed to download document:\n\n${errorMessage}`);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesSearch = (doc.property_title || doc.propertyTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.owner_name || doc.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.document_type || doc.documentType || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-800">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Document Management
                </h1>
                <p className="text-gray-300 mt-1">Review and manage legal documents from property owners</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Documents</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchDocuments}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center mx-auto"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center">
                Document Management
              </h1>
              <p className="text-gray-300 mt-1">Review and manage legal documents from property owners</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchDocuments}
                disabled={loading}
                className="bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <svg className="w-4 h-4 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-medium">Refresh</span>
              </button>
              <div className="bg-white/10 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium">Total Documents: {documents.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-black p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-bold text-black mb-2">Filter by Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
                >
                  <option value="all">All Documents</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-bold text-black mb-2">Search Documents</label>
              <input
                type="text"
                placeholder="Search by property, owner, or document type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black"
              />
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-black overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b-2 border-black">
            <h2 className="text-lg font-bold text-black">Legal Documents</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Upload Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document, index) => {
                  // Create a unique key using multiple identifiers and index
                  const uniqueKey = `doc_${document.id || 'unknown'}_prop_${document.property_id || 'unknown'}_idx_${index}_file_${(document.file_name || document.fileName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}`;
                  return (
                  <tr key={uniqueKey} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-black">{document.property_title || document.propertyTitle || 'Unknown Property'}</div>
                        <div className="text-sm text-gray-500">
                          ID: {document.property_id || document.propertyId || 'N/A'}
                          {document.property_subdomain && ` • ${document.property_subdomain}.localhost`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-black">{document.owner_name || document.ownerName || 'Unknown Owner'}</div>
                        <div className="text-sm text-gray-500">{document.owner_email || document.ownerEmail || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-black">{document.document_type || document.documentType || 'Unknown Type'}</div>
                          {document.source && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              document.source === 'subdomain' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {document.source === 'subdomain' ? 'Subdomain' : 'Main Domain'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{document.file_name || document.fileName || 'Unknown File'}</div>
                        <div className="text-xs text-gray-400">
                          {document.file_size || document.fileSize || 'Unknown Size'}
                          {document.uploader_role && ` • Uploaded by ${document.uploader_role}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {document.upload_date ? new Date(document.upload_date).toLocaleDateString() : 
                       document.uploadDate ? new Date(document.uploadDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(document.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {document.hasBlobUrl ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-red-600 font-medium mb-1">Not Available</span>
                            <span className="text-xs text-gray-500">File not uploaded</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDownload(document)}
                            disabled={!document.isDownloadable}
                            className="bg-black text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!document.isDownloadable ? 'File path not available' : 'Download document'}
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download
                          </button>
                        )}
                        {/* Only show approve/reject for main domain documents (property legal documents) */}
                        {document.status === 'pending' && document.source !== 'subdomain' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(document.id, 'approved')}
                              disabled={updatingStatus[document.id]}
                              className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              {updatingStatus[document.id] ? (
                                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(document.id, 'rejected')}
                              disabled={updatingStatus[document.id]}
                              className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              {updatingStatus[document.id] ? (
                                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-black mb-2">No documents found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-sm border-2 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {documents.filter(d => d.status === 'pending').length}
                </p>
              </div>
              <div className="text-yellow-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border-2 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {documents.filter(d => d.status === 'approved').length}
                </p>
              </div>
              <div className="text-green-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border-2 border-black p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {documents.filter(d => d.status === 'rejected').length}
                </p>
              </div>
              <div className="text-red-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManagement;
