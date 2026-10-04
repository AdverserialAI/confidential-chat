import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(new URL('.', import.meta.url).pathname, 'dist');
const port = Number(process.env.PORT || 8080);
const mime = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const defaultModels = [{ id: 'lordx64/cyberglm', label: 'CyberGLM' }];
let configuredModels = defaultModels;
if (process.env.CC_MODELS_JSON) {
  try { const candidate = JSON.parse(process.env.CC_MODELS_JSON); if (Array.isArray(candidate) && candidate.every((m) => m && typeof m.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}\/[a-z0-9][a-z0-9._-]{0,127}$/.test(m.id))) configuredModels = candidate; else throw new Error('invalid model list'); }
  catch { throw new Error('CC_MODELS_JSON must be a JSON array of canonical model IDs'); }
}
const config = JSON.stringify({
  version: 1,
  api_base_url: process.env.CC_API_BASE_URL || 'https://cc-api.adverserial.ai/v1',
  attestation_url: process.env.CC_ATTESTATION_URL || 'https://cc-api.adverserial.ai/attestation',
  policy_url: process.env.CC_POLICY_URL || 'https://verify.adverserial.ai/policies/production.json',
  billing_base_url: process.env.CC_BILLING_BASE_URL || 'https://billing.adverserial.ai',
  receipt_issuer: process.env.CC_RECEIPT_ISSUER || 'https://verify.adverserial.ai',
  receipt_audience: process.env.CC_RECEIPT_AUDIENCE || 'cc-chat.adverserial.ai',
  max_output_tokens: Number(process.env.CC_MAX_OUTPUT_TOKENS || '65536'),
  models: configuredModels
});
function headers(type) {
  return {
    'content-type': type,
    'cache-control': 'public, max-age=31536000, immutable',
    'content-security-policy': "default-src 'self'; connect-src 'self' https://cc-api.adverserial.ai https://verify.adverserial.ai https://billing.adverserial.ai; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'cross-origin-opener-policy': 'same-origin',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  };
}
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/healthz') { res.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'text/plain' }); return res.end('ok\\n'); }
  if (pathname === '/config.json') { res.writeHead(200, { ...headers('application/json; charset=utf-8'), 'cache-control': 'no-store' }); return res.end(config); }
  if (pathname === '/.well-known/adverserial-build.json') {
    const body = await readFile(join(root, 'build-info.json'));
    res.writeHead(200, { ...headers('application/json; charset=utf-8'), 'cache-control': 'no-store' });
    return res.end(body);
  }
  const requested = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^[/\\\\]+/, '');
  const file = join(root, requested);
  if (!file.startsWith(root)) { res.writeHead(400).end(); return; }
  try { await access(file); res.writeHead(200, headers(mime[extname(file)] || 'application/octet-stream')); createReadStream(file).pipe(res); }
  catch { res.writeHead(404, { 'cache-control': 'no-store', 'content-type': 'text/plain' }); res.end('not found\\n'); }
}).listen(port, '0.0.0.0', () => console.log(`cc-chat static server listening on ${port}`));
