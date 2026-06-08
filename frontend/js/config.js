window.MedPriceConfig = {
  API_BASE_URL: 'https://medprice-186w.onrender.com'
};

window.getApiUrl = function (path) {
  return (window.MedPriceConfig.API_BASE_URL || '') + path;
};
