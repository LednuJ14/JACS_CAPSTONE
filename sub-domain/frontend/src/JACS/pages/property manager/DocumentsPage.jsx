import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, Upload, Download, Search, Filter, Folder, Eye, X, Building, UserPlus, Plus, Trash2, Edit2 } from 'lucide-react';
import Header from '../../components/Header';
import { apiService } from '../../../services/api';
// import { getMockManagerDocuments } from '../../mock/managerMockData';

const DocumentsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [property, setProperty] = useState('all');
  const [preview, setPreview] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.get('/documents');
      setDocs(response.documents || []);
    } catch (e) {
      console.error('Failed to load documents:', e);
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await apiService.get('/documents/types');
      setDocumentTypes(response.document_types || []);
    } catch (e) {
      console.error('Failed to load document types:', e);
    }
  };

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadDocuments();
    loadDocumentTypes();
  }, [navigate]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(docs.map(d => d.document_type)))], [docs]);
  const properties = useMemo(() => ['all', ...Array.from(new Set(docs.filter(d => d.unit_name).map(d => d.unit_name)))], [docs]);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      const s = search.trim().toLowerCase();
      const matchesSearch = !s || d.name.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s) || d.tenant_name?.toLowerCase().includes(s) || d.unit_name?.toLowerCase().includes(s);
      const matchesCategory = category === 'all' || d.document_type === category;
      const matchesProperty = property === 'all' || d.unit_name === property;
      return matchesSearch && matchesCategory && matchesProperty;
    });
  }, [docs, search, category, property]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading documents...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="manager" />
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
              <p className="text-gray-600">Distribute policies and share files</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search document, tenant, or property..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <select
                value={property}
                onChange={(e) => setProperty(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {properties.map(p => (
                  <option key={p} value={p}>{p === 'all' ? 'All Properties' : p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Document Library</h2>
              <span className="text-sm text-gray-500">{filtered.length} of {docs.length}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No documents found</p>
                <p className="text-sm">Upload or add documents to populate the library</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(doc => (
                  <div key={doc.id} className="px-6 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{doc.name}</p>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{doc.document_type}</span>
                            {doc.is_public && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600">Public</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {doc.document_type} • 
                            {doc.tenant_name ? (
                              <span className="inline-flex items-center gap-1">
                                <UserPlus className="w-3 h-3" /> {doc.tenant_name}
                              </span>
                            ) : 'All Tenants'} • 
                            {doc.unit_name || 'All Units'}
                            {' '}• {doc.file_size ? Math.round(doc.file_size / 1024) : '0'} KB • 
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                          {doc.description && (
                            <p className="text-sm text-gray-400 mt-1">{doc.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setPreview(doc)} 
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200" 
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`${apiService.getBaseURL()}/documents/${doc.id}/download`, {
                                headers: {
                                  'Authorization': `Bearer ${apiService.getToken()}`
                                }
                              });
                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = doc.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                              } else {
                                console.error('Download failed');
                              }
                            } catch (e) {
                              console.error('Download error:', e);
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this document?')) {
                              try {
                                await apiService.delete(`/documents/${doc.id}`);
                                await loadDocuments();
                              } catch (e) {
                                console.error('Delete failed:', e);
                                alert('Failed to delete document');
                              }
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {preview && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
                  <button onClick={() => setPreview(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{preview.name}</p>
                      <p className="text-sm text-gray-500">{preview.document_type} • {preview.unit_name || 'All Units'}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                    <p>Live file preview is not available in this demo.</p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`${apiService.getBaseURL()}/documents/${preview.id}/download`, {
                          headers: {
                            'Authorization': `Bearer ${apiService.getToken()}`
                          }
                        });
                        if (response.ok) {
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = preview.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        }
                      } catch (e) {
                        console.error('Download error:', e);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUploadModal && (
            <DocumentUploadModal
              onClose={() => setShowUploadModal(false)}
              onUpload={loadDocuments}
              documentTypes={documentTypes}
              uploading={uploading}
              setUploading={setUploading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Upload Modal Component
const DocumentUploadModal = ({ onClose, onUpload, documentTypes, uploading, setUploading }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    document_type: 'other',
    visibility: 'all_tenants', // all_tenants, specific_tenant, staff_and_tenants
    tenant_id: '',
    unit_id: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  
  // Load tenants for specific tenant selection
  useEffect(() => {
    if (formData.visibility === 'specific_tenant') {
      loadTenants();
    }
  }, [formData.visibility]);
  
  const loadTenants = async () => {
    try {
      setLoadingTenants(true);
      const response = await apiService.get('/tenants');
      setTenants(response.tenants || response || []);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Upload form submitted, selectedFile:', selectedFile);
    
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('name', formData.name || selectedFile.name);
      formDataToSend.append('document_type', formData.document_type);
      
      // Get property_id from subdomain - REQUIRED for tenant-visible documents
      const propertyId = apiService.getPropertyIdFromSubdomain();
      
      // Determine visibility value
      let visibilityValue = 'private';
      switch (formData.visibility) {
        case 'all_tenants':
          visibilityValue = 'tenants_only';
          // Property ID is REQUIRED for tenant-visible documents
          if (!propertyId) {
            alert('Property ID is required for documents visible to tenants. Please ensure you are accessing the correct property subdomain.');
            setUploading(false);
            return;
          }
          break;
        case 'specific_tenant':
          visibilityValue = 'private';
          // For specific tenant, we still need property_id to ensure proper filtering
          if (!propertyId) {
            alert('Property ID is required for tenant-specific documents. Please ensure you are accessing the correct property subdomain.');
            setUploading(false);
            return;
          }
          if (!formData.tenant_id) {
            alert('Please select a tenant for tenant-specific documents.');
            setUploading(false);
            return;
          }
          break;
        case 'staff_and_tenants':
          visibilityValue = 'public';
          // Property ID is REQUIRED for tenant-visible documents
          if (!propertyId) {
            alert('Property ID is required for documents visible to tenants. Please ensure you are accessing the correct property subdomain.');
            setUploading(false);
            return;
          }
          break;
        default:
          visibilityValue = 'private';
      }
      
      // Always append property_id if available (required for tenant visibility)
      if (propertyId) {
        formDataToSend.append('property_id', propertyId);
        console.log('Added property_id to FormData:', propertyId, typeof propertyId);
      } else {
        console.warn('No property_id from subdomain - document may not be visible to tenants');
      }
      
      // Append visibility
      formDataToSend.append('visibility', visibilityValue);
      
      // For specific tenant visibility, append tenant_id (though backend may not use it without tenant_id column)
      if (formData.visibility === 'specific_tenant' && formData.tenant_id) {
        formDataToSend.append('tenant_id', formData.tenant_id);
      }
      
      if (formData.unit_id) formDataToSend.append('unit_id', formData.unit_id);
      
      // Debug: Log FormData contents
      console.log('FormData entries:');
      for (let pair of formDataToSend.entries()) {
        console.log(pair[0] + ': ' + (pair[1] instanceof File ? `File: ${pair[1].name}` : pair[1]));
      }
      
      console.log('FormData prepared:', {
        file: selectedFile,
        name: formData.name || selectedFile.name,
        document_type: formData.document_type
      });

      await apiService.post('/documents', formDataToSend);

      onUpload(); // Refresh documents list
      onClose(); // Close modal
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File *
            </label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif"
              required
            />
          </div>

          {/* Document Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Leave blank to use filename"
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
              rows={3}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={formData.document_type}
              onChange={(e) => setFormData(prev => ({ ...prev, document_type: e.target.value }))}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Visibility Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Visibility *
            </label>
            <div className="space-y-2">
              <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="all_tenants"
                  checked={formData.visibility === 'all_tenants'}
                  onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value, tenant_id: '' }))}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 block">All Tenants</span>
                  <span className="text-xs text-gray-500">Visible to all tenants in this property</span>
                </div>
              </label>
              <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="staff_and_tenants"
                  checked={formData.visibility === 'staff_and_tenants'}
                  onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value, tenant_id: '' }))}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 block">Staff & Tenants</span>
                  <span className="text-xs text-gray-500">Visible to both staff and tenants in this property</span>
                </div>
              </label>
              <label className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="specific_tenant"
                  checked={formData.visibility === 'specific_tenant'}
                  onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 block">Specific Tenant</span>
                  <span className="text-xs text-gray-500">Visible only to the selected tenant (private document)</span>
                </div>
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Note: Documents visible to tenants must be associated with a property. Make sure you're uploading from the correct property subdomain.
            </p>
          </div>

          {/* Specific Tenant Selection */}
          {formData.visibility === 'specific_tenant' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Tenant
              </label>
              {loadingTenants ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading tenants...
                </div>
              ) : (
                <select
                  value={formData.tenant_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, tenant_id: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={formData.visibility === 'specific_tenant'}
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.user?.name || tenant.user?.first_name + ' ' + tenant.user?.last_name || `Tenant ${tenant.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentsPage;


