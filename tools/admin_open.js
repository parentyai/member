'use strict';

const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { createHash } = require('crypto');
const { resolveFirestoreProjectId } = require('../src/infra/firestore');
const {
  runLocalPreflight,
  classifyOperatorRecoveryBranch,
  buildOperatorRecoveryHint
} = require('./admin_local_preflight');

const DEFAULT_PORT = 18080;
const DEFAULT_ENV_NAME = 'stg';
const DEFAULT_HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 45_000;
const HEALTHCHECK_INTERVAL_MS = 400;
const PORT_RELEASE_TIMEOUT_MS = 5_000;

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const out = {
    port: DEFAULT_PORT,
    envName: DEFAULT_ENV_NAME,
    host: DEFAULT_HOST,
    noOpen: false,
    noCopy: false,
    noAdcRepair: false,
    freshServer: false,
    projectId: '',
    token: '',
    tokenFile: '',
    preflight: 'on'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i] || '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--no-open') out.noOpen = true;
    else if (arg === '--no-copy') out.noCopy = true;
    else if (arg === '--no-adc-repair') out.noAdcRepair = true;
    else if (arg === '--fresh-server') out.freshServer = true;
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
      '  --preflight=on|off       Enable/disable local preflight banner (default: on)',
      '  --no-adc-repair          Skip automatic ADC reauth when expired',
      '  --fresh-server           Force restart even when a server already exists on the port',
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

function buildAdminTokenSecretAccessArgs(projectId) {
  return [
    'secrets',
    'versions',
    'access',
    'latest',
    '--secret=ADMIN_OS_TOKEN',
    '--project',
    projectId,
    '--quiet'
  ];
}

function requiresInteractiveGcloudAuth(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return false;
  if (text.includes('reauthentication failed')) return true;
  if (text.includes('cannot prompt during non-interactive execution')) return true;
  return text.includes('gcloud auth login');
}

function resolveAdminToken(opts, deps) {
  const src = deps && typeof deps === 'object' ? deps : {};
  const envSource = src.env && typeof src.env === 'object' ? src.env : process.env;
  const run = typeof src.runCommand === 'function' ? src.runCommand : runCommand;
  const resolveProject = typeof src.resolveProjectId === 'function' ? src.resolveProjectId : resolveProjectId;
  const log = typeof src.log === 'function'
    ? src.log
    : (line) => process.stdout.write(`${line}\n`);

  const envToken = String(envSource.ADMIN_OS_TOKEN || '').trim();
  if (envToken) return { token: envToken, source: 'env:ADMIN_OS_TOKEN' };

  const cliToken = String(opts.token || '').trim();
  if (cliToken) return { token: cliToken, source: 'cli:--token' };

  const fileFromCli = String(opts.tokenFile || '').trim();
  if (fileFromCli) {
    const token = readTokenFromFile(fileFromCli);
    if (token) return { token, source: `file:${fileFromCli}` };
  }

  const fileFromEnv = String(envSource.ADMIN_OS_TOKEN_FILE || '').trim();
  if (fileFromEnv) {
    const token = readTokenFromFile(fileFromEnv);
    if (token) return { token, source: `env:ADMIN_OS_TOKEN_FILE (${fileFromEnv})` };
  }

  const { projectId } = resolveProject(opts.projectId);
  if (!projectId) {
    return {
      token: '',
      source: 'unresolved',
      error: 'project id unavailable (set --project-id, FIRESTORE_PROJECT_ID, or GCP_PROJECT_ID)'
    };
  }

  const secretArgs = buildAdminTokenSecretAccessArgs(projectId);
  let secretRes = run('gcloud', secretArgs);
  if (secretRes.status !== 0 && requiresInteractiveGcloudAuth(secretRes.stderr || secretRes.stdout)) {
    log('[admin:open] gcloud account auth expired; launching browser for gcloud auth login');
    const loginRes = run('gcloud', ['auth', 'login'], {
      stdio: 'inherit'
    });
    if (loginRes.status !== 0) {
      return {
        token: '',
        source: 'unresolved',
        error: `gcloud auth login failed: ${String(loginRes.stderr || loginRes.stdout || 'unknown error').trim()}`
      };
    }
    secretRes = run('gcloud', secretArgs);
  }

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

function requestJson(url, headers) {
  const requestHeaders = headers && typeof headers === 'object' ? headers : {};
  return new Promise((resolve) => {
    const req = http.get(url, { headers: requestHeaders }, (res) => {
      const status = Number(res.statusCode || 0);
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (_err) {
          json = null;
        }
        resolve({ status, json, text });
      });
    });
    req.on('error', (err) => resolve({ status: 0, json: null, text: '', error: err && err.message ? err.message : String(err) }));
    req.setTimeout(4_000, () => {
      req.destroy();
      resolve({ status: 0, json: null, text: '', error: 'timeout' });
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

function evaluateDashboardHealthPayload(payload) {
  if (!payload || payload.ok !== true) {
    return { ok: false, code: 'dashboard_not_ok' };
  }
  if (payload.fallbackBlocked === true || payload.dataSource === 'not_available') {
    return { ok: false, code: 'dashboard_not_available' };
  }
  const registrations = payload.kpis && payload.kpis.registrations;
  if (!registrations || registrations.available !== true) {
    return { ok: false, code: 'dashboard_registrations_unavailable' };
  }
  return { ok: true, code: 'ok' };
}

function evaluateFeatureCatalogHealthPayload(payload) {
  if (!payload || payload.ok !== true) {
    return { ok: false, code: 'feature_catalog_not_ok' };
  }
  if (payload.available === false) {
    return { ok: false, code: 'feature_catalog_unavailable' };
  }
  return { ok: true, code: 'ok' };
}

async function checkExistingServerDataHealth(baseUrl, token) {
  const headers = {
    'x-admin-token': String(token || ''),
    'x-actor': 'admin_open_healthcheck',
    'x-trace-id': `admin_open_health_${Date.now()}`
  };
  const dashboardUrl = `${baseUrl}/api/admin/os/dashboard/kpi?windowMonths=1&fallbackMode=allow&fallbackOnEmpty=true&snapshotRefresh=true`;
  const dashboardRes = await requestJson(dashboardUrl, headers);
  if (dashboardRes.status !== 200) {
    return { ok: false, code: 'dashboard_http_error', status: dashboardRes.status, error: dashboardRes.error || null };
  }
  const dashboardEval = evaluateDashboardHealthPayload(dashboardRes.json);
  if (!dashboardEval.ok) {
    return { ok: false, code: dashboardEval.code, status: dashboardRes.status };
  }
  const featureUrl = `${baseUrl}/api/admin/ops-feature-catalog-status`;
  const featureRes = await requestJson(featureUrl, headers);
  if (featureRes.status !== 200) {
    return { ok: false, code: 'feature_catalog_http_error', status: featureRes.status, error: featureRes.error || null };
  }
  const featureEval = evaluateFeatureCatalogHealthPayload(featureRes.json);
  if (!featureEval.ok) {
    return { ok: false, code: featureEval.code, status: featureRes.status };
  }
  return { ok: true, code: 'ok' };
}

function isLoopbackHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || normalized === '0.0.0.0';
}

function listListeningPidsByPort(port) {
  const res = runCommand('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN']);
  if (res.status !== 0) return [];
  const pids = String(res.stdout || '')
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value !== process.pid);
  return Array.from(new Set(pids));
}

function killPid(pid, signal) {
  const sig = signal || 'TERM';
  if (process.platform === 'win32') {
    runCommand('taskkill', ['/PID', String(pid), '/F']);
    return;
  }
  runCommand('kill', [`-${sig}`, String(pid)]);
}

async function waitUntilPortReleased(loginUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await isServerReady(loginUrl);
    if (!ready) return true;
    await new Promise((resolve) => setTimeout(resolve, HEALTHCHECK_INTERVAL_MS));
  }
  return false;
}

async function stopExistingServerForFreshStart({ port, host, loginUrl }) {
  if (!isLoopbackHost(host)) {
    return { ok: false, code: 'non_loopback_host' };
  }
  const pids = listListeningPidsByPort(port);
  if (!pids.length) {
    const released = await waitUntilPortReleased(loginUrl, PORT_RELEASE_TIMEOUT_MS);
    return released ? { ok: true, code: 'already_released' } : { ok: false, code: 'port_still_busy' };
  }
  pids.forEach((pid) => killPid(pid, 'TERM'));
  let released = await waitUntilPortReleased(loginUrl, PORT_RELEASE_TIMEOUT_MS);
  if (released) return { ok: true, code: 'terminated', pids };
  pids.forEach((pid) => killPid(pid, 'KILL'));
  released = await waitUntilPortReleased(loginUrl, PORT_RELEASE_TIMEOUT_MS);
  return released ? { ok: true, code: 'force_terminated', pids } : { ok: false, code: 'port_still_busy', pids };
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
    else process.stdout.write(`[admin:open] token copy failed (${copied.reason}): ${describeClipboardFailure(copied.reason)}\n`);
  }
  if (!opts.noOpen) {
    const opened = openUrl(loginUrl);
    process.stdout.write(opened
      ? '[admin:open] browser opened\n'
      : `[admin:open] browser open failed; open manually: ${loginUrl}\n`);
  }
}

function resolveProbeClassification(preflightResult) {
  const checks = preflightResult && typeof preflightResult === 'object'
    ? preflightResult.checks
    : null;
  const probe = checks && typeof checks.firestoreProbe === 'object'
    ? checks.firestoreProbe
    : null;
  const raw = probe && (probe.classification || probe.code)
    ? (probe.classification || probe.code)
    : '';
  return String(raw || '').trim().toUpperCase();
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function pickPrimaryRecoveryCommand(commands) {
  const list = Array.isArray(commands) ? commands : [];
  const executable = list
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry && !entry.startsWith('#'));
  if (!executable.length) return '';
  const preferred = executable.find((entry) => entry.includes('npm run admin:preflight'));
  return preferred || executable[0];
}

function buildAdminOpenPreflightAdvice(preflightResult) {
  const result = preflightResult && typeof preflightResult === 'object' ? preflightResult : {};
  const summary = result.summary && typeof result.summary === 'object' ? result.summary : {};
  const code = normalizeCode(summary.code || resolveProbeClassification(result) || 'LOCAL_PREFLIGHT_UNKNOWN');
  const operatorBranch = classifyOperatorRecoveryBranch(summary);
  const operatorHint = buildOperatorRecoveryHint(operatorBranch);
  const cause = String(summary.cause || '').trim();
  const action = String(summary.action || '').trim();
  const nextCommand = pickPrimaryRecoveryCommand(summary.recoveryCommands);
  return {
    ready: result.ready !== false,
    code,
    operatorBranch,
    operatorHint,
    cause,
    action,
    nextCommand
  };
}

function printAdminOpenPreflightAdvice(stage, advice, log) {
  const label = String(stage || 'probe').trim() || 'probe';
  const logger = typeof log === 'function'
    ? log
    : (line) => process.stdout.write(`${line}\n`);
  const src = advice && typeof advice === 'object' ? advice : {};
  logger(`[admin:open] preflight.${label} code=${normalizeCode(src.code || 'LOCAL_PREFLIGHT_UNKNOWN')} branch=${src.operatorBranch || 'UNKNOWN'} ready=${src.ready === false ? 'false' : 'true'}`);
  if (src.cause) logger(`[admin:open] preflight.${label} cause=${src.cause}`);
  if (src.action) logger(`[admin:open] preflight.${label} action=${src.action}`);
  if (src.operatorHint) logger(`[admin:open] preflight.${label} hint=${src.operatorHint}`);
  if (src.nextCommand) logger(`[admin:open] preflight.${label} next=${src.nextCommand}`);
}

function describeHealthcheckFailure(code) {
  const normalized = normalizeCode(code);
  if (normalized === 'DASHBOARD_HTTP_ERROR') return 'ダッシュボード取得に失敗したため既存プロセスを再起動します。';
  if (normalized === 'DASHBOARD_NOT_AVAILABLE') return 'ダッシュボードが情報不足状態のため既存プロセスを再起動します。';
  if (normalized === 'DASHBOARD_REGISTRATIONS_UNAVAILABLE') return '登録者数KPIが取得できないため既存プロセスを再起動します。';
  if (normalized === 'FEATURE_CATALOG_HTTP_ERROR' || normalized === 'FEATURE_CATALOG_UNAVAILABLE') {
    return '機能カタログ状態が取得できないため既存プロセスを再起動します。';
  }
  return '既存プロセスのヘルスチェックに失敗したため再起動します。';
}

function describeClipboardFailure(reason) {
  const normalized = String(reason || '').trim().toLowerCase();
  if (normalized === 'pbcopy_failed') {
    return 'pbcopy に失敗しました。ターミナルのクリップボード権限を確認し、必要なら --no-copy で起動を継続してください。';
  }
  if (normalized === 'clip_failed') {
    return 'clip に失敗しました。管理者権限で再実行するか --no-copy で起動を継続してください。';
  }
  if (normalized === 'clipboard_command_missing') {
    return 'クリップボードコマンドが見つかりません。xclip/xsel を導入するか --no-copy で起動を継続してください。';
  }
  return 'トークンコピーに失敗しました。--no-copy で起動し、手動で貼り付けてください。';
}

async function maybeRepairAdcForLocalReadPath(opts, projectId) {
  if (opts.noAdcRepair) return { attempted: false, skipped: 'disabled' };
  if (!projectId) return { attempted: false, skipped: 'project_id_unavailable' };

  const probeEnv = Object.assign({}, process.env, {
    FIRESTORE_PROJECT_ID: projectId
  });
  const before = await runLocalPreflight({
    env: probeEnv,
    allowGcloudProjectIdDetect: true
  });
  const beforeAdvice = buildAdminOpenPreflightAdvice(before);
  printAdminOpenPreflightAdvice('before', beforeAdvice);
  const beforeClassification = resolveProbeClassification(before);
  if (beforeClassification !== 'ADC_REAUTH_REQUIRED') {
    return { attempted: false, skipped: 'not_required', beforeClassification, beforeAdvice };
  }

  process.stdout.write('[admin:open] ADC expired; launching browser for gcloud application-default login\n');
  const loginRes = runCommand('gcloud', ['auth', 'application-default', 'login'], {
    stdio: 'inherit'
  });
  if (loginRes.status !== 0) {
    throw new Error('ADC再認証に失敗しました。gcloud auth application-default login を手動実行してください。');
  }
  const tokenRes = runCommand('gcloud', ['auth', 'application-default', 'print-access-token']);
  if (tokenRes.status !== 0 || !String(tokenRes.stdout || '').trim()) {
    throw new Error('ADC再認証後のアクセストークン確認に失敗しました。gcloud auth application-default print-access-token を確認してください。');
  }

  const after = await runLocalPreflight({
    env: probeEnv,
    allowGcloudProjectIdDetect: true
  });
  const afterAdvice = buildAdminOpenPreflightAdvice(after);
  printAdminOpenPreflightAdvice('after', afterAdvice);
  const afterClassification = resolveProbeClassification(after);
  if (afterClassification === 'ADC_REAUTH_REQUIRED') {
    throw new Error('ADC再認証後も Firestore read-only probe が失敗しています。service account 鍵または権限設定を確認してください。');
  }

  return {
    attempted: true,
    repaired: true,
    beforeClassification,
    afterClassification,
    beforeAdvice,
    afterAdvice
  };
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

  const adcRepair = await maybeRepairAdcForLocalReadPath(opts, project.projectId);

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
      `[admin:open] adc=${adcRepair.attempted ? 'repaired' : 'ok'}`,
      `[admin:open] preflight=${serverEnv.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1 === '0' ? 'off' : 'on'}`,
      `[admin:open] mode=${opts.freshServer ? 'fresh-server' : 'auto'}`,
      ''
    ].join('\n')
  );

  const alreadyRunning = await isServerReady(loginUrl);
  if (alreadyRunning) {
    if (!opts.freshServer) {
      const health = await checkExistingServerDataHealth(baseUrl, tokenResolved.token);
      if (health.ok) {
        process.stdout.write('[admin:open] existing server detected, reuse current process\n');
        process.stdout.write('[admin:open] mode=reuse-server\n');
        applyLocalAccessActions(loginUrl, tokenResolved.token, opts);
        process.stdout.write('[admin:open] ready\n');
        return;
      }
      process.stdout.write(`[admin:open] existing server health check failed (${health.code}): ${describeHealthcheckFailure(health.code)}\n`);
    } else {
      process.stdout.write('[admin:open] existing server detected, fresh-server requested\n');
    }
    const stopped = await stopExistingServerForFreshStart({ port, host, loginUrl });
    if (!stopped.ok) {
      throw new Error(`既存サーバの停止に失敗しました (${stopped.code})。別ポートで実行するか、手動で停止してください。`);
    }
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
  process.stdout.write('[admin:open] mode=fresh-server\n');
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
  resolveAdminToken,
  maybeRepairAdcForLocalReadPath,
  resolveProbeClassification,
  buildAdminOpenPreflightAdvice,
  evaluateDashboardHealthPayload,
  evaluateFeatureCatalogHealthPayload
};
