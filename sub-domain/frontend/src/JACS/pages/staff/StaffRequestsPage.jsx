import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import { Filter, Search, Loader2 } from 'lucide-react';
import { apiService } from '../../../services/api';

const StaffRequestsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Status');

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    fetchRequests();
  }, [navigate]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get requests from API - staff can see requests assigned to them
      const response = await apiService.getMaintenanceRequests();
      
      // Transform API data to match frontend interface
      const transformedRequests = (response || []).map((request) => {
        const backendStatus = (request.status || 'pending').toLowerCase();
        let displayStatus = 'Pending';
        if (backendStatus === 'in_progress') {
          displayStatus = 'Assigned';
        } else if (backendStatus === 'completed') {
          displayStatus = 'Resolved';
        } else if (backendStatus === 'cancelled') {
          displayStatus = 'Cancelled';
        } else if (backendStatus === 'approved' || backendStatus === 'on_hold') {
          displayStatus = 'Pending';
        }
        
        return {
          id: request.id,
          type: request.category || 'Maintenance',
          title: request.title || request.issue || 'Maintenance Request',
          priority: request.priority ? 
            (request.priority.charAt(0).toUpperCase() + request.priority.slice(1)) : 
            'Medium',
          status: displayStatus,
          backend_status: backendStatus
        };
      });
      
      setRequests(transformedRequests);
    } catch (e) {
      console.error('Failed to load requests from API:', e);
      setError('Failed to load requests. Please try again later.');
      setRequests([]); // Set empty array instead of mock data
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = search === '' || 
      req.title.toLowerCase().includes(search.toLowerCase()) ||
      (req.type || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All Types' || req.type === typeFilter;
    const matchesStatus = statusFilter === 'All Status' || req.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading requests...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
        <Header userType="staff" />
        <main className="px-4 py-8 w-full">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-800 font-medium mb-4">{error}</p>
              <button
                onClick={fetchRequests}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="staff" />
      <main className="px-4 py-8 w-full">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Requests</h1>
                <p className="text-gray-600 text-sm">Track and manage assigned maintenance/support requests</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{requests.length} total</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" 
                  placeholder="Search requests..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
                <select 
                  className="px-3 py-2 border rounded-lg text-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option>All Types</option>
                  <option>Maintenance</option>
                  <option>Support</option>
                </select>
                <select 
                  className="px-3 py-2 border rounded-lg text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option>All Status</option>
                  <option>Pending</option>
                  <option>Assigned</option>
                  <option>Resolved</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y">
          {filteredRequests.length > 0 ? filteredRequests.map((req) => (
            <div key={req.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">#{req.id} • {req.type}</div>
                <div className="font-medium text-gray-900">{req.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full border ${
                  req.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}>{req.priority}</span>
                <span className={`px-2 py-1 text-xs rounded-full border ${
                  req.status === 'Assigned' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>{req.status}</span>
              </div>
            </div>
          )) : (
            <div className="bg-white border rounded-xl p-8 text-center text-sm text-gray-600">
              {search || typeFilter !== 'All Types' || statusFilter !== 'All Status'
                ? 'No requests found. Try adjusting your filters.'
                : 'No requests have been assigned to you yet.'}
            </div>
          )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StaffRequestsPage;


