// Real API service that connects to Flask backend
class ApiService {
  constructor() {
    // Property base URL should always be port 5001 for subdomain
    // Only use VITE_PROPERTY_API_BASE_URL if explicitly set, otherwise default to 5001
    const envPropertyURL = import.meta.env.VITE_PROPERTY_API_BASE_URL;
    const envApiURL = import.meta.env.VITE_API_BASE_URL;
    
    // For propertyBaseURL, only use env vars if they point to port 5001
    if (envPropertyURL && envPropertyURL.includes('5001')) {
      this.propertyBaseURL = envPropertyURL;
    } else if (envApiURL && envApiURL.includes('5001')) {
      this.propertyBaseURL = envApiURL;
    } else {
      // Always default to port 5001 for subdomain backend
      this.propertyBaseURL = 'http://localhost:5001/api';
    }
    
    this.mainDomainBaseURL =
      import.meta.env.VITE_MAIN_DOMAIN_API_URL ||
      'http://localhost:5000/api';
    // For subdomain, always default to property base URL
    // Only use stored base if it's also a property URL (port 5001)
    const storedBase = localStorage.getItem('active_api_base');
    if (storedBase && storedBase.includes('5001')) {
      this.activeBaseURL = storedBase;
    } else {
      this.activeBaseURL = this.propertyBaseURL;
    }

    this.token = localStorage.getItem('access_token');
    this.propertyContext = { property: null }; // Will be loaded from backend
    
    // Log initialization info
    console.log('API Service initialized:');
    console.log('Property API Base URL:', this.propertyBaseURL);
    console.log('Main-domain API Base URL:', this.mainDomainBaseURL);
    console.log('Active API Base URL:', this.activeBaseURL);
    console.log('Has token:', !!this.token);
    console.log('Stored active_api_base:', localStorage.getItem('active_api_base'));
    
    // Force propertyBaseURL for subdomain - ensure it's always port 5001
    // If propertyBaseURL itself is wrong, fix it first
    if (!this.propertyBaseURL || !this.propertyBaseURL.includes('5001')) {
      console.warn('propertyBaseURL is incorrect, forcing to port 5001');
      this.propertyBaseURL = 'http://localhost:5001/api';
    }
    
    // Force activeBaseURL to propertyBaseURL if it's wrong
    if (this.activeBaseURL && (this.activeBaseURL.includes('5000') || !this.activeBaseURL.includes('5001'))) {
      console.warn('Active base URL is set to wrong port, resetting to property base URL (5001)');
      console.warn('Previous activeBaseURL:', this.activeBaseURL);
      this.activeBaseURL = this.propertyBaseURL;
      console.log('Reset activeBaseURL to:', this.activeBaseURL);
    }
    
    // Also clear localStorage if it has wrong URL (reuse storedBase from above)
    if (storedBase && (storedBase.includes('5000') || !storedBase.includes('5001'))) {
      console.warn('Clearing incorrect stored base URL from localStorage');
      localStorage.setItem('active_api_base', this.propertyBaseURL);
    }
  }

  // Add method to check authentication status
  isAuthenticated() {
    return !!this.token;
  }

  // Helper method to make HTTP requests
  async makeRequest(url, options = {}) {
    const {
      baseURL: overrideBaseURL,
      headers: optionHeaders,
      body,
      ...restOptions
    } = options;

    // Check if body is FormData - don't set Content-Type for FormData (browser will set it with boundary)
    const isFormData = body instanceof FormData;
    
    const config = {
      headers: {},
      ...restOptions
    };
    
    // Only set Content-Type for non-FormData requests
    if (!isFormData) {
      config.headers['Content-Type'] = 'application/json';
    }
    
    // Merge option headers (but don't override Content-Type if it was explicitly removed for FormData)
    if (optionHeaders) {
      Object.assign(config.headers, optionHeaders);
      // If FormData and Content-Type was set in optionHeaders, remove it
      if (isFormData && config.headers['Content-Type']) {
        delete config.headers['Content-Type'];
      }
    }
    
    // Set body
    if (body !== undefined) {
      if (isFormData) {
        config.body = body;
      } else {
        config.body = JSON.stringify(body);
      }
    }

    // Add authorization header if token exists
    if (this.token) {
      config.headers['Authorization'] = `Bearer ${this.token}`;
    } else {
      console.warn('No access token found. User may need to log in.');
    }

    // Priority: overrideBaseURL > propertyBaseURL > activeBaseURL (only if it's property URL)
    // For subdomain, always prefer propertyBaseURL unless explicitly overridden
    let targetBaseURL;
    if (overrideBaseURL) {
      targetBaseURL = overrideBaseURL;
    } else if (this.propertyBaseURL) {
      targetBaseURL = this.propertyBaseURL;
    } else if (this.activeBaseURL && this.activeBaseURL.includes('5001')) {
      targetBaseURL = this.activeBaseURL;
    } else {
      // Fallback: use propertyBaseURL even if not set (shouldn't happen)
      targetBaseURL = 'http://localhost:5001/api';
    }
    
    const methodLabel = (config.method || 'GET').toUpperCase();
    console.log(`Making ${methodLabel} request to: ${targetBaseURL}${url}`);
    console.log('Base URL selection:', { 
      overrideBaseURL, 
      propertyBaseURL: this.propertyBaseURL, 
      activeBaseURL: this.activeBaseURL,
      selected: targetBaseURL 
    });
    console.log('Request config:', { ...config, headers: { ...config.headers, Authorization: this.token ? 'Bearer [REDACTED]' : undefined } });

    try {
      const response = await fetch(`${targetBaseURL}${url}`, config);
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
          data = { error: `Failed to parse JSON response: ${jsonError.message}` };
        }
      } else {
        // If response isn't JSON, get text content for debugging
        const textContent = await response.text();
        console.error('Non-JSON response received:', textContent);
        data = { error: `HTTP ${response.status}: ${response.statusText}`, details: textContent };
      }
      
      if (!response.ok) {
        // Enhanced error logging for debugging
        console.error(`API Error ${response.status}:`, data);
        console.error('Full response headers:', [...response.headers.entries()]);
        
        // Specific handling for different error codes
        if (response.status === 401) {
          console.error('Authentication failed - token may be expired or invalid');
          // Clear invalid token
          this.token = null;
          localStorage.removeItem('access_token');
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. You may not have permission for this action.');
        } else if (response.status === 500) {
          throw new Error(`Server error: ${data.error || data.message || 'Internal server error'}`);
        }
        
        const errorMessage = data.error || data.message || `HTTP error! status: ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      
      console.log('Request successful:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Helper to extract property_id from current URL/subdomain
  getPropertyIdFromSubdomain() {
    if (typeof window === 'undefined') return null;
    try {
      const hostname = window.location.hostname;
      // Extract subdomain (e.g., "pat" from "pat.localhost")
      const subdomainMatch = hostname.match(/^([a-zA-Z0-9-]+)\.localhost/);
      if (subdomainMatch) {
        const subdomain = subdomainMatch[1].toLowerCase();
        // Try to get property_id from sessionStorage if available
        const cached = sessionStorage.getItem('property_context');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed?.property?.id) {
              return parsed.property.id;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        // Return subdomain for backend to match (backend will handle matching)
        return subdomain;
      }
    } catch (e) {
      console.warn('Error extracting property from subdomain:', e);
    }
    return null;
  }

  // Auth
  async login(username, password, twoFactorCode) {
    // Try to get property_id from subdomain or cached context
    const propertyIdentifier = this.getPropertyIdFromSubdomain();
    
    const attemptLogin = async (baseURL) => {
      const loginBody = {
        email: username, // Frontend sends username, backend expects email
        password: password
      };
      
      // Add property_id or subdomain identifier if available
      if (propertyIdentifier) {
        // If it's a number, send as property_id, otherwise send as subdomain for backend matching
        if (typeof propertyIdentifier === 'number') {
          loginBody.property_id = propertyIdentifier;
        } else {
          loginBody.property_subdomain = propertyIdentifier;
        }
      }
      
      return await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginBody),
        baseURL
      });
    };

    const persistSession = (response, baseURL) => {
      // For subdomain frontend, always use property base URL
      // This ensures all subdomain-specific endpoints use the correct backend
      this.setActiveBaseURL(this.propertyBaseURL);
      this.token = response.access_token;
      localStorage.setItem('access_token', response.access_token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }

      const normalizedUser = this.normalizeUserPayload(response.user);
      localStorage.setItem('user', JSON.stringify(normalizedUser));

      return {
        access_token: response.access_token,
        user: normalizedUser
      };
    };

    const shouldFallbackToMainDomain = (error) => {
      if (!error || typeof error !== 'object') return false;
      const fallbackStatuses = [401, 403, 404];
      return fallbackStatuses.includes(error.status);
    };

    // If 2FA code is provided, verify it instead of logging in
    if (twoFactorCode) {
      try {
        // Get email from stored user or use username
        const storedUser = this.getStoredUser();
        const email = storedUser?.email || username;
        
        const response = await this.verify2FA(email, twoFactorCode);
        return persistSession(response, this.propertyBaseURL);
      } catch (error) {
        console.error('2FA verification failed:', error);
        throw error;
      }
    }

    try {
      const propertyResponse = await attemptLogin(this.propertyBaseURL);
      
      // Check if 2FA is required
      if (propertyResponse.status === 'pending_2fa') {
        // Store username for 2FA verification
        const storedUser = this.getStoredUser();
        if (!storedUser) {
          // Try to get user info from response or use username as email
          const email = propertyResponse.email || username;
          localStorage.setItem('pending_2fa_email', email);
        }
        throw new Error('2FA_REQUIRED');
      }
      
      return persistSession(propertyResponse, this.propertyBaseURL);
    } catch (propertyError) {
      // Check if it's a 2FA requirement
      if (propertyError.message === '2FA_REQUIRED') {
        throw propertyError;
      }
      
      console.warn('Property portal login failed, evaluating fallback...', propertyError);
      if (!shouldFallbackToMainDomain(propertyError)) {
        throw propertyError;
      }

      try {
        const mainDomainResponse = await attemptLogin(this.mainDomainBaseURL);
        
        // Check if 2FA is required
        if (mainDomainResponse.status === 'pending_2fa') {
          throw new Error('2FA_REQUIRED');
        }
        
        return persistSession(mainDomainResponse, this.mainDomainBaseURL);
      } catch (mainDomainError) {
        console.error('Main-domain login failed:', mainDomainError);
        throw mainDomainError;
      }
    }
  }

  async register() {
    return { success: true };
  }

  async forgotPassword() {
    return { success: true };
  }

  async resetPassword() {
    return { success: true };
  }

  // Dashboard - Use property base URL (subdomain backend)
  async getDashboardData() {
    try {
      const response = await this.makeRequest('/analytics/dashboard', {
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Return fallback empty data if API fails
      return {
        metrics: {
          total_income: 0,
          active_tenants: 0,
          active_staff: 0,
          current_month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          total_properties: 0,
        },
        sales_data: [],
        announcements: [],
      };
    }
  }

  async getDashboardContext() {
    try {
      // Try to load properties from backend - use property base URL
      const properties = await this.makeRequest('/properties/', {
        baseURL: this.propertyBaseURL
      });
      if (properties && properties.length > 0) {
        this.propertyContext = { property: properties[0] }; // Use first property
        return this.propertyContext;
      }
    } catch (error) {
      console.warn('Failed to load properties from backend:', error);
    }
    
    // Fallback to empty context if no properties or error
    this.propertyContext = { property: null };
    return this.propertyContext;
  }

  // Display Settings
  async getDisplaySettings(propertyId) {
    try {
      return await this.makeRequest(`/properties/${propertyId}/display-settings`, {
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to get display settings:', error);
      throw error;
    }
  }

  async updateDisplaySettings(propertyId, settings) {
    try {
      return await this.makeRequest(`/properties/${propertyId}/display-settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to update display settings:', error);
      throw error;
    }
  }

  async uploadLogo(propertyId, file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${this.propertyBaseURL}/properties/${propertyId}/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Failed to upload logo');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to upload logo:', error);
      throw error;
    }
  }

  // Lists - Use property base URL (subdomain backend)
  async getProperties() {
    try {
      return await this.makeRequest('/properties/', {
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      return [];
    }
  }
  
  async createProperty(propertyData) {
    try {
      return await this.makeRequest('/properties', {
        method: 'POST',
        body: JSON.stringify(propertyData),
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to create property:', error);
      throw error;
    }
  }
  
  async getAnnouncements(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters as query parameters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });
      
      const queryString = queryParams.toString();
      const url = queryString ? `/announcements?${queryString}` : '/announcements';
      
      const response = await this.makeRequest(url);
      return { data: response };
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      throw error;
    }
  }
  
  async getAnnouncement(announcementId) {
    try {
      const response = await this.makeRequest(`/announcements/${announcementId}`);
      return { data: response };
    } catch (error) {
      console.error('Failed to fetch announcement:', error);
      throw error;
    }
  }
  
  async createAnnouncement(announcementData) {
    try {
      console.log('Creating announcement with data:', announcementData);
      
      // Validate required fields before sending request
      if (!announcementData.title || !announcementData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!announcementData.content || !announcementData.content.trim()) {
        throw new Error('Content is required');
      }
      
      const response = await this.makeRequest('/announcements', {
        method: 'POST',
        body: JSON.stringify(announcementData)
      });
      return { data: response };
    } catch (error) {
      console.error('Failed to create announcement:', error);
      throw error;
    }
  }
  
  async updateAnnouncement(announcementId, announcementData) {
    try {
      const response = await this.makeRequest(`/announcements/${announcementId}`, {
        method: 'PUT',
        body: JSON.stringify(announcementData)
      });
      return { data: response };
    } catch (error) {
      console.error('Failed to update announcement:', error);
      throw error;
    }
  }
  
  async deleteAnnouncement(announcementId) {
    try {
      const response = await this.makeRequest(`/announcements/${announcementId}`, {
        method: 'DELETE'
      });
      return { data: response };
    } catch (error) {
      console.error('Failed to delete announcement:', error);
      throw error;
    }
  }
  
  async getAnnouncementStats() {
    try {
      const response = await this.makeRequest('/announcements/stats');
      return { data: response };
    } catch (error) {
      console.error('Failed to fetch announcement stats:', error);
      throw error;
    }
  }
  
  async getTenants() {
    try {
      return await this.makeRequest('/tenants/', {
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      return [];
    }
  }

  async getTenant(tenantId) {
    try {
      return await this.makeRequest(`/tenants/${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch tenant:', error);
      throw error;
    }
  }
  
  async createTenant(tenantData) {
    try {
      return await this.makeRequest('/tenants/', {
        method: 'POST',
        body: JSON.stringify(tenantData)
      });
    } catch (error) {
      console.error('Failed to create tenant:', error);
      throw error;
    }
  }
  
  async updateTenant(tenantId, tenantData) {
    try {
      return await this.makeRequest(`/tenants/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify(tenantData)
      });
    } catch (error) {
      console.error('Failed to update tenant:', error);
      throw error;
    }
  }
  
  async deleteTenant(tenantId) {
    try {
      return await this.makeRequest(`/tenants/${tenantId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      throw error;
    }
  }
  
  async getIncomeRecords() {
    try {
      return await this.makeRequest('/billing/income');
    } catch (error) {
      console.error('Failed to fetch income records:', error);
      return [];
    }
  }
  
  async createIncomeRecord(incomeData) {
    try {
      return await this.makeRequest('/billing/income', {
        method: 'POST',
        body: JSON.stringify(incomeData)
      });
    } catch (error) {
      console.error('Failed to create income record:', error);
      throw error;
    }
  }

  // Users
  async getCurrentUser() {
    try {
      // Try property base URL first (subdomain backend)
      try {
        const response = await this.makeRequest('/auth/me', {
          baseURL: this.propertyBaseURL
        });
      // Update stored user with fresh data
      localStorage.setItem('user', JSON.stringify(response.user));
      return response.user;
      } catch (propertyError) {
        // Fallback to active base URL if property URL fails
        const response = await this.makeRequest('/auth/me');
        localStorage.setItem('user', JSON.stringify(response.user));
        return response.user;
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
      return this.getStoredUser();
    }
  }

  async updateProfile(profileData) {
    try {
      return await this.makeRequest('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }
  async getMyTenant() {
    try {
      const user = this.getStoredUser();
      if (!user || user.role !== 'tenant') {
        return null;
      }
      
      // Try direct API call to /tenants/me endpoint
      try {
        const response = await this.makeRequest('/tenants/me', {
          baseURL: this.propertyBaseURL
        });
        return response;
      } catch (err) {
        // Fallback: get all tenants and find the one matching current user
        console.warn('Direct tenant API call failed, trying fallback:', err);
        try {
          const tenants = await this.getTenants();
          if (Array.isArray(tenants)) {
            const myTenant = tenants.find(t => 
              t.user_id === user.id || 
              (t.user && t.user.id === user.id) ||
              (typeof t === 'object' && t.user && t.user.id === user.id)
            );
            return myTenant || null;
          }
        } catch (fallbackErr) {
          console.error('Fallback tenant lookup failed:', fallbackErr);
        }
        return null;
      }
    } catch (error) {
      console.error('Failed to get my tenant:', error);
      return null;
    }
  }

  // 2FA - Email-based (like main domain)
  async verify2FA(email, code) {
    try {
      return await this.makeRequest('/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to verify 2FA code:', error);
      throw error;
    }
  }

  async getTwoFactorStatus() {
    try {
      // Use property base URL for 2FA (subdomain backend)
      return await this.makeRequest('/auth/2fa/status', {
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to get 2FA status:', error);
      return { enabled: false };
    }
  }

  async enableTwoFactor() {
    try {
      return await this.makeRequest('/auth/2fa/enable', {
        method: 'POST',
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to enable 2FA:', error);
      throw error;
    }
  }

  async disableTwoFactor(password) {
    try {
      return await this.makeRequest('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      throw error;
    }
  }

  // Chats
  async getContacts() { return []; }
  async createContact() { return { success: true }; }
  async updateContact() { return { success: true }; }
  async convertProspectToTenant() { return { success: true }; }
  async getChats() { return []; }
  async createChat() { return { success: true }; }
  async getChatMessages() { return []; }
  async sendMessage() { return { success: true }; }
  async markMessageAsRead() { return { success: true }; }
  async getChatsSummary() { return {}; }
  async getContactsSummary() { return {}; }

  // Bills
  async getBills(tenantId = null, status = null, billType = null, page = 1, perPage = 100) {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.append('tenant_id', tenantId);
      if (status) params.append('status', status);
      if (billType) params.append('bill_type', billType);
      params.append('page', page);
      params.append('per_page', perPage);
      
      const response = await this.makeRequest(`/billing/bills?${params.toString()}`, {
        baseURL: this.propertyBaseURL
      });
      
      // Return bills array directly for compatibility
      return response.bills || [];
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      return [];
    }
  }

  async getBillsDashboard() {
    try {
      const response = await this.makeRequest('/billing/dashboard', {
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch bills dashboard:', error);
      return {
        total_revenue: 0,
        pending_payments: 0,
        overdue_amount: 0,
        total_bills: 0,
        paid_bills: 0,
        pending_bills: 0,
        overdue_bills: 0
      };
    }
  }

  async createBill(billData) {
    try {
      // Map frontend fields to backend fields
      const backendData = {
        tenant_id: billData.tenant_id,
        unit_id: billData.unit_id || null, // Will need to get from tenant
        bill_type: billData.bill_type?.toLowerCase() || billData.bill_type,
        title: billData.title || `${billData.bill_type} Bill`,
        amount: billData.amount,
        due_date: billData.due_date?.split('T')[0] || billData.due_date,
        description: billData.description || '',
        is_recurring: billData.is_recurring || false,
        recurring_frequency: billData.recurring_frequency || null,
        notes: billData.notes || ''
      };
      
      const response = await this.makeRequest('/billing/bills', {
        method: 'POST',
        body: JSON.stringify(backendData),
        baseURL: this.propertyBaseURL
      });
      
      return response;
    } catch (error) {
      console.error('Failed to create bill:', error);
      throw error;
    }
  }

  async updateBill(billId, billData) {
    try {
      const response = await this.makeRequest(`/billing/bills/${billId}`, {
        method: 'PUT',
        body: JSON.stringify(billData),
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to update bill:', error);
      throw error;
    }
  }

  async deleteBill(billId) {
    try {
      const response = await this.makeRequest(`/billing/bills/${billId}`, {
        method: 'DELETE',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to delete bill:', error);
      throw error;
    }
  }

  async submitPaymentProof(billId, paymentData) {
    try {
      const response = await this.makeRequest(`/billing/bills/${billId}/submit-payment`, {
        method: 'POST',
        body: JSON.stringify(paymentData),
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to submit payment proof:', error);
      throw error;
    }
  }

  // Requests
  async getMaintenanceRequests(tenantId = null, status = null, category = null, priority = null, page = 1, perPage = 20) {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.append('tenant_id', tenantId);
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (priority) params.append('priority', priority);
      params.append('page', page);
      params.append('per_page', perPage);
      
      const response = await this.makeRequest(`/requests?${params.toString()}`, {
        baseURL: this.propertyBaseURL
      });
      
      return response.requests || [];
    } catch (error) {
      console.error('Failed to fetch maintenance requests:', error);
      return [];
    }
  }
  
  async getRequestsDashboard() {
    try {
      const response = await this.makeRequest('/requests/dashboard', {
        baseURL: this.propertyBaseURL
      });
      return response || {};
    } catch (error) {
      console.error('Failed to fetch requests dashboard:', error);
      return {};
    }
  }
  
  async createMaintenanceRequest(requestData) {
    try {
      // Map frontend fields to backend fields
      const backendData = {
        title: requestData.issue || requestData.title,
        description: requestData.description,
        category: (requestData.issue_category || requestData.category || 'other').toLowerCase(),
        priority: (requestData.priority_level || requestData.priority || 'medium').toLowerCase(),
        unit_id: requestData.unit_id || null,
        images: requestData.images || null,
        attachments: requestData.attachments || null
      };
      
      const response = await this.makeRequest('/requests', {
        method: 'POST',
        body: JSON.stringify(backendData),
        baseURL: this.propertyBaseURL
      });
      
      return response;
    } catch (error) {
      console.error('Failed to create maintenance request:', error);
      throw error;
    }
  }
  
  async getMaintenanceRequest(requestId) {
    try {
      const response = await this.makeRequest(`/requests/${requestId}`, {
        baseURL: this.propertyBaseURL
      });
      return response.request || response;
    } catch (error) {
      console.error('Failed to fetch maintenance request:', error);
      throw error;
    }
  }
  
  async updateMaintenanceRequest(requestId, requestData) {
    try {
      const response = await this.makeRequest(`/requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify(requestData),
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to update maintenance request:', error);
      throw error;
    }
  }
  
  async deleteMaintenanceRequest(requestId) {
    try {
      const response = await this.makeRequest(`/requests/${requestId}`, {
        method: 'DELETE',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to delete maintenance request:', error);
      throw error;
    }
  }
  
  async addRequestFeedback(requestId, feedbackData) {
    try {
      const response = await this.makeRequest(`/requests/${requestId}/feedback`, {
        method: 'POST',
        body: JSON.stringify(feedbackData),
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to add request feedback:', error);
      throw error;
    }
  }

  // Notifications
  async getNotifications(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.per_page) params.append('per_page', filters.per_page);
      if (filters.is_read !== undefined) params.append('is_read', filters.is_read);
      if (filters.type) params.append('type', filters.type);
      if (filters.priority) params.append('priority', filters.priority);
      
      const queryString = params.toString();
      const url = `/notifications${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.makeRequest(url, {
        baseURL: this.propertyBaseURL
      });
      
      return response;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return { notifications: [], pagination: {} };
    }
  }

  async getUnreadNotificationCount() {
    try {
      const response = await this.makeRequest('/notifications/unread-count', {
        baseURL: this.propertyBaseURL
      });
      return response.unread_count || 0;
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error);
      return 0;
    }
  }

  async getNotification(notificationId) {
    try {
      const response = await this.makeRequest(`/notifications/${notificationId}`, {
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch notification:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId) {
    try {
      const response = await this.makeRequest(`/notifications/${notificationId}/read`, {
        method: 'PUT',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markNotificationAsUnread(notificationId) {
    try {
      const response = await this.makeRequest(`/notifications/${notificationId}/unread`, {
        method: 'PUT',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to mark notification as unread:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead() {
    try {
      const response = await this.makeRequest('/notifications/mark-all-read', {
        method: 'PUT',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId) {
    try {
      const response = await this.makeRequest(`/notifications/${notificationId}`, {
        method: 'DELETE',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    }
  }

  async deleteAllReadNotifications() {
    try {
      const response = await this.makeRequest('/notifications/delete-all-read', {
        method: 'DELETE',
        baseURL: this.propertyBaseURL
      });
      return response;
    } catch (error) {
      console.error('Failed to delete all read notifications:', error);
      throw error;
    }
  }

  // Staff
  async getStaff() {
    try {
      return await this.makeRequest('/staff/', {
        baseURL: this.propertyBaseURL
      });
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      return [];
    }
  }

  async getStaffMember(staffId) {
    try {
      return await this.makeRequest(`/staff/${staffId}`);
    } catch (error) {
      console.error('Failed to fetch staff member:', error);
      throw error;
    }
  }
  
  async createStaff(staffData) {
    try {
      return await this.makeRequest('/staff/', {
        method: 'POST',
        body: JSON.stringify(staffData)
      });
    } catch (error) {
      console.error('Failed to create staff:', error);
      throw error;
    }
  }
  
  async updateStaff(staffId, staffData) {
    try {
      return await this.makeRequest(`/staff/${staffId}`, {
        method: 'PUT',
        body: JSON.stringify(staffData)
      });
    } catch (error) {
      console.error('Failed to update staff:', error);
      throw error;
    }
  }
  
  async deleteStaff(staffId) {
    try {
      return await this.makeRequest(`/staff/${staffId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to delete staff:', error);
      throw error;
    }
  }

  // Feedback
  async getFeedback(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      
      const queryString = params.toString();
      const endpoint = `/feedback/${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.makeRequest(endpoint, {
        baseURL: this.propertyBaseURL
      });
      return response.feedback || [];
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      return [];
    }
  }

  async createFeedback(feedbackData) {
    try {
      const response = await this.makeRequest('/feedback/', {
        method: 'POST',
        body: JSON.stringify(feedbackData),
        baseURL: this.propertyBaseURL
      });
      return response.feedback || response;
    } catch (error) {
      console.error('Failed to create feedback:', error);
      throw error;
    }
  }

  async getFeedbackById(feedbackId) {
    try {
      const response = await this.makeRequest(`/feedback/${feedbackId}`, {
        baseURL: this.propertyBaseURL
      });
      return response.feedback || response;
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      throw error;
    }
  }

  async getFeedbackDashboard() {
    try {
      const response = await this.makeRequest('/feedback/dashboard', {
        baseURL: this.propertyBaseURL
      });
      return response || {};
    } catch (error) {
      console.error('Failed to fetch feedback dashboard:', error);
      return {};
    }
  }
  
  async replyToFeedback(feedbackId, replyData) {
    // For now, just update status to 'responded'
    // In the future, we can add a separate replies table
    try {
      const response = await this.makeRequest(`/feedback/${feedbackId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'responded' }),
        baseURL: this.propertyBaseURL
      });
      return response.feedback || response;
    } catch (error) {
      console.error('Failed to reply to feedback:', error);
      throw error;
    }
  }
  
  async updateFeedbackStatus(feedbackId, statusData) {
    try {
      const response = await this.makeRequest(`/feedback/${feedbackId}`, {
        method: 'PUT',
        body: JSON.stringify(statusData),
        baseURL: this.propertyBaseURL
      });
      return response.feedback || response;
    } catch (error) {
      console.error('Failed to update feedback status:', error);
      throw error;
    }
  }

  // Documents API
  async get(endpoint) {
    return await this.makeRequest(endpoint, { method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    const config = { 
      method: 'POST', 
      body: data,  // Pass body directly, makeRequest will handle FormData vs JSON
      ...options 
    };
    
    return await this.makeRequest(endpoint, config);
  }

  async put(endpoint, data) {
    return await this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return await this.makeRequest(endpoint, { method: 'DELETE' });
  }

  // Documents
  async getDocuments(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.type) params.append('type', filters.type);
      if (filters.property_id) params.append('property_id', filters.property_id);
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.page) params.append('page', filters.page);
      if (filters.per_page) params.append('per_page', filters.per_page);
      
      const endpoint = `/documents/${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.makeRequest(endpoint);
      return response.documents || response.data?.documents || [];
    } catch (error) {
      console.error('Failed to get documents:', error);
      throw error;
    }
  }

  async getDocumentById(documentId) {
    try {
      const response = await this.makeRequest(`/documents/${documentId}`);
      return response.document || response.data;
    } catch (error) {
      console.error('Failed to get document:', error);
      throw error;
    }
  }

  async uploadDocument(file, documentData = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', documentData.name || file.name);
      formData.append('document_type', documentData.document_type || 'other');
      if (documentData.property_id) {
        formData.append('property_id', documentData.property_id);
      }
      if (documentData.visibility) {
        formData.append('visibility', documentData.visibility);
      } else {
        formData.append('visibility', 'private'); // Default to private for tenant uploads
      }
      
      // Get property_id from subdomain if not provided
      if (!documentData.property_id) {
        const propertyId = this.getPropertyIdFromSubdomain();
        if (propertyId && !isNaN(parseInt(propertyId))) {
          formData.append('property_id', parseInt(propertyId));
        }
      }
      
      // Use fetch directly for FormData uploads
      const baseURL = this.getActiveBaseURL();
      const url = `${baseURL}/documents/`;
      const headers = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`API Error ${response.status}:`, data);
        const error = new Error(data.error || data.message || `API request failed with status ${response.status}`);
        error.status = response.status;
        error.response = data;
        throw error;
      }
      
      return data.document || data.data;
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      return await this.makeRequest(`/documents/${documentId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  async downloadDocument(documentId) {
    try {
      const response = await fetch(`${this.getActiveBaseURL()}/documents/${documentId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Failed to download document:', error);
      throw error;
    }
  }

  async getDocumentTypes() {
    try {
      const response = await this.makeRequest('/documents/types');
      return response.document_types || [];
    } catch (error) {
      console.error('Failed to get document types:', error);
      throw error;
    }
  }

  async getDocumentsByProperty(propertyId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.type) params.append('type', filters.type);
      if (filters.page) params.append('page', filters.page);
      if (filters.per_page) params.append('per_page', filters.per_page);
      
      const endpoint = `/documents/by-property/${propertyId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.makeRequest(endpoint);
      return response;
    } catch (error) {
      console.error('Failed to get documents by property:', error);
      throw error;
    }
  }

  getBaseURL() {
    return this.getActiveBaseURL();
  }

  getToken() {
    return this.token;
  }

  // Utilities
  logout() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_profile');
    this.clearActiveBaseURL();
  }
  isAuthenticated() {
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      return false;
    }
    
    // Update instance token if not set
    if (token && !this.token) {
      this.token = token;
    }
    
    return true;
  }
  getStoredUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      const parsed = JSON.parse(userStr);
      return this.normalizeUserPayload(parsed);
    } catch {
      return null;
    }
  }
  refreshToken() {
    const token = localStorage.getItem('access_token');
    if (token) this.token = token;
  }

  setActiveBaseURL(baseURL) {
    // For subdomain, always use propertyBaseURL (port 5001)
    // Don't allow setting to main domain (port 5000) for subdomain frontend
    if (baseURL && baseURL.includes('5001')) {
      this.activeBaseURL = baseURL;
    } else {
      // Force to propertyBaseURL (port 5001) for subdomain
      this.activeBaseURL = this.propertyBaseURL || 'http://localhost:5001/api';
    }
    localStorage.setItem('active_api_base', this.activeBaseURL);
    console.log('Active base URL set to:', this.activeBaseURL);
  }

  clearActiveBaseURL() {
    localStorage.removeItem('active_api_base');
    this.activeBaseURL = this.propertyBaseURL;
  }

  getActiveBaseURL() {
    return this.activeBaseURL || this.propertyBaseURL;
  }

  normalizeUserRole(role) {
    if (!role) return role;
    const roleStr = role.toString().toLowerCase();
    if (['manager', 'property_manager'].includes(roleStr)) return 'property_manager';
    if (roleStr === 'staff') return 'staff';
    if (roleStr === 'tenant') return 'tenant';
    if (roleStr === 'admin') return 'admin';
    return roleStr;
  }

  normalizeUserPayload(user) {
    if (!user) return user;
    const normalizedRole = this.normalizeUserRole(user.role || user.user_type);
    return {
      ...user,
      role: normalizedRole,
      user_type: normalizedRole
    };
  }

  // Preferences / Feature Flags (static)
  isStaffManagementEnabled() {
    const raw = localStorage.getItem('staff_management_enabled');
    if (raw === null) return true; // enabled by default
    return raw === 'true';
  }
  setStaffManagementEnabled(enabled) {
    localStorage.setItem('staff_management_enabled', enabled ? 'true' : 'false');
  }
}

export const apiService = new ApiService();
