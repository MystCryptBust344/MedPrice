// Hospital business logic
// Transforms result shapes

const repo = require('../repositories/hospitalRepository')

// Get aggregated hospitals
async function getAllHospitals(city) {
  return repo.getAllGrouped(city)
}

// Get hospital procedures
async function getHospitalProcedures(name) {
  const procedures = await repo.getProceduresByHospitalName(name)

  const result = procedures.map(p => {
    const hospital = p.hospitals.find(h => h.name === name)
    return {
      _id:           p._id,
      commonName:    p.commonName,
      officialName:  p.officialName,
      cghsRate:      p.cghsRate,
      category:      p.category,
      hospitalPrice: hospital ? hospital.price : null,
      markup:        hospital ? (hospital.price / p.cghsRate).toFixed(1) : null
    }
  })

  return { hospitalName: name, procedures: result }
}

// Haversine distance calc (accurate great-circle distance in km)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Get nearby hospitals (FIXED) ────────────────────────────────────────────
// MongoDB $geoNear on embedded subdoc arrays does NOT reliably enforce
// maxDistance — the pipeline matches at the *procedure* document level, not
// the individual embedded hospital entry. We therefore fetch all unique
// hospitals and apply the strict radius filter using Haversine in JS.
async function getNearbyHospitals(lat, lng, radiusKm = 50) {
  const all = await repo.getAllGrouped() // no city filter → all hospitals

  return all
    .filter(h => h.coordinates && h.coordinates.length === 2)
    .map(h => {
      const [hLng, hLat] = h.coordinates
      const distKm = haversineKm(parseFloat(lat), parseFloat(lng), hLat, hLng)
      return { ...h, distanceKm: parseFloat(distKm.toFixed(1)) }
    })
    .filter(h => h.distanceKm <= radiusKm)   // ← strict cutoff
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

// Compare specific list of hospitals
async function compareHospitals(names) {
  return repo.getHospitalsByNames(names)
}

module.exports = { getAllHospitals, getHospitalProcedures, getNearbyHospitals, compareHospitals }
