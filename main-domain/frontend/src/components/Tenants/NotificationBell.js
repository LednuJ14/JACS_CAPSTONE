import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import TenantNotifications from './Notifications';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch unread count
  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    // Also listen for custom events to refresh immediately (e.g., after profile update)
    const handleRefresh = () => {
      fetchUnreadCount();
    };
    window.addEventListener('notification-refresh', handleRefresh);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-refresh', handleRefresh);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const data = await apiService.getTenantNotifications();
      if (data && data.notifications) {
        const unread = data.notifications.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      } else {
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to fetch notification count:', err);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUpdate = () => {
    // Refresh count when notifications are updated
    fetchUnreadCount();
  };

  return (
    <>
      {/* Desktop Notification Bell */}
      <div className="hidden md:block relative" data-notification-button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {!loading && unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-black flex items-center justify-center">
              {unreadCount > 9 ? (
                <span className="text-[6px] text-white font-bold">9+</span>
              ) : unreadCount > 0 ? (
                <span className="text-[6px] text-white font-bold">{unreadCount}</span>
              ) : null}
            </span>
          )}
        </button>
        
        <TenantNotifications 
          isOpen={isOpen} 
          onClose={() => setIsOpen(false)}
          onUpdate={handleNotificationUpdate}
        />
      </div>

      {/* Mobile Notification Button */}
      <div className="md:hidden w-full" data-notification-button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full px-4 py-3 rounded-xl font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-all duration-300 flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>Notifications</span>
          {!loading && unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-gray-800 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
            </span>
          )}
        </button>
        
        {isOpen && (
          <div className="mt-2 relative">
            <TenantNotifications 
              isOpen={isOpen} 
              onClose={() => setIsOpen(false)}
              onUpdate={handleNotificationUpdate}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationBell;

