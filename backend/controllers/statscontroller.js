// HTTP layer only: call statsService - send response.

const service = require('../services/statsService')

const getSummary = async (req, res) => {
  try {
    const result = await service.getSummary()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getSummary }