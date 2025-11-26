import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LandingDashboard from './components/LandingDashboard';
import SearchSection from './components/Tenants/SearchSection';
import PropertyGrid from './components/Tenants/PropertyGrid';
import Footer from './components/Footer';
import Login from './components/Login';
import SignUp from './components/SignUp';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import EmailVerification from './components/EmailVerification';
import EmailVerificationPending from './components/EmailVerificationPending';
import ManagerRentSpace from './components/PropertyManager/RentSpace';
import AnalyticsReports from './components/PropertyManager/AnalyticsReports';
import BillingPayment from './components/PropertyManager/BillingPayment';
import ManageProperty from './components/PropertyManager/ManageProperty';
import AboutContact from './components/AboutContact';
import AdminDashboard from './components/Admin/Dashboard';
import AdminProfile from './components/Admin/Profile';
import AdminSettings from './components/Admin/Settings';
import AdminPropertyReview from './components/Admin/PropertyReview';
import AdminAnalytics from './components/Admin/Analytics';
import AdminSubscriptionManagement from './components/Admin/SubscriptionManagement';
import DocumentManagement from './components/Admin/DocumentManagement';
import ManagerDashboard from './components/PropertyManager/Dashboard';
  
function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('tenant'); // 'tenant' | 'manager' | 'admin'
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

  // Check for reset password and email verification URLs on app load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    
    if (token && email && window.location.pathname === '/reset-password') {
      setCurrentPage('reset-password');
    } else if (token && email && window.location.pathname === '/verify-email') {
      setCurrentPage('verify-email');
    }
  }, []);

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const token = localStorage.getItem('access_token');
        const savedRole = localStorage.getItem('user_role');
        const userId = localStorage.getItem('user_id');

        if (token && savedRole && userId) {
          // Restore authentication state
          setIsAuthenticated(true);
          setUserRole(savedRole.toLowerCase());
          
          // Set appropriate landing page based on role
          if (savedRole.toLowerCase() === 'admin') {
            setCurrentPage('admin-dashboard');
          } else if (savedRole.toLowerCase() === 'manager') {
            setCurrentPage('dashboard');
          } else {
            setCurrentPage('dashboard');
          }
          
          console.log('Session restored:', { role: savedRole, userId });
        } else {
          console.log('No existing session found');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // Clear any corrupted session data
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
      } finally {
        setIsLoadingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  // Listen for navigation to login events (from PropertyGrid when user tries to inquire without login)
  useEffect(() => {
    const handleNavigateToLogin = (event) => {
      setCurrentPage('login');
    };

    window.addEventListener('navigateToLogin', handleNavigateToLogin);
    
    return () => {
      window.removeEventListener('navigateToLogin', handleNavigateToLogin);
    };
  }, []);

  const handlePageChange = (nextPage) => {
    if (nextPage === 'logout') {
      // Clear all session data
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      
      setIsAuthenticated(false);
      setCurrentPage('dashboard');
      setUserRole('tenant');
      
      console.log('User logged out, session cleared');
      return;
    }
    setCurrentPage(nextPage);
  };

  const [propertyFilters, setPropertyFilters] = useState({ city: '', type: '', min_price: '', max_price: '', bedrooms: '', search: '' });

  const renderContent = () => {
    // Handle Admin specific pages
    if (userRole === 'admin' && isAuthenticated) {
      switch (currentPage) {
        case 'admin-dashboard':
          return <AdminDashboard onPageChange={setCurrentPage} />;
        case 'admin-profile':
          return <AdminProfile />;
        case 'admin-settings':
          return <AdminSettings />;
        case 'admin-property-review':
          return <AdminPropertyReview />;
        case 'admin-analytics':
          return <AdminAnalytics />;
        case 'admin-subscription-management':
          return <AdminSubscriptionManagement />;
        case 'admin-document-management':
          return <DocumentManagement />;
        case 'admin-property-approval':
          return <AdminPropertyReview />;
        case 'about-contact':
          return <AboutContact />;
        default:
          return <AdminDashboard onPageChange={setCurrentPage} />;
      }
    }
    
    // Handle Property Manager specific pages
    if (userRole === 'manager' && isAuthenticated) {
      switch (currentPage) {
        case 'rent-space':
          return <ManagerRentSpace onPageChange={handlePageChange} />;
        case 'analyticsReports':
          return <AnalyticsReports />;
        case 'billingPayment':
          return <BillingPayment />;
        case 'manageProperty':
          return <ManageProperty onOpenManageUnits={() => handlePageChange('rent-space')} />;
        case 'about-contact':
          return <AboutContact />;
        default:
          return <ManagerDashboard onPageChange={handlePageChange} />;
      }
    }
    
    // Handle Tenant and public pages
    switch (currentPage) {
      case 'dashboard':
        return <LandingDashboard />;
      case 'rent-space':
        return (
          <>
            <section className="mb-6 md:mb-8 bg-gradient-to-r from-black to-gray-800 text-white rounded-xl p-4 md:p-6 shadow-lg">
              <h1 className="text-xl md:text-2xl font-black">Find Your Next Home</h1>
              <p className="text-xs md:text-sm text-gray-300 mt-1">Search and filter rental spaces that match your needs</p>
            </section>
            <div className="mb-6 md:mb-8">
              <SearchSection 
                filters={propertyFilters}
                onChange={setPropertyFilters}
              />
            </div>
            <PropertyGrid filters={propertyFilters} />
          </>
        );
      case 'about-contact':
        return <AboutContact />;
      default:
        return <LandingDashboard />;
    }
  };

  // Show loading screen while checking session
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  if (currentPage === 'login') {
    return (
      <Login
        onLoginSuccess={({ role }) => {
          setIsAuthenticated(true);
          if (role === 'admin') {
            setUserRole('admin');
            setCurrentPage('admin-dashboard');
          } else if (role === 'manager') {
            setUserRole('manager');
            setCurrentPage('dashboard');
          } else {
            setUserRole('tenant');
            setCurrentPage('dashboard');
          }
        }}
        onBackToMain={() => setCurrentPage('dashboard')}
        onSignUpClick={() => setCurrentPage('signup')}
        onForgotPasswordClick={() => setCurrentPage('forgot-password')}
      />
    );
  }

  if (currentPage === 'signup') {
    return (
      <SignUp
        onSignUpSuccess={({ role, email }) => {
          // For tenants and managers, redirect to email verification pending page
          if (role && (role.toLowerCase() === 'tenant' || role.toLowerCase() === 'manager')) {
            setPendingVerificationEmail(email);
            setCurrentPage('email-verification-pending');
          } else {
            // For admins, redirect to login (no email verification required)
            setCurrentPage('login');
          }
        }}
        onBackToLogin={() => setCurrentPage('login')}
      />
    );
  }

  if (currentPage === 'forgot-password') {
    return (
      <ForgotPassword
        onBackToLogin={() => setCurrentPage('login')}
      />
    );
  }

  if (currentPage === 'reset-password') {
    return (
      <ResetPassword
        onResetSuccess={() => setCurrentPage('login')}
        onBackToLogin={() => setCurrentPage('login')}
      />
    );
  }

  if (currentPage === 'verify-email') {
    return (
      <EmailVerification
        onVerificationComplete={(user) => {
          // Auto-login the user after successful verification
          setIsAuthenticated(true);
          const userRole = user.role ? user.role.toLowerCase() : 'tenant';
          setUserRole(userRole);
          localStorage.setItem('user_role', user.role || 'tenant');
          localStorage.setItem('user_id', user.id);
          
          // Route to appropriate dashboard based on role
          if (userRole === 'manager') {
            setCurrentPage('dashboard'); // Manager dashboard
          } else {
            setCurrentPage('dashboard'); // Tenant dashboard
          }
        }}
        onBack={() => setCurrentPage('login')}
      />
    );
  }

  if (currentPage === 'email-verification-pending') {
    return (
      <EmailVerificationPending
        email={pendingVerificationEmail}
        onResendEmail={() => {
          // Optional: Show success message or update UI
        }}
        onBackToLogin={() => setCurrentPage('login')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header
        currentPage={currentPage}
        onPageChange={handlePageChange}
        isAuthenticated={isAuthenticated}
        userRole={userRole}
      />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}

export default App;
