'use strict';

const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { createHash } = require('crypto');
const { resolveFirestoreProjectId } = require('../src/infra/firestore');

const DEFAULT_PORT = 18080;
const DEFAULT_ENV_NAME = 'stg';
const DEFAULT_HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 45_000;
const HEALTHCHECK_INTERVAL_MS = 400;

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const out = {
    port: DEFAULT_PORT,
    envName: DEFAULT_ENV_NAME,
    host: DEFAULT_HOST,
    noOpen: false,
    noCopy: false,
    projectId: '',
    token: '',
    tokenFile: '',
    preflight: 'off'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i] || '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--no-open') out.noOpen = true;
    else if (arg === '--no-copy') out.noCopy = true;
    else if (arg === '--preflight=on') out.preflight = 'on';
    else if (arg === '--preflight=off') out.preflight = 'off';
    else if (arg.startsWith('--port=')) out.port = Number(arg.slice('--port='.length)) || DEFAULT_PORT;
    else if (arg.startsWith('--env-name=')) out.envName = arg.slice('--env-name='.length).trim() || DEFAULT_ENV_NAME;
    else if (arg.startsWith('--host=')) out.host = arg.slice('--host='.length).trim() || DEFAULT_HOST;
    else if (arg.startsWith('--project-id=')) out.projectId = arg.slice('--project-id='.length).trim();
    else if (arg.startsWith('--token=')) out.token = arg.slice('--token='.length).trim();
    else if (arg.startsWith('--token-file=')) out.tokenFile = arg.slice('--token-file='.length).trim();
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: npm run admin:open -- [options]',
      '',
      'Options:',
      '  --port=<number>          Local server port (default: 18080)',
      '  --env-name=<name>        ENV_NAME for local server (default: stg)',
      '  --host=<host>            Host for URL generation (default: 127.0.0.1)',
      '  --project-id=<id>        Firestore/GCP project id override',
      '  --token=<value>          ADMIN_OS_TOKEN override',
      '  --token-file=<path>      Read ADMIN_OS_TOKEN from file',
      '  --preflight=on|off       Enable/disable local preflight banner (default: off)',
      '  --no-open                Do not open browser automatically',
      '  --no-copy                Do not copy token to clipboard',
      '  -h, --help               Show this help',
      ''
    ].join('\n')
  );
}

function readTokenFromFile(filePath) {
  if (!filePath) return null;
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const token = String(text || '').trim();
    return token || null;
  } catch (_err) {
    return null;
  }
}

function runCommand(cmd, args, options) {
  try {
    const res = spawnSync(cmd, args, Object.assign({
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }, options || {}));
    return res;
  } catch (err) {
    return {
      status: 1,
      stdout: '',
      stderr: err && err.message ? err.message : String(err)
    };
  }
}

function resolveProjectId(cliProjectId) {
  const cli = String(cliProjectId || '').trim();
  if (cli) return { projectId: cli, source: 'cli' };
  const resolved = resolveFirestoreProjectId({ allowGcloud: true });
  if (resolved && resolved.projectId) return resolved;
  return { projectId: '', source: 'unresolved' };
}

function resolveAdminToken(opts) {
  const envToken = String(process.env.ADMIN_OS_TOKEN || '').trim();
  if (envToken) return { token: envToken, source: 'env:ADMIN_OS_TOKEN' };

  const cliToken = String(opts.token || '').trim();
  if (cliToken) return { token: cliToken, source: 'cli:--token' };

  const fileFromCli = String(opts.tokenFile || '').trim();
  if (fileFromCli) {
    const token = readTokenFromFile(fileFromCli);
    if (token) return { token, source: `file:${fileFromCli}` };
  }

  const fileFromEnv = String(process.env.ADMIN_OS_TOKEN_FILE || '').trim();
  if (fileFromEnv) {
    const token = readTokenFromFile(fileFromEnv);
    if (token) return { token, source: `env:ADMIN_OS_TOKEN_FILE (${fileFromEnv})` };
  }

  const { projectId } = resolveProjectId(opts.projectId);
  if (!projectId) {
    return {
      token: '',
      source: 'unresolved',
      error: 'project id unavailable (set --project-id, FIRESTORE_PROJECT_ID, or GCP_PROJECT_ID)'
    };
  }

  const secretRes = runCommand('gcloud', [
    'secrets',
    'versions',
    'access',
    'latest',
    '--secret=ADMIN_OS_TOKEN',
    '--project',
    projectId,
    '--quiet'
  ]);
  if (secretRes.status === 0) {
    const token = String(secretRes.stdout || '').trim();
    if (token) return { token, source: `secretmanager:${projectId}/ADMIN_OS_TOKEN` };
  }

  return {
    token: '',
    source: 'unresolved',
    error: String(secretRes.stderr || secretRes.stdout || 'failed to resolve ADMIN_OS_TOKEN').trim()
  };
}

function requestStatus(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      const status = Number(res.statusCode || 0);
      res.resume();
      resolve(status);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(2_000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

async function isServerReady(url) {
  const status = await requestStatus(url);
  return status === 200 || status === 302;
}

async function waitUntilReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await isServerReady(url);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, HEALTHCHECK_INTERVAL_MS));
  }
  return false;
}

function openUrl(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    return runCommand('open', [url]).status === 0;
  }
  if (platform === 'win32') {
    return runCommand('cmd', ['/c', 'start', '', url]).status === 0;
  }
  return runCommand('xdg-open', [url]).status === 0;
}

function copyToClipboard(text) {
  const token = String(text || '');
  if (!token) return { ok: false, reason: 'empty' };
  const platform = process.platform;

  if (platform === 'darwin') {
    const res = runCommand('pbcopy', [], { input: token, encoding: 'utf8' });
    return { ok: res.status === 0, reason: res.status === 0 ? 'pbcopy' : 'pbcopy_failed' };
  }
  if (platform === 'win32') {
    const res = runCommand('clip', [], { input: token, encoding: 'utf8' });
    return { ok: res.status === 0, reason: res.status === 0 ? 'clip' : 'clip_failed' };
  }

  const xclip = runCommand('xclip', ['-selection', 'clipboard'], { input: token, encoding: 'utf8' });
  if (xclip.status === 0) return { ok: true, reason: 'xclip' };
  const xsel = runCommand('xsel', ['--clipboard', '--input'], { input: token, encoding: 'utf8' });
  if (xsel.status === 0) return { ok: true, reason: 'xsel' };
  return { ok: false, reason: 'clipboard_command_missing' };
}

function digestPrefix(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

function startServer(env) {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: process.cwd(),
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  });
  if (child.stdout) child.stdout.pipe(process.stdout);
  if (child.stderr) child.stderr.pipe(process.stderr);
  return child;
}

function applyLocalAccessActions(loginUrl, token, opts) {
  if (!opts.noCopy) {
    const copied = copyToClipboard(token);
    if (copied.ok) process.stdout.write(`[admin:open] token copied to clipboard (${copied.reason})\n`);
    else process.stdout.write('[admin:open] token copy skipped (clipboard command unavailable)\n');
  }
  if (!opts.noOpen) {
    const opened = openUrl(loginUrl);
    process.stdout.write(opened
      ? '[admin:open] browser opened\n'
      : `[admin:open] browser open failed; open manually: ${loginUrl}\n`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const project = resolveProjectId(opts.projectId);
  if (!project.projectId) {
    throw new Error('project id を解決できませんでした。--project-id か FIRESTORE_PROJECT_ID を指定してください。');
  }

  const tokenResolved = resolveAdminToken(opts);
  if (!tokenResolved.token) {
    throw new Error(
      `ADMIN_OS_TOKEN を解決できませんでした。` +
      `${tokenResolved.error ? ` (${tokenResolved.error})` : ''}`
    );
  }

  const port = Number(opts.port) || DEFAULT_PORT;
  const host = String(opts.host || DEFAULT_HOST).trim();
  const baseUrl = `http://${host}:${port}`;
  const loginUrl = `${baseUrl}/admin/login`;

  const serverEnv = Object.assign({}, process.env, {
    PORT: String(port),
    ENV_NAME: String(opts.envName || DEFAULT_ENV_NAME),
    FIRESTORE_PROJECT_ID: project.projectId,
    ADMIN_OS_TOKEN: tokenResolved.token
  });
  if (opts.preflight === 'off') serverEnv.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1 = '0';
  if (opts.preflight === 'on') serverEnv.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1 = '1';

  process.stdout.write(
    [
      `[admin:open] projectId=${project.projectId} (${project.source || 'unknown'})`,
      `[admin:open] tokenSource=${tokenResolved.source} sha256=${digestPrefix(tokenResolved.token)}...`,
      `[admin:open] url=${loginUrl}`,
      `[admin:open] preflight=${serverEnv.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1 === '0' ? 'off' : 'on'}`,
      ''
    ].join('\n')
  );

  const alreadyRunning = await isServerReady(loginUrl);
  if (alreadyRunning) {
    process.stdout.write('[admin:open] existing server detected, reuse current process\n');
    applyLocalAccessActions(loginUrl, tokenResolved.token, opts);
    process.stdout.write('[admin:open] ready\n');
    return;
  }

  const server = startServer(serverEnv);
  let stopped = false;

  const stopHandler = (signal) => {
    if (stopped) return;
    stopped = true;
    process.stdout.write(`\n[admin:open] ${signal} received, stopping server...\n`);
    server.kill('SIGINT');
  };
  process.on('SIGINT', () => stopHandler('SIGINT'));
  process.on('SIGTERM', () => stopHandler('SIGTERM'));

  const ready = await waitUntilReady(loginUrl, STARTUP_TIMEOUT_MS);
  if (!ready) {
    server.kill('SIGINT');
    throw new Error(`起動待機がタイムアウトしました (${STARTUP_TIMEOUT_MS}ms): ${loginUrl}`);
  }

  applyLocalAccessActions(loginUrl, tokenResolved.token, opts);
  process.stdout.write('[admin:open] ready (Ctrl+C to stop)\n');

  await new Promise((resolve, reject) => {
    server.on('exit', (code, signal) => {
      if (stopped) return resolve();
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') return resolve();
      reject(new Error(`server exited unexpectedly (code=${code}, signal=${signal || 'none'})`));
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  main().catch((err) => {
    const message = err && err.message ? err.message : String(err);
    process.stderr.write(`[admin:open] ${message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  resolveProjectId,
  resolveAdminToken
};
