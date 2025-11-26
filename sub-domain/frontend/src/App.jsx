import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './JACS/pages/LoginPage';
import DashboardPage from './JACS/pages/property manager/DashboardPage';
import TenantDashboardPage from './JACS/pages/tenant/TenantDashboardPage';
import StaffDashboardPage from './JACS/pages/staff/StaffDashboardPage';
import StaffTasksPage from './JACS/pages/staff/StaffTasksPage';
import StaffRequestsPage from './JACS/pages/staff/StaffRequestsPage';
import StaffAnnouncementsPage from './JACS/pages/staff/StaffAnnouncementsPage';
import StaffDocumentsPage from './JACS/pages/staff/StaffDocumentsPage';
import StaffFeedbackPage from './JACS/pages/staff/StaffFeedbackPage';
import TenantBillsPage from './JACS/pages/tenant/TenantBillsPage';
import TenantRequestsPage from './JACS/pages/tenant/TenantRequestsPage';
import TenantAnnouncementPage from './JACS/pages/tenant/TenantAnnouncementPage';
import TenantDocumentsPage from './JACS/pages/tenant/TenantDocumentsPage';
import TenantFeedbackPage from './JACS/pages/tenant/TenantFeedbackPage';
import BillsPage from './JACS/pages/property manager/BillsPage';
import RequestsPage from './JACS/pages/property manager/RequestsPage';
import FeedbackPage from './JACS/pages/property manager/FeedbackPage';
import AnnouncementPage from './JACS/pages/property manager/AnnouncementPage';
import TenantsPage from './JACS/pages/property manager/TenantsPage';
import StaffPage from './JACS/pages/property manager/StaffPage';
import DocumentsPage from './JACS/pages/property manager/DocumentsPage';
import AnalyticsPage from './JACS/pages/property manager/AnalyticsPage';
import TasksPage from './JACS/pages/property manager/TasksPage';
import RouteProtection from './JACS/components/RouteProtection';
import SimpleRouteProtection from './JACS/components/SimpleRouteProtection';
import './App.css';

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <div className="App w-full">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Property Manager Routes */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/announcements" element={<AnnouncementPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/staffs" element={<StaffPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/staff" element={<StaffDashboardPage />} />
            <Route path="/staff/tasks" element={<StaffTasksPage />} />
            <Route path="/staff/requests" element={<StaffRequestsPage />} />
            <Route path="/staff/announcements" element={<StaffAnnouncementsPage />} />
            <Route path="/staff/documents" element={<StaffDocumentsPage />} />
            <Route path="/staff/feedback" element={<StaffFeedbackPage />} />
          
          {/* Tenant Routes */}
          <Route path="/tenant" element={<TenantDashboardPage />} />
          <Route path="/tenant/bills" element={<TenantBillsPage />} />
          <Route path="/tenant/requests" element={<TenantRequestsPage />} />
          <Route path="/tenant/announcements" element={<TenantAnnouncementPage />} />
          <Route path="/tenant/documents" element={<TenantDocumentsPage />} />
          <Route path="/tenant/feedback" element={<TenantFeedbackPage />} />
          
        </Routes>
      </div>
    </Router>
  );
}

export default App;
