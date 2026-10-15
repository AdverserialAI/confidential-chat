import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const maxRelayBodyBytes = 9 * 1024 * 1024;

async function freePort() {
	const listener = net.createServer();
	listener.listen(0, '127.0.0.1');
	await once(listener, 'listening');
	const { port } = listener.address();
	await new Promise((resolve) => listener.close(resolve));
	return port;
}

async function startChat(port) {
	const child = spawn(process.execPath, ['server.mjs'], {
		cwd: root,
		env: { ...process.env, PORT: String(port), CC_API_BASE_URL: 'https://127.0.0.1:1/v1' },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let output = '';
	child.stdout.on('data', (chunk) => { output += chunk; });
	child.stderr.on('data', (chunk) => { output += chunk; });
	const deadline = Date.now() + 5_000;
	while (!output.includes('cc-chat static server listening')) {
		if (child.exitCode !== null) throw new Error(`chat server exited early: ${output}`);
		if (Date.now() > deadline) throw new Error(`chat server did not start: ${output}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return child;
}

function post(port, body) {
	return new Promise((resolve, reject) => {
		const req = http.request({
			hostname: '127.0.0.1', port, method: 'POST', path: '/confidential-relay/chat/completions',
			headers: {
				'content-type': 'application/json',
				'content-length': body.length,
				'ehbp-encapsulated-key': '00'
			}
		}, (res) => {
			let data = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => resolve({ status: res.statusCode, data }));
		});
		req.once('error', reject);
		req.end(body);
	});
}

test('relay rejects an oversized encrypted request before opening an upstream request', async (t) => {
	let port;
	let child;
	try {
		port = await freePort();
		child = await startChat(port);
	} catch (error) {
		// The managed static-analysis sandbox deliberately forbids listeners.
		// Normal CI executes the end-to-end assertion below.
		if (error?.code === 'EPERM') {
			t.skip('local listener creation is blocked by the sandbox');
			return;
		}
		throw error;
	}
	t.after(() => child.kill('SIGTERM'));
	const response = await post(port, Buffer.alloc(maxRelayBodyBytes + 1));
	assert.equal(response.status, 413);
	assert.match(response.data, /encrypted request body too large/);
});
