// AJAX API calls

const API_BASE = typeof getApiUrl === 'function' ? getApiUrl('/api') : '/api'

// Search procedures
function apiSearchProcedures(params, onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/procedures',
    method: 'GET',
    data: params,
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Get single procedure
function apiGetProcedure(id, onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/procedures/' + id,
    method: 'GET',
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Compare procedures
function apiCompareProcedures(ids, onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/procedures/compare',
    method: 'GET',
    data: { ids: ids.join(',') },
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Autocomplete suggestions
function apiAutocomplete(q, onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/procedures/autocomplete',
    method: 'GET',
    data: { q: q },
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Get similar procedures
function apiGetSimilar(id, onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/procedures/similar/' + id,
    method: 'GET',
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Get hospitals
function apiGetHospitals(params, onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/hospitals',
    method: 'GET',
    data: params || {},
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Get stats
function apiGetStats(onSuccess, onError) {
  $.ajax({
    url: API_BASE + '/stats/summary',
    method: 'GET',
    success: onSuccess,
    error: function(xhr) {
      const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Server error'
      if (onError) onError(msg)
    }
  })
}

// Format Indian numbers
function toIndianNum(n) {
  return Number(n).toLocaleString('en-IN')
}

// Markup pill class
function markupPillClass(markup) {
  markup = parseFloat(markup)
  if (markup <= 1.5) return 'pill-green'
  if (markup <= 2.5) return 'pill-amber'
  return 'pill-red'
}

// Category pill class
function categoryPillClass(cat) {
  const map = {
    Surgery:      'pill-red',
    Diagnostic:   'pill-blue',
    Therapy:      'pill-amber',
    Consultation: 'pill-green',
    Other:        'pill-gray'
  }
  return map[cat] || 'pill-gray'
}

// Read URL param
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key) || ''
}

// Fair value badge
function fairValueBadge(markup) {
  markup = parseFloat(markup)
  if (markup <= 1.15) return '<span class="badge badge-fair">✓ Fair Value</span>'
  if (markup > 3.0)   return '<span class="badge badge-high">⚠ High Markup</span>'
  if (markup > 1.5)   return '<span class="badge badge-premium">Premium</span>'
  return ''
}