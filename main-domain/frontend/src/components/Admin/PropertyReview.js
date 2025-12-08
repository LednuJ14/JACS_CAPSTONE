import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ApiService from '../../services/api';

const AdminPropertyReview = () => {
  const [activeTab, setActiveTab] = useState('all'); // Default to all properties tab
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState({});
  // const [refreshKey] = useState(0); // Removed unused variable
  const [propertyDocumentsStatus, setPropertyDocumentsStatus] = useState({}); // Track document statuses per property
  const [updatingDocumentStatus, setUpdatingDocumentStatus] = useState({}); // Track document status updates
  const [previewDocument, setPreviewDocument] = useState(null); // Document preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [properties, setProperties] = useState([]);

  const fetchPendingProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      // Always fetch ALL properties regardless of activeTab to get accurate counts
      const statusParam = 'all';
      
      const data = await ApiService.getPendingProperties({ 
        t: timestamp, 
        status: statusParam,
        per_page: 100 // Fetch all properties for accurate counts
      });
      
      // Transform API data to match component expectations
      if (!data || !data.properties) {
        console.error('No properties data received:', data);
        setError('No properties data received from server');
        return;
      }
      
      const transformedProperties = data.properties.map(prop => {
        return {
          id: prop.id,
          name: prop.name || prop.title || 'Unnamed Property',
          manager: prop.manager || prop.owner?.name || 'Unknown Manager',
          managerEmail: prop.managerEmail || prop.owner?.email || '',
          managerPhone: prop.managerPhone || prop.owner?.phone || '',
          location: prop.location || prop.address || 'No address',
          type: prop.property_type || prop.type || 'Building',
          units: prop.units || prop.num_units || 0,
          priceRange: prop.rent_price ? `₱${Number(prop.rent_price).toLocaleString()}` : 'Price not set',
          description: prop.description || 'No description provided',
          amenities: prop.amenities || [],
          images: Array.isArray(prop.images) && prop.images.length > 0 ? prop.images : ['data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNzUgMTUwSDMyNVYyNTBIMjc1VjE1MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTI1MCAyMDBIMzUwVjIyMEgyNTBWMjAwWiIgZmlsbD0iIzlDQTNBRiIvPgo8dGV4dCB4PSIzMDAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNkI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Qcm9wZXJ0eSBJbWFnZTwvdGV4dD4KPC9zdmc+'],
          documents: Array.isArray(prop.legal_documents) ? prop.legal_documents : [],
          submittedDate: prop.created_at ? new Date(prop.created_at).toLocaleDateString() : 'N/A',
          lastUpdated: prop.last_updated ? new Date(prop.last_updated).toLocaleDateString() : 'N/A',
          status: prop.status || 'pending_approval',
          notes: '',
          managerNotes: prop.managerNotes || 'Property submitted for review'
        };
      });
      
      setProperties(transformedProperties);
    } catch (error) {
      console.error('Fetch error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        response: error.response,
        stack: error.stack
      });
      
      if (error.status === 401) {
        setError('Authentication failed. Please log in as an admin user.');
        console.error('401 Error - User may not be authenticated or may not have admin privileges');
      } else if (error.status === 403) {
        setError('Access denied. Admin privileges required to view property reviews.');
        console.error('403 Error - User does not have admin privileges');
      } else if (error.status === 500) {
        setError('Server error. Please try again later.');
        console.error('500 Error - Server internal error');
      } else if (error.status === 404) {
        setError('API endpoint not found. Please check if the backend server is running.');
        console.error('404 Error - API endpoint not found');
      } else {
        setError(error.message || 'Network error. Please try again.');
        console.error('Other error -', error.message);
      }
      
      // Clear properties array when there's an error
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []); // Remove activeTab dependency - always fetch all properties

  // Fetch all properties on component mount
  useEffect(() => {
    fetchPendingProperties();
  }, [fetchPendingProperties]); // Only fetch on mount, not when tab changes

  // Fetch documents for a specific property
  const fetchPropertyDocuments = useCallback(async (propertyId) => {
    try {
      const documentsResponse = await ApiService.adminDocuments();
      const allDocuments = documentsResponse.documents || [];
      
      // Filter documents for this property (main domain only)
      const propertyDocuments = allDocuments.filter(doc => 
        doc.property_id === propertyId && doc.source !== 'subdomain'
      );
      
      setPropertyDocumentsStatus(prev => ({
        ...prev,
        [propertyId]: propertyDocuments
      }));
    } catch (error) {
      console.error('Error fetching property documents:', error);
    }
  }, []);

  // Fetch documents when modal opens
  useEffect(() => {
    if (showModal && selectedProperty) {
      fetchPropertyDocuments(selectedProperty.id);
    }
  }, [showModal, selectedProperty, fetchPropertyDocuments]);

  // Cleanup blob URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewDocument?.previewUrl) {
        window.URL.revokeObjectURL(previewDocument.previewUrl);
      }
    };
  }, [previewDocument]);

  // Handle document status update (approve/reject)
  const handleDocumentStatusUpdate = async (documentId, newStatus) => {
    try {
      setUpdatingDocumentStatus(prev => ({ ...prev, [documentId]: true }));
      await ApiService.updateDocumentStatus(documentId, newStatus);
      
      // Update local state
      if (selectedProperty) {
        const propertyDocs = propertyDocumentsStatus[selectedProperty.id] || [];
        const updatedDocs = propertyDocs.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: newStatus }
            : doc
        );
        
        setPropertyDocumentsStatus(prev => ({
          ...prev,
          [selectedProperty.id]: updatedDocs
        }));
      }
      
      alert(`Document ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating document status:', error);
      alert(`Failed to update document status: ${error.message || 'Unknown error'}`);
    } finally {
      setUpdatingDocumentStatus(prev => ({ ...prev, [documentId]: false }));
    }
  };

  // Handle document preview
  const handleDocumentPreview = async (doc) => {
    if (!doc || !doc.id) {
      alert('Invalid document selected for preview');
      return;
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
      const blob = await ApiService.downloadDocument(doc.id);
      
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
      if (error.message) {
        errorMessage = error.message;
      }
      
      setPreviewError(errorMessage);
      setPreviewDocument({
        ...doc,
        previewUrl: null
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Close preview
  const closePreview = useCallback(() => {
    setPreviewDocument(prev => {
      if (prev?.previewUrl) {
        window.URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
    setPreviewError('');
    setPreviewLoading(false);
  }, []);

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
  }, [previewDocument, closePreview]);

  // Get file type for preview
  const getFileType = (filename) => {
    if (!filename) return 'unknown';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
    return 'unknown';
  };

  const handleStatusChange = async (propertyId, newStatus, adminNotes = '') => {
    setApproving(prev => ({ ...prev, [propertyId]: true }));
    
    try {
      if (newStatus === 'approved') {
        // Check if all legal documents are approved before allowing property approval
        const property = properties.find(p => p.id === propertyId);
        if (property && property.documents && property.documents.length > 0) {
          // Check document statuses - need to fetch from Document Management API
          try {
            const documentsResponse = await ApiService.adminDocuments();
            const allDocuments = documentsResponse.documents || [];
            
            // Filter documents for this property
            const propertyDocuments = allDocuments.filter(doc => 
              doc.property_id === propertyId && doc.source !== 'subdomain'
            );
            
            // Check if any document is not approved
            const pendingDocuments = propertyDocuments.filter(doc => 
              doc.status !== 'approved' && doc.status !== 'rejected'
            );
            
            if (pendingDocuments.length > 0) {
              const pendingList = pendingDocuments.map(doc => 
                `- ${doc.file_name || doc.fileName || 'Unknown'} (${doc.document_type || 'Document'})`
              ).join('\n');
              
              alert(`❌ Cannot approve property!\n\nPlease approve all legal documents first:\n\n${pendingList}\n\nGo to Document Management to review and approve documents.`);
              setApproving(prev => ({ ...prev, [propertyId]: false }));
              return;
            }
          } catch (docError) {
            console.error('Error checking document status:', docError);
            // Continue with approval attempt if document check fails
            // Backend will also validate this
          }
        }
        
        const data = await ApiService.approveProperty(propertyId, {
          notes: adminNotes || 'Approved and portal enabled'
        });
        
        // Refetch all properties to get updated status and accurate counts
        await fetchPendingProperties();
        
        // Show success message
        if (data.portal_url) {
          alert(`✅ Property approved successfully!\n\nPortal URL: ${data.portal_url}`);
        } else {
          alert(`✅ Property approved successfully!\n\nManager can now set subdomain in Manage Properties.`);
        }
      } else if (newStatus === 'rejected') {
        await ApiService.rejectProperty(propertyId, {
          reason: adminNotes
        });
        
        // Refetch all properties to get updated status and accurate counts
        await fetchPendingProperties();
        
        alert('✅ Property rejected successfully');
      }
    } catch (error) {
      console.error('Status change error:', error);
      
      // Check if error is about pending documents
      if (error.message && error.message.includes('legal documents must be approved')) {
        alert(`❌ ${error.message}`);
      } else if (error.message && error.message.includes('Cannot approve property')) {
        alert(`❌ ${error.message}`);
      } else {
        alert(`❌ ${error.message || 'Network error during status change'}`);
      }
    } finally {
      setApproving(prev => ({ ...prev, [propertyId]: false }));
    }
    
    setShowModal(false);
    setSelectedProperty(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved':
      case 'active': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_approval': return 'Pending Review';
      case 'approved':
      case 'active': return 'Approved';
      case 'rejected': return 'Rejected';
      default: 
        return 'Unknown';
    }
  };

  // Calculate property counts for tabs using useMemo for performance
  const propertyCounts = useMemo(() => {
    // Ensure properties is an array
    const propsArray = Array.isArray(properties) ? properties : [];
    
    return {
      all: propsArray.length,
      pending: propsArray.filter(p => {
        const status = (p.status || '').toLowerCase();
        return status === 'pending' || status === 'pending_approval';
      }).length,
      approved: propsArray.filter(p => {
        const status = (p.status || '').toLowerCase();
        return status === 'approved' || status === 'active';
      }).length,
      rejected: propsArray.filter(p => {
        const status = (p.status || '').toLowerCase();
        return status === 'rejected';
      }).length
    };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    // Ensure properties is an array
    const propsArray = Array.isArray(properties) ? properties : [];
    
    if (activeTab === 'all') return propsArray;
    
    if (activeTab === 'pending') {
      return propsArray.filter(prop => {
        const status = (prop.status || '').toLowerCase();
        return status === 'pending' || status === 'pending_approval';
      });
    }
    
    if (activeTab === 'approved') {
      return propsArray.filter(prop => {
        const status = (prop.status || '').toLowerCase();
        return status === 'approved' || status === 'active';
      });
    }
    
    if (activeTab === 'rejected') {
      return propsArray.filter(prop => {
        const status = (prop.status || '').toLowerCase();
        return status === 'rejected';
      });
    }
    
    return propsArray;
  }, [properties, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center">
            <div className="text-red-400 mr-3 text-xl">⚠️</div>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Properties</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchPendingProperties}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Black & White Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div className="text-white">
              <h1 className="text-3xl font-bold text-white">Property Review & Approval</h1>
              <p className="text-gray-300 mt-1">Review and approve property submissions - Creates dynamic portals automatically!</p>
              <div className="mt-1 flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">
                    {propertyCounts.pending} Pending Review
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">
                    {propertyCounts.approved} Approved
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-sm text-gray-300">
                    {propertyCounts.rejected} Rejected
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setLoading(true);
                  setProperties([]); // Clear existing data
                  setError('');
                  setTimeout(() => {
                    fetchPendingProperties();
                  }, 100);
                }}
                className="bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-xl hover:bg-white/20 transition-all duration-200 font-medium border border-white/20"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Refreshing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                  </div>
                )}
              </button>
              <button className="bg-white text-black px-6 py-3 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Report
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Black & White Tabs */}
        <div className="rounded-2xl shadow-lg border border-gray-200 mb-8 overflow-hidden bg-gradient-to-r from-gray-900 to-black">
          <div className="bg-black px-6 py-2">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'all'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${activeTab === 'all' ? 'bg-white' : 'bg-gray-400'}`}></div>
                  <span>All Properties</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'all' ? 'bg-white text-black' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {propertyCounts.all}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'pending'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${activeTab === 'pending' ? 'bg-white' : 'bg-gray-400'}`}></div>
                  <span>Pending Review</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'pending' ? 'bg-white text-black' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {propertyCounts.pending}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'approved'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${activeTab === 'approved' ? 'bg-white' : 'bg-gray-400'}`}></div>
                  <span>Approved</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'approved' ? 'bg-white text-black' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {propertyCounts.approved}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'rejected'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${activeTab === 'rejected' ? 'bg-white' : 'bg-gray-400'}`}></div>
                  <span>Rejected</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activeTab === 'rejected' ? 'bg-white text-black' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {propertyCounts.rejected}
                  </span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Enhanced Properties Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredProperties.map((property) => (
            <div key={property.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 group">
              {/* Property Images */}
              <div className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-200">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={property.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-lg ${getStatusColor(property.status)}`}>
                    {getStatusText(property.status)}
                  </span>
                </div>

                {/* Property Type Badge */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700 backdrop-blur-sm">
                    {property.type}
                  </span>
                </div>
              </div>

              {/* Property Info */}
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {property.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">{property.building_name || 'Property Building'}</p>
                </div>
                
                {/* Key Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{property.location}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{property.units} units</span>
                  </div>
                </div>

                {/* Manager Info */}
                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="truncate">{property.manager}</span>
                </div>

                {/* Financial Info */}
                <div className="bg-black rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Rent Range</span>
                    <span className="text-lg font-bold text-white">{property.priceRange}</span>
                  </div>
                </div>

                {/* Timeline Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Submitted</span>
                    <span className="font-medium">{property.submittedDate}</span>
                  </div>
                  {property.lastUpdated && property.lastUpdated !== property.submittedDate && (
                    <div className="flex items-center justify-between text-xs text-blue-600">
                      <span>Last Updated</span>
                      <span className="font-medium">{property.lastUpdated}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6">
                  {(property.status === 'pending' || property.status === 'pending_approval') ? (
                    <button
                      onClick={() => {
                        setSelectedProperty(property);
                        setShowModal(true);
                      }}
                      className="w-full bg-black text-white px-4 py-3 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      disabled={approving[property.id]}
                    >
                      {approving[property.id] ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Review Property
                        </div>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedProperty(property);
                          setShowModal(true);
                        }}
                        className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl hover:bg-gray-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </div>
                      </button>
                      {property.notes && (
                        <div className="mt-3 p-3 bg-gray-100 rounded-xl border border-gray-200">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Admin Notes:</span> {property.notes}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-500">
              {activeTab === 'pending' 
                ? 'No properties are currently pending review. All submitted properties have been processed.'
                : activeTab === 'approved'
                ? 'No properties have been approved yet. Review pending properties to approve them.'
                : activeTab === 'rejected'
                ? 'No properties have been rejected. All submitted properties are either pending or approved.'
                : `No properties found in the ${activeTab} status.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Enhanced Property Review Modal */}
      {showModal && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Property Review</h2>
                  <p className="text-sm text-gray-600 mt-1">Review property submission and make approval decision</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Property Images Gallery */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Property Images
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProperty.images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`${selectedProperty.name} ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                        <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Property Information */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Property Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
                        <p className="text-sm text-gray-900 font-medium">{selectedProperty.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                        <p className="text-sm text-gray-900">{selectedProperty.type}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <p className="text-sm text-gray-900">{selectedProperty.location}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Units</label>
                        <p className="text-sm text-gray-900 font-semibold">{selectedProperty.units}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rent</label>
                        <p className="text-sm text-gray-900 font-semibold text-green-600">{selectedProperty.priceRange}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Property Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedProperty.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                        selectedProperty.status === 'active' ? 'bg-green-100 text-green-800' :
                        selectedProperty.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedProperty.status === 'pending_approval' ? 'Pending Review' :
                         selectedProperty.status === 'active' ? 'Active' :
                         selectedProperty.status === 'rejected' ? 'Rejected' :
                         selectedProperty.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manager Information */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Manager Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                      <p className="text-sm text-gray-900 font-medium">{selectedProperty.manager}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <p className="text-sm text-gray-900">{selectedProperty.managerEmail}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <p className="text-sm text-gray-900">{selectedProperty.managerPhone}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Submitted Date</label>
                      <p className="text-sm text-gray-900">{selectedProperty.submittedDate}</p>
                    </div>
                    {selectedProperty.lastUpdated && selectedProperty.lastUpdated !== selectedProperty.submittedDate && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                        <p className="text-sm text-blue-600 font-medium">{selectedProperty.lastUpdated}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description and Amenities */}
              <div className="mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Description & Amenities
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Property Description</label>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-900 leading-relaxed">{selectedProperty.description}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Available Amenities</label>
                      {selectedProperty.amenities && selectedProperty.amenities.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {selectedProperty.amenities.map((amenity, index) => (
                            <div key={index} className="flex items-center p-2 bg-green-50 border border-green-200 rounded-lg">
                              <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm text-green-800 font-medium">{amenity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No amenities specified</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal Documents */}
              <div className="mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Legal Documents
                    </h3>
                    {(() => {
                      const propertyDocs = propertyDocumentsStatus[selectedProperty.id] || [];
                      const pendingDocs = propertyDocs.filter(doc => doc.status !== 'approved' && doc.status !== 'rejected');
                      if (pendingDocs.length > 0 && (selectedProperty.status === 'pending' || selectedProperty.status === 'pending_approval')) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                            <p className="text-sm font-medium text-yellow-800">
                              ⚠️ {pendingDocs.length} document{pendingDocs.length > 1 ? 's' : ''} pending approval
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const propertyDocs = propertyDocumentsStatus[selectedProperty.id] || [];
                      const hasDocuments = propertyDocs.length > 0 || (selectedProperty.documents && selectedProperty.documents.length > 0);
                      
                      if (!hasDocuments) {
                        return (
                          <div className="col-span-full text-center py-8">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-sm text-gray-500">No legal documents uploaded</p>
                          </div>
                        );
                      }
                      
                      // Use fetched document statuses if available, otherwise fall back to property documents
                      if (propertyDocs.length > 0) {
                        return propertyDocs.map((doc, index) => {
                          const docName = doc.file_name || doc.fileName || `Document ${index + 1}`;
                          const docType = doc.document_type || doc.documentType || 'Document';
                          const docStatus = doc.status || 'pending';
                          const isPending = docStatus !== 'approved' && docStatus !== 'rejected';
                          
                          return (
                            <div key={doc.id || index} className={`p-4 border rounded-lg transition-colors ${
                              isPending ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}>
                              <div className="flex items-start">
                                <div className="flex-shrink-0">
                                  <svg className={`w-8 h-8 ${isPending ? 'text-yellow-500' : docStatus === 'approved' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{docName}</p>
                                  <p className="text-xs text-gray-500">{docType}</p>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                                    docStatus === 'approved' ? 'bg-green-100 text-green-800' :
                                    docStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {docStatus === 'approved' ? '✓ Approved' :
                                     docStatus === 'rejected' ? '✗ Rejected' :
                                     '⏳ Pending Review'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center space-x-2">
                                <button
                                  onClick={() => handleDocumentPreview(doc)}
                                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex items-center justify-center"
                                  title="Preview document"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Preview
                                </button>
                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => handleDocumentStatusUpdate(doc.id, 'approved')}
                                      disabled={updatingDocumentStatus[doc.id]}
                                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-xs font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Approve document"
                                    >
                                      {updatingDocumentStatus[doc.id] ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          Approve
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDocumentStatusUpdate(doc.id, 'rejected')}
                                      disabled={updatingDocumentStatus[doc.id]}
                                      className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-xs font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Reject document"
                                    >
                                      {updatingDocumentStatus[doc.id] ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          Reject
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        });
                      }
                      
                      // Fallback to property documents if document statuses not loaded
                      return selectedProperty.documents.map((doc, index) => {
                        const docName = typeof doc === 'string' ? doc : (doc.filename || doc.name || `Document ${index + 1}`);
                        const docType = typeof doc === 'object' ? (doc.type || 'Document') : 'Document';
                        const docStatus = typeof doc === 'object' ? (doc.status || 'pending') : 'pending';
                        const isPending = docStatus !== 'approved' && docStatus !== 'rejected';
                        
                        // Create a document object with id for preview/status update
                        const docObj = typeof doc === 'object' ? doc : {
                          id: `fallback_${selectedProperty.id}_${index}`,
                          file_name: docName,
                          document_type: docType,
                          status: docStatus,
                          ...doc
                        };
                        
                        return (
                          <div key={index} className={`p-4 border rounded-lg transition-colors ${
                            isPending ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <svg className={`w-8 h-8 ${isPending ? 'text-yellow-500' : docStatus === 'approved' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{docName}</p>
                                <p className="text-xs text-gray-500">{docType}</p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                                  docStatus === 'approved' ? 'bg-green-100 text-green-800' :
                                  docStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {docStatus === 'approved' ? '✓ Approved' :
                                   docStatus === 'rejected' ? '✗ Rejected' :
                                   '⏳ Pending Review'}
                                </span>
                              </div>
                            </div>
                            {docObj.id && (
                              <div className="mt-3 flex items-center space-x-2">
                                <button
                                  onClick={() => handleDocumentPreview(docObj)}
                                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex items-center justify-center"
                                  title="Preview document"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Preview
                                </button>
                                {isPending && docObj.id.startsWith('main_') && (
                                  <>
                                    <button
                                      onClick={() => handleDocumentStatusUpdate(docObj.id, 'approved')}
                                      disabled={updatingDocumentStatus[docObj.id]}
                                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-xs font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Approve document"
                                    >
                                      {updatingDocumentStatus[docObj.id] ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          Approve
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDocumentStatusUpdate(docObj.id, 'rejected')}
                                      disabled={updatingDocumentStatus[docObj.id]}
                                      className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-xs font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Reject document"
                                    >
                                      {updatingDocumentStatus[docObj.id] ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          Reject
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Manager Notes */}
              <div className="mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Manager Notes
                  </h3>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 leading-relaxed">{selectedProperty.managerNotes}</p>
                  </div>
                </div>
              </div>

              {/* Admin Decision Section */}
              <div className="mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {(selectedProperty.status === 'pending' || selectedProperty.status === 'pending_approval') ? 'Admin Decision' : 'Admin Notes'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {(selectedProperty.status === 'pending' || selectedProperty.status === 'pending_approval') ? 'Review Notes' : 'Admin Notes'}
                      </label>
                      <textarea
                        id="admin-notes-textarea"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows="4"
                        placeholder={selectedProperty.notes || "Add your review notes, feedback, or requirements here..."}
                        defaultValue={selectedProperty.notes || ''}
                      ></textarea>
                    </div>
                    {(selectedProperty.status === 'pending' || selectedProperty.status === 'pending_approval') && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-800 mb-2">What happens when you approve:</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• Property status changes to ACTIVE</li>
                          <li>• Property manager can set their subdomain</li>
                          <li>• Property manager can customize the portal</li>
                          <li>• Tenants can access property-specific portal</li>
                          <li>• Default features enabled: login, inquiries, gallery</li>
                        </ul>
                      </div>
                    )}
                    {(selectedProperty.status === 'approved' || selectedProperty.status === 'active') && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-800 mb-2">Property Status: Approved</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• Property is currently active and visible to tenants</li>
                          <li>• Property manager has access to portal management</li>
                          <li>• You can change status to rejected if needed</li>
                        </ul>
                      </div>
                    )}
                    {selectedProperty.status === 'rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-semibold text-red-800 mb-2">Property Status: Rejected</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• Property is currently rejected and not visible to tenants</li>
                          <li>• Property manager can resubmit after making changes</li>
                          <li>• You can change status to approved if needed</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {(selectedProperty.status === 'pending' || selectedProperty.status === 'pending_approval') ? (
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      const adminNotes = document.querySelector('#admin-notes-textarea')?.value || 'Rejected after review';
                      handleStatusChange(selectedProperty.id, 'rejected', adminNotes);
                    }}
                    className="flex-1 bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center"
                    disabled={approving[selectedProperty.id]}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject Property
                  </button>
                  {(() => {
                    const propertyDocs = propertyDocumentsStatus[selectedProperty.id] || [];
                    const pendingDocs = propertyDocs.filter(doc => doc.status !== 'approved' && doc.status !== 'rejected');
                    const hasPendingDocs = pendingDocs.length > 0;
                    
                    return (
                      <button
                        onClick={() => {
                          const adminNotes = document.querySelector('#admin-notes-textarea')?.value || 'Approved and portal enabled';
                          handleStatusChange(selectedProperty.id, 'approved', adminNotes);
                        }}
                        className={`flex-1 px-6 py-4 rounded-lg transition-colors font-medium flex items-center justify-center ${
                          hasPendingDocs
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        disabled={approving[selectedProperty.id] || hasPendingDocs}
                        title={hasPendingDocs ? 'Please approve all legal documents first' : 'Approve property'}
                      >
                        {approving[selectedProperty.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : hasPendingDocs ? (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            Approve Property (Documents Pending)
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve Property
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-600 text-white px-6 py-4 rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close
                  </button>
                  {/* Allow status change for approved/rejected properties */}
                  {selectedProperty.status === 'approved' || selectedProperty.status === 'active' ? (
                    <button
                      onClick={() => {
                        const adminNotes = document.querySelector('#admin-notes-textarea')?.value || 'Status changed to rejected';
                        handleStatusChange(selectedProperty.id, 'rejected', adminNotes);
                      }}
                      className="flex-1 bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center"
                      disabled={approving[selectedProperty.id]}
                    >
                      {approving[selectedProperty.id] ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Change to Rejected
                        </>
                      )}
                    </button>
                  ) : selectedProperty.status === 'rejected' ? (
                    <button
                      onClick={() => {
                        const adminNotes = document.querySelector('#admin-notes-textarea')?.value || 'Status changed to approved';
                        handleStatusChange(selectedProperty.id, 'approved', adminNotes);
                      }}
                      className="flex-1 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center"
                      disabled={approving[selectedProperty.id]}
                    >
                      {approving[selectedProperty.id] ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Change to Approved
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]" onClick={closePreview}>
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
                    {selectedProperty?.name || 'Property'} • {previewDocument.document_type || previewDocument.documentType || 'Document'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {previewDocument.status === 'pending' && previewDocument.id && previewDocument.id.startsWith('main_') && (
                  <>
                    <button
                      onClick={() => {
                        handleDocumentStatusUpdate(previewDocument.id, 'approved');
                        closePreview();
                      }}
                      disabled={updatingDocumentStatus[previewDocument.id]}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Approve document"
                    >
                      {updatingDocumentStatus[previewDocument.id] ? (
                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        handleDocumentStatusUpdate(previewDocument.id, 'rejected');
                        closePreview();
                      }}
                      disabled={updatingDocumentStatus[previewDocument.id]}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Reject document"
                    >
                      {updatingDocumentStatus[previewDocument.id] ? (
                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      Reject
                    </button>
                  </>
                )}
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
                    <button
                      onClick={() => handleDocumentPreview(previewDocument)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Try Again
                    </button>
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

export default AdminPropertyReview;

