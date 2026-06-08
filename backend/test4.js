require('dotenv').config();
const http = require('http');

http.get('http://localhost:5000/api/procedures?hospital=Apollo+Delhi', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Procedures found for Apollo+Delhi:', json.total);
    process.exit(0);
  });
}).on('error', err => {
  console.error(err);
  process.exit(1);
});
