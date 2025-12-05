// Shared request lock to prevent concurrent requests across notification components
export const notificationRequestLock = {
  isFetching: false,
  lastFetchTime: 0,
  minTimeBetweenRequests: 2000, // Minimum 2 seconds between requests
};

