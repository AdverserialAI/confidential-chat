import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { extname, join, normalize } from 'node:path';
import { Transform } from 'node:stream';

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
  api_base_url: process.env.CC_API_BASE_URL || 'https://api.adverserial.ai/v1',
  attestation_url: process.env.CC_ATTESTATION_URL || 'https://api.adverserial.ai/attestation',
  policy_url: process.env.CC_POLICY_URL || 'https://verify.adverserial.ai/policies/production.json',
  billing_base_url: process.env.CC_BILLING_BASE_URL || 'https://billing.adverserial.ai',
  receipt_issuer: process.env.CC_RECEIPT_ISSUER || 'https://verify.adverserial.ai',
  receipt_audience: process.env.CC_RECEIPT_AUDIENCE || 'https://chat.adverserial.ai',
  max_output_tokens: Number(process.env.CC_MAX_OUTPUT_TOKENS || '65536'),
  models: configuredModels
});
const apiBaseURL = new URL(process.env.CC_API_BASE_URL || 'https://api.adverserial.ai/v1');
if (apiBaseURL.protocol !== 'https:' || apiBaseURL.pathname.replace(/\/$/, '') !== '/v1') throw new Error('CC_API_BASE_URL must be an HTTPS /v1 endpoint');
const relayPrefix = '/confidential-relay';
// The relay only sees EHBP ciphertext, but it is still a public internet
// ingress. Keep its upload and concurrency envelope aligned with the CVM's
// encrypted-body guard so a slow or oversized upload cannot exhaust the
// static host before the runtime gets a chance to reject it.
const maxRelayBodyBytes = 9 * 1024 * 1024;
const maxRelayRequests = 16;
const maxRelayUploadMilliseconds = 60_000;
let activeRelayRequests = 0;
const forwardedRequestHeaders = new Set([
  'accept',
  'authorization',
  'content-type',
  'ehbp-encapsulated-key',
  'x-adverserial-nonce'
]);
const forwardedResponseHeaders = new Set([
  'content-type',
  'ehbp-response-nonce',
  'x-adverserial-receipt',
  'content-length'
]);
function headers(type, cacheControl = 'no-cache, max-age=0, must-revalidate') {
  return {
    'content-type': type,
    // The chat bundle is security-sensitive and its filenames are stable.
    // Always revalidate so a client cannot remain on a superseded verifier.
    'cache-control': cacheControl,
    // Browser-side verification needs only these pinned public trust sources in
    // addition to Adverserial services: Phala PCCS supplies Intel TDX collateral
    // and NVIDIA NRAS supplies the public keys for signed GPU EATs.
    'content-security-policy': "default-src 'self'; connect-src 'self' https://api.adverserial.ai https://verify.adverserial.ai https://billing.adverserial.ai https://pccs.phala.network https://nras.attestation.nvidia.com; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'cross-origin-opener-policy': 'same-origin',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  };
}
function relayHeaders(headers) {
  const selected = {};
  for (const [name, value] of Object.entries(headers)) {
    if (forwardedRequestHeaders.has(name.toLowerCase()) && typeof value === 'string') selected[name] = value;
  }
  return selected;
}
function relayResponseHeaders(headers) {
  const selected = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  for (const [name, value] of Object.entries(headers)) {
    if (forwardedResponseHeaders.has(name.toLowerCase()) && typeof value === 'string') selected[name] = value;
  }
  return selected;
}

function relayError(res, status, message) {
  if (res.headersSent || res.writableEnded) return;
  // A rejected relay request must not remain a keep-alive slow-upload socket.
  // The request may have no Content-Length, so leaving it open would bypass the
  // admission counter until the HTTP server timeout expires.
  res.shouldKeepAlive = false;
  res.writeHead(status, { 'cache-control': 'no-store', 'connection': 'close', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify({ error: message }));
}

function relayToAttestedAPI(req, res, pathname) {
  const suffix = pathname.slice(relayPrefix.length);
  if (req.method !== 'POST' || suffix !== '/chat/completions' || typeof req.headers['ehbp-encapsulated-key'] !== 'string') {
    relayError(res, 404, 'not found');
    return;
  }
  const declaredLength = req.headers['content-length'];
  if (typeof declaredLength === 'string' && (!/^(?:0|[1-9][0-9]*)$/.test(declaredLength) || Number(declaredLength) > maxRelayBodyBytes)) {
    relayError(res, 413, 'encrypted request body too large');
    return;
  }
  if (activeRelayRequests >= maxRelayRequests) {
    relayError(res, 503, 'confidential relay is busy; retry shortly');
    return;
  }
  activeRelayRequests += 1;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      activeRelayRequests -= 1;
    }
  };
  let uploadFinished = false;
  let uploadDeadline;
  const clearUploadDeadline = () => {
    if (uploadDeadline) clearTimeout(uploadDeadline);
    uploadDeadline = undefined;
  };
  const upstream = https.request({
    protocol: apiBaseURL.protocol,
    hostname: apiBaseURL.hostname,
    port: apiBaseURL.port || 443,
    method: 'POST',
    path: `${apiBaseURL.pathname.replace(/\/$/, '')}${suffix}`,
    headers: relayHeaders(req.headers),
    rejectUnauthorized: true
  }, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode || 502, relayResponseHeaders(upstreamResponse.headers));
    upstreamResponse.once('end', release);
    upstreamResponse.once('error', release);
    upstreamResponse.pipe(res);
  });
  upstream.on('error', () => {
    relayError(res, 502, 'confidential endpoint unavailable');
    if (!res.writableEnded) res.end();
    release();
  });
  const bodyLimiter = new Transform({
    transform(chunk, _encoding, callback) {
      this.received = (this.received || 0) + chunk.length;
      if (this.received > maxRelayBodyBytes) {
        const error = new Error('encrypted request body too large');
        error.code = 'ERR_RELAY_BODY_TOO_LARGE';
        callback(error);
        return;
      }
      callback(null, chunk);
    }
  });
  bodyLimiter.once('error', (error) => {
    clearUploadDeadline();
    upstream.destroy();
    if (error?.code === 'ERR_RELAY_BODY_TOO_LARGE') relayError(res, 413, 'encrypted request body too large');
    else relayError(res, 400, 'could not read encrypted request body');
    if (!res.writableEnded) res.end();
    req.destroy();
    release();
  });
  req.once('end', () => { uploadFinished = true; clearUploadDeadline(); });
  req.once('aborted', () => { clearUploadDeadline(); upstream.destroy(); release(); });
  req.once('error', () => { clearUploadDeadline(); upstream.destroy(); release(); });
  res.once('finish', release);
  res.once('close', () => { clearUploadDeadline(); upstream.destroy(); release(); });
  uploadDeadline = setTimeout(() => {
    if (uploadFinished) return;
    upstream.destroy();
    relayError(res, 408, 'encrypted request upload timed out');
    if (!res.writableEnded) res.end();
    req.destroy();
    release();
  }, maxRelayUploadMilliseconds);
  uploadDeadline.unref();
  req.pipe(bodyLimiter).pipe(upstream);
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith(`${relayPrefix}/`)) return relayToAttestedAPI(req, res, pathname);
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
  try {
    await access(file);
    // `access()` succeeds for directories. Passing one to createReadStream()
    // emits EISDIR asynchronously; without an error listener Node treats that
    // as an uncaught error and a single public GET can terminate the process.
    // Only serve regular files and keep a handler for an open/read race.
    if (!(await stat(file)).isFile()) throw new Error('not a regular file');
    const stream = createReadStream(file);
    stream.once('error', () => {
      if (!res.headersSent) res.writeHead(500, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
      res.end('internal server error\\n');
    });
    res.writeHead(200, headers(mime[extname(file)] || 'application/octet-stream'));
    stream.pipe(res);
  }
  catch { res.writeHead(404, { 'cache-control': 'no-store', 'content-type': 'text/plain' }); res.end('not found\\n'); }
});
// These apply only to client request headers/body. Inference response streams
// remain unconstrained after the encrypted request upload completes.
server.headersTimeout = 10_000;
server.requestTimeout = maxRelayUploadMilliseconds;
server.keepAliveTimeout = 5_000;
server.listen(port, '0.0.0.0', () => console.log(`cc-chat static server listening on ${port}`));
