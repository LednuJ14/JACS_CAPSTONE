import { API_ENDPOINTS } from '../config/api';

class ApiService {
  constructor() {
    // Backward compatibility: support legacy 'token' key as well
    this.accessToken = localStorage.getItem('access_token') || localStorage.getItem('token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  setAccessToken(token) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
      // Also write legacy key for compatibility with older code paths
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
    }
  }

  setRefreshToken(token) {
    this.refreshToken = token;
    if (token) localStorage.setItem('refresh_token', token);
  }

  refreshTokenFromStorage() {
    // Refresh token from localStorage in case it was set after API service creation
    this.accessToken = localStorage.getItem('access_token') || localStorage.getItem('token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  getHeaders({ isFormData = false, noAuth = false } = {}) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (this.accessToken && !noAuth) headers['Authorization'] = `Bearer ${this.accessToken}`;
    
    // For subdomain requests, we need to handle the host properly
    const hostname = window.location.hostname;
    if (hostname.includes('.localhost')) {
      // For subdomain requests, we'll rely on CORS instead of host headers
      // since we can't set host headers from browser JavaScript
    }
    
    return headers;
  }

  async request(url, options = {}) {
    try {
      // Refresh token from storage before each request to ensure we have the latest token
      this.refreshTokenFromStorage();
      
      // Handle FormData - don't set Content-Type for FormData, browser will set it
      const isFormData = options.isFormData || options.body instanceof FormData;
      const headers = { ...this.getHeaders({ isFormData, noAuth: options.noAuth }), ...(options.headers || {}) };
      
      // Remove isFormData and responseType from options before passing to fetch
      const { isFormData: _, responseType, ...fetchOptions } = options;
      
      const res = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      
      // Handle blob responses
      if (responseType === 'blob') {
        if (!res.ok) {
          // Attempt refresh on 401 only for protected endpoints (not public auth routes)
          const isAuthPublic = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/verify-2fa');
          const canTryRefresh = res.status === 401 && this.refreshToken && !url.includes('/refresh') && !isAuthPublic && !options._retried;
          if (canTryRefresh) {
            const refreshed = await this.refresh();
            if (refreshed) {
              return this.request(url, { ...options, _retried: true });
            }
          }
          
          // Try to extract error message from response
          // Clone the response first so we can read it without consuming the body
          const clonedRes = res.clone();
          const errorText = await clonedRes.text();
          let errorData = null;
          try {
            errorData = errorText ? JSON.parse(errorText) : null;
          } catch {
            errorData = null;
          }
          
          const message = (errorData && (errorData.message || errorData.error)) || res.statusText;
          const error = new Error(message || 'API error');
          error.status = res.status;
          error.data = errorData;
          throw error;
        }
        
        // Check content type to ensure it's actually a binary file
        const contentType = res.headers.get('content-type') || '';
        const isBinary = !contentType.includes('application/json') && !contentType.includes('text/');
        
        // Return blob directly
        const blob = await res.blob();
        
        // Validate that we got a proper blob
        if (!blob || !(blob instanceof Blob)) {
          throw new Error('Invalid blob response from server');
        }
        
        return blob;
      }
      
      // Handle JSON/text responses
      const text = await res.text();
      let data = null;
      try { 
        data = text ? JSON.parse(text) : null; 
      } catch { 
        data = null; 
      }

      if (!res.ok) {
        // Attempt refresh on 401 only for protected endpoints (not public auth routes)
        const isAuthPublic = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/verify-2fa');
        const canTryRefresh = res.status === 401 && this.refreshToken && !url.includes('/refresh') && !isAuthPublic && !options._retried;
        if (canTryRefresh) {
          const refreshed = await this.refresh();
          if (refreshed) {
            return this.request(url, { ...options, _retried: true });
          }
        }
        
        // Extract error message from response
        const message = (data && (data.message || data.error)) || res.statusText;
        const error = new Error(message || 'API error');
        error.status = res.status;
        error.data = data;
        throw error;
      }
      
      return data;
    } catch (error) {
      // Handle network errors
      if (!error.status) {
        const networkError = new Error('Network error - unable to connect to server');
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  }

  async refresh() {
    try {
      const res = await fetch(API_ENDPOINTS.AUTH.REFRESH, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.refreshToken}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        this.setAccessToken(data.access_token);
        return true;
      }
    } catch (_) {}
    this.logout();
    return false;
  }

  logout() {
    this.setAccessToken(null);
    this.setRefreshToken(null);
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
  }

  // Auth
  async login(email, password) {
    const data = await this.request(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      noAuth: true
    });
    if (data?.access_token) this.setAccessToken(data.access_token);
    if (data?.refresh_token) this.setRefreshToken(data.refresh_token);
    return data;
  }

  async verify2FA(email, code) {
    const data = await this.request(API_ENDPOINTS.AUTH.VERIFY_2FA, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
      noAuth: true
    });
    if (data?.access_token) this.setAccessToken(data.access_token);
    if (data?.refresh_token) this.setRefreshToken(data.refresh_token);
    return data;
  }

  async register(userData) {
    const data = await this.request(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData),
      noAuth: true
    });
    return data;
  }

  async me() {
    return this.request(API_ENDPOINTS.AUTH.ME);
  }

  async forgotPassword(payload) {
    return this.request(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      method: 'POST',
      body: JSON.stringify(payload),
      noAuth: true
    });
  }

  async resetPassword(token, email, newPassword) {
    return this.request(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ token, email, new_password: newPassword }),
      noAuth: true
    });
  }

  async healthCheck() {
    return this.request(API_ENDPOINTS.AUTH.HEALTH);
  }

  // Properties
  async getProperties(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.PROPERTIES.LIST}?${qs}` : API_ENDPOINTS.PROPERTIES.LIST;
    return this.request(url);
  }

  async getProperty(id) {
    return this.request(API_ENDPOINTS.PROPERTIES.DETAIL(id));
  }

  async createProperty(payload) {
    return this.request(API_ENDPOINTS.PROPERTIES.CREATE, { method: 'POST', body: JSON.stringify(payload) });
  }

  async getMyProperties(params = {}) {
    const qs = new URLSearchParams(params).toString();
    // Use legacy manager route for compatibility with current backend
    const base = API_ENDPOINTS.MANAGER.MY_PROPERTIES;
    const url = qs ? `${base}?${qs}` : base;
    return this.request(url);
  }

  // Managed Properties
  async getMyProperties(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.MANAGER.MY_PROPERTIES}?${qs}` : API_ENDPOINTS.MANAGER.MY_PROPERTIES;
    return this.request(url);
  }

  async addProperty(payload) {
    return this.request(API_ENDPOINTS.MANAGER.ADD_PROPERTY, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Units/Spaces for ManagedProperty
  async listUnits(propertyId) {
    // New manager endpoint returns { units: [...] }
    return this.request(`${API_ENDPOINTS.MANAGER.INQUIRIES}units/${propertyId}`);
  }

  async createUnit(managedPropertyId, payload) {
    return this.request(`${API_ENDPOINTS.MANAGER.INQUIRIES}units/${managedPropertyId}`, { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateUnit(unitId, payload) {
    return this.request(`${API_ENDPOINTS.MANAGER.INQUIRIES}units/${unitId}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  async deleteUnit(unitId) {
    return this.request(`${API_ENDPOINTS.MANAGER.INQUIRIES}units/${unitId}`, { method: 'DELETE' });
  }


  // Admin
  async adminDashboard() {
    return this.request(API_ENDPOINTS.ADMIN.DASHBOARD);
  }

  async adminAnalytics(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.ADMIN.ANALYTICS}?${qs}` : API_ENDPOINTS.ADMIN.ANALYTICS;
    return this.request(url);
  }

  async adminAllProperties(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.ADMIN.ALL_PROPERTIES}?${qs}` : API_ENDPOINTS.ADMIN.ALL_PROPERTIES;
    return this.request(url);
  }

  async getPendingProperties(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.ADMIN.PENDING_PROPERTIES}?${qs}` : API_ENDPOINTS.ADMIN.PENDING_PROPERTIES;
    console.log('API Service - getPendingProperties called with:', { params, url });
    return this.request(url);
  }

  async approveProperty(propertyId, payload) {
    return this.request(API_ENDPOINTS.ADMIN.APPROVE_PROPERTY(propertyId), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async rejectProperty(propertyId, payload) {
    return this.request(API_ENDPOINTS.ADMIN.REJECT_PROPERTY(propertyId), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getAllPortals(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.ADMIN.ALL_PORTALS}?${qs}` : API_ENDPOINTS.ADMIN.ALL_PORTALS;
    return this.request(url);
  }

  async togglePortal(propertyId) {
    return this.request(API_ENDPOINTS.ADMIN.TOGGLE_PORTAL(propertyId), {
      method: 'POST'
    });
  }

  async getPortalAnalytics() {
    return this.request(API_ENDPOINTS.ADMIN.PORTAL_ANALYTICS);
  }

  // Admin Subscription Management
  async getAdminSubscriptionPlans() {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIPTION_PLANS);
  }

  async createSubscriptionPlan(planData) {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIPTION_PLANS, {
      method: 'POST',
      body: JSON.stringify(planData)
    });
  }

  async updateSubscriptionPlan(planId, planData) {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIPTION_PLAN(planId), {
      method: 'PUT',
      body: JSON.stringify(planData)
    });
  }

  async deleteSubscriptionPlan(planId) {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIPTION_PLAN(planId), {
      method: 'DELETE'
    });
  }

  async updateSubscriptionPlanFeatures(planId, featuresData) {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIPTION_PLAN_FEATURES(planId), {
      method: 'PUT',
      body: JSON.stringify(featuresData)
    });
  }

  async getAdminSubscriptionStats() {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIPTION_STATS);
  }

  async getAdminSubscribers() {
    return this.request(API_ENDPOINTS.ADMIN.SUBSCRIBERS);
  }

  async updateSubscription(subscriptionId, updateData) {
    return this.request(API_ENDPOINTS.ADMIN.UPDATE_SUBSCRIPTION(subscriptionId), {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async getAdminBillingHistory() {
    return this.request(API_ENDPOINTS.ADMIN.BILLING_HISTORY);
  }

  // Soft helper to fetch payment transactions if backend route exists
  get ADMIN_PAYMENT_TRANSACTIONS() {
    return (API_ENDPOINTS.ADMIN && API_ENDPOINTS.ADMIN.PAYMENT_TRANSACTIONS) || '/api/admin/payment-transactions';
  }

  async createBillingEntry(billingData) {
    return this.request(API_ENDPOINTS.ADMIN.CREATE_BILLING, {
      method: 'POST',
      body: JSON.stringify(billingData)
    });
  }

  async updateBillingStatus(billId, statusData) {
    return this.request(API_ENDPOINTS.ADMIN.UPDATE_BILLING_STATUS(billId), {
      method: 'PUT',
      body: JSON.stringify(statusData)
    });
  }

  // Property Manager Subscription methods
  async getSubscriptionPlans() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.PLANS);
  }

  async getCurrentSubscription() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.MY_SUBSCRIPTION);
  }

  async getBillingHistory() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.BILLING_HISTORY);
  }

  async getPaymentMethods() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.PAYMENT_METHODS);
  }

  async upgradePlan(planId, paymentMethodId) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.UPGRADE, {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, payment_method_id: paymentMethodId })
    });
  }

  async addPaymentMethod(paymentData) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.ADD_PAYMENT_METHOD, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  async removePaymentMethod(paymentMethodId) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.REMOVE_PAYMENT_METHOD(paymentMethodId), {
      method: 'DELETE'
    });
  }

  async setDefaultPaymentMethod(paymentMethodId) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.SET_DEFAULT_PAYMENT_METHOD(paymentMethodId), {
      method: 'POST'
    });
  }

  async processPayment(billingId, paymentData) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.PROCESS_PAYMENT(billingId), {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  // Tenant specific methods
  async getTenantInquiries() {
    return this.request(API_ENDPOINTS.TENANT.INQUIRIES);
  }

  async sendTenantMessage(inquiryId, message) {
    return this.request(API_ENDPOINTS.TENANT.SEND_MESSAGE, {
      method: 'POST',
      body: JSON.stringify({ inquiry_id: inquiryId, message })
    });
  }

  async startTenantInquiry(propertyId, message, unitId = null) {
    return this.request(API_ENDPOINTS.TENANT.START_INQUIRY, {
      method: 'POST',
      body: JSON.stringify({ property_id: propertyId, unit_id: unitId, message })
    });
  }

  // Manager inquiry methods
  async getManagerInquiries() {
    return this.request(API_ENDPOINTS.MANAGER.INQUIRIES);
  }

  async sendManagerMessage(inquiryId, message) {
    return this.request(API_ENDPOINTS.MANAGER.INQUIRIES + 'send-message', {
      method: 'POST',
      body: JSON.stringify({ inquiry_id: inquiryId, message })
    });
  }

  // Inquiry attachment methods
  async uploadInquiryAttachments(inquiryId, files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    return this.request(API_ENDPOINTS.INQUIRIES.ATTACHMENTS(inquiryId), {
      method: 'POST',
      body: formData,
      isFormData: true
      // Don't set Content-Type header - browser will set it with boundary
    });
  }

  async getInquiryAttachments(inquiryId) {
    return this.request(API_ENDPOINTS.INQUIRIES.ATTACHMENTS(inquiryId));
  }

  async downloadInquiryAttachment(attachmentId) {
    return this.request(API_ENDPOINTS.INQUIRIES.ATTACHMENT_DOWNLOAD(attachmentId), {
      responseType: 'blob'
    });
  }

  async deleteInquiryAttachment(attachmentId) {
    return this.request(API_ENDPOINTS.INQUIRIES.ATTACHMENT(attachmentId), {
      method: 'DELETE'
    });
  }

  async assignTenantToProperty(inquiryId, propertyId, unitId = null, unitName = null) {
    const payload = { inquiry_id: inquiryId, property_id: propertyId };
    if (unitId) {
      payload.unit_id = unitId;
    }
    if (unitName) {
      payload.unit_name = unitName;
    }
    return this.request(API_ENDPOINTS.MANAGER.INQUIRIES + 'assign-tenant', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getActiveProperties(params = {}) {
    // Sanitize params: drop empty strings/undefined/null to avoid backend 500s
    const clean = Object.entries(params || {}).reduce((acc, [k, v]) => {
      if (v === undefined || v === null) return acc;
      if (typeof v === 'string' && v.trim() === '') return acc;
      acc[k] = v;
      return acc;
    }, {});
    const qs = new URLSearchParams(clean).toString();
    // Use the new units API that serves managed units data
    const url = qs ? `${API_ENDPOINTS.UNITS.ACTIVE}?${qs}` : API_ENDPOINTS.UNITS.ACTIVE;
    return this.request(url);
  }

  async getTenantProfile() {
    return this.request(API_ENDPOINTS.TENANT.PROFILE);
  }

  async updateTenantProfile(profileData) {
    return this.request(API_ENDPOINTS.TENANT.PROFILE, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  async uploadTenantProfileImage(file) {
    const form = new FormData();
    form.append('image', file);
    return this.request(API_ENDPOINTS.TENANT.PROFILE_UPLOAD_IMAGE, {
      method: 'POST',
      body: form,
      // Let browser set Content-Type boundary
      isFormData: true
    });
  }

  async changeTenantPassword(currentPassword, newPassword, confirmPassword) {
    return this.request(API_ENDPOINTS.TENANT.CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });
  }

  async twofaSetup() {
    return this.request(API_ENDPOINTS.TENANT.TWOFA_SETUP, { method: 'POST' });
  }

  async twofaEnable(code) {
    return this.request(API_ENDPOINTS.TENANT.TWOFA_ENABLE, {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  async twofaDisable() {
    return this.request(API_ENDPOINTS.TENANT.TWOFA_DISABLE, { method: 'POST' });
  }

  async twofaEmailEnable() {
    return this.request(API_ENDPOINTS.TENANT.TWOFA_EMAIL_ENABLE, { method: 'POST' });
  }

  async twofaEmailDisable() {
    return this.request(API_ENDPOINTS.TENANT.TWOFA_EMAIL_DISABLE, { method: 'POST' });
  }

  // Manager Notification methods
  async getManagerNotifications() {
    return this.request(API_ENDPOINTS.MANAGER.NOTIFICATIONS);
  }

  async getManagerUnreadCount() {
    return this.request(API_ENDPOINTS.MANAGER.NOTIFICATIONS_UNREAD_COUNT);
  }

  async markManagerNotificationAsRead(notificationId) {
    return this.request(API_ENDPOINTS.MANAGER.NOTIFICATION_READ(notificationId), {
      method: 'PUT'
    });
  }

  async markAllManagerNotificationsAsRead() {
    return this.request(API_ENDPOINTS.MANAGER.NOTIFICATIONS_MARK_ALL_READ, {
      method: 'PUT'
    });
  }

  async deleteManagerNotification(notificationId) {
    return this.request(API_ENDPOINTS.MANAGER.NOTIFICATION_DELETE(notificationId), {
      method: 'DELETE'
    });
  }

  // Tenant Notification methods
  async getTenantNotifications() {
    return this.request(API_ENDPOINTS.TENANT.NOTIFICATIONS);
  }

  async markNotificationAsRead(notificationId) {
    return this.request(API_ENDPOINTS.TENANT.NOTIFICATION_READ(notificationId), {
      method: 'PUT'
    });
  }

  async markAllNotificationsAsRead() {
    return this.request(API_ENDPOINTS.TENANT.NOTIFICATIONS_MARK_ALL_READ, {
      method: 'PUT'
    });
  }

  async deleteNotification(notificationId) {
    return this.request(API_ENDPOINTS.TENANT.NOTIFICATION_DELETE(notificationId), {
      method: 'DELETE'
    });
  }

  // Admin Notification methods
  async getAdminNotifications() {
    return this.request(API_ENDPOINTS.ADMIN.NOTIFICATIONS);
  }

  async getAdminUnreadCount() {
    return this.request(API_ENDPOINTS.ADMIN.NOTIFICATIONS_UNREAD_COUNT);
  }

  async markAdminNotificationAsRead(notificationId) {
    return this.request(API_ENDPOINTS.ADMIN.NOTIFICATION_READ(notificationId), {
      method: 'PUT'
    });
  }

  async markAllAdminNotificationsAsRead() {
    return this.request(API_ENDPOINTS.ADMIN.NOTIFICATIONS_MARK_ALL_READ, {
      method: 'PUT'
    });
  }

  async deleteAdminNotification(notificationId) {
    return this.request(API_ENDPOINTS.ADMIN.NOTIFICATION_DELETE(notificationId), {
      method: 'DELETE'
    });
  }

  async getManagerProfile() {
    // Refresh token from storage before making request
    this.refreshTokenFromStorage();
    return this.request(API_ENDPOINTS.MANAGER.PROFILE);
  }

  async managerAnalytics(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${API_ENDPOINTS.MANAGER.ANALYTICS}?${qs}` : API_ENDPOINTS.MANAGER.ANALYTICS;
    return this.request(url);
  }

  async updateManagerProfile(profileData) {
    return this.request(API_ENDPOINTS.MANAGER.PROFILE, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  async changeManagerPassword(currentPassword, newPassword, confirmPassword) {
    return this.request(API_ENDPOINTS.MANAGER.CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });
  }

  async managerTwofaEmailEnable() {
    return this.request(API_ENDPOINTS.MANAGER.TWOFA_EMAIL_ENABLE, { method: 'POST' });
  }

  async managerTwofaEmailDisable() {
    return this.request(API_ENDPOINTS.MANAGER.TWOFA_EMAIL_DISABLE, { method: 'POST' });
  }

  // Subscription and Billing methods
  async getCurrentSubscription() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.MY_SUBSCRIPTION);
  }

  async getSubscriptionPlans() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.PLANS);
  }

  async upgradePlan(planId, paymentMethodId = null) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.UPGRADE, {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, payment_method_id: paymentMethodId })
    });
  }

  async getBillingHistory() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.BILLING_HISTORY);
  }

  async getPaymentMethods() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.PAYMENT_METHODS);
  }

  async addPaymentMethod(paymentMethodData) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.ADD_PAYMENT_METHOD, {
      method: 'POST',
      body: JSON.stringify(paymentMethodData)
    });
  }

  async removePaymentMethod(paymentMethodId) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.REMOVE_PAYMENT_METHOD(paymentMethodId), {
      method: 'DELETE'
    });
  }

  async setDefaultPaymentMethod(paymentMethodId) {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.SET_DEFAULT_PAYMENT_METHOD(paymentMethodId), {
      method: 'POST'
    });
  }

  async createPaymentIntent(amount, currency = 'php') {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.CREATE_PAYMENT_INTENT, {
      method: 'POST',
      body: JSON.stringify({ amount, currency })
    });
  }

  async cancelSubscription() {
    return this.request(API_ENDPOINTS.SUBSCRIPTIONS.CANCEL_SUBSCRIPTION, {
      method: 'POST'
    });
  }

  // Admin Document Management
  async adminDocuments() {
    return this.request(API_ENDPOINTS.ADMIN.DOCUMENTS);
  }

  async updateDocumentStatus(documentId, status) {
    return this.request(API_ENDPOINTS.ADMIN.DOCUMENT_STATUS(documentId), {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async downloadDocument(documentId) {
    const response = await fetch(API_ENDPOINTS.ADMIN.DOCUMENT_DOWNLOAD(documentId), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
    
    if (!response.ok) {
      // Try to extract error message from response
      let errorMessage = 'Failed to download document';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      const error = new Error(errorMessage);
      error.response = response;
      throw error;
    }
    
    return response.blob();
  }

  async adminDocumentStats() {
    return this.request(API_ENDPOINTS.ADMIN.DOCUMENT_STATS);
  }

  async uploadPropertyImage(file) {
    const form = new FormData();
    form.append('image', file);
    return this.request(API_ENDPOINTS.MANAGER.UPLOAD_PROPERTY_IMAGE, {
      method: 'POST',
      body: form,
      isFormData: true
    });
  }

  async uploadUnitImage(file) {
    const form = new FormData();
    form.append('image', file);
    return this.request(API_ENDPOINTS.MANAGER.UPLOAD_UNIT_IMAGE, {
      method: 'POST',
      body: form,
      isFormData: true
    });
  }
}

const apiService = new ApiService();
export default apiService;
