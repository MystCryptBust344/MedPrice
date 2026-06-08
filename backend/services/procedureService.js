// Procedure business logic
// Calls repo directly
// Returns clean objects
// No req/res handling

const repo = require('../repositories/procedureRepository')

// Find nearby procedures
async function getNearbyProcedures(lat, lng, radiusKm = 15) {
  return repo.findNear(parseFloat(lng), parseFloat(lat), radiusKm * 1000)
}

// Search with pagination
async function searchProcedures({ q, category, city, page = 1, limit = 12, sort }) {
  const skip = (Number(page) - 1) * Number(limit)

  if (q) {
    // Try text search
    const [textResults, total] = await Promise.all([
      repo.textSearch(q, skip, Number(limit)),
      repo.countTextSearch(q)
    ])

    if (textResults.length > 0) {
      return { procedures: textResults, total, page: Number(page) }
    }

    // Regex fallback
  }

  // Generic filter query
  const query = {}
  if (q)        query.commonName = { $regex: q, $options: 'i' }
  if (category) query.category = category
  if (city)     query['hospitals.city'] = city
  if (arguments[0].hospital) query['hospitals.name'] = arguments[0].hospital

  // Map sort options
  let sortOption = {}
  if (sort === 'price_asc')  sortOption = { cghsRate: 1 }
  if (sort === 'price_desc') sortOption = { cghsRate: -1 }
  if (sort === 'name')       sortOption = { commonName: 1 }

  const [procedures, total] = await Promise.all([
    repo.findAll(query, sortOption, skip, Number(limit)),
    repo.countAll(query)
  ])

  let finalProcedures = procedures
  if (arguments[0].hospital) {
    const hName = arguments[0].hospital
    finalProcedures = procedures.map(p => {
      const doc = p.toObject ? p.toObject() : p
      const h = doc.hospitals && doc.hospitals.find(h => h.name === hName)
      if (h) {
        doc.hospitalPrice = h.price
        doc.markup = (h.price / doc.cghsRate).toFixed(1)
      }
      return doc
    })
  }

  return { procedures: finalProcedures, total, page: Number(page) }
}

// Get with markup
async function getProcedureWithMarkup(id) {
  const procedure = await repo.findById(id)
  if (!procedure) return null

  const data = procedure.toObject()
  data.hospitals = data.hospitals.map(h => ({
    ...h,
    markup: (h.price / data.cghsRate).toFixed(1)
  }))

  return data
}

// Compare multiple procedures
async function compareProcedures(ids) {
  if (!ids || ids.length < 2) {
    throw new Error('Send at least 2 ids')
  }
  return repo.findByIds(ids)
}

// Get category procedures
async function getProceduresByCategory(category) {
  return repo.findByCategory(category, 20)
}

// Autocomplete search queries
async function autocompleteProcedures(q) {
  if (!q || q.trim().length < 2) return []
  return repo.autocompleteSearch(q, 7)
}

// Find similar procedures
async function getSimilarProcedures(id) {
  const base = await repo.findById(id)
  if (!base) throw new Error('Procedure not found')

  const low  = base.cghsRate * 0.5
  const high = base.cghsRate * 1.5

  return repo.findSimilar(base._id, base.category, low, high, 4)
}

module.exports = {
  getNearbyProcedures,
  searchProcedures,
  getProcedureWithMarkup,
  compareProcedures,
  getProceduresByCategory,
  autocompleteProcedures,
  getSimilarProcedures
}
