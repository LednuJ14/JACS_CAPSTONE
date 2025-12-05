import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [activeTab, setActiveTab] = useState('mainDomain'); // 'mainDomain' or 'subdomain'
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Cleanup blob URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewDocument?.previewUrl) {
        window.URL.revokeObjectURL(previewDocument.previewUrl);
      }
    };
  }, [previewDocument]);

  // Handle escape key to close preview
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && previewDocument) {
        closePreview();
      }
    };
    
    if (previewDocument) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [previewDocument]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.adminDocuments();
      console.log('Raw documents response:', response);
      
      const documents = response.documents || [];
      console.log('Documents count:', documents.length);
      console.log('Documents data:', documents);
      
      // Remove duplicates based on document ID, property ID, and file name combination
      // Use a Map to track unique documents more efficiently
      const documentMap = new Map();
      const duplicateCount = { count: 0 };
      
      documents.forEach((doc, index) => {
        // Create a unique key combining id, property_id, and file_name
        const docId = doc.id || `unknown_${index}`;
        const propertyId = doc.property_id || doc.propertyId || 'unknown';
        const fileName = doc.file_name || doc.fileName || 'unknown';
        const uniqueKey = `${docId}_${propertyId}_${fileName}`;
        
        if (!documentMap.has(uniqueKey)) {
          documentMap.set(uniqueKey, doc);
        } else {
          duplicateCount.count++;
          // Log duplicate only once per unique key
          if (duplicateCount.count === 1 || duplicateCount.count % 10 === 0) {
            console.warn(`Duplicate document found (${duplicateCount.count} total):`, {
              id: docId,
              property_id: propertyId,
              file_name: fileName
            });
          }
        }
      });
      
      const uniqueDocuments = Array.from(documentMap.values());
      
      if (duplicateCount.count > 0) {
        console.log(`Removed ${duplicateCount.count} duplicate document(s). Unique documents: ${uniqueDocuments.length}`);
      }
      
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

  const handlePreview = async (doc) => {
    // Safety check
    if (!doc || !doc.id) {
      alert('Invalid document selected for preview');
      return;
    }

    // Check if this is a subdomain document
    if (doc.id.startsWith('subdomain_')) {
      // Warn user that subdomain documents may not be available
      const proceed = window.confirm(
        'This is a subdomain document. Preview may not be available if the subdomain server is offline.\n\n' +
        'Would you like to try previewing it anyway? If it fails, you can still download the document.'
      );
      if (!proceed) {
        return;
      }
    }

    try {
      setPreviewLoading(true);
      setPreviewError('');
      
      // Clean up previous preview URL if exists
      if (previewDocument?.previewUrl) {
        window.URL.revokeObjectURL(previewDocument.previewUrl);
      }
      
      setPreviewDocument(doc);
      
      // Get the preview URL from the download endpoint
      const blob = await apiService.downloadDocument(doc.id);
      
      // Safety check for blob
      if (!blob || !(blob instanceof Blob)) {
        throw new Error('Invalid file data received');
      }
      
      const url = window.URL.createObjectURL(blob);
      
      // Store the blob URL in the document object for preview
      setPreviewDocument({
        ...doc,
        previewUrl: url
      });
    } catch (error) {
      console.error('Error loading document for preview:', error);
      
      let errorMessage = 'Failed to load document for preview';
      
      // Special handling for subdomain documents
      if (doc.id.startsWith('subdomain_')) {
        if (error.status === 404 || error.message.includes('subdomain') || error.message.includes('404')) {
          errorMessage = 'Subdomain document preview is not available. The subdomain server may be offline or the document may have been deleted. You can still download the document using the Download button.';
        } else {
          errorMessage = error.message || 'Failed to load subdomain document. The subdomain server may be offline.';
        }
      } else {
        // Handle other errors
        if (error.response) {
          try {
            const errorData = await error.response.json();
            errorMessage = errorData.message || errorData.error || error.message || errorMessage;
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`;
            }
          } catch (e) {
            // If response is not JSON, use the error message
            errorMessage = error.message || errorMessage;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      setPreviewError(errorMessage);
      // Keep document in state so error can be displayed
      setPreviewDocument({
        ...doc,
        previewUrl: null
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    // Clean up blob URL if it exists
    if (previewDocument?.previewUrl) {
      window.URL.revokeObjectURL(previewDocument.previewUrl);
    }
    setPreviewDocument(null);
    setPreviewError('');
    setPreviewLoading(false);
  };

  const getFileType = (filename) => {
    if (!filename) return 'unknown';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
    return 'unknown';
  };

  const filteredDocuments = documents.filter(doc => {
    // Filter by domain source
    const docSource = doc.source || 'main_domain';
    const matchesDomain = activeTab === 'mainDomain' 
      ? (docSource === 'main_domain' || docSource !== 'subdomain')
      : docSource === 'subdomain';
    
    // Filter by status
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    
    // Filter by search term
    const matchesSearch = (doc.property_title || doc.propertyTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.owner_name || doc.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.document_type || doc.documentType || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDomain && matchesStatus && matchesSearch;
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
                <span className="text-sm font-medium">
                  {activeTab === 'mainDomain' ? 'Main Domain' : 'Subdomain'}: {documents.filter(d => {
                    const docSource = d.source || 'main_domain';
                    return activeTab === 'mainDomain' 
                      ? (docSource === 'main_domain' || docSource !== 'subdomain')
                      : docSource === 'subdomain';
                  }).length} / Total: {documents.length}
                </span>
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

        {/* Domain Tabs */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-black mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-900 to-black px-6 py-2">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('mainDomain')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'mainDomain'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${activeTab === 'mainDomain' ? 'bg-white' : 'bg-gray-400'}`}></div>
                  <span>Main Domain</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'mainDomain' ? 'bg-white text-black' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {documents.filter(d => (d.source || 'main_domain') !== 'subdomain').length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('subdomain')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'subdomain'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${activeTab === 'subdomain' ? 'bg-white' : 'bg-gray-400'}`}></div>
                  <span>Subdomain</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'subdomain' ? 'bg-white text-black' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {documents.filter(d => d.source === 'subdomain').length}
                  </span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-black overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b-2 border-black">
            <h2 className="text-lg font-bold text-black">
              Legal Documents - {activeTab === 'mainDomain' ? 'Main Domain' : 'Subdomain'}
            </h2>
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
                            <span className="text-xs text-red-600 font-medium mb-1">File Not Uploaded</span>
                            <span className="text-xs text-gray-500 max-w-xs">
                              {document.file_path && document.file_path.startsWith('blob:') 
                                ? 'File was never uploaded to server. Property manager needs to re-upload this document.'
                                : 'File path is invalid or missing. Please contact the property manager to re-upload.'}
                            </span>
                          </div>
                        ) : !document.isDownloadable ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-yellow-600 font-medium mb-1">Path Missing</span>
                            <span className="text-xs text-gray-500">File path not available in database</span>
                          </div>
                        ) : (
                          <>
                            {/* Show preview button for all downloadable documents */}
                            <button
                              onClick={() => handlePreview(document)}
                              disabled={previewLoading || !document.isDownloadable}
                              className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                !document.isDownloadable 
                                  ? 'File not available for preview' 
                                  : document.source === 'subdomain'
                                  ? 'Preview subdomain document (may not be available if subdomain server is offline)'
                                  : 'Preview document'
                              }
                            >
                              {previewLoading && previewDocument?.id === document.id ? (
                                <>
                                  <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Preview
                                </>
                              )}
                            </button>
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
                          </>
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
                  {filteredDocuments.filter(d => d.status === 'pending').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {activeTab === 'mainDomain' ? 'Main Domain' : 'Subdomain'}
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
                  {filteredDocuments.filter(d => d.status === 'approved').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {activeTab === 'mainDomain' ? 'Main Domain' : 'Subdomain'}
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
                  {filteredDocuments.filter(d => d.status === 'rejected').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {activeTab === 'mainDomain' ? 'Main Domain' : 'Subdomain'}
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

      {/* Document Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={closePreview}>
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-900 to-black flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{previewDocument.file_name || previewDocument.fileName || 'Document Preview'}</h3>
                  <p className="text-sm text-gray-300">
                    {previewDocument.property_title || previewDocument.propertyTitle || 'Unknown Property'} • {previewDocument.document_type || previewDocument.documentType || 'Document'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload(previewDocument)}
                  className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors text-sm flex items-center"
                  title="Download document"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className="text-white hover:text-gray-300 transition-colors p-2"
                  title="Close preview"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {previewLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading document preview...</p>
                  </div>
                </div>
              ) : previewError ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Error</h3>
                    <p className="text-gray-600 mb-4 whitespace-pre-line">{previewError}</p>
                    <div className="flex items-center justify-center space-x-3">
                      <button
                        onClick={() => handlePreview(previewDocument)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Try Again
                      </button>
                      {previewDocument?.source === 'subdomain' && (
                        <button
                          onClick={() => handleDownload(previewDocument)}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Download Instead
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : previewDocument.previewUrl ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {(() => {
                    const fileType = getFileType(previewDocument.file_name || previewDocument.fileName || '');
                    if (fileType === 'image') {
                      return (
                        <div className="flex items-center justify-center p-8">
                          <img
                            src={previewDocument.previewUrl}
                            alt={previewDocument.file_name || 'Preview'}
                            className="max-w-full max-h-[70vh] object-contain rounded-lg"
                            onError={(e) => {
                              setPreviewError('Failed to load image preview');
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      );
                    } else if (fileType === 'pdf') {
                      return (
                        <iframe
                          src={previewDocument.previewUrl}
                          className="w-full h-[70vh] border-0"
                          title="PDF Preview"
                          onError={() => {
                            console.error('PDF iframe load error');
                            setPreviewError('Failed to load PDF preview. The PDF may be corrupted or too large.');
                          }}
                          onLoad={() => {
                            // Check if iframe loaded successfully
                            try {
                              const iframe = document.querySelector('iframe[title="PDF Preview"]');
                              if (iframe && iframe.contentDocument) {
                                // PDF loaded successfully
                                setPreviewError('');
                              }
                            } catch (e) {
                              // Cross-origin or other iframe access error - this is normal for PDFs
                              console.log('PDF iframe loaded (cross-origin check skipped)');
                            }
                          }}
                        />
                      );
                    } else {
                      return (
                        <div className="flex items-center justify-center h-96 p-8">
                          <div className="text-center max-w-md">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
                            <p className="text-gray-600 mb-4">
                              Preview is not available for this file type ({fileType}). Please download the file to view it.
                            </p>
                            <button
                              onClick={() => handleDownload(previewDocument)}
                              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              Download File
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManagement;
