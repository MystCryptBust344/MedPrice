// statsRepository.js
// Isolated Mongoose queries for dashboard statistics.

const Procedure = require('../models/Procedure')

// Full collection fetch — used by statsService to compute in-memory aggregations
function getAll() {
  return Procedure.find({})
}

// Count procedures per category
function groupByCategory() {
  return Procedure.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
}

// Top N most expensive procedures by CGHS rate
function getMostExpensive(limit) {
  return Procedure.find({})
    .sort({ cghsRate: -1 })
    .limit(limit)
    .select('commonName cghsRate category')
}

// Top N cheapest procedures by CGHS rate
function getCheapest(limit) {
  return Procedure.find({})
    .sort({ cghsRate: 1 })
    .limit(limit)
    .select('commonName cghsRate category')
}

// Average CGHS rate broken down per category
function getAvgByCategory() {
  return Procedure.aggregate([
    { $group: { _id: '$category', avgRate: { $avg: '$cghsRate' } } },
    { $sort: { avgRate: -1 } }
  ])
}

module.exports = { getAll, groupByCategory, getMostExpensive, getCheapest, getAvgByCategory }
