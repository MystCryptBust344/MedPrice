/**
 * config.example.js — Template for environment configuration
 *
 * Copy this file to config.js and fill in your values.
 * config.js is in .gitignore — never commit your real URLs.
 *
 * USAGE:
 *   1. cp frontend/js/config.example.js frontend/js/config.js
 *   2. Edit config.js with your actual backend URL
 */
window.MedPriceConfig = {
  // LOCAL: leave empty string to use relative paths
  // PRODUCTION: set to your Render backend URL
  API_BASE_URL: ''   // e.g. 'https://medprice-api.onrender.com'
}

window.getApiUrl = function (path) {
  var base = (window.MedPriceConfig && window.MedPriceConfig.API_BASE_URL) || ''
  return base + path
}
