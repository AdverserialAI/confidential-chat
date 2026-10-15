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

function get(port, path) {
	return new Promise((resolve, reject) => {
		http.get({ hostname: '127.0.0.1', port, path }, (res) => {
			let data = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => resolve({ status: res.statusCode, data }));
		}).once('error', reject);
	});
}

function rejectedSlowUpload(port) {
	return new Promise((resolve, reject) => {
		const socket = net.connect(port, '127.0.0.1');
		let response = '';
		const timeout = setTimeout(() => {
			socket.destroy();
			reject(new Error('rejected upload socket did not close promptly'));
		}, 1_000);
		timeout.unref();
		socket.once('connect', () => {
			socket.write('POST /confidential-relay/chat/completions HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nContent-Type: application/json\r\nConnection: keep-alive\r\n\r\n5\r\nhello\r\n');
		});
		socket.on('data', (chunk) => { response += chunk; });
		socket.once('error', (error) => { clearTimeout(timeout); reject(error); });
		socket.once('close', () => { clearTimeout(timeout); resolve(response); });
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


test('relay closes rejected slow uploads instead of retaining a keep-alive body', async (t) => {
	let port;
	let child;
	try {
		port = await freePort();
		child = await startChat(port);
	} catch (error) {
		if (error?.code === 'EPERM') {
			t.skip('local listener creation is blocked by the sandbox');
			return;
		}
		throw error;
	}
	t.after(() => child.kill('SIGTERM'));
	const response = await rejectedSlowUpload(port);
	assert.match(response, /^HTTP\/1\.1 404 /);
	assert.match(response.toLowerCase(), /\r\nconnection: close\r\n/);
});

test('static directory request cannot terminate the public chat server', async (t) => {
	let port;
	let child;
	try {
		port = await freePort();
		child = await startChat(port);
	} catch (error) {
		if (error?.code === 'EPERM') {
			t.skip('local listener creation is blocked by the sandbox');
			return;
		}
		throw error;
	}
	t.after(() => child.kill('SIGTERM'));
	const response = await get(port, '/vendor');
	assert.equal(response.status, 404);
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(child.exitCode, null);
});
