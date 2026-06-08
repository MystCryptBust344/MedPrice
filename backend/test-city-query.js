const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Procedure = require('./models/Procedure')

dotenv.config({ path: require('path').join(__dirname, '.env') })

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected.')

  const doc = await Procedure.findOne({ commonName: 'Appendix Surgery' })
  if (doc) {
    console.log(`Document: ${doc.commonName}`)
    console.log(`Number of hospitals nested: ${doc.hospitals.length}`)
    console.log('Sample hospital records (first 8):')
    doc.hospitals.slice(0, 8).forEach((h, i) => {
      console.log(`  [${i}] ${h.name} - City: ${h.city} - Price: ${h.price}`)
    })
    console.log('Sample hospital records (last 8):')
    doc.hospitals.slice(-8).forEach((h, i) => {
      console.log(`  [${i}] ${h.name} - City: ${h.city} - Price: ${h.price}`)
    })
  } else {
    console.log('Not found!')
  }

  mongoose.connection.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
