// Compiles src/input.css -> css/app.css by scanning the HTML and JS for Tailwind classes.
// Usage:  npm install tailwindcss@4  &&  node build.mjs
// (Or use the official CLI:  npx @tailwindcss/cli -i src/input.css -o css/app.css --minify)
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let twDir; try { twDir = path.dirname(require.resolve('tailwindcss/package.json')); } catch { twDir = '/opt/npm-tools/node_modules/tailwindcss'; }
const { compile } = await import(path.join(twDir, 'dist/lib.mjs'));
const input = fs.readFileSync('src/input.css', 'utf8');
const c = await compile(input, { base: twDir, loadStylesheet: async (id, b) => { const f = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(b, id); return { content: fs.readFileSync(f, 'utf8'), base: path.dirname(f), path: f }; } });
const files = [...fs.readdirSync('.').filter(f => f.endsWith('.html')), ...fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
const cands = new Set(files.flatMap(f => fs.readFileSync(f, 'utf8').match(/[A-Za-z0-9_\-:\/\[\]\.#%()!]+/g) || []));
fs.mkdirSync('css', { recursive: true });
fs.writeFileSync('css/app.css', c.build([...cands]));
console.log('css/app.css written');
