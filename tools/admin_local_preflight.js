'use strict';

const fs = require('fs');
const path = require('path');

function normalizeMessage(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return String(err);
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeLowerText(value) {
  return String(value || '').toLowerCase();
}

function evaluateCredentialsPath(env, fsApi) {
  const envSource = env && typeof env === 'object' ? env : process.env;
  const fsSource = fsApi && typeof fsApi === 'object' ? fsApi : fs;
  const raw = typeof envSource.GOOGLE_APPLICATION_CREDENTIALS === 'string'
    ? envSource.GOOGLE_APPLICATION_CREDENTIALS.trim()
    : '';
  if (!raw) {
    return {
      key: 'credentialsPath',
      status: 'ok',
      code: 'CREDENTIALS_PATH_UNSET',
      message: 'GOOGLE_APPLICATION_CREDENTIALS は未設定です（ADC既定を利用）。',
      value: null
    };
  }

  let stats;
  try {
    stats = fsSource.statSync(raw);
  } catch (err) {
    return {
      key: 'credentialsPath',
      status: 'error',
      code: 'CREDENTIALS_PATH_INVALID',
      message: `GOOGLE_APPLICATION_CREDENTIALS を参照できません: ${normalizeMessage(err)}`,
      value: raw
    };
  }

  if (!stats.isFile()) {
    return {
      key: 'credentialsPath',
      status: 'error',
      code: 'CREDENTIALS_PATH_NOT_FILE',
      message: 'GOOGLE_APPLICATION_CREDENTIALS はファイルを指していません。',
      value: raw
    };
  }

  return {
    key: 'credentialsPath',
    status: 'ok',
    code: 'CREDENTIALS_PATH_OK',
    message: 'GOOGLE_APPLICATION_CREDENTIALS は有効なファイルです。',
    value: raw
  };
}

function evaluateProjectId(env) {
  const envSource = env && typeof env === 'object' ? env : process.env;
  const raw = typeof envSource.FIRESTORE_PROJECT_ID === 'string'
    ? envSource.FIRESTORE_PROJECT_ID.trim()
    : '';
  if (!raw) {
    return {
      key: 'firestoreProjectId',
      status: 'warn',
      code: 'FIRESTORE_PROJECT_ID_MISSING',
      message: 'FIRESTORE_PROJECT_ID が未設定です。',
      value: null
    };
  }
  return {
    key: 'firestoreProjectId',
    status: 'ok',
    code: 'FIRESTORE_PROJECT_ID_OK',
    message: 'FIRESTORE_PROJECT_ID を確認しました。',
    value: raw
  };
}

function classifyProbeError(message) {
  const text = normalizeLowerText(message);
  if (text.includes('could not load the default credentials')
    || text.includes('failed to read credentials')
    || text.includes('google_application_credentials')
    || text.includes('enotdir')
    || text.includes('enoent')) {
    return 'FIRESTORE_CREDENTIALS_ERROR';
  }
  if (text.includes('project id')) return 'FIRESTORE_PROJECT_ID_ERROR';
  if (text.includes('permission') || text.includes('unauthorized') || text.includes('forbidden')) {
    return 'FIRESTORE_PERMISSION_ERROR';
  }
  return 'FIRESTORE_PROBE_FAILED';
}

function classifyFirestoreProbeClassification(message) {
  const text = normalizeLowerText(message);
  if (text.includes('invalid_rapt')
    || text.includes('invalid_grant')
    || text.includes('reauth related error')
    || text.includes('getting metadata from plugin failed')) {
    return 'ADC_REAUTH_REQUIRED';
  }
  if (text.includes('firestore_probe_timeout')
    || text.includes('deadline exceeded')
    || text.includes('timed out')
    || text.includes('timeout')) {
    return 'FIRESTORE_TIMEOUT';
  }
  if (text.includes('permission denied')
    || text.includes('unauthorized')
    || text.includes('forbidden')
    || text.includes('permission')) {
    return 'FIRESTORE_PERMISSION_ERROR';
  }
  if (text.includes('unavailable')
    || text.includes('network')
    || text.includes('econnreset')
    || text.includes('eai_again')
    || text.includes('enotfound')
    || text.includes('socket hang up')
    || text.includes('connection reset')
    || text.includes('etimedout')) {
    return 'FIRESTORE_NETWORK_ERROR';
  }
  return 'FIRESTORE_UNKNOWN';
}

const RECOVERY_COMMANDS = Object.freeze({
  RUN_ADC_REAUTH: Object.freeze([
    'unset GOOGLE_APPLICATION_CREDENTIALS',
    'gcloud auth application-default login',
    'gcloud auth application-default print-access-token',
    'npm run admin:preflight'
  ]),
  CHECK_FIRESTORE_TIMEOUT: Object.freeze([
    'gcloud auth application-default print-access-token',
    'export FIRESTORE_PROJECT_ID=<your-project-id>',
    'npm run admin:preflight'
  ]),
  CHECK_FIRESTORE_NETWORK: Object.freeze([
    'gcloud auth application-default print-access-token',
    'curl -sS -H "x-admin-token: <token>" -H "x-actor: local-check" http://127.0.0.1:8080/api/admin/local-preflight',
    'npm run admin:preflight'
  ]),
  CHECK_FIRESTORE_PERMISSION: Object.freeze([
    'gcloud auth application-default print-access-token',
    'gcloud projects get-iam-policy <your-project-id> --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"',
    'npm run admin:preflight'
  ]),
  CHECK_FIRESTORE_UNKNOWN: Object.freeze([
    'npm run admin:preflight',
    'curl -sS -H "x-admin-token: <token>" -H "x-actor: local-check" http://127.0.0.1:8080/api/admin/local-preflight'
  ]),
  FIX_CREDENTIALS_PATH: Object.freeze([
    'unset GOOGLE_APPLICATION_CREDENTIALS',
    'gcloud auth application-default login',
    'npm run admin:preflight'
  ]),
  SET_FIRESTORE_PROJECT_ID: Object.freeze([
    'export FIRESTORE_PROJECT_ID=<your-project-id>',
    'npm run admin:preflight'
  ])
});

function resolveRecoveryCommands(actionCode) {
  const commands = RECOVERY_COMMANDS[actionCode];
  return Array.isArray(commands) ? commands.slice() : [];
}

function buildErrorSummary(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const message = source.message || 'ローカル前提条件の確認に失敗しました。';
  const code = normalizeCode(source.code || 'LOCAL_PREFLIGHT_ERROR');
  const rawHint = String(message);

  if (source.key === 'firestoreProbe') {
    const classification = normalizeCode(source.classification || 'FIRESTORE_UNKNOWN');
    if (classification === 'ADC_REAUTH_REQUIRED') {
      return {
        code: 'ADC_REAUTH_REQUIRED',
        tone: 'danger',
        category: 'auth',
        cause: 'ADC認証が期限切れでFirestore接続に失敗しました。',
        impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
        action: 'ADCを再認証して再診断してください。',
        recoveryActionCode: 'RUN_ADC_REAUTH',
        recoveryCommands: resolveRecoveryCommands('RUN_ADC_REAUTH'),
        primaryCheckKey: 'firestoreProbe',
        rawHint,
        retriable: true
      };
    }
    if (classification === 'FIRESTORE_TIMEOUT') {
      return {
        code: 'FIRESTORE_TIMEOUT',
        tone: 'danger',
        category: 'connectivity',
        cause: 'Firestore read-only probeがタイムアウトしました。',
        impact: 'ダッシュボード等の取得が遅延または失敗します。',
        action: '接続状態と認証状態を確認して再診断してください。',
        recoveryActionCode: 'CHECK_FIRESTORE_TIMEOUT',
        recoveryCommands: resolveRecoveryCommands('CHECK_FIRESTORE_TIMEOUT'),
        primaryCheckKey: 'firestoreProbe',
        rawHint,
        retriable: true
      };
    }
    if (classification === 'FIRESTORE_NETWORK_ERROR') {
      return {
        code: 'FIRESTORE_NETWORK_ERROR',
        tone: 'danger',
        category: 'connectivity',
        cause: 'Firestoreへのネットワーク到達性に問題があります。',
        impact: 'Firestore依存APIが断続的に失敗します。',
        action: 'ネットワーク疎通と認証状態を確認して再診断してください。',
        recoveryActionCode: 'CHECK_FIRESTORE_NETWORK',
        recoveryCommands: resolveRecoveryCommands('CHECK_FIRESTORE_NETWORK'),
        primaryCheckKey: 'firestoreProbe',
        rawHint,
        retriable: true
      };
    }
    if (classification === 'FIRESTORE_PERMISSION_ERROR') {
      return {
        code: 'FIRESTORE_PERMISSION_ERROR',
        tone: 'danger',
        category: 'permission',
        cause: 'Firestoreアクセス権限が不足しています。',
        impact: '管理画面のFirestore依存操作が拒否されます。',
        action: '利用中アカウントの権限を確認して再診断してください。',
        recoveryActionCode: 'CHECK_FIRESTORE_PERMISSION',
        recoveryCommands: resolveRecoveryCommands('CHECK_FIRESTORE_PERMISSION'),
        primaryCheckKey: 'firestoreProbe',
        rawHint,
        retriable: true
      };
    }
    return {
      code: 'FIRESTORE_UNKNOWN',
      tone: 'danger',
      category: 'unknown',
      cause: 'Firestore接続で未分類エラーが発生しました。',
      impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
      action: '詳細ヒントを確認し、再診断してください。',
      recoveryActionCode: 'CHECK_FIRESTORE_UNKNOWN',
      recoveryCommands: resolveRecoveryCommands('CHECK_FIRESTORE_UNKNOWN'),
      primaryCheckKey: 'firestoreProbe',
      rawHint,
      retriable: true
    };
  }

  if (code === 'CREDENTIALS_PATH_INVALID' || code === 'CREDENTIALS_PATH_NOT_FILE' || code === 'FIRESTORE_CREDENTIALS_ERROR') {
    return {
      code: 'CREDENTIALS_PATH_INVALID',
      tone: 'danger',
      category: 'auth',
      cause: message,
      impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
      action: '認証情報を修正して再診断してください。',
      recoveryActionCode: 'FIX_CREDENTIALS_PATH',
      recoveryCommands: resolveRecoveryCommands('FIX_CREDENTIALS_PATH'),
      primaryCheckKey: source.key || 'credentialsPath',
      rawHint,
      retriable: true
    };
  }

  return {
    code,
    tone: 'danger',
    category: 'unknown',
    cause: message,
    impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
    action: 'ローカル前提条件を確認して再診断してください。',
    recoveryActionCode: 'CHECK_FIRESTORE_UNKNOWN',
    recoveryCommands: resolveRecoveryCommands('CHECK_FIRESTORE_UNKNOWN'),
    primaryCheckKey: source.key || null,
    rawHint,
    retriable: true
  };
}

function buildWarnSummary(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const message = source.message || 'ローカル前提条件に警告があります。';
  const code = normalizeCode(source.code || 'LOCAL_PREFLIGHT_WARN');
  if (code === 'FIRESTORE_PROJECT_ID_MISSING' || code === 'FIRESTORE_PROJECT_ID_ERROR') {
    return {
      code: 'FIRESTORE_PROJECT_ID_MISSING',
      tone: 'warn',
      category: 'config',
      cause: message,
      impact: '一部環境では管理APIが不安定になる可能性があります。',
      action: 'FIRESTORE_PROJECT_ID を設定して再診断してください。',
      recoveryActionCode: 'SET_FIRESTORE_PROJECT_ID',
      recoveryCommands: resolveRecoveryCommands('SET_FIRESTORE_PROJECT_ID'),
      primaryCheckKey: source.key || 'firestoreProjectId',
      rawHint: String(message),
      retriable: true
    };
  }
  return {
    code,
    tone: 'warn',
    category: 'config',
    cause: message,
    impact: '一部環境では管理APIが不安定になる可能性があります。',
    action: 'ローカル環境変数を見直し、必要値を設定してください。',
    recoveryActionCode: 'SET_FIRESTORE_PROJECT_ID',
    recoveryCommands: resolveRecoveryCommands('SET_FIRESTORE_PROJECT_ID'),
    primaryCheckKey: source.key || null,
    rawHint: String(message),
    retriable: true
  };
}

async function probeFirestoreReadOnly(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const timeoutMs = Number.isFinite(Number(opts.timeoutMs)) ? Number(opts.timeoutMs) : 2500;
  const getDb = typeof opts.getDb === 'function'
    ? opts.getDb
    : require('../src/infra/firestore').getDb;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`firestore_probe_timeout:${timeoutMs}`));
    }, timeoutMs);
  });
  const run = (async () => {
    const db = getDb();
    if (!db || typeof db.listCollections !== 'function') {
      throw new Error('firestore_db_unavailable');
    }
    await db.listCollections();
    return {
      key: 'firestoreProbe',
      status: 'ok',
      code: 'FIRESTORE_PROBE_OK',
      message: 'Firestore read-only probe succeeded.'
    };
  })();
  try {
    return await Promise.race([run, timeout]);
  } catch (err) {
    const message = normalizeMessage(err);
    const classification = classifyFirestoreProbeClassification(message);
    return {
      key: 'firestoreProbe',
      status: 'error',
      code: classifyProbeError(message),
      classification,
      message: `Firestore read-only probe failed: ${message}`
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildSummary(checks) {
  const list = checks && typeof checks === 'object'
    ? Object.values(checks)
    : [];
  const errors = list.filter((entry) => entry && entry.status === 'error');
  const warns = list.filter((entry) => entry && entry.status === 'warn');

  if (errors.length > 0) {
    return buildErrorSummary(errors[0]);
  }

  if (warns.length > 0) {
    return buildWarnSummary(warns[0]);
  }

  return {
    code: 'LOCAL_PREFLIGHT_OK',
    tone: 'ok',
    category: 'ok',
    cause: 'ローカル前提条件は正常です。',
    impact: 'Firestore依存APIを含む管理機能を実行できます。',
    action: 'この状態を維持して運用確認を続けてください。',
    recoveryActionCode: 'NONE',
    recoveryCommands: [],
    primaryCheckKey: null,
    rawHint: '',
    retriable: false
  };
}

async function runLocalPreflight(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const env = opts.env && typeof opts.env === 'object' ? opts.env : process.env;
  const fsApi = opts.fsApi && typeof opts.fsApi === 'object' ? opts.fsApi : fs;
  const probeFirestore = typeof opts.probeFirestore === 'function'
    ? opts.probeFirestore
    : probeFirestoreReadOnly;

  const checks = {
    credentialsPath: evaluateCredentialsPath(env, fsApi),
    firestoreProjectId: evaluateProjectId(env),
    firestoreProbe: await probeFirestore({ timeoutMs: opts.timeoutMs, getDb: opts.getDb })
  };
  const summary = buildSummary(checks);
  const ready = summary.tone !== 'danger';

  return {
    ok: true,
    ready,
    checkedAt: new Date().toISOString(),
    checks,
    summary
  };
}

async function main() {
  const result = await runLocalPreflight();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ready) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${normalizeMessage(err)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  runLocalPreflight,
  evaluateCredentialsPath,
  evaluateProjectId,
  probeFirestoreReadOnly,
  buildSummary,
  classifyProbeError,
  classifyFirestoreProbeClassification
};
