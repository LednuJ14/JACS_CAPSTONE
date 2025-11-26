import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import { FileText, Download, Search, Filter, Loader2 } from 'lucide-react';
import { apiService } from '../../../services/api';

const StaffDocumentsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  
  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    fetchDocuments();
  }, [navigate]);
  
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to get documents from API
      const response = await apiService.get('/documents');
      setDocuments(response.documents || []);
      console.log('Loaded documents for staff:', response.documents?.length);
    } catch (e) {
      console.warn('Failed to load documents from API, using mock data:', e);
      // Fallback to mock data
      setDocuments(getStaffDocuments());
    } finally {
      setLoading(false);
    }
  };
  
  const handleDownload = async (doc) => {
    try {
      // Create download URL using the API endpoint
      const response = await fetch(`${apiService.getBaseURL()}/documents/${doc.id}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiService.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get the file blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    }
  };
  
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = search === '' || doc.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All Types' || 
      (doc.mime_type && doc.mime_type.includes(typeFilter.toLowerCase())) ||
      (doc.document_type && doc.document_type.toLowerCase() === typeFilter.toLowerCase());
    return matchesSearch && matchesType;
  });
  
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="staff" />

      <main className="px-4 py-8 w-full">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
              <p className="text-gray-600 text-sm">Browse and download staff resources</p>
            </div>
          </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" 
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 w-full md:w-auto">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <select 
              className="px-3 py-2 border rounded-lg text-sm w-full md:w-auto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option>All Types</option>
              <option>policy</option>
              <option>maintenance</option>
              <option>lease</option>
              <option>other</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-gray-500 border-b">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          {filteredDocs.length > 0 ? filteredDocs.map((doc) => (
            <div key={doc.id} className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-b-0 hover:bg-gray-50">
              <div className="col-span-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    {doc.description && (
                      <p className="text-xs text-gray-500 truncate">{doc.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {doc.document_type || doc.type || 'Document'}
                </span>
              </div>
              <div className="col-span-2 text-xs text-gray-500">
                {doc.file_size ? Math.round(doc.file_size / 1024) + ' KB' : (doc.size || 'N/A')}
              </div>
              <div className="col-span-2 text-xs text-gray-500">
                {new Date(doc.created_at || Date.now()).toLocaleDateString()}
              </div>
              <div className="col-span-1 text-right">
                <button 
                  onClick={() => handleDownload(doc)}
                  className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-xs hover:bg-gray-50 transition-colors"
                  title="Download document"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>
          )) : (
            <div className="px-4 py-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">No documents found</p>
              <p className="text-sm text-gray-600">
                {search || typeFilter !== 'All Types' 
                  ? 'Try adjusting your search or filters' 
                  : 'No documents are available yet'}
              </p>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
};

export default StaffDocumentsPage;

