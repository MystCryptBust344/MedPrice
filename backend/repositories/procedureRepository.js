// DB repository

const Procedure = require('../models/Procedure')

// Full-text search
async function textSearch(q, skip, limit) {
  try {
    const results = await Procedure.aggregate([
      {
        $search: {
          index: "default",
          text: {
            query: q,
            path: ["commonName", "officialName", "keywords", "description"]
          }
        }
      },
      {
        $addFields: {
          bm25_score: { $meta: "searchScore" }
        }
      },
      { $skip: skip },
      { $limit: limit }
    ])
    return results.map(doc => Procedure.hydrate(doc))
  } catch (err) {
    // Graceful fallback for local development or missing index
    return Procedure.find({ $text: { $search: q } })
      .skip(skip)
      .limit(limit)
  }
}

async function countTextSearch(q) {
  try {
    const results = await Procedure.aggregate([
      {
        $search: {
          index: "default",
          text: {
            query: q,
            path: ["commonName", "officialName", "keywords", "description"]
          }
        }
      },
      {
        $count: "total"
      }
    ])
    return results.length > 0 ? results[0].total : 0;
  } catch (err) {
    return Procedure.countDocuments({ $text: { $search: q } })
  }
}

// Generic find
function findAll(query, sortOption, skip, limit) {
  return Procedure.find(query).sort(sortOption).skip(skip).limit(limit)
}

function countAll(query) {
  return Procedure.countDocuments(query)
}

// Lookup by ID
function findById(id) {
  return Procedure.findById(id)
}

// Bulk lookup
function findByIds(ids) {
  return Procedure.find({ _id: { $in: ids } })
}

// Category lookup
function findByCategory(category, limit) {
  return Procedure.find({ category }).limit(limit)
}

// Typeahead autocomplete
async function autocompleteSearch(q, limit) {
  try {
    const results = await Procedure.aggregate([
      {
        $search: {
          index: "default",
          text: {
            query: q,
            path: ["commonName", "officialName"]
          }
        }
      },
      {
        $project: {
          score: { $meta: "searchScore" },
          commonName: 1,
          category: 1,
          cghsRate: 1
        }
      },
      { $limit: limit }
    ])
    return results.map(doc => Procedure.hydrate(doc))
  } catch (err) {
    return Procedure.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' }, commonName: 1, category: 1, cghsRate: 1 }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
  }
}

// Similar procedures
function findSimilar(excludeId, category, low, high, limit) {
  return Procedure.find({
    _id:      { $ne: excludeId },
    category,
    cghsRate: { $gte: low, $lte: high }
  })
    .sort({ cghsRate: 1 })
    .limit(limit)
    .select('commonName officialName category cghsRate')
}

// Find nearby procedures
function findNear(lng, lat, maxDistance) {
  return Procedure.aggregate([
    {
      $geoNear: {
        near:          { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'nearestHospitalDistance',
        maxDistance,
        spherical:     true,
        // Embedded array search
        key: 'hospitals.location'
      }
    },
    { $limit: 20 }
  ])
}

module.exports = {
  textSearch,
  countTextSearch,
  findAll,
  countAll,
  findById,
  findByIds,
  findByCategory,
  autocompleteSearch,
  findSimilar,
  findNear
}
