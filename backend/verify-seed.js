const mongoose = require('mongoose')
const dotenv   = require('dotenv')
const Procedure = require('./models/Procedure')

dotenv.config({ path: require('path').join(__dirname, '.env') })

async function verify() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not specified')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Verifying seeded data...')

  const procedures = await Procedure.find({})
  if (procedures.length === 0) {
    throw new Error('Verification Failed: No procedures found in collection')
  }

  const cities = new Set()
  const hospitalCountsByCity = {}
  let totalHospitalsChecked = 0

  procedures.forEach(p => {
    p.hospitals.forEach(h => {
      cities.add(h.city)
      hospitalCountsByCity[h.city] = (hospitalCountsByCity[h.city] || 0) + 1
      totalHospitalsChecked++

      // Validate GeoJSON format
      if (!h.location || h.location.type !== 'Point') {
        throw new Error(`Verification Failed: Hospital ${h.name} is missing GeoJSON Point structure`)
      }
      if (!Array.isArray(h.location.coordinates) || h.location.coordinates.length !== 2) {
        throw new Error(`Verification Failed: Hospital ${h.name} has invalid coordinate array`)
      }
      const [lng, lat] = h.location.coordinates
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        throw new Error(`Verification Failed: Hospital ${h.name} coordinates are not numbers`)
      }
      // Assert typical Indian bounds
      if (lng < 68 || lng > 98 || lat < 6 || lat > 38) {
        throw new Error(`Verification Failed: Coordinates [${lng}, ${lat}] for ${h.name} are outside India bounding box`)
      }
    })
  })

  console.log('--- Seeding Validation Report ---')
  console.log(`Detected Cities: [ ${Array.from(cities).join(', ')} ]`)
  console.log(`Total Hospital Records Checked: ${totalHospitalsChecked}`)

  // Assert exactly 6 cities
  if (cities.size !== 6) {
    throw new Error(`Verification Failed: Expected exactly 6 cities, but found ${cities.size}`)
  }

  // Assert at least 5 hospital records per city
  for (const city of cities) {
    const count = hospitalCountsByCity[city]
    console.log(`  - ${city}: ${count} seeded hospital items`)
    if (count < 5) {
      throw new Error(`Verification Failed: City ${city} only has ${count} hospitals (expected >= 5)`)
    }
  }

  console.log('---------------------------------')
  console.log('✅ Seeding validation passed successfully!')
  mongoose.connection.close()
}

verify().catch(err => {
  console.error('❌ SEED VERIFICATION ERROR:', err.message)
  if (mongoose.connection) mongoose.connection.close()
  process.exit(1)
})
