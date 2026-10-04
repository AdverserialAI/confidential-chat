import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('build emits an integrity manifest', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/verify-dist.mjs'], { stdio: 'inherit' });
  assert.ok(true);
});
