// Hospital DB queries
// Embedded subdocument queries

const Procedure = require('../models/Procedure')

// Aggregate unique hospitals
function getAllGrouped(city) {
  const match = city ? { 'hospitals.city': city } : {}

  return Procedure.aggregate([
    { $match: match },
    { $unwind: '$hospitals' },
    ...(city ? [{ $match: { 'hospitals.city': city } }] : []),
    {
      $group: {
        _id:             '$hospitals.name',
        city:            { $first: '$hospitals.city' },
        type:            { $first: '$hospitals.type' },
        rating:          { $first: '$hospitals.rating' },
        coordinates:     { $first: '$hospitals.location.coordinates' },
        totalProcedures: { $sum: 1 },
        avgPrice:        { $avg: '$hospitals.price' },
        minPrice:        { $min: '$hospitals.price' },
        maxPrice:        { $max: '$hospitals.price' }
      }
    },
    { $sort: { totalProcedures: -1 } }
  ])
}

// Get hospital procedures
function getProceduresByHospitalName(name) {
  return Procedure.find({ 'hospitals.name': name })
}

// Geo proximity aggregation
function findNear(lng, lat, maxDistance) {
  return Procedure.aggregate([
    // $geoNear must lead
    {
      $geoNear: {
        near:          { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'minDist',   // Nearest distance
        maxDistance,
        spherical: true,
        key: 'hospitals.location'   // Embedded key
      }
    },
    // Unwind hospitals
    { $unwind: '$hospitals' },
    // Group unique hospitals
    {
      $group: {
        _id:             '$hospitals.name',
        city:            { $first: '$hospitals.city' },
        type:            { $first: '$hospitals.type' },
        rating:          { $first: '$hospitals.rating' },
        // Keep GeoJSON coordinates
        coordinates:     { $first: '$hospitals.location.coordinates' },
        totalProcedures: { $sum: 1 },
        minPrice:        { $min: '$hospitals.price' },
        maxPrice:        { $max: '$hospitals.price' }
      }
    },
    { $sort: { _id: 1 } }
  ])
}

// Compare specific list of hospitals
function getHospitalsByNames(names) {
  return Procedure.aggregate([
    { $match: { 'hospitals.name': { $in: names } } },
    { $unwind: '$hospitals' },
    { $match: { 'hospitals.name': { $in: names } } },
    {
      $group: {
        _id:             '$hospitals.name',
        city:            { $first: '$hospitals.city' },
        type:            { $first: '$hospitals.type' },
        rating:          { $first: '$hospitals.rating' },
        totalProcedures: { $sum: 1 },
        avgPrice:        { $avg: '$hospitals.price' },
        minPrice:        { $min: '$hospitals.price' },
        maxPrice:        { $max: '$hospitals.price' }
      }
    }
  ])
}

module.exports = { getAllGrouped, getProceduresByHospitalName, findNear, getHospitalsByNames }
