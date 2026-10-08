import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
test('pinned browser SDK is present and matches its published source lock', async () => {
  const lock = JSON.parse(await readFile(join(root, 'src/vendor/adverserial-confidential-sdk.lock.json')));
  const source = await readFile(join(root, 'src/vendor/adverserial-confidential-sdk.js'));
  assert.match(lock.source_commit, /^[0-9a-f]{40}$/);
  assert.equal(createHash('sha256').update(source).digest('hex'), lock.sha256);
  assert.match(source.toString('utf8', 0, 1024), /AdverserialConfidentialSDK/);
});

test('chat client has no plaintext confidential request fallback', async () => {
  const app = await readFile(join(root, 'src/app.js'), 'utf8');
  assert.match(app, /createVerifiedOpenAI/);
  assert.match(app, /createPhalaNVIDIAVerifier/);
  assert.match(app, /active public policy/);
  assert.doesNotMatch(app, /AdverserialHardwareVerifier/);
  assert.doesNotMatch(app, /token\.value=''/);
  assert.match(app, /trustedReceiptKeys:state\.policy\.receipt_keys/);
  assert.match(app, /confidentialRelayFetch/);
  assert.match(app, /fetchImpl: confidentialRelayFetch/);
  assert.match(app, /EHBP private key/);
});
