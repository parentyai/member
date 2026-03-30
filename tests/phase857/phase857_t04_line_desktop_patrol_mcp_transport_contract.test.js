'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');

function encodeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8'),
    body
  ]);
}

function createClient() {
  const child = spawn('python3', ['-m', 'member_line_patrol.mcp_server'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdoutBuffer = Buffer.alloc(0);
  const pending = new Map();
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    while (true) {
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = stdoutBuffer.slice(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        throw new Error(`missing content-length header: ${header}`);
      }
      const length = Number(match[1]);
      const frameEnd = headerEnd + 4 + length;
      if (stdoutBuffer.length < frameEnd) break;
      const body = stdoutBuffer.slice(headerEnd + 4, frameEnd).toString('utf8');
      stdoutBuffer = stdoutBuffer.slice(frameEnd);
      const payload = JSON.parse(body);
      const slot = pending.get(payload.id);
      if (slot) {
        pending.delete(payload.id);
        slot.resolve(payload);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  function request(message) {
    return new Promise((resolve, reject) => {
      pending.set(message.id, { resolve, reject });
      child.stdin.write(encodeMessage(message));
    });
  }

  async function close() {
    for (const slot of pending.values()) {
      slot.reject(new Error(`server closed early: ${stderr}`));
    }
    pending.clear();
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', () => resolve()));
  }

  return { child, request, close };
}

test('phase857: line desktop patrol MCP server exposes guarded send_text tool', async () => {
  const client = createClient();
  try {
    const initialized = await client.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'phase857', version: '1.0.0' }
      }
    });
    assert.equal(initialized.result.serverInfo.name, 'member-line-desktop-patrol');
    assert.ok(initialized.result.capabilities.tools);

    client.child.stdin.write(encodeMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    }));

    const tools = await client.request({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    const names = tools.result.tools.map((tool) => tool.name);
    assert.ok(names.includes('get_runtime_state'));
    assert.ok(names.includes('list_allowed_targets'));
    assert.ok(names.includes('send_text'));
    assert.ok(names.includes('desktop_readiness'));
    assert.ok(names.includes('desktop_snapshot'));
    assert.ok(names.includes('desktop_run_conversation_loop'));

    const listTargets = await client.request({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'list_allowed_targets',
        arguments: {}
      }
    });
    const targetPayload = JSON.parse(listTargets.result.content[0].text);
    assert.equal(targetPayload.ok, true);
    assert.equal(targetPayload.targets[0].alias, 'sample-self-test');
    assert.equal(targetPayload.targets[0].executeReady, false);
    assert.equal(targetPayload.targets[0].desktopUiEligible, false);

    const blockedSend = await client.request({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'send_text',
        arguments: {
          target_alias: 'sample-self-test',
          text: 'hello from test',
          target_confirmation: 'sample-self-test',
          send_mode: 'dry_run'
        }
      }
    });
    const sendPayload = JSON.parse(blockedSend.result.content[0].text);
    assert.equal(blockedSend.result.isError, true);
    assert.equal(sendPayload.code, 'policy_disabled');
  } finally {
    await client.close();
  }
});

test('phase857: desktop MCP transport preserves explicit session logout error codes from the bridge', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tools', 'line_desktop_patrol', 'src', 'member_line_patrol', 'mcp_server.py'), 'utf8');
  assert.match(source, /classify_desktop_bridge_error/);
  assert.match(source, /desktop_session_logged_out/);
  assert.match(source, /payload_or_text\.get\("errorCode"\)/);
});
