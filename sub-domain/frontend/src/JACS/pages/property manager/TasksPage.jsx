import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import Header from '../../components/Header';
import { apiService } from '../../../services/api';

const mockTemplates = [
  'Room inspection',
  'Repair request follow-up',
  'Move-in assistance',
  'Inventory check',
];

const TasksPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.get('/tasks');
      setTasks(response.tasks || []);
    } catch (e) {
      console.error('Failed to load tasks:', e);
      setError('Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      // Get staff users - if no staff exist, get all users for now
      const response = await apiService.get('/users?role=staff');
      if (response.users && response.users.length > 0) {
        setStaff(response.users);
      } else {
        // Fallback to all users if no staff users exist
        const allUsersResponse = await apiService.get('/users');
        setStaff(allUsersResponse.users || []);
      }
    } catch (e) {
      console.error('Failed to load staff:', e);
      // Fallback to empty array on error
      setStaff([]);
    }
  };

  const loadTaskEnums = async () => {
    try {
      const response = await apiService.get('/tasks/enums');
      setStatusOptions(response.statuses || []);
      setPriorityOptions(response.priorities || []);
    } catch (e) {
      console.error('Failed to load task enums:', e);
    }
  };

  useEffect(() => {
    if (!apiService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadTasks();
    loadStaff();
    loadTaskEnums();
  }, [navigate]);

  const canSubmit = useMemo(() => assigneeId && title.trim().length > 0, [assigneeId, title]);

  const handleTemplate = (t) => {
    setTitle(t);
    if (!description) setDescription(`${t} - details`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    
    try {
      setSubmitting(true);
      const taskData = {
        title: title.trim(),
        description: description.trim(),
        priority,
        assigned_to: assigneeId || null,
        due_date: dueDate || null
      };
      
      await apiService.post('/tasks', taskData);
      
      // Reset form
      setAssigneeId('');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      
      // Close modal
      setShowAssignModal(false);
      
      // Reload tasks
      await loadTasks();
    } catch (e) {
      console.error('Failed to create task:', e);
      alert('Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    // Reset form when closing
    setAssigneeId('');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
  };

  const updateStatus = async (id, status) => {
    try {
      await apiService.put(`/tasks/${id}`, { status });
      await loadTasks(); // Reload to get updated data
    } catch (e) {
      console.error('Failed to update task:', e);
      alert('Failed to update task status.');
    }
  };

  const deleteTask = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await apiService.delete(`/tasks/${id}`);
      await loadTasks(); // Reload tasks
    } catch (e) {
      console.error('Failed to delete task:', e);
      alert('Failed to delete task.');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const byStatus = statusFilter === 'All' || t.status === statusFilter;
      const bySearch = !search.trim() ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.assigned_to_name || '').toLowerCase().includes(search.toLowerCase());
      return byStatus && bySearch;
    });
  }, [tasks, statusFilter, search]);

  const countByStatus = useMemo(() => {
    const counts = { All: tasks.length };
    statusOptions.forEach(s => { counts[s.value] = tasks.filter(t => t.status === s.value).length; });
    return counts;
  }, [tasks, statusOptions]);

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
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tasks</h1>
              <p className="text-gray-600">Assign and track staff tasks with backend integration.</p>
            </div>
            <button
              onClick={() => setShowAssignModal(true)}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm shadow-sm"
            >
              + Assign Task
            </button>
          </div>

        {/* Filters / Toolbar */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              key="All" 
              onClick={() => setStatusFilter('All')} 
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${statusFilter === 'All' ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'}`}
            >
              All ({countByStatus['All'] || 0})
            </button>
            {statusOptions.map(s => (
              <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${statusFilter === s.value ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'}`}>
                {s.label} ({(countByStatus[s.value] || 0)})
              </button>
            ))}
            <div className="ml-auto">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks or assignee" className="h-10 border rounded-lg px-3 w-64" />
            </div>
          </div>
        </div>


        {/* Task Board */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No tasks assigned yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map(task => {
                const priorityColor = task.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' : task.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                return (
                  <div key={task.id} className="border rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColor}`}>{task.priority?.toUpperCase()}</span>
                      <span className="text-xs text-gray-500">Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</span>
                    </div>
                    <h3 className="mt-2 font-medium">{task.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">{task.description || 'No description provided.'}</p>
                    <div className="mt-3 text-sm text-gray-700">
                      <span className="font-medium">Assignee:</span> {task.assigned_to_name || '—'}
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      Created {new Date(task.created_at).toLocaleDateString()}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <select 
                        value={task.status} 
                        onChange={(e) => updateStatus(task.id, e.target.value)} 
                        className="h-9 border rounded-lg px-2 text-sm"
                      >
                        {statusOptions.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => deleteTask(task.id)} 
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Assign Task Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Assign Task to Staff</h2>
                  <p className="text-sm text-gray-500">Create and assign tasks with backend integration.</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                    <input 
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)} 
                      className="w-full h-11 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      placeholder="e.g. Repair broken faucet in 2A" 
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {mockTemplates.map(t => (
                        <button 
                          key={t} 
                          type="button" 
                          onClick={() => handleTemplate(t)} 
                          className="text-xs px-2 py-1 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      rows={4} 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                      placeholder="Add task details, unit number, instructions..." 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select 
                        value={priority} 
                        onChange={(e) => setPriority(e.target.value)} 
                        className="w-full h-11 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {priorityOptions.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                      <input 
                        type="date" 
                        value={dueDate} 
                        onChange={(e) => setDueDate(e.target.value)} 
                        className="w-full h-11 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign To *</label>
                      <select 
                        value={assigneeId} 
                        onChange={(e) => setAssigneeId(e.target.value)} 
                        className="w-full h-11 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select staff</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email} — {s.role || 'Staff'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  </div>

                  <div className="space-y-3">
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2">Tips</p>
                      <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
                        <li>Use templates for common tasks</li>
                        <li>Set due dates for time-sensitive work</li>
                        <li>Provide clear instructions</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!canSubmit || submitting} 
                    className={`px-6 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors ${
                      canSubmit && !submitting 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? 'Creating...' : 'Assign Task'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;


