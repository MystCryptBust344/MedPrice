const express = require('express')
const router = express.Router()
const {
  getProcedures,
  getProcedureById,
  compareProcedures,
  getByCategory,
  autocomplete,
  getSimilar,
  getNearby
} = require('../controllers/procedureController')

// order matters — specific routes before :id
router.get('/autocomplete', autocomplete)
router.get('/compare', compareProcedures)
router.get('/category/:category', getByCategory)
router.get('/nearby', getNearby)       // NEW — geo-location search
router.get('/', getProcedures)
router.get('/similar/:id', getSimilar)
router.get('/:id', getProcedureById)

module.exports = router