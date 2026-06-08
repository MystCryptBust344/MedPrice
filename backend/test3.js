require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/medprice').then(async () => {
  try {
    const service = require('./services/procedureService');
    const hospitalRepo = require('./repositories/hospitalRepository');
    
    const allHospitals = await hospitalRepo.getAllGrouped();
    console.log('Total unique hospitals:', allHospitals.length);
    
    for (let h of allHospitals) {
      const res = await service.searchProcedures({ hospital: h._id });
      console.log(`Hospital: ${h._id} -> Found procedures: ${res.total}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
