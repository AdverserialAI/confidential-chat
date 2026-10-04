import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname; const src=join(root,'src'); const dist=join(root,'dist');
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true}); await cp(src,dist,{recursive:true});
async function files(dir) { const out=[]; for (const entry of await readdir(dir,{withFileTypes:true})) { const full=join(dir,entry.name); if(entry.isDirectory()) out.push(...await files(full)); else out.push(full); } return out; }
const assets={}; for(const file of await files(dist)){ const content=await readFile(file); assets[relative(dist,file)]={sha256:createHash('sha256').update(content).digest('base64'),bytes:content.length}; }
await writeFile(join(dist,'integrity.json'),JSON.stringify({version:1,algorithm:'sha256-base64',assets},null,2)+'\n');
