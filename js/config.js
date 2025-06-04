// Environment configuration
const ENV = {
  API_URL: '{{ site.env.APPS_SCRIPT_URL }}' || 'development_url'
};

// Export configuration values
export const API_URL = ENV.API_URL; 