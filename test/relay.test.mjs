import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

test('same-origin relay is constrained to encrypted confidential completions', async () => {
  const server = await readFile(join(root, 'server.mjs'), 'utf8');
  assert.match(server, /const relayPrefix = '\/confidential-relay'/);
  assert.match(server, /req\.method !== 'POST' \|\| suffix !== '\/chat\/completions'/);
  assert.match(server, /ehbp-encapsulated-key/);
  assert.match(server, /hostname: apiBaseURL\.hostname/);
  assert.match(server, /rejectUnauthorized: true/);
  assert.match(server, /const forwardedRequestHeaders = new Set/);
  assert.doesNotMatch(server, /console\.log\(.*req/);
});
