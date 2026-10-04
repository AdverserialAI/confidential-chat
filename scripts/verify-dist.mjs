import { createHash } from 'node:crypto'; import { readFile } from 'node:fs/promises'; import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname; const dist=join(root,'dist'); const manifest=JSON.parse(await readFile(join(dist,'integrity.json'))); let bad=0;
for(const [file,expected] of Object.entries(manifest.assets)){ const value=createHash('sha256').update(await readFile(join(dist,file))).digest('base64'); if(value!==expected.sha256){console.error(`digest mismatch: ${file}`);bad++;} }
if(bad) process.exit(1); console.log(`verified ${Object.keys(manifest.assets).length} immutable assets`);
