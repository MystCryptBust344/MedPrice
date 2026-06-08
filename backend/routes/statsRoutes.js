const express = require('express')
const router = express.Router()
const { getSummary } = require('../controllers/statscontroller')

router.get('/summary', getSummary)

module.exports = router