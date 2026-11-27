/* Front-end settings.
   apiBase  where the Flask backend runs (see backend/README.md).
   demo     false = use the Flask API (registrations and roles are saved).
            true  = use the built-in sample data only; nothing is persisted. */
window.DCC_CONFIG = {
  apiBase: ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://127.0.0.1:5000/api'
    : '/api',
  demo: false
};
