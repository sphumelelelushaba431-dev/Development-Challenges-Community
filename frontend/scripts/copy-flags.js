/* Copy the flag SVGs needed by the phone country picker into the static assets. */
const fs = require('fs');
const path = require('path');
const { getCountries } = require('libphonenumber-js');

const source = path.join(__dirname, '..', 'node_modules', 'flag-icons', 'flags', '4x3');
const target = path.join(__dirname, '..', 'images', 'flags');
fs.mkdirSync(target, { recursive: true });

const aliases = { AC: 'sh', TA: 'sh' }; // Saint Helena, Ascension and Tristan da Cunha share a flag.
const missing = [];
let copied = 0;
getCountries().forEach(function (code) {
  const flag = aliases[code] || code.toLowerCase();
  const file = code.toLowerCase() + '.svg';
  const from = path.join(source, flag + '.svg');
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(target, file));
    copied += 1;
  } else {
    missing.push(code);
  }
});
console.log('Copied ' + copied + ' flags. Missing: ' + (missing.join(', ') || 'none'));
