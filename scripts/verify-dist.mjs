import { createHash } from 'node:crypto'; import { readFile } from 'node:fs/promises'; import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname; const dist=join(root,'dist'); const manifest=JSON.parse(await readFile(join(dist,'integrity.json'))); let bad=0;
for(const [file,expected] of Object.entries(manifest.assets)){ const value=createHash('sha256').update(await readFile(join(dist,file))).digest('base64'); if(value!==expected.sha256){console.error(`digest mismatch: ${file}`);bad++;} }
const build=JSON.parse(await readFile(join(dist,'build-info.json')));
const expected=`sha256:${createHash('sha256').update(await readFile(join(dist,'integrity.json'))).digest('hex')}`;
if(build.integrity_sha256 !== expected || !build.source_commit || build.source_commit === 'unversioned'){ console.error('build provenance metadata is incomplete'); bad++; }
if(bad) process.exit(1); console.log(`verified ${Object.keys(manifest.assets).length} immutable assets`);
