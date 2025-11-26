import React, { useState } from 'react';
import LogoImage from '../assets/images/logo-08.png';
import TenantProfileDropdown from './Tenants/ProfileDropdown';
import ManagerProfileDropdown from './PropertyManager/ProfileDropdown';
import AdminProfileDropdown from './Admin/ProfileDropdown';
import NotificationBell from './Tenants/NotificationBell';
import ManagerNotificationBell from './PropertyManager/NotificationBell';
import AdminNotificationBell from './Admin/NotificationBell';

const Header = ({ currentPage, onPageChange, isAuthenticated, onLoginClick, userRole }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-black text-white shadow-lg border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo Section */}
          <div className="flex items-center space-x-3 md:space-x-4">
          <div className="w-16 h-16 md:w-18 md:h-18 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
              <img src={LogoImage} alt="JACS Logo" className="w-14 h-14 md:w-16 md:h-16 object-contain" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg md:text-xl font-black">JACS</div>
              <div className="text-xs text-gray-400 font-medium">Joint Association & Community System - Cebu City</div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {userRole === 'admin' ? (
              <>
                <button
                  onClick={() => onPageChange('admin-dashboard')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPage === 'admin-dashboard'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => onPageChange('admin-property-approval')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPage === 'admin-property-approval' || currentPage === 'admin-property-review'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Property Approval
                </button>
                <button
                  onClick={() => onPageChange('admin-analytics')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPage === 'admin-analytics'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => onPageChange('admin-subscription-management')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPage === 'admin-subscription-management'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Subscriptions
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onPageChange('dashboard')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPage === 'dashboard'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => onPageChange('rent-space')}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPage === 'rent-space'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Rent Space
                </button>
              </>
            )}
            <button
              onClick={() => onPageChange('about-contact')}
              className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                currentPage === 'about-contact'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              About Us
            </button>
          </nav>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated ? (
              <>
                {userRole === 'tenant' && <NotificationBell />}
                {userRole === 'manager' && <ManagerNotificationBell />}
                {userRole === 'admin' && <AdminNotificationBell />}
                {userRole === 'admin' ? (
                  <AdminProfileDropdown onPageChange={onPageChange} />
                ) : userRole === 'manager' ? (
                  <ManagerProfileDropdown onPageChange={onPageChange} />
                ) : (
                  <TenantProfileDropdown onPageChange={onPageChange} />
                )}
              </>
            ) : (
              <button
                onClick={onLoginClick || (() => onPageChange('login'))}
                className="px-6 py-2 rounded-xl font-semibold bg-white text-black hover:bg-gray-200 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-3">
            <nav className="flex flex-col space-y-2">
              {userRole === 'admin' ? (
                <>
                  <button
                    onClick={() => {
                      onPageChange('admin-dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'admin-dashboard'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      onPageChange('admin-analytics');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'admin-analytics'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Analytics
                  </button>
                  <button
                    onClick={() => {
                      onPageChange('admin-settings');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'admin-settings'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      onPageChange('admin-property-approval');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'admin-property-approval' || currentPage === 'admin-property-review'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Property Approval
                  </button>
                  <button
                    onClick={() => {
                      onPageChange('admin-subscription-management');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'admin-subscription-management'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Subscriptions
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onPageChange('dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'dashboard'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      onPageChange('rent-space');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                      currentPage === 'rent-space'
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Rent Space
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  onPageChange('about-contact');
                  setIsMobileMenuOpen(false);
                }}
                className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 text-left ${
                  currentPage === 'about-contact'
                    ? 'bg-white text-black'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                About & Contact
              </button>
            </nav>
            <div className="pt-3 border-t border-gray-800">
              {isAuthenticated ? (
                <>
                  {userRole === 'tenant' && (
                    <div className="mb-3">
                      <NotificationBell />
                    </div>
                  )}
                  {userRole === 'manager' && (
                    <div className="mb-3">
                      <ManagerNotificationBell />
                    </div>
                  )}
                  {userRole === 'admin' && (
                    <div className="mb-3">
                      <AdminNotificationBell />
                    </div>
                  )}
                  {userRole === 'admin' ? (
                    <AdminProfileDropdown onPageChange={onPageChange} />
                  ) : userRole === 'manager' ? (
                    <ManagerProfileDropdown onPageChange={onPageChange} />
                  ) : (
                    <TenantProfileDropdown onPageChange={onPageChange} />
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    onLoginClick?.() || onPageChange('login');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 rounded-xl font-semibold bg-white text-black hover:bg-gray-200 transition-all duration-300"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
