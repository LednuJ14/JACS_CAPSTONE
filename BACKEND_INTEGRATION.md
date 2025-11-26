# Backend Integration Guide

This guide explains how to integrate the Flask backend with your React frontend for the JACS Cebu Property Management platform.

## 🚀 Quick Start

### 1. Start the Backend Server

**Windows:**
```bash
cd main-domain\backend
start_backend.bat
```

**macOS/Linux:**
```bash
cd main-domain/backend
./start_backend.sh
```

The backend API will be available at `http://localhost:5000`

### 2. Update Frontend API Configuration

Create an API configuration file in your React frontend:

**`src/config/api.js`**
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
    ME: `${API_BASE_URL}/auth/me`,
    CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`
  },
  
  // Users
  USERS: {
    LIST: `${API_BASE_URL}/users`,
    DETAIL: (id) => `${API_BASE_URL}/users/${id}`,
    UPDATE_STATUS: (id) => `${API_BASE_URL}/users/${id}/status`,
    STATS: `${API_BASE_URL}/users/stats`
  },
  
  // Properties
  PROPERTIES: {
    LIST: `${API_BASE_URL}/properties`,
    DETAIL: (id) => `${API_BASE_URL}/properties/${id}`,
    CREATE: `${API_BASE_URL}/properties`,
    MY_PROPERTIES: `${API_BASE_URL}/properties/my-properties`
  },
  
  // Subscriptions
  SUBSCRIPTIONS: {
    PLANS: `${API_BASE_URL}/subscriptions/plans`,
    MY_SUBSCRIPTION: `${API_BASE_URL}/subscriptions/my-subscription`
  },
  
  // Admin
  ADMIN: {
    DASHBOARD: `${API_BASE_URL}/admin/dashboard`
  }
};

export default API_BASE_URL;
```

### 3. Create API Service Helper

**`src/services/api.js`**
```javascript
import { API_ENDPOINTS } from '../config/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('access_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getHeaders(isFormData = false) {
    const headers = {};
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(options.isFormData),
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && data.error === 'Token expired') {
          await this.refreshToken();
          // Retry the original request
          return this.makeRequest(url, options);
        }
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REFRESH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        this.setToken(data.access_token);
        return data.access_token;
      } else {
        // Refresh failed, redirect to login
        this.logout();
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    window.location.href = '/login';
  }

  // Authentication methods
  async login(email, password) {
    const data = await this.makeRequest(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.access_token) {
      this.setToken(data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
    }

    return data;
  }

  async register(userData) {
    return this.makeRequest(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async getCurrentUser() {
    return this.makeRequest(API_ENDPOINTS.AUTH.ME);
  }

  // Property methods
  async getProperties(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_ENDPOINTS.PROPERTIES.LIST}?${queryString}` : API_ENDPOINTS.PROPERTIES.LIST;
    return this.makeRequest(url);
  }

  async getProperty(id) {
    return this.makeRequest(API_ENDPOINTS.PROPERTIES.DETAIL(id));
  }

  async createProperty(propertyData) {
    return this.makeRequest(API_ENDPOINTS.PROPERTIES.CREATE, {
      method: 'POST',
      body: JSON.stringify(propertyData)
    });
  }

  async getMyProperties(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_ENDPOINTS.PROPERTIES.MY_PROPERTIES}?${queryString}` : API_ENDPOINTS.PROPERTIES.MY_PROPERTIES;
    return this.makeRequest(url);
  }

  // Subscription methods
  async getSubscriptionPlans() {
    return this.makeRequest(API_ENDPOINTS.SUBSCRIPTIONS.PLANS);
  }

  async getMySubscription() {
    return this.makeRequest(API_ENDPOINTS.SUBSCRIPTIONS.MY_SUBSCRIPTION);
  }
}

export default new ApiService();
```

### 4. Update Authentication in Your Components

**Example: Update `src/components/Login.js`**
```javascript
import React, { useState } from 'react';
import ApiService from '../services/api';

const Login = ({ onLoginSuccess, onBackToMain, onSignUpClick }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await ApiService.login(formData.email, formData.password);
      
      // Call the parent's success handler with role information
      onLoginSuccess({ 
        role: response.user.role,
        user: response.user,
        subscription: response.subscription 
      });
    } catch (error) {
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ... rest of your component
};
```

### 5. Update Property Listings

**Example: Update property fetching in `src/components/Tenants/PropertyGrid.js`**
```javascript
import React, { useState, useEffect } from 'react';
import ApiService from '../../services/api';

const PropertyGrid = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async (params = {}) => {
    try {
      setLoading(true);
      const response = await ApiService.getProperties(params);
      setProperties(response.properties);
      setPagination(response.pagination);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ... rest of your component
};
```

## 🔐 Authentication Flow

### 1. Login Process
1. User submits login form
2. Frontend calls `/api/auth/login`
3. Backend validates credentials and returns JWT tokens
4. Frontend stores tokens and user data
5. Frontend redirects based on user role

### 2. Protected Routes
1. Frontend includes JWT token in Authorization header
2. Backend validates token on each request
3. Backend returns user data or 401 if invalid

### 3. Token Refresh
1. When access token expires, backend returns 401
2. Frontend automatically tries to refresh using refresh token
3. If refresh succeeds, retry original request
4. If refresh fails, redirect to login

## 📊 Data Models

### User Object
```javascript
{
  id: 1,
  email: "user@example.com",
  role: "manager", // "tenant", "manager", "admin"
  status: "active",
  first_name: "John",
  last_name: "Doe",
  full_name: "John Doe",
  phone_number: "+63 917 123 4567",
  email_verified: true,
  created_at: "2023-01-01T00:00:00",
  // ... other fields
}
```

### Property Object
```javascript
{
  id: 1,
  title: "Modern 2BR Apartment",
  description: "Beautiful apartment...",
  property_type: "apartment",
  status: "active",
  address: {
    line1: "123 Main St",
    city: "Cebu City",
    province: "Cebu",
    full_address: "123 Main St, Cebu City, Cebu"
  },
  details: {
    bedrooms: 2,
    bathrooms: 1,
    floor_area: 50.0,
    parking_spaces: 1,
    furnishing: "semi_furnished"
  },
  pricing: {
    monthly_rent: 25000.00,
    security_deposit: 25000.00,
    total_move_in_cost: 75000.00
  },
  images: [
    {
      id: 1,
      url: "/uploads/properties/image.jpg",
      is_primary: true
    }
  ],
  amenities: ["WiFi", "Air Conditioning", "Security"],
  // ... other fields
}
```

## 🛡️ Security Considerations

### 1. Token Storage
- Store access token in memory or secure storage
- Store refresh token in httpOnly cookie (if possible)
- Never store sensitive data in localStorage in production

### 2. API Security
- All requests use HTTPS in production
- Implement proper CORS configuration
- Validate all inputs on both frontend and backend

### 3. Error Handling
- Don't expose sensitive error details to users
- Log security events on the backend
- Implement rate limiting for sensitive operations

## 🧪 Testing the Integration

### 1. Test Authentication
```javascript
// Test login
const loginData = await ApiService.login('admin@jacs-cebu.com', 'Admin123!');
console.log('Login successful:', loginData);

// Test getting current user
const currentUser = await ApiService.getCurrentUser();
console.log('Current user:', currentUser);
```

### 2. Test Property Operations
```javascript
// Get properties
const properties = await ApiService.getProperties({ page: 1, per_page: 10 });
console.log('Properties:', properties);

// Get specific property
const property = await ApiService.getProperty(1);
console.log('Property details:', property);
```

## 🚀 Production Deployment

### Environment Variables
Create a `.env` file in your React app:
```
REACT_APP_API_URL=https://your-api-domain.com/api
```

### Backend Configuration
Update your backend `.env` for production:
```
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-production-secret-key
JWT_SECRET_KEY=your-production-jwt-secret
DATABASE_URL=mysql+pymysql://user:pass@host/db
CORS_ORIGINS=https://your-frontend-domain.com
```

## 📞 API Reference

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token

### Property Endpoints
- `GET /api/properties` - List properties (public)
- `GET /api/properties/{id}` - Get property details
- `POST /api/properties` - Create property (managers only)
- `GET /api/properties/my-properties` - Get user's properties

### Subscription Endpoints
- `GET /api/subscriptions/plans` - Get subscription plans
- `GET /api/subscriptions/my-subscription` - Get user's subscription

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure backend CORS is configured for your frontend domain
2. **Database Connection**: Verify MySQL is running and credentials are correct
3. **Token Expiration**: Implement proper token refresh logic
4. **Port Conflicts**: Make sure ports 3000 (React) and 5000 (Flask) are available

### Debug Mode
Enable debug logging by setting `FLASK_DEBUG=True` in your backend `.env` file.

---

🎉 **Congratulations!** Your secure Flask backend is now ready to power your React frontend. The backend includes:

✅ **Secure Authentication** with JWT tokens  
✅ **Role-based Access Control** (Admin, Manager, Tenant)  
✅ **Subscription Management** with usage tracking  
✅ **Property Management** with image uploads  
✅ **Input Validation** and security middleware  
✅ **Database Models** for all entities  
✅ **Comprehensive Error Handling**  
✅ **API Documentation** and examples  

The system is production-ready with proper security measures, but remember to:
- Change default passwords
- Use strong secret keys in production
- Set up HTTPS/SSL
- Configure proper database backups
- Monitor and log security events
