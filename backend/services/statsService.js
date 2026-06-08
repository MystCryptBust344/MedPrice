// statsService.js
// Business logic for the dashboard statistics summary.
// Runs all repository queries in parallel, then computes the in-memory max markup.

const repo = require('../repositories/statsRepository')

async function getSummary() {
  // Fire all DB queries concurrently — much faster than sequential awaits
  const [all, byCategory, mostExpensive, cheapest, avgByCategory] = await Promise.all([
    repo.getAll(),
    repo.groupByCategory(),
    repo.getMostExpensive(5),
    repo.getCheapest(5),
    repo.getAvgByCategory()
  ])

  // Business logic: find the highest markup ratio across all procedures and hospitals
  let totalHospitals = 0
  let maxMarkup = 0
  let maxMarkupProcedure = ''

  all.forEach(p => {
    totalHospitals += p.hospitals.length
    p.hospitals.forEach(h => {
      const ratio = h.price / p.cghsRate
      if (ratio > maxMarkup) {
        maxMarkup = ratio
        maxMarkupProcedure = p.commonName
      }
    })
  })

  return {
    totalProcedures:    all.length,
    totalHospitals,
    maxMarkup:          maxMarkup.toFixed(1) + 'x',
    maxMarkupProcedure,
    byCategory,
    mostExpensive,
    cheapest,
    avgByCategory
  }
}

module.exports = { getSummary }
