const decode = new TextDecoder();
const encode = new TextEncoder();

const base64Url = (value) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const arrayBuffer = (value) => { const copy = new Uint8Array(value.byteLength); copy.set(value); return copy.buffer; };
const digest = async (value) => {
  const result = await crypto.subtle.digest('SHA-256', arrayBuffer(encode.encode(value)));
  let binary = ''; for (const byte of new Uint8Array(result)) binary += String.fromCharCode(byte);
  return `sha256:${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')}`;
};
const object = (value) => typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
const text = (value) => typeof value === 'string' && value ? value : null;
const audienceMatches = (value, expected) => value === expected || (Array.isArray(value) && value.includes(expected));

/**
 * Verify the proxy's signed response receipt. All inputs are local request,
 * response, and already-verified attestation values; this makes no network
 * call and never exposes prompt text to another service.
 */
export async function verifyInferenceReceipt({ receipt, receiptPublicKey, issuer, audience, modelId, requestNonce, requestBody, responseBody, tlsSpkiSha256, attestationStateDigest, now = Date.now }) {
  const parts = typeof receipt === 'string' ? receipt.split('.') : [];
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('The inference response has no valid signed receipt.');
  let header; let claims;
  try { header = object(JSON.parse(decode.decode(base64Url(parts[0])))); claims = object(JSON.parse(decode.decode(base64Url(parts[1])))); }
  catch { throw new Error('The inference receipt has invalid JSON.'); }
  if (!header || !claims || header.alg !== 'ES256' || typeof header.kid !== 'string') throw new Error('The inference receipt has an unexpected signature format.');
  if (!receiptPublicKey || receiptPublicKey.kty !== 'EC' || receiptPublicKey.crv !== 'P-256' || receiptPublicKey.kid !== header.kid) throw new Error('The inference receipt key is not the attested key.');
  const key = await crypto.subtle.importKey('jwk', receiptPublicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, arrayBuffer(base64Url(parts[2])), encode.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('The inference receipt signature is invalid.');
  const issuedAt = claims.iat; const expiresAt = claims.exp; const seconds = Math.floor(now() / 1000);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= seconds || issuedAt > seconds + 60) throw new Error('The inference receipt is expired or not yet valid.');
  if (text(claims.iss) !== issuer || !audienceMatches(claims.aud, audience)) throw new Error('The inference receipt is not intended for this chat client.');
  if (text(claims.model_id) !== modelId || text(claims.request_nonce) !== requestNonce) throw new Error('The inference receipt is not bound to this model request.');
  if (text(claims.request_body_hash) !== await digest(requestBody) || text(claims.response_hash) !== await digest(responseBody)) throw new Error('The inference receipt does not match the request or response bytes.');
  const binding = object(claims.attestation_binding);
  if (!binding || text(binding.tls_spki_sha256) !== tlsSpkiSha256 || text(binding.evidence_digest) !== attestationStateDigest) throw new Error('The inference receipt does not match the verified attestation state.');
  return { issuedAt, expiresAt, usage: object(claims.usage) };
}
