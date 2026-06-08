const express = require('express')
const router = express.Router()
const { getAllHospitals, getHospitalProcedures, getNearbyHospitals, compareHospitals } = require('../controllers/hospitalController')

// /nearby and /compare must lead before parameters to avoid Express parameter-shadowing
router.get('/nearby',                 getNearbyHospitals)
router.get('/compare',                compareHospitals)
router.get('/',                       getAllHospitals)
router.get('/:name/procedures',       getHospitalProcedures)

module.exports = router