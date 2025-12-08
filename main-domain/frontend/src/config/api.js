// Always use HTTP for localhost backend connections
// The backend doesn't support HTTPS, so we must use HTTP even if the page is HTTPS
// This is safe for localhost development
const getBackendProtocol = () => {
  // If environment variable is set, use it (allows override)
  if (process.env.REACT_APP_API_URL) {
    const url = new URL(process.env.REACT_APP_API_URL);
    return url.protocol;
  }
  // Always use HTTP for localhost backend
  return 'http:';
};

const BACKEND_PROTOCOL = getBackendProtocol();
const API_BASE_URL = process.env.REACT_APP_API_URL || `${BACKEND_PROTOCOL}//localhost:5000/api`;
const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || `${BACKEND_PROTOCOL}//localhost:5000`;

// Helper function to get full image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  // If it starts with /uploads, prepend backend base URL
  if (imagePath.startsWith('/uploads/')) {
    return `${BACKEND_BASE_URL}${imagePath}`;
  }
  // If it's a relative path, assume it's an upload
  if (imagePath.startsWith('/')) {
    return `${BACKEND_BASE_URL}${imagePath}`;
  }
  // Otherwise return as is (might be a data URL or default image)
  return imagePath;
};

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    VERIFY_2FA: `${API_BASE_URL}/auth/verify-2fa`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
    ME: `${API_BASE_URL}/auth/me`,
    CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`,
    FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
    RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
    HEALTH: `${API_BASE_URL}/auth/health`
  },
  USERS: {
    LIST: `${API_BASE_URL}/users`,
    DETAIL: (id) => `${API_BASE_URL}/users/${id}`,
    UPDATE_STATUS: (id) => `${API_BASE_URL}/users/${id}/status`,
    STATS: `${API_BASE_URL}/users/stats`
  },
  PROPERTIES: {
    LIST: `${API_BASE_URL}/properties`,
    DETAIL: (id) => `${API_BASE_URL}/properties/${id}`,
    CREATE: `${API_BASE_URL}/properties`,
    MY_PROPERTIES: `${API_BASE_URL}/properties/my-properties`
  },
  SUBSCRIPTIONS: {
    PLANS: `${API_BASE_URL}/subscriptions/plans`,
    MY_SUBSCRIPTION: `${API_BASE_URL}/subscriptions/my-subscription`,
    UPGRADE_PLAN: `${API_BASE_URL}/subscriptions/upgrade`,
    BILLING_HISTORY: `${API_BASE_URL}/subscriptions/billing-history`,
    PAYMENT_METHODS: `${API_BASE_URL}/subscriptions/payment-methods`,
    ADD_PAYMENT_METHOD: `${API_BASE_URL}/subscriptions/payment-methods/add`,
    REMOVE_PAYMENT_METHOD: (id) => `${API_BASE_URL}/subscriptions/payment-methods/${id}`,
    SET_DEFAULT_PAYMENT: (id) => `${API_BASE_URL}/subscriptions/payment-methods/${id}/set-default`,
    CREATE_PAYMENT_INTENT: `${API_BASE_URL}/subscriptions/create-payment-intent`,
    CANCEL_SUBSCRIPTION: `${API_BASE_URL}/subscriptions/cancel`
  },
  ADMIN: {
    DASHBOARD: `${API_BASE_URL}/admin/dashboard`,
    ANALYTICS: `${API_BASE_URL}/admin/analytics`,
    ANALYTICS_DOWNLOAD_PDF: `${API_BASE_URL}/admin/analytics/download/pdf`,
    ANALYTICS_DOWNLOAD_EXCEL: `${API_BASE_URL}/admin/analytics/download/excel`,
    ANALYTICS_DOWNLOAD_CSV: `${API_BASE_URL}/admin/analytics/download/csv`,
    ALL_PROPERTIES: `${API_BASE_URL}/admin/properties/all`,
    PENDING_PROPERTIES: `${API_BASE_URL}/admin/properties/pending-properties`,
    APPROVE_PROPERTY: (id) => `${API_BASE_URL}/admin/properties/approve-property/${id}`,
    REJECT_PROPERTY: (id) => `${API_BASE_URL}/admin/properties/reject-property/${id}`,
    ALL_PORTALS: `${API_BASE_URL}/admin/properties/all-portals`,
    TOGGLE_PORTAL: (id) => `${API_BASE_URL}/admin/properties/toggle-portal/${id}`,
    PORTAL_ANALYTICS: `${API_BASE_URL}/admin/properties/portal-analytics`,
    SUBSCRIPTION_PLANS: `${API_BASE_URL}/admin/subscription-plans`,
    SUBSCRIPTION_PLAN: (id) => `${API_BASE_URL}/admin/subscription-plans/${id}`,
    SUBSCRIPTION_PLAN_FEATURES: (id) => `${API_BASE_URL}/admin/subscription-plans/${id}/features`,
    SUBSCRIPTION_STATS: `${API_BASE_URL}/admin/subscription-stats`,
    SUBSCRIBERS: `${API_BASE_URL}/admin/subscribers`,
    UPDATE_SUBSCRIPTION: (id) => `${API_BASE_URL}/admin/subscriptions/${id}`,
    BILLING_HISTORY: `${API_BASE_URL}/admin/billing-history`,
    CREATE_BILLING: `${API_BASE_URL}/admin/billing`,
    UPDATE_BILLING_STATUS: (id) => `${API_BASE_URL}/admin/billing/${id}/status`,
    RESEND_INVOICE: (id) => `${API_BASE_URL}/admin/billing/${id}/resend`,
    PAYMENT_TRANSACTIONS: `${API_BASE_URL}/admin/payment-transactions`,
    VERIFY_PAYMENT: (id) => `${API_BASE_URL}/admin/payment-transactions/${id}/verify`,
    DOCUMENTS: `${API_BASE_URL}/admin/documents`,
    DOCUMENT_STATUS: (id) => `${API_BASE_URL}/admin/documents/${id}/status`,
    DOCUMENT_DOWNLOAD: (id) => `${API_BASE_URL}/admin/documents/${id}/download`,
    DOCUMENT_STATS: `${API_BASE_URL}/admin/documents/stats`,
    NOTIFICATIONS: `${API_BASE_URL}/admin/notifications`,
    NOTIFICATION_READ: (id) => `${API_BASE_URL}/admin/notifications/${id}/read`,
    NOTIFICATION_DELETE: (id) => `${API_BASE_URL}/admin/notifications/${id}`,
    NOTIFICATIONS_MARK_ALL_READ: `${API_BASE_URL}/admin/notifications/read-all`,
    NOTIFICATIONS_UNREAD_COUNT: `${API_BASE_URL}/admin/notifications/unread-count`
  },
  MANAGER: {
    MY_PROPERTIES: `${API_BASE_URL}/manager/properties/my-properties`,
    ADD_PROPERTY: `${API_BASE_URL}/manager/properties/companies`,
    DASHBOARD_STATS: `${API_BASE_URL}/manager/properties/dashboard-stats`,
    PROFILE: `${API_BASE_URL}/manager/properties/profile/`,
    PROFILE_UPLOAD_IMAGE: `${API_BASE_URL}/manager/properties/profile/upload-image`,
    SET_SUBDOMAIN: (id) => `${API_BASE_URL}/manager/properties/set-subdomain/${id}`,  
    PROPERTY_DETAILS: (id) => `${API_BASE_URL}/manager/properties/property/${id}`,
    UPDATE_PROPERTY: (id) => `${API_BASE_URL}/manager/properties/property/${id}`,
    INQUIRIES: `${API_BASE_URL}/manager/inquiries/`,
    ANALYTICS: `${API_BASE_URL}/manager/analytics`,
    ANALYTICS_DOWNLOAD_PDF: `${API_BASE_URL}/manager/analytics/download/pdf`,
    ANALYTICS_DOWNLOAD_EXCEL: `${API_BASE_URL}/manager/analytics/download/excel`,
    ANALYTICS_DOWNLOAD_CSV: `${API_BASE_URL}/manager/analytics/download/csv`,
    CHANGE_PASSWORD: `${API_BASE_URL}/manager/properties/profile/change-password`,
    TWOFA_EMAIL_ENABLE: `${API_BASE_URL}/manager/properties/profile/2fa/email/enable`,
    TWOFA_EMAIL_DISABLE: `${API_BASE_URL}/manager/properties/profile/2fa/email/disable`,
    UPLOAD_PROPERTY_IMAGE: `${API_BASE_URL}/manager/properties/upload-image`,
    UPLOAD_UNIT_IMAGE: `${API_BASE_URL}/manager/properties/upload-unit-image`,
    UPLOAD_LEGAL_DOCUMENT: `${API_BASE_URL}/manager/properties/upload-legal-document`,
    NOTIFICATIONS: `${API_BASE_URL}/manager/notifications`,
    NOTIFICATION_READ: (id) => `${API_BASE_URL}/manager/notifications/${id}/read`,
    NOTIFICATION_DELETE: (id) => `${API_BASE_URL}/manager/notifications/${id}`,
    NOTIFICATIONS_MARK_ALL_READ: `${API_BASE_URL}/manager/notifications/read-all`,
    NOTIFICATIONS_UNREAD_COUNT: `${API_BASE_URL}/manager/notifications/unread-count`
  },
  TENANT: {
    INQUIRIES: `${API_BASE_URL}/tenant/inquiries/`,
    START_INQUIRY: `${API_BASE_URL}/tenant/inquiries/start`,
    SEND_MESSAGE: `${API_BASE_URL}/tenant/inquiries/send-message`,
    PROFILE: `${API_BASE_URL}/tenant/profile/`,
    PROFILE_UPLOAD_IMAGE: `${API_BASE_URL}/tenant/profile/upload-image`,
    CHANGE_PASSWORD: `${API_BASE_URL}/tenant/profile/change-password`,
    TWOFA_SETUP: `${API_BASE_URL}/tenant/profile/2fa/setup`,
    TWOFA_ENABLE: `${API_BASE_URL}/tenant/profile/2fa/enable`,
    TWOFA_DISABLE: `${API_BASE_URL}/tenant/profile/2fa/disable`,
    TWOFA_EMAIL_ENABLE: `${API_BASE_URL}/tenant/profile/2fa/email/enable`,
    TWOFA_EMAIL_DISABLE: `${API_BASE_URL}/tenant/profile/2fa/email/disable`,
    NOTIFICATIONS: `${API_BASE_URL}/tenant/notifications`,
    NOTIFICATION_READ: (id) => `${API_BASE_URL}/tenant/notifications/${id}/read`,
    NOTIFICATION_DELETE: (id) => `${API_BASE_URL}/tenant/notifications/${id}`,
    NOTIFICATIONS_MARK_ALL_READ: `${API_BASE_URL}/tenant/notifications/mark-all-read`
  },
  INQUIRIES: {
    ATTACHMENTS: (inquiryId) => `${API_BASE_URL}/inquiries/${inquiryId}/attachments`,
    ATTACHMENT: (attachmentId) => `${API_BASE_URL}/inquiries/attachments/${attachmentId}`,
    ATTACHMENT_DOWNLOAD: (attachmentId) => `${API_BASE_URL}/inquiries/attachments/${attachmentId}`
  },
  SUBSCRIPTIONS: {
    PLANS: `${API_BASE_URL}/subscriptions/plans`,
    MY_SUBSCRIPTION: `${API_BASE_URL}/subscriptions/my-subscription`,
    BILLING_HISTORY: `${API_BASE_URL}/subscriptions/billing-history`,
    PAYMENT_METHODS: `${API_BASE_URL}/subscriptions/payment-methods`,
    UPGRADE: `${API_BASE_URL}/subscriptions/upgrade`,
    ADD_PAYMENT_METHOD: `${API_BASE_URL}/subscriptions/payment-methods/add`,
    REMOVE_PAYMENT_METHOD: (id) => `${API_BASE_URL}/subscriptions/payment-methods/${id}`,
    SET_DEFAULT_PAYMENT_METHOD: (id) => `${API_BASE_URL}/subscriptions/payment-methods/${id}/set-default`,
    PROCESS_PAYMENT: (billingId) => `${API_BASE_URL}/subscriptions/billing/${billingId}/pay`
  },
  UNITS: {
    ACTIVE: `${API_BASE_URL}/units/active`
  }
};

export default API_BASE_URL;
