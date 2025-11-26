import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, Upload, Download, Search, Folder, X, Eye, Trash2 } from 'lucide-react';
import Header from '../../components/Header';
import { apiService } from '../../../services/api';

// Use centralized mock docs

const TenantDocumentsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [preview, setPreview] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState('other');
  const [uploading, setUploading] = useState(false);
  const [documentTypes, setDocumentTypes] = useState([]);

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = apiService.getStoredUser();
    if (user && user.role !== 'tenant') {
      navigate('/dashboard');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        let myTenant = null;
        try {
          myTenant = await apiService.getMyTenant();
        } catch (_e) {}
        setTenant(myTenant || getMockTenant());
        
        // Load documents from backend API
        try {
          const response = await apiService.getDocuments();
          setDocuments(Array.isArray(response) ? response : (response.documents || []));
          console.log('Loaded documents for tenant:', Array.isArray(response) ? response.length : response.documents?.length);
        } catch (e) {
          console.error('Failed to load documents from API, using empty list:', e);
          setDocuments([]);
        }
        
        // Load document types
        try {
          const types = await apiService.getDocumentTypes();
          setDocumentTypes(types);
        } catch (e) {
          console.error('Failed to load document types:', e);
          setDocumentTypes([]);
        }
      } catch (e) {
        setError('Failed to load documents. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const categories = useMemo(() => {
    const set = new Set(documents.map((d) => d.document_type || d.category));
    return ['all', ...Array.from(set)];
  }, [documents]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || (d.document_type || d.category) === category;
      return matchesSearch && matchesCategory;
    });
  }, [documents, search, category]);
  
  const handleDownload = async (doc) => {
    try {
      const blob = await apiService.downloadDocument(doc.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename || doc.name || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download failed:', error);
      alert(error.message || 'Download failed. Please try again.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, ''));
      setShowUploadModal(true);
    }
    // Reset input
    e.target.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      alert('Please select a file to upload.');
      return;
    }
    
    try {
      setUploading(true);
      
      const documentData = {
        name: uploadName || uploadFile.name,
        document_type: uploadType,
        visibility: 'private' // Tenants upload private documents by default
      };
      
      const uploadedDoc = await apiService.uploadDocument(uploadFile, documentData);
      
      // Refresh documents list
      const response = await apiService.getDocuments();
      setDocuments(Array.isArray(response) ? response : (response.documents || []));
      
      // Reset form
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadName('');
      setUploadType('other');
      
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    
    try {
      await apiService.deleteDocument(docId);
      
      // Refresh documents list
      const response = await apiService.getDocuments();
      setDocuments(Array.isArray(response) ? response : (response.documents || []));
      
      alert('Document deleted successfully!');
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error.message || 'Failed to delete document. Please try again.');
    }
  };

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="tenant" />
      <div className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Documents</h1>
              <p className="text-gray-600">View, download, and manage your files</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Upload Document
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xls,.xlsx,.ppt,.pptx"
                  onChange={handleFileUpload}
                  className="hidden"
                  multiple={false}
                />
              </label>
            </div>
          </div>

          {/* No Tenant Record Message removed for frontend-only demo */}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search documents..."
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
                {categories.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
              <span className="text-sm text-gray-500">{filtered.length} of {documents.length}</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No documents found</p>
                <p className="text-sm">Your files will appear here once available</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((doc) => (
                  <div key={doc.id} className="px-6 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{doc.name}</p>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{doc.document_type || doc.type}</span>
                            {doc.is_public && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600">Public</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {doc.document_type || doc.category} • 
                            {doc.file_size ? Math.round(doc.file_size / 1024) : Math.round(doc.sizeKb || 0)} KB • 
                            {new Date(doc.created_at || doc.uploaded_at).toLocaleDateString()}
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
                          onClick={() => handleDownload(doc)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {/* Show delete button only for documents uploaded by current user */}
                        {doc.uploaded_by && tenant && tenant.user_id === doc.uploaded_by && (
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
                  <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
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
                      <p className="text-sm text-gray-500">
                        {preview.document_type || preview.category || 'Other'} • 
                        {preview.file_size ? ` ${Math.round(preview.file_size / 1024)} KB` : ''} • 
                        {new Date(preview.created_at || preview.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                    <p>Live file preview is not available. Please download to view.</p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    onClick={() => setPreview(null)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDownload(preview)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
                  <button 
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setUploadName('');
                      setUploadType('other');
                    }} 
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {uploadFile ? (
                        <div className="space-y-2">
                          <FileText className="w-8 h-8 mx-auto text-blue-600" />
                          <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                          <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-500">No file selected</p>
                        </div>
                      )}
                    </div>
                    <label className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xls,.xlsx,.ppt,.pptx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <span className="underline">Select different file</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Document Name *</label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="Enter document name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Document Type *</label>
                    <select
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {documentTypes.length > 0 ? (
                        documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="lease">Lease</option>
                          <option value="invoice">Invoice</option>
                          <option value="receipt">Receipt</option>
                          <option value="policy">Policy</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="other">Other</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setUploadName('');
                      setUploadType('other');
                    }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadSubmit}
                    disabled={uploading || !uploadFile || !uploadName.trim()}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantDocumentsPage;


