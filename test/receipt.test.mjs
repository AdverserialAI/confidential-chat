import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { verifyInferenceReceipt } from '../src/receipt.js';

const b64 = (value) => Buffer.from(value).toString('base64url');
const hash = (value) => `sha256:${createHash('sha256').update(value).digest('base64url')}`;

test('receipt binds the signed request, response, model, and attestation state', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const receiptPublicKey = { ...publicKey.export({ format: 'jwk' }), kid: 'receipt-key' };
  const requestBody = '{"model":"lordx64/cyberglm","messages":[]}';
  const responseBody = '{"id":"r1","choices":[]}';
  const claims = { iss:'https://verify.adverserial.ai', aud:'cc-chat.adverserial.ai', iat:1_800_000_000, exp:1_800_000_060, model_id:'lordx64/cyberglm', request_nonce:'nonce', request_body_hash:hash(requestBody), response_hash:hash(responseBody), attestation_binding:{tls_spki_sha256:'sha256:tls',evidence_digest:'sha256:state'}, usage:{input_tokens:3,cached_tokens:1,output_tokens:2} };
  const header = { alg:'ES256', kid:'receipt-key', typ:'JWT' };
  const signingInput = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;
  const receipt = `${signingInput}.${sign('sha256', Buffer.from(signingInput), { key:privateKey, dsaEncoding:'ieee-p1363' }).toString('base64url')}`;
  const options = { receipt, receiptPublicKey, issuer:claims.iss, audience:claims.aud, modelId:claims.model_id, requestNonce:'nonce', requestBody, responseBody, tlsSpkiSha256:'sha256:tls', attestationStateDigest:'sha256:state', now:() => 1_800_000_000_000 };
  const verified = await verifyInferenceReceipt(options);
  assert.equal(verified.usage.output_tokens, 2);
  await assert.rejects(() => verifyInferenceReceipt({ ...options, responseBody:'{}' }), /response bytes/);
  await assert.rejects(() => verifyInferenceReceipt({ ...options, requestNonce:'different' }), /model request/);
});
