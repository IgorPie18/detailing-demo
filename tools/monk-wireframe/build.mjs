import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// 4 modele dopasowane do wielkości aut w salonie: miejskie, sedan, SUV, duży SUV
const MODELS = ['ffocus18', 'haccord', 'fesc20', 'jgc21'];
const all = JSON.parse(readFileSync(require.resolve('@monkvision/sights/lib/data/wireframes.json'), 'utf8'));
writeFileSync('wire-data.json', JSON.stringify(Object.fromEntries(MODELS.map((m) => [m, all[m]]))));
await build({
  entryPoints: ['entry.jsx'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: '../../assets/monk-wireframe.js', define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@monkvision/common': './shim-common.js', '@monkvision/sights': './shim-sights.js' },
  banner: { js: '/* Schemat uszkodzeń: MonkJS VehicleDynamicWireframe (c) Monk, Inc., BSD-3-Clause-Clear, https://github.com/monkvision/monkjs ; React (c) Meta, MIT. Licencje: monk-wireframe.LICENSE.txt */' },
  legalComments: 'none',
});
console.log('OK', readFileSync('../../assets/monk-wireframe.js').length, 'B');
