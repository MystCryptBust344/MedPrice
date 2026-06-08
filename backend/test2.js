require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/medprice').then(async () => {
  try {
    const service = require('./services/procedureService');
    const res = await service.searchProcedures({ hospital: 'Medanta' });
    console.log('Total procedures for Medanta:', res.total);
    if(res.total > 0) {
      console.log('First procedure:', res.procedures[0].commonName);
      console.log('Hospital Price:', res.procedures[0].hospitalPrice);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
