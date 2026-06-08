const mongoose = require('mongoose')
const dotenv   = require('dotenv')
const Procedure = require('./models/Procedure')

dotenv.config({ path: require('path').join(__dirname, '.env') })

// Top hospitals in 6 major Indian metropolitan regions with real GPS coordinates
const COORDS = {
  // --- Delhi NCR ---
  'AIIMS Delhi':                     [77.2100, 28.5672],
  'Apollo Delhi':                    [77.2889, 28.5413],
  'Fortis Gurgaon':                  [77.0722, 28.4462],
  'Max Saket':                       [77.2138, 28.5259],
  'Safdarjung Delhi':                [77.2042, 28.5707],

  // --- Mumbai ---
  'Kokilaben Ambani Mumbai':         [72.8258, 19.1312],
  'Tata Memorial Mumbai':            [72.8427, 19.0028],
  'KEM Hospital Mumbai':             [72.8415, 19.0035],
  'Fortis Mulund Mumbai':            [72.9554, 19.1685],
  'Bombay Hospital Mumbai':          [72.8282, 18.9405],

  // --- Bangalore ---
  'NIMHANS Bangalore':               [77.5991, 12.9362],
  'Fortis Bannerghatta Bangalore':   [77.5982, 12.8943],
  'Manipal Hospital Bangalore':      [77.6481, 12.9592],
  'Narayana Health Bangalore':       [77.6917, 12.8123],
  'St Johns Bangalore':              [77.6244, 12.9333],

  // --- Chennai ---
  'Apollo Greams Chennai':           [80.2514, 13.0603],
  'Fortis Malar Chennai':            [80.2570, 13.0076],
  'MMC Hospital Chennai':            [80.2748, 13.0805],
  'MIOT International Chennai':      [80.1802, 13.0232],
  'Gleneagles Global Chennai':       [80.2033, 12.9038],

  // --- Hyderabad ---
  'Yashoda Hospital Hyderabad':      [78.4975, 17.4384],
  'Apollo Jubilee Hills Hyderabad':  [78.4116, 17.4239],
  'NIMS Hospital Hyderabad':         [78.4552, 17.4258],
  'Care Banjara Hyderabad':          [78.4485, 17.4144],
  'KIMS Secunderabad Hyderabad':     [78.4811, 17.4326],

  // --- Kolkata ---
  'SSKM Hospital Kolkata':           [88.3444, 22.5398],
  'Apollo Kolkata':                  [88.4045, 22.5684],
  'Fortis Anandapur Kolkata':        [88.3999, 22.5168],
  'AMRI Hospital Kolkata':           [88.3707, 22.5085],
  'Ruby General Kolkata':            [88.4039, 22.5132]
}

// Map of cities to their seeded hospitals
const CITY_HOSPITALS = {
  'Delhi':     ['AIIMS Delhi', 'Apollo Delhi', 'Fortis Gurgaon', 'Max Saket', 'Safdarjung Delhi'],
  'Mumbai':    ['Kokilaben Ambani Mumbai', 'Tata Memorial Mumbai', 'KEM Hospital Mumbai', 'Fortis Mulund Mumbai', 'Bombay Hospital Mumbai'],
  'Bangalore': ['NIMHANS Bangalore', 'Fortis Bannerghatta Bangalore', 'Manipal Hospital Bangalore', 'Narayana Health Bangalore', 'St Johns Bangalore'],
  'Chennai':   ['Apollo Greams Chennai', 'Fortis Malar Chennai', 'MMC Hospital Chennai', 'MIOT International Chennai', 'Gleneagles Global Chennai'],
  'Hyderabad': ['Yashoda Hospital Hyderabad', 'Apollo Jubilee Hills Hyderabad', 'NIMS Hospital Hyderabad', 'Care Banjara Hyderabad', 'KIMS Secunderabad Hyderabad'],
  'Kolkata':   ['SSKM Hospital Kolkata', 'Apollo Kolkata', 'Fortis Anandapur Kolkata', 'AMRI Hospital Kolkata', 'Ruby General Kolkata']
}

// Generate hospital records for a procedure
function generateHospitalsForProcedure(cghsRate) {
  const list = []
  
  for (const [city, hospNames] of Object.entries(CITY_HOSPITALS)) {
    hospNames.forEach((name, index) => {
      // Index 0: Government (cheap, close to CGHS)
      // Index 1, 2: Private Premium (higher prices, e.g. 2x - 3.5x CGHS)
      // Index 3: Private Standard (1.5x - 2.5x CGHS)
      // Index 4: Trust / Budget (1.1x - 1.8x CGHS)
      
      let type = 'Private'
      let price = cghsRate
      let rating = 3 + (index % 3) // 3, 4, 5 star ratings

      if (index === 0) {
        type = 'Government'
        price = Math.round(cghsRate * (0.9 + Math.random() * 0.15)) // Government discount / baseline
      } else if (index === 4 && city !== 'Delhi') {
        type = 'Trust'
        price = Math.round(cghsRate * (1.1 + Math.random() * 0.4))
      } else {
        // Private markup
        let multiplier = 1.8 + (index * 0.4)
        // Regional variance: Mumbai/Delhi/Bangalore have higher markups
        if (city === 'Mumbai' || city === 'Delhi') {
          multiplier += 0.4
        }
        price = Math.round(cghsRate * multiplier)
      }

      const coords = COORDS[name] || [77.2090, 28.6139]

      list.push({
        name,
        city,
        price,
        type,
        rating,
        contact: `+91 ${city === 'Delhi' ? '11' : city === 'Mumbai' ? '22' : city === 'Bangalore' ? '80' : '44'}-${20000000 + Math.floor(Math.random() * 9999999)}`,
        location: {
          type: 'Point',
          coordinates: coords
        }
      })
    })
  }

  return list
}

const proceduresTemplate = [
  {
    officialName: 'Appendectomy',
    commonName: 'Appendix Surgery',
    cghsRate: 18500,
    category: 'Surgery',
    description: 'Surgical removal of the appendix, usually performed as an emergency procedure.',
    duration: '1-2 hours',
    recovery: '2-3 weeks',
    keywords: ['appendix', 'appendectomy', 'appendix removal']
  },
  {
    officialName: 'Total Knee Arthroplasty',
    commonName: 'Knee Replacement',
    cghsRate: 68000,
    category: 'Surgery',
    description: 'Replacement of damaged knee joint with an artificial implant to relieve pain.',
    duration: '2-3 hours',
    recovery: '6-12 weeks',
    keywords: ['knee', 'knee replacement', 'tkr', 'arthroplasty', 'joint replacement']
  },
  {
    officialName: 'Laparoscopic Cholecystectomy',
    commonName: 'Gallbladder Removal',
    cghsRate: 22000,
    category: 'Surgery',
    description: 'Minimally invasive removal of the gallbladder using a laparoscope.',
    duration: '1-2 hours',
    recovery: '1-2 weeks',
    keywords: ['gallbladder', 'cholecystectomy', 'lap chole', 'gallstone surgery']
  },
  {
    officialName: 'Phacoemulsification with IOL Implantation',
    commonName: 'Cataract Surgery',
    cghsRate: 12000,
    category: 'Surgery',
    description: 'Removal of the clouded eye lens and replacement with an artificial lens.',
    duration: '30-45 minutes',
    recovery: '1-2 weeks',
    keywords: ['cataract', 'eye surgery', 'lens replacement', 'iol', 'phaco']
  },
  {
    officialName: 'Coronary Artery Bypass Grafting',
    commonName: 'Heart Bypass Surgery',
    cghsRate: 150000,
    category: 'Surgery',
    description: 'Surgery to restore blood flow to the heart by bypassing blocked arteries.',
    duration: '4-6 hours',
    recovery: '6-12 weeks',
    keywords: ['bypass', 'cabg', 'heart surgery', 'coronary', 'open heart']
  },
  {
    officialName: 'Magnetic Resonance Imaging Brain',
    commonName: 'MRI Brain Scan',
    cghsRate: 3500,
    category: 'Diagnostic',
    description: 'Non-invasive imaging of the brain using magnetic fields and radio waves.',
    duration: '45-60 minutes',
    recovery: 'None',
    keywords: ['mri', 'brain scan', 'mri brain', 'magnetic resonance', 'neuroimaging']
  },
  {
    officialName: 'Computed Tomography Abdomen with Contrast',
    commonName: 'CT Scan Abdomen',
    cghsRate: 2800,
    category: 'Diagnostic',
    description: 'Detailed cross-sectional imaging of the abdomen to detect abnormalities.',
    duration: '30 minutes',
    recovery: 'None',
    keywords: ['ct scan', 'ct abdomen', 'computed tomography', 'abdomen scan']
  },
  {
    officialName: 'Haemodialysis Session',
    commonName: 'Kidney Dialysis',
    cghsRate: 1200,
    category: 'Therapy',
    description: 'Blood filtration process to replace kidney function in patients with renal failure.',
    duration: '3-4 hours',
    recovery: 'Same day',
    keywords: ['dialysis', 'kidney dialysis', 'haemodialysis', 'renal therapy']
  },
  {
    officialName: 'Percutaneous Transluminal Coronary Angioplasty',
    commonName: 'Angioplasty',
    cghsRate: 95000,
    category: 'Surgery',
    description: 'Procedure to open narrowed or blocked coronary arteries using a balloon catheter.',
    duration: '1-2 hours',
    recovery: '3-5 days',
    keywords: ['angioplasty', 'ptca', 'stent', 'heart blockage', 'coronary angioplasty']
  },
  {
    officialName: 'Hysterectomy Abdominal',
    commonName: 'Uterus Removal Surgery',
    cghsRate: 25000,
    category: 'Surgery',
    description: 'Surgical removal of the uterus, performed for various gynaecological conditions.',
    duration: '2-3 hours',
    recovery: '4-6 weeks',
    keywords: ['hysterectomy', 'uterus removal', 'womb removal', 'gynaecology surgery']
  },
  {
    officialName: 'Electroencephalography',
    commonName: 'EEG Brain Test',
    cghsRate: 800,
    category: 'Diagnostic',
    description: 'Recording of electrical activity in the brain to detect disorders like epilepsy.',
    duration: '45-60 minutes',
    recovery: 'None',
    keywords: ['eeg', 'brain test', 'electroencephalography', 'epilepsy test', 'brain wave test']
  },
  {
    officialName: 'Physiotherapy Session',
    commonName: 'Physiotherapy',
    cghsRate: 200,
    category: 'Therapy',
    description: 'Treatment of physical dysfunction through exercise, manual therapy and education.',
    duration: '45-60 minutes',
    recovery: 'Ongoing',
    keywords: ['physiotherapy', 'physio', 'physical therapy', 'rehab', 'rehabilitation']
  },
  {
    officialName: 'General Physician Consultation',
    commonName: 'Doctor Consultation',
    cghsRate: 300,
    category: 'Consultation',
    description: 'Initial medical consultation with a general physician for diagnosis and advice.',
    duration: '15-30 minutes',
    recovery: 'None',
    keywords: ['consultation', 'doctor visit', 'gp', 'general physician', 'opd']
  },
  {
    officialName: 'Spinal Cord Decompression Surgery',
    commonName: 'Spine Surgery',
    cghsRate: 120000,
    category: 'Surgery',
    description: 'Surgery to relieve pressure on the spinal cord or nerves caused by disc problems.',
    duration: '3-5 hours',
    recovery: '6-12 weeks',
    keywords: ['spine surgery', 'spinal surgery', 'disc surgery', 'back surgery', 'laminectomy']
  },
  {
    officialName: 'Echocardiography Transthoracic',
    commonName: 'Heart Echo Test',
    cghsRate: 1500,
    category: 'Diagnostic',
    description: 'Ultrasound imaging of the heart to assess its structure and function.',
    duration: '30-45 minutes',
    recovery: 'None',
    keywords: ['echo', 'echocardiography', 'heart ultrasound', 'cardiac echo', '2d echo']
  }
]

// Expand the template to populate hospital listings across all 6 cities
const data = proceduresTemplate.map(proc => {
  return {
    ...proc,
    hospitals: generateHospitalsForProcedure(proc.cghsRate)
  }
})

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing in .env')
    process.exit(1)
  }
  
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB for Seeding...')

  await Procedure.deleteMany({})
  console.log('Cleared existing procedures.')

  await Procedure.insertMany(data)
  console.log(`Successfully seeded ${data.length} procedures with multi-city hospitals!`)

  // Create 2dsphere indexes explicitly
  await Procedure.createIndexes()
  console.log('Indexes checked & generated.')

  mongoose.connection.close()
  console.log('Done database seeding.')
}

seed().catch(err => {
  console.log('Seed failed:', err.message)
  process.exit(1)
})