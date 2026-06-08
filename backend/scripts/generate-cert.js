const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Ensure target directory exists
const configDir = path.join(__dirname, '..', 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

console.log('Generating secure 2048-bit RSA key pair in-memory...');
const keys = forge.pki.rsa.generateKeyPair(2048);

console.log('Creating self-signed X.509 certificate for localhost...');
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8)); // random serial

// Set validity to 365 days
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'IN' },
  { name: 'organizationName', value: 'MedPrice Secure Dev' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// Subject Alternative Names (SAN) is critical so modern browsers trust the cert for localhost
cert.setExtensions([
  {
    name: 'basicConstraints',
    cA: true
  },
  {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  },
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' }, // type 2 is DNS
      { type: 7, ip: '127.0.0.1' }     // type 7 is IP
    ]
  }
]);

// Self-sign the certificate
cert.sign(keys.privateKey, forge.md.sha256.create());

// Export to PEM formats
const pemPrivateKey = forge.pki.privateKeyToPem(keys.privateKey);
const pemCertificate = forge.pki.certificateToPem(cert);

const keyPath = path.join(configDir, 'key.pem');
const certPath = path.join(configDir, 'cert.pem');

fs.writeFileSync(keyPath, pemPrivateKey, 'utf8');
fs.writeFileSync(certPath, pemCertificate, 'utf8');

console.log('✅ Port-Forge SSL Setup successful!');
console.log('   - Private Key: ' + keyPath);
console.log('   - Certificate: ' + certPath);
