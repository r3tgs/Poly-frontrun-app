// Post-processes the Expo web build:
//   1. Renames the bundle with a timestamp to bust caches.
//   2. Injects iOS home-screen web app meta tags so the status bar is black.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let src = fs.readFileSync(indexPath, 'utf8');

// ── 1. Rename bundle ─────────────────────────────────────────────────────────
const match = src.match(/(_expo\/static\/js\/web\/[^"]+\.js)/);
if (!match) { console.log('No bundle found in index.html'); process.exit(0); }

const oldRel = match[1];
const oldFile = path.join(__dirname, '..', 'dist', oldRel);
const newRel = oldRel.replace('.js', `-${Date.now()}.js`);
const newFile = path.join(__dirname, '..', 'dist', newRel);

fs.renameSync(oldFile, newFile);
src = src.replace(oldRel, newRel);
console.log(`Bundle renamed: ${path.basename(newFile)}`);

// ── 2. Inject iOS status-bar meta tags (only if not already present) ─────────
// "black" = solid black opaque status bar with white icons, no transparency issues.
// Also pin html/body background to #000000 so no white bleeds through anywhere.
const APPLE_INJECT = `    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <style>html,body{background-color:#000000!important;}</style>`;

if (!src.includes('apple-mobile-web-app-capable')) {
  src = src.replace('</head>', `${APPLE_INJECT}\n  </head>`);
  console.log('Injected iOS status-bar meta tags.');
}

fs.writeFileSync(indexPath, src);
