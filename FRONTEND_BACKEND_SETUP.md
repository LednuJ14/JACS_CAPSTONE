# Frontend & Backend Setup Guide

## Overview
This guide will help you properly set up and run both the frontend (React) and backend (Flask) of the JACS Property Management System.

## Prerequisites
Before starting, ensure you have:
- **Node.js** (version 16 or higher)
- **Python** (version 3.8 or higher) 
- **MySQL Server** running
- **Git** installed

## Quick Start

### Option 1: Use the Automated Startup Script (Recommended)
1. Open PowerShell as Administrator
2. Navigate to the project root directory:
   ```powershell
   cd "C:\Users\Administrator\Desktop\Capstone\Capstone-Project"
   ```
3. Run the complete startup script:
   ```powershell
   .\START_EVERYTHING.bat
   ```

This will:
- Start the Flask backend server on `http://localhost:5000`
- Start the React frontend server on `http://localhost:3000`
- Display all available property portal URLs

### Option 2: Manual Setup

#### Backend Setup
1. Navigate to the backend directory:
   ```powershell
   cd main-domain\backend
   ```

2. Activate the Python virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

3. Install dependencies (if not already installed):
   ```powershell
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```powershell
   python app.py
   ```

#### Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```powershell
   cd "C:\Users\Administrator\Desktop\Capstone\Capstone-Project\main-domain\frontend"
   ```

2. Install dependencies (if not already installed):
   ```powershell
   npm install
   ```

3. Start the frontend development server:
   ```powershell
   npm start
   ```

## Fixed Issues

### Authentication & Login
✅ **Fixed login with email**: Changed from username to email-based authentication
✅ **Improved error handling**: Better error messages for network issues, invalid credentials, etc.
✅ **Added loading states**: Login button shows loading spinner during authentication
✅ **Token management**: Improved JWT token handling and refresh

### API Service
✅ **Enhanced error handling**: Network errors are properly detected and displayed
✅ **Added missing endpoints**: Password reset, registration, and health check endpoints
✅ **Better request/response handling**: Improved parsing and error extraction

### Registration
✅ **Removed username requirement**: Registration now only requires email, password, and personal info
✅ **API integration**: SignUp component now uses the centralized API service
✅ **Better validation**: Improved password strength and field validation

### Password Reset
✅ **API integration**: ForgotPassword component now uses the API service
✅ **Error handling**: Network and server errors are properly handled

## Available Endpoints

### Backend API (http://localhost:5000/api)
- `POST /auth/login` - User login
- `POST /auth/register` - User registration  
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token
- `GET /auth/me` - Get current user info
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `GET /auth/health` - Health check

### Frontend (http://localhost:3000)
- Login page with role selection (tenant/manager/admin)
- Registration with multi-step form
- Password reset functionality
- Dashboard based on user role
- Property management features

## Test Accounts
Once the backend is running with sample data:

- **Admin**: `admin@jacs-cebu.com` / `Admin123!`
- **Manager**: `manager@example.com` / `Manager123!`
- **Tenant**: `tenant@example.com` / `Tenant123!`

## Property Portal URLs
The system supports dynamic subdomains for individual properties:
- http://modern-2br-itpark.localhost:3000
- http://cozy-studio-ayala.localhost:3000
- http://family-house-banilad.localhost:3000
- http://luxury-condo-marco.localhost:3000
- http://student-boarding-usc.localhost:3000

## Configuration

### Frontend Configuration
- **API Base URL**: Configured in `src/config/api.js`
- **Proxy**: React development server proxies `/api` requests to `http://localhost:5000`

### Backend Configuration
- **Database**: MySQL connection configured in `backend/.env`
- **CORS**: Allows frontend origin `http://localhost:3000`
- **JWT**: Token expiration and refresh settings

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check if MySQL server is running
   - Verify database connection settings in `backend/.env`
   - Ensure Python virtual environment is activated

2. **Frontend can't connect to backend**
   - Ensure backend is running on port 5000
   - Check browser console for CORS errors
   - Verify proxy configuration in `package.json`

3. **Login fails with network error**
   - Backend may not be running
   - Check if backend API endpoints are accessible
   - Verify CORS configuration

4. **Database errors**
   - Run database migrations: `python backend/migrate_dynamic_portals.py`
   - Check MySQL service status
   - Verify database credentials

### Health Checks
- Backend health: http://localhost:5000/api/auth/health
- Frontend status: Check if http://localhost:3000 loads without errors

## Development Notes

### Key Improvements Made
1. **Centralized API calls** through `src/services/api.js`
2. **Better error handling** with specific error types and messages  
3. **Loading states** for better user experience
4. **Token refresh logic** for seamless authentication
5. **Network error detection** for offline scenarios

### Architecture
- **Frontend**: React with functional components and hooks
- **Backend**: Flask with JWT authentication
- **Database**: MySQL with SQLAlchemy ORM
- **Styling**: Tailwind CSS for responsive design

## Next Steps
After completing the setup:
1. Test login with different user roles
2. Try the registration flow
3. Test password reset functionality
4. Explore property management features
5. Check property portal functionality

For additional help, refer to the individual README files in the backend and frontend directories.