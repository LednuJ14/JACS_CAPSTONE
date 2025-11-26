import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import { ClipboardList, Plus, CheckCircle2, Clock, Search, SlidersHorizontal, Loader2 } from 'lucide-react';
import { apiService } from '../../../services/api';

const StaffTasksPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  
  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    fetchTasks();
  }, [navigate]);
  
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to get tasks from API
      const response = await apiService.get('/tasks/my-tasks');
      setTasks(response.tasks || []);
    } catch (e) {
      console.warn('Failed to load tasks from API, using mock data:', e);
      // Fallback to mock data
      setTasks(getStaffTasks());
    } finally {
      setLoading(false);
    }
  };
  
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await apiService.put(`/tasks/${taskId}`, { status: newStatus });
      await fetchTasks(); // Reload tasks
    } catch (e) {
      console.error('Failed to update task status:', e);
      // For demo purposes, update locally if API fails
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    }
  };
  
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = search === '' || 
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading tasks...</span>
        </div>
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
                <p className="text-sm text-gray-600">Track and manage your assigned tasks</p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="col-span-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" 
                  placeholder="Search tasks..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 w-full md:w-auto">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
              <select 
                className="px-3 py-2 border rounded-lg text-sm w-full md:w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All Status</option>
                <option>open</option>
                <option>in_progress</option>
                <option>completed</option>
                <option>cancelled</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {filteredTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map((task) => {
                  const statusColors = {
                    'open': 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    'in_progress': 'bg-blue-50 text-blue-700 border-blue-200',
                    'completed': 'bg-green-50 text-green-700 border-green-200',
                    'cancelled': 'bg-red-50 text-red-700 border-red-200'
                  };
                  
                  const defaultColor = 'bg-gray-50 text-gray-700 border-gray-200';
                  const statusColor = statusColors[task.status] || defaultColor;
                  
                  return (
                    <div key={task.id} className="border rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-gray-900">{task.title}</h3>
                        {task.status === 'in_progress' || task.status === 'In Progress' ? (
                          <Clock className="w-4 h-4 text-amber-500" />
                        ) : task.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ClipboardList className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{task.description}</p>
                      )}
                      
                      <div className="mt-2 text-sm text-gray-600">
                        Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : task.due || 'No due date'}
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full border ${statusColor}`}>
                          {task.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        
                        {task.status !== 'completed' && (
                          <select
                            value={task.status}
                            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                            className="text-xs border rounded px-2 py-1 ml-2"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                      
                      {task.priority && (
                        <div className="mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {task.priority.toUpperCase()} PRIORITY
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">No tasks found</p>
                <p className="text-sm text-gray-600">
                  {search || statusFilter !== 'All Status' 
                    ? 'Try adjusting your search or filters' 
                    : 'No tasks have been assigned to you yet'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StaffTasksPage;


