const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('mongodb connected')
  } catch (err) {
    console.log('db connection failed:', err.message)
    process.exit(1)
  }
}

module.exports = connectDB