// City bounding-box lookup for GPS-based city detection
// Format: { minLng, maxLng, minLat, maxLat }
// Generous bounds that encompass the metro + NCR/suburb areas

const CITY_BOUNDS = {
  'Delhi': {
    minLng: 76.84, maxLng: 77.55,
    minLat: 28.40, maxLat: 28.88
  },
  'Mumbai': {
    minLng: 72.77, maxLng: 73.05,
    minLat: 18.89, maxLat: 19.27
  },
  'Bangalore': {
    minLng: 77.45, maxLng: 77.78,
    minLat: 12.84, maxLat: 13.14
  },
  'Chennai': {
    minLng: 80.16, maxLng: 80.34,
    minLat: 12.92, maxLat: 13.23
  },
  'Hyderabad': {
    minLng: 78.30, maxLng: 78.65,
    minLat: 17.28, maxLat: 17.58
  },
  'Kolkata': {
    minLng: 88.22, maxLng: 88.50,
    minLat: 22.44, maxLat: 22.72
  }
}

/**
 * Detect which supported city a lat/lng coordinate falls within.
 * Returns the city name string, or null if outside all bounds.
 * @param {number} lat
 * @param {number} lng
 * @returns {string|null}
 */
function detectCity(lat, lng) {
  for (const [city, b] of Object.entries(CITY_BOUNDS)) {
    if (lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat) {
      return city
    }
  }
  return null
}

module.exports = { CITY_BOUNDS, detectCity }
