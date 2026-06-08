// HTTP layer only

const service = require('../services/procedureService')

// Get procedures
const getProcedures = async (req, res) => {
  const { q, category, city, hospital, page = 1, limit = 12, sort } = req.query
  try {
    const result = await service.searchProcedures({ q, category, city, hospital, page, limit, sort })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get by ID
const getProcedureById = async (req, res) => {
  try {
    const data = await service.getProcedureWithMarkup(req.params.id)
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Compare procedures
const compareProcedures = async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean)
    const result = await service.compareProcedures(ids)
    res.json(result)
  } catch (err) {
    // Treat as 400
    res.status(400).json({ error: err.message })
  }
}

// Get category
const getByCategory = async (req, res) => {
  try {
    const result = await service.getProceduresByCategory(req.params.category)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Autocomplete suggestions
const autocomplete = async (req, res) => {
  try {
    const result = await service.autocompleteProcedures(req.query.q)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get similar
const getSimilar = async (req, res) => {
  try {
    const result = await service.getSimilarProcedures(req.params.id)
    res.json(result)
  } catch (err) {
    const status = err.message === 'Procedure not found' ? 404 : 500
    res.status(status).json({ error: err.message })
  }
}

// Get nearby procedures
const getNearby = async (req, res) => {
  const { lat, lng, radius = 15 } = req.query
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' })
  }
  try {
    const result = await service.getNearbyProcedures(lat, lng, radius)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getProcedures, getProcedureById, compareProcedures, getByCategory, autocomplete, getSimilar, getNearby }