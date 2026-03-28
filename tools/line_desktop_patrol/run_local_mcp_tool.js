'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const MCP_LAUNCHER = path.join(__dirname, 'run_mcp_server.sh');

function parseMultiFlag(argv, flag) {
  const out = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && typeof argv[index + 1] === 'string') {
      out.push(argv[index + 1]);
      index += 1;
    }
  }
  return out;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (typeof next === 'string' && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  args.expectedReplySubstrings = parseMultiFlag(argv, '--expected-reply-substring');
  args.forbiddenReplySubstrings = parseMultiFlag(argv, '--forbidden-reply-substring');
  return args;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function toInt(value) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) throw new Error(`invalid integer: ${value}`);
  return parsed;
}

function buildDesktopReadinessArguments(args) {
  return args.targetAlias ? { target_alias: args.targetAlias } : {};
}

function buildDesktopLoopArguments(args) {
  return {
    target_alias: requireString(args.targetAlias, 'targetAlias'),
    text: requireString(args.text, 'text'),
    target_confirmation: typeof args.targetConfirmation === 'string' && args.targetConfirmation.trim()
      ? args.targetConfirmation.trim()
      : requireString(args.targetAlias, 'targetAlias'),
    send_mode: args.sendMode,
    observe_seconds: toInt(args.observeSeconds),
    poll_seconds: toInt(args.pollSeconds),
    expected_reply_substrings: args.expectedReplySubstrings,
    forbidden_reply_substrings: args.forbiddenReplySubstrings,
  };
}

function buildExecutionPlan(args) {
  const command = args._[0] || 'state';
  switch (command) {
    case 'state':
      return { kind: 'single', call: { name: 'get_runtime_state', arguments: {} } };
    case 'targets':
      return { kind: 'single', call: { name: 'list_allowed_targets', arguments: {} } };
    case 'desktop-readiness':
      return {
        kind: 'single',
        call: {
          name: 'desktop_readiness',
          arguments: buildDesktopReadinessArguments(args),
        },
      };
    case 'desktop-snapshot':
      return {
        kind: 'single',
        call: {
          name: 'desktop_snapshot',
          arguments: {
            target_alias: requireString(args.targetAlias, 'targetAlias'),
          },
        },
      };
    case 'desktop-loop':
      return {
        kind: 'single',
        call: {
          name: 'desktop_run_conversation_loop',
          arguments: buildDesktopLoopArguments(args),
        },
      };
    case 'desktop-self-test':
      return {
        kind: 'flow',
        name: 'desktop_self_test',
        calls: [
          {
            stage: 'readiness',
            name: 'desktop_readiness',
            arguments: buildDesktopReadinessArguments(args),
          },
          {
            stage: 'loop',
            name: 'desktop_run_conversation_loop',
            arguments: buildDesktopLoopArguments(args),
          },
        ],
      };
    case 'send-text':
      return {
        kind: 'single',
        call: {
          name: 'send_text',
          arguments: {
            target_alias: requireString(args.targetAlias, 'targetAlias'),
            text: requireString(args.text, 'text'),
            target_confirmation: typeof args.targetConfirmation === 'string' && args.targetConfirmation.trim()
              ? args.targetConfirmation.trim()
              : requireString(args.targetAlias, 'targetAlias'),
            send_mode: args.sendMode,
          },
        },
      };
    default:
      throw new Error(`unsupported command: ${command}`);
  }
}

function buildToolCall(args) {
  const plan = buildExecutionPlan(args);
  if (plan.kind !== 'single') {
    throw new Error(`command requires flow execution: ${args._[0] || 'state'}`);
  }
  return plan.call;
}

function getReadinessResult(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.result && typeof payload.result === 'object') {
    return payload.result;
  }
  return payload;
}

function encodeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8'),
    body,
  ]);
}

function createClient(deps) {
  const explicitDeps = deps && typeof deps === 'object' ? deps : {};
  const spawnImpl = typeof explicitDeps.spawn === 'function' ? explicitDeps.spawn : spawn;
  const child = spawnImpl('bash', [MCP_LAUNCHER], {
    cwd: ROOT,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdoutBuffer = Buffer.alloc(0);
  let stderr = '';
  const pending = new Map();

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
    await new Promise((resolve) => child.once('exit', resolve));
  }

  return { child, request, close };
}

async function initializeClient(client) {
  await client.request({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'line-desktop-patrol-local-runner', version: '1.0.0' },
    },
  });
  client.child.stdin.write(encodeMessage({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }));
}

async function callTool(client, id, call) {
  const reply = await client.request({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: call,
  });
  const content = reply.result && Array.isArray(reply.result.content) ? reply.result.content[0] : null;
  const payload = content && typeof content.text === 'string' ? JSON.parse(content.text) : {};
  return {
    ok: reply.result && reply.result.isError !== true,
    toolName: call.name,
    payload,
  };
}

async function runLocalTool(args, deps) {
  const plan = buildExecutionPlan(args);
  const client = createClient(deps);
  try {
    await initializeClient(client);
    if (plan.kind === 'single') {
      return await callTool(client, 2, plan.call);
    }

    const readiness = await callTool(client, 2, plan.calls[0]);
    const readinessResult = getReadinessResult(readiness.payload);
    if (!readiness.ok || readinessResult.ready !== true) {
      return {
        ok: false,
        toolName: plan.name,
        payload: {
          ok: false,
          stage: 'readiness',
          readiness: readiness.payload,
          readinessResult,
          loop: null,
        },
      };
    }

    const loop = await callTool(client, 3, plan.calls[1]);
    return {
      ok: loop.ok,
      toolName: plan.name,
      payload: {
        ok: loop.ok,
        stage: 'loop',
        readiness: readiness.payload,
        readinessResult,
        loop: loop.payload,
      },
    };
  } finally {
    await client.close();
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  const result = await runLocalTool(args);
  const output = JSON.stringify(result.payload, null, 2);
  if (result.ok) {
    process.stdout.write(`${output}\n`);
    return;
  }
  process.stderr.write(`${output}\n`);
  process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildExecutionPlan,
  buildToolCall,
  buildDesktopLoopArguments,
  getReadinessResult,
  createClient,
  callTool,
  initializeClient,
  parseArgs,
  runLocalTool,
};
