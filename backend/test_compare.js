require('dotenv').config();
const http = require('http');

http.get('http://localhost:5000/api/procedures', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const procedures = json.procedures;
    if (procedures.length >= 2) {
      const ids = procedures[0]._id + ',' + procedures[1]._id;
      console.log('Testing compare with ids:', ids);
      
      http.get('http://localhost:5000/api/procedures/compare?ids=' + ids, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          console.log('Compare response:', data2.slice(0, 200));
          process.exit(0);
        });
      });
    } else {
      console.log('Not enough procedures found');
      process.exit(1);
    }
  });
});//

