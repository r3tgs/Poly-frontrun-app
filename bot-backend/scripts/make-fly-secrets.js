const fs = require('fs');
const raw = fs.readFileSync('.env', 'utf8');
const m = raw.match(/KALSHI_PRIVATE_KEY=(-----BEGIN[\s\S]+?-----END[^\n-]+-----)/);
if (!m) { console.error('Key not found in .env'); process.exit(1); }
const b64 = Buffer.from(m[1].trim()).toString('base64');
fs.writeFileSync('fly-secrets.env', `KALSHI_PRIVATE_KEY_B64=${b64}\n`);
console.log('Created fly-secrets.env — now run: flyctl secrets import < fly-secrets.env');
