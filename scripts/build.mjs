import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname; const src=join(root,'src'); const dist=join(root,'dist');
let gitCommit = '';
try { gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch {}
const sourceCommit = process.env.CC_CHAT_SOURCE_COMMIT || process.env.SOURCE_VERSION || process.env.GITHUB_SHA || gitCommit || 'unversioned';
const buildId = sourceCommit.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'unversioned';
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true}); await cp(src,dist,{recursive:true});
const indexPath = join(dist, 'index.html');
const index = await readFile(indexPath, 'utf8');
if (!index.includes('__BUILD_ID__')) throw new Error('index.html is missing the build asset marker');
await writeFile(indexPath, index.replaceAll('__BUILD_ID__', buildId));
async function files(dir) { const out=[]; for (const entry of await readdir(dir,{withFileTypes:true})) { const full=join(dir,entry.name); if(entry.isDirectory()) out.push(...await files(full)); else out.push(full); } return out; }
const assets={}; for(const file of await files(dist)){ const content=await readFile(file); assets[relative(dist,file)]={sha256:createHash('sha256').update(content).digest('base64'),bytes:content.length}; }
const integrity = JSON.stringify({version:1,algorithm:'sha256-base64',assets},null,2)+'\n';
await writeFile(join(dist,'integrity.json'),integrity);
const buildInfo = {
  version: 1,
  source_repository: process.env.CC_CHAT_SOURCE_REPOSITORY || 'https://github.com/AdverserialAI/confidential-chat',
  source_commit: sourceCommit,
  integrity_sha256: `sha256:${createHash('sha256').update(integrity).digest('hex')}`,
  provenance: `${process.env.CC_CHAT_SOURCE_REPOSITORY || 'https://github.com/AdverserialAI/confidential-chat'}/actions`,
  generated_at: new Date().toISOString()
};
await writeFile(join(dist,'build-info.json'),JSON.stringify(buildInfo,null,2)+'\n');
