const fs = require('fs');
const path = require('path');
require('dotenv').config();
const HAR_PATH = process.env.HAR_PATH || '/mnt/data/globalpro.solarmanpv.com.har';

function extractFromHar(harPath) {
  if (!fs.existsSync(harPath)) {
    console.error('HAR file not found at', harPath);
    return null;
  }
  const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));
  const entries = har.log && har.log.entries ? har.log.entries : [];
  for (const e of entries) {
    const req = e.request || {};
    const headers = req.headers || [];
    // Search for Authorization header
    const auth = headers.find(h => (h.name || '').toLowerCase() === 'authorization');
    if (auth && auth.value && auth.value.toLowerCase().startsWith('bearer ')) {
      const token = auth.value.split(' ')[1];
      return token;
    }
    // Search cookies
    const cookieHeader = headers.find(h => (h.name || '').toLowerCase() === 'cookie');
    if (cookieHeader && cookieHeader.value) {
      // find tokenKey=
      const match = cookieHeader.value.match(/tokenKey=([^;\s]+)/);
      if (match) return match[1];
    }
  }
  return null;
}

// Standalone script execution
const token = extractFromHar(HAR_PATH);
if (token) {
  fs.writeFileSync(path.join(__dirname, '..', '.token.cache'), token, 'utf8');
  console.log('Token extracted and saved to .token.cache (do not commit this file)');
  console.log('Token (first 40 chars):', token.slice(0, 40) + '...');
} else {
  console.error('No token found in HAR file.');
}

module.exports = { extractFromHar };