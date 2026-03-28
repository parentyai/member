'use strict';

const crypto = require('node:crypto');

const { pushMessage } = require('../../src/infra/lineClient');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function buildTextMessage(text) {
  return { type: 'text', text };
}

function deriveRetryKey(runId) {
  const normalized = requireString(runId, 'runId');
  const digest = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 32).split('');
  if (digest.length < 32) {
    throw new Error('retry key seed unavailable');
  }
  digest[12] = '5';
  const variant = parseInt(digest[16], 16);
  digest[16] = ((variant & 0x3) | 0x8).toString(16);
  return [
    digest.slice(0, 8).join(''),
    digest.slice(8, 12).join(''),
    digest.slice(12, 16).join(''),
    digest.slice(16, 20).join(''),
    digest.slice(20, 32).join('')
  ].join('-');
}

async function sendTextViaLineClient(params, deps) {
  const payload = params || {};
  const explicitDeps = deps || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');
  const text = requireString(payload.text, 'text');
  const runId = requireString(payload.runId, 'runId');
  const pushFn = typeof explicitDeps.pushFn === 'function' ? explicitDeps.pushFn : pushMessage;
  const retryKey = deriveRetryKey(runId);
  const startedAt = new Date().toISOString();
  const response = await pushFn(lineUserId, buildTextMessage(text), { retryKey });
  const finishedAt = new Date().toISOString();
  return {
    ok: true,
    lineUserIdMasked: `${lineUserId.slice(0, 3)}***${lineUserId.slice(-2)}`,
    textLength: text.length,
    retryKey,
    providerStatus: response && Number.isInteger(response.status) ? response.status : null,
    providerBodyPresent: Boolean(response && typeof response.body === 'string' && response.body.length > 0),
    startedAt,
    finishedAt
  };
}

function parseArgs(argv) {
  const opts = {
    lineUserId: '',
    text: '',
    runId: ''
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--line-user-id') {
      opts.lineUserId = requireString(argv[++i], '--line-user-id');
      continue;
    }
    if (arg === '--text') {
      opts.text = requireString(argv[++i], '--text');
      continue;
    }
    if (arg === '--run-id') {
      opts.runId = requireString(argv[++i], '--run-id');
      continue;
    }
    throw new Error(`unknown arg: ${arg}`);
  }
  return opts;
}

async function main() {
  const result = await sendTextViaLineClient(parseArgs(process.argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildTextMessage,
  deriveRetryKey,
  sendTextViaLineClient
};
