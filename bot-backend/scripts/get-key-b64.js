const fs = require('fs');
const raw = fs.readFileSync('.env', 'utf8');
const m = raw.match(/KALSHI_PRIVATE_KEY=(-----BEGIN[\s\S]+?-----END[^\n-]+-----)/);
if (!m) { console.error('Key not found in .env'); process.exit(1); }
console.log(Buffer.from(m[1].trim()).toString('base64'));
