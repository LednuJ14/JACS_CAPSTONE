import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header.jsx';
import { apiService } from '../../../services/api';
import { Bell, ClipboardList, MessageSquare, Calendar, FileText, CheckCircle, AlertCircle, ChevronRight, CalendarDays, Users, Wrench, ArrowRight, Loader2 } from 'lucide-react';

const StaffDashboardPage = () => {
  const [stats, setStats] = useState({
    myTasks: 0,
    pendingRequests: 0,
    unreadMessages: 0,
    upcomingShifts: 0
  });
  const [workload, setWorkload] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch dashboard data
        const dashboardData = await apiService.getDashboardData();
        if (dashboardData) {
          setStats({
            myTasks: dashboardData.metrics?.my_tasks || 0,
            pendingRequests: dashboardData.metrics?.pending_requests || 0,
            unreadMessages: dashboardData.metrics?.unread_messages || 0,
            upcomingShifts: dashboardData.metrics?.upcoming_shifts || 0
          });
          setWorkload({
            pending: dashboardData.workload?.pending || 0,
            inProgress: dashboardData.workload?.in_progress || 0,
            completed: dashboardData.workload?.completed || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const workloadTotal = workload.pending + workload.inProgress + workload.completed;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const quickLinks = [
    { label: 'My Tasks', icon: ClipboardList, href: '/staff/tasks', gradient: 'from-blue-50 to-blue-100', border: 'border-blue-200', iconBg: 'bg-blue-600' },
    { label: 'Requests', icon: Wrench, href: '/staff/requests', gradient: 'from-green-50 to-green-100', border: 'border-green-200', iconBg: 'bg-green-600' },
    { label: 'Chats', icon: MessageSquare, href: '/staff/', gradient: 'from-purple-50 to-purple-100', border: 'border-purple-200', iconBg: 'bg-purple-600' },
    { label: 'Schedule', icon: Calendar, href: '/staff/schedule', gradient: 'from-rose-50 to-rose-100', border: 'border-rose-200', iconBg: 'bg-rose-600' },
    { label: 'Documents', icon: FileText, href: '/staff/documents', gradient: 'from-slate-50 to-slate-100', border: 'border-slate-200', iconBg: 'bg-slate-700' },
    { label: 'Announcements', icon: Bell, href: '/staff/announcements', gradient: 'from-amber-50 to-amber-100', border: 'border-amber-200', iconBg: 'bg-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 w-full">
      <Header userType="staff" />
      <div className="px-4 py-8 w-full">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Dashboard</h1>
                <p className="text-gray-600">Welcome back! Here is your overview.</p>
              </div>
            </div>
          </div>

        <main className="px-4 py-8 w-full">
          <div className="max-w-7xl mx-auto space-y-8">
          {/* Key Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">My Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.myTasks}</p>
                  <p className="text-xs text-gray-500 mt-1">assigned to me</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <ClipboardList className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Pending Requests</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pendingRequests}</p>
                  <p className="text-xs text-gray-500 mt-1">awaiting action</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Wrench className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Unread Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unreadMessages}</p>
                  <p className="text-xs text-gray-500 mt-1">inbox total</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Upcoming Shifts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingShifts}</p>
                  <p className="text-xs text-gray-500 mt-1">this week</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`group flex items-center space-x-3 p-4 bg-gradient-to-r ${item.gradient} hover:from-white hover:to-white rounded-lg transition-all duration-200 border ${item.border}`}
                >
                  <div className={`p-2 ${item.iconBg} rounded-lg group-hover:brightness-110 transition-colors`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-600">Go to {item.label.toLowerCase()}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 ml-auto" />
                </Link>
              ))}
            </div>
          </section>

          {/* Main Content Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Workload Overview</h2>
                <ClipboardList className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-gray-600">Pending</span>
                    <span className="text-gray-900 font-medium">{workload.pending}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-3 bg-amber-500"
                      style={{ width: `${workloadTotal ? (workload.pending / workloadTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-gray-600">In Progress</span>
                    <span className="text-gray-900 font-medium">{workload.inProgress}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-blue-100 overflow-hidden">
                    <div
                      className="h-3 bg-blue-500"
                      style={{ width: `${workloadTotal ? (workload.inProgress / workloadTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-gray-600">Completed</span>
                    <span className="text-gray-900 font-medium">{workload.completed}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-emerald-100 overflow-hidden">
                    <div
                      className="h-3 bg-emerald-500"
                      style={{ width: `${workloadTotal ? (workload.completed / workloadTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-lg bg-gray-50 border">
                    <p className="text-xs text-gray-500">This Week</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{stats.upcomingShifts} upcoming shifts</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 border">
                    <p className="text-xs text-gray-500">Inbox</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{stats.unreadMessages} unread messages</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
                <Bell className="w-5 h-5 text-gray-400" />
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2"><Bell className="w-4 h-4 mt-0.5 text-purple-500" /> Fire drill scheduled for Friday 10 AM.</li>
                <li className="flex items-start gap-2"><Bell className="w-4 h-4 mt-0.5 text-purple-500" /> New safety protocols updated in documents.</li>
                <li className="flex items-start gap-2"><Bell className="w-4 h-4 mt-0.5 text-purple-500" /> Monthly meeting next week.</li>
              </ul>
            </div>
          </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StaffDashboardPage;


