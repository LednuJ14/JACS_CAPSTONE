import React from 'react';
import Header from '../../components/Header.jsx';
import { AlertCircle, Filter, Search } from 'lucide-react';

const StaffRequestsPage = () => {
  const mockRequests = getStaffRequests();

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
              <span className="text-sm text-gray-500">{mockRequests.length} total</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search requests..." />
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
                <select className="px-3 py-2 border rounded-lg text-sm">
                  <option>All Types</option>
                  <option>Maintenance</option>
                  <option>Support</option>
                </select>
                <select className="px-3 py-2 border rounded-lg text-sm">
                  <option>All Status</option>
                  <option>Pending</option>
                  <option>Assigned</option>
                  <option>Resolved</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y">
          {mockRequests.map((req) => (
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
          ))}
        </div>
          {mockRequests.length === 0 && (
            <div className="bg-white border rounded-xl p-8 text-center text-sm text-gray-600">
              No requests found. Try adjusting your filters.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StaffRequestsPage;


