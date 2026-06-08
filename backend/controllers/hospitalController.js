// Hospital HTTP endpoints

const service = require('../services/hospitalService')
const { detectCity } = require('../utils/cityBounds')

// Get all hospitals
const getAllHospitals = async (req, res) => {
  try {
    const result = await service.getAllHospitals(req.query.city)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get hospital procedures
const getHospitalProcedures = async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const result = await service.getHospitalProcedures(name)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get nearby hospitals with graceful 50km degradation
const getNearbyHospitals = async (req, res) => {
  const { lat, lng, radius = 50 } = req.query
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required query params' })
  }
  
  const parsedLat = parseFloat(lat)
  const parsedLng = parseFloat(lng)
  const parsedRadius = parseFloat(radius)

  try {
    const hospitals = await service.getNearbyHospitals(parsedLat, parsedLng, parsedRadius)
    
    if (hospitals.length === 0) {
      // Bounding box detect city fallback (Kolkata, Mumbai, Bangalore, Chennai, Hyderabad, Delhi)
      const detectedCity = detectCity(parsedLat, parsedLng) || 'Delhi'
      return res.json({
        hospitals: [],
        detectedCity,
        fallback: true
      })
    }
    
    res.json(hospitals)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Compare hospitals side-by-side
const compareHospitals = async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean)
    if (ids.length < 2) {
      return res.status(400).json({ error: 'Send at least 2 hospital IDs/names to compare' })
    }
    const result = await service.compareHospitals(ids)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAllHospitals, getHospitalProcedures, getNearbyHospitals, compareHospitals }