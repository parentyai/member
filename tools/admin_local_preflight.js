'use strict';

const fs = require('fs');
const path = require('path');
const { resolveFirestoreProjectId } = require('../src/infra/firestore');

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

function hasProjectIdToken(text) {
  return text.includes('project id')
    || text.includes('project-id')
    || text.includes('project_id')
    || text.includes('projectid');
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

function evaluateSaKeyPath(env, fsApi) {
  const envSource = env && typeof env === 'object' ? env : process.env;
  const fsSource = fsApi && typeof fsApi === 'object' ? fsApi : fs;
  const raw = typeof envSource.GOOGLE_APPLICATION_CREDENTIALS === 'string'
    ? envSource.GOOGLE_APPLICATION_CREDENTIALS.trim()
    : '';

  if (!raw) {
    return {
      key: 'saKeyPath',
      status: 'warn',
      code: 'SA_KEY_PATH_UNSET',
      message: 'ローカルSA鍵パス（GOOGLE_APPLICATION_CREDENTIALS）が未設定です。',
      value: null
    };
  }

  let stats;
  try {
    stats = fsSource.statSync(raw);
  } catch (err) {
    return {
      key: 'saKeyPath',
      status: 'error',
      code: 'SA_KEY_PATH_INVALID',
      message: `ローカルSA鍵を参照できません: ${normalizeMessage(err)}`,
      value: raw
    };
  }

  if (!stats.isFile()) {
    return {
      key: 'saKeyPath',
      status: 'error',
      code: 'SA_KEY_PATH_NOT_FILE',
      message: 'ローカルSA鍵パス（GOOGLE_APPLICATION_CREDENTIALS）はファイルを指していません。',
      value: raw
    };
  }

  if (typeof fsSource.accessSync === 'function') {
    const readMode = fsSource.constants && Number.isFinite(fsSource.constants.R_OK)
      ? fsSource.constants.R_OK
      : fs.constants.R_OK;
    try {
      fsSource.accessSync(raw, readMode);
    } catch (err) {
      const text = normalizeLowerText(normalizeMessage(err));
      if (text.includes('eacces') || text.includes('eperm')) {
        return {
          key: 'saKeyPath',
          status: 'error',
          code: 'SA_KEY_PATH_PERMISSION_DENIED',
          message: `ローカルSA鍵の読み取り権限が不足しています: ${normalizeMessage(err)}`,
          value: raw
        };
      }
      return {
        key: 'saKeyPath',
        status: 'error',
        code: 'SA_KEY_PATH_UNREADABLE',
        message: `ローカルSA鍵を読み取れません: ${normalizeMessage(err)}`,
        value: raw
      };
    }
  }

  return {
    key: 'saKeyPath',
    status: 'ok',
    code: 'SA_KEY_PATH_OK',
    message: 'ローカルSA鍵パスを確認しました。',
    value: raw
  };
}

function evaluateProjectId(env, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const envSource = env && typeof env === 'object' ? env : process.env;
  const resolver = typeof opts.resolveProjectId === 'function'
    ? opts.resolveProjectId
    : resolveFirestoreProjectId;
  const allowGcloudDetect = opts.allowGcloudDetect === true;
  const resolved = resolver({ env: envSource, allowGcloud: allowGcloudDetect });
  const raw = resolved && typeof resolved.projectId === 'string'
    ? resolved.projectId.trim()
    : '';
  if (!raw) {
    return {
      key: 'firestoreProjectId',
      status: 'warn',
      code: 'FIRESTORE_PROJECT_ID_MISSING',
      message: 'FIRESTORE_PROJECT_ID が未設定です。',
      value: null,
      source: 'unresolved'
    };
  }
  const source = resolved && typeof resolved.source === 'string' ? resolved.source : 'env:FIRESTORE_PROJECT_ID';
  const sourceLabel = source === 'env:FIRESTORE_PROJECT_ID' ? 'FIRESTORE_PROJECT_ID' : source;
  return {
    key: 'firestoreProjectId',
    status: 'ok',
    code: 'FIRESTORE_PROJECT_ID_OK',
    message: `Firestore projectId を確認しました（${sourceLabel}）。`,
    value: raw,
    source
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
  if (hasProjectIdToken(text)) return 'FIRESTORE_PROJECT_ID_ERROR';
  if (text.includes('permission') || text.includes('unauthorized') || text.includes('forbidden')) {
    return 'FIRESTORE_PERMISSION_ERROR';
  }
  return 'FIRESTORE_PROBE_FAILED';
}

function classifyFirestoreProbeClassification(message) {
  const text = normalizeLowerText(message);
  if (text.includes('database not found')
    || text.includes('datastore was not found')
    || text.includes('resource name') && text.includes('/databases/') && text.includes('not found')
    || text.includes('projects/') && text.includes('/databases/') && text.includes('not found')) {
    return 'FIRESTORE_DATABASE_NOT_FOUND';
  }
  if (text.includes('unable to detect a project id')
    || text.includes('unable to detect project id')
    || text.includes('project id is required')
    || text.includes('firestore_project_id_error')
    || text.includes('firestore_project_id_missing')
    || (hasProjectIdToken(text)
      && (text.includes('unable to detect')
        || text.includes('required')
        || text.includes('missing')
        || text.includes('unset')
        || text.includes('not set')))) {
    return 'FIRESTORE_PROJECT_ID_ERROR';
  }
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
    '# Preferred: local SA key via GOOGLE_APPLICATION_CREDENTIALS',
    'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa.json"',
    'test -r "$GOOGLE_APPLICATION_CREDENTIALS"',
    'npm run admin:preflight',
    '# Fallback: ADC reauth only when SA key is unavailable',
    'unset GOOGLE_APPLICATION_CREDENTIALS',
    'gcloud auth application-default login',
    'gcloud auth application-default print-access-token',
    'npm run admin:preflight'
  ]),
  CHECK_FIRESTORE_TIMEOUT: Object.freeze([
    'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa.json"',
    'test -r "$GOOGLE_APPLICATION_CREDENTIALS"',
    'export FIRESTORE_PROJECT_ID=<your-project-id>',
    'npm run admin:preflight',
    'gcloud auth application-default print-access-token'
  ]),
  CHECK_FIRESTORE_NETWORK: Object.freeze([
    'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa.json"',
    'test -r "$GOOGLE_APPLICATION_CREDENTIALS"',
    'curl -sS -H "x-admin-token: <token>" -H "x-actor: local-check" http://127.0.0.1:8080/api/admin/local-preflight',
    'npm run admin:preflight',
    'gcloud auth application-default print-access-token'
  ]),
  CHECK_FIRESTORE_PERMISSION: Object.freeze([
    'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa.json"',
    'test -r "$GOOGLE_APPLICATION_CREDENTIALS"',
    'gcloud projects get-iam-policy <your-project-id> --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"',
    'npm run admin:preflight',
    'gcloud auth application-default print-access-token'
  ]),
  CHECK_FIRESTORE_DATABASE: Object.freeze([
    'gcloud firestore databases list --project <your-project-id>',
    'https://console.cloud.google.com/firestore/databases/-default-/data?project=<your-project-id>',
    'npm run admin:preflight'
  ]),
  CHECK_FIRESTORE_UNKNOWN: Object.freeze([
    'npm run admin:preflight',
    'curl -sS -H "x-admin-token: <token>" -H "x-actor: local-check" http://127.0.0.1:8080/api/admin/local-preflight'
  ]),
  FIX_CREDENTIALS_PATH: Object.freeze([
    'export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa.json"',
    'test -r "$GOOGLE_APPLICATION_CREDENTIALS"',
    'npm run admin:preflight',
    'unset GOOGLE_APPLICATION_CREDENTIALS',
    'gcloud auth application-default login',
    'npm run admin:preflight'
  ]),
  SET_FIRESTORE_PROJECT_ID: Object.freeze([
    'gcloud config get-value project',
    'export FIRESTORE_PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"',
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
    if (classification === 'FIRESTORE_DATABASE_NOT_FOUND') {
      return {
        code: 'FIRESTORE_DATABASE_NOT_FOUND',
        tone: 'danger',
        category: 'config',
        cause: 'Firestore Database が見つからず接続に失敗しました。',
        impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
        action: 'databaseId と GCP Console URL を確認し、(default) DB へ切り替えて再診断してください。',
        recoveryActionCode: 'CHECK_FIRESTORE_DATABASE',
        recoveryCommands: resolveRecoveryCommands('CHECK_FIRESTORE_DATABASE'),
        primaryCheckKey: 'firestoreProbe',
        rawHint,
        retriable: true
      };
    }
    if (classification === 'FIRESTORE_PROJECT_ID_ERROR') {
      return {
        code: 'FIRESTORE_PROJECT_ID_ERROR',
        tone: 'danger',
        category: 'config',
        cause: 'Firestore Project ID を特定できず接続に失敗しました。',
        impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
        action: 'FIRESTORE_PROJECT_ID を設定して再診断してください。',
        recoveryActionCode: 'SET_FIRESTORE_PROJECT_ID',
        recoveryCommands: resolveRecoveryCommands('SET_FIRESTORE_PROJECT_ID'),
        primaryCheckKey: 'firestoreProjectId',
        rawHint,
        retriable: true
      };
    }
    if (classification === 'ADC_REAUTH_REQUIRED') {
      return {
        code: 'ADC_REAUTH_REQUIRED',
        tone: 'danger',
        category: 'auth',
        cause: 'ADC認証が期限切れでFirestore接続に失敗しました。',
        impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
        action: 'まず GOOGLE_APPLICATION_CREDENTIALS にローカルSA鍵を設定して再診断し、解消しない場合はADCを再認証してください。',
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
        action: 'まずローカルSA鍵パス（GOOGLE_APPLICATION_CREDENTIALS）と FIRESTORE_PROJECT_ID を確認し、必要時のみADCを再認証してください。',
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
        action: 'まずローカルSA鍵パス（GOOGLE_APPLICATION_CREDENTIALS）を確認し、ネットワーク疎通を確認したうえで再診断してください。',
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
        action: 'まずローカルSA鍵の権限を確認し、必要時のみADCアカウント権限を確認して再診断してください。',
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
      action: 'GOOGLE_APPLICATION_CREDENTIALS を有効なローカルSA鍵パスへ修正し、解消しない場合はADC再認証を試してください。',
      recoveryActionCode: 'FIX_CREDENTIALS_PATH',
      recoveryCommands: resolveRecoveryCommands('FIX_CREDENTIALS_PATH'),
      primaryCheckKey: source.key || 'credentialsPath',
      rawHint,
      retriable: true
    };
  }

  if (code === 'SA_KEY_PATH_INVALID'
    || code === 'SA_KEY_PATH_NOT_FILE'
    || code === 'SA_KEY_PATH_PERMISSION_DENIED'
    || code === 'SA_KEY_PATH_UNREADABLE') {
    return {
      code,
      tone: 'danger',
      category: 'auth',
      cause: message,
      impact: 'ローカルSA鍵の読み取り不備によりFirestore依存APIが失敗する可能性があります。',
      action: 'GOOGLE_APPLICATION_CREDENTIALS を有効なローカルSA鍵へ修正し、読み取り権限を確認して再診断してください。',
      recoveryActionCode: 'FIX_CREDENTIALS_PATH',
      recoveryCommands: resolveRecoveryCommands('FIX_CREDENTIALS_PATH'),
      primaryCheckKey: source.key || 'saKeyPath',
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
  if (code === 'SA_KEY_PATH_UNSET') {
    return {
      code: 'SA_KEY_PATH_UNSET',
      tone: 'warn',
      category: 'auth',
      cause: message,
      impact: 'ADC依存での再認証発生率が高くなるため、ローカル運用の安定性が低下します。',
      action: 'GOOGLE_APPLICATION_CREDENTIALS にローカルSA鍵パスを設定して再診断してください。',
      recoveryActionCode: 'FIX_CREDENTIALS_PATH',
      recoveryCommands: resolveRecoveryCommands('FIX_CREDENTIALS_PATH'),
      primaryCheckKey: source.key || 'saKeyPath',
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

function normalizeProjectIdProbeClassification(checks) {
  const source = checks && typeof checks === 'object' ? checks : {};
  const projectIdCheck = source.firestoreProjectId && typeof source.firestoreProjectId === 'object'
    ? source.firestoreProjectId
    : null;
  const probeCheck = source.firestoreProbe && typeof source.firestoreProbe === 'object'
    ? source.firestoreProbe
    : null;
  if (!projectIdCheck || !probeCheck) return source;

  const projectIdMissing = projectIdCheck.status === 'warn'
    && normalizeCode(projectIdCheck.code) === 'FIRESTORE_PROJECT_ID_MISSING';
  const probeErrored = probeCheck.status === 'error';
  if (!projectIdMissing || !probeErrored) return source;

  const probeCode = normalizeCode(probeCheck.code);
  const probeClassification = normalizeCode(probeCheck.classification || probeCheck.code);
  if (probeClassification === 'FIRESTORE_PROJECT_ID_ERROR') return source;

  const shouldPromoteToProjectId = probeClassification === 'FIRESTORE_UNKNOWN'
    || probeCode === 'FIRESTORE_PROJECT_ID_ERROR'
    || probeCode === 'FIRESTORE_PROBE_FAILED';
  if (!shouldPromoteToProjectId) return source;

  return Object.assign({}, source, {
    firestoreProbe: Object.assign({}, probeCheck, {
      code: 'FIRESTORE_PROJECT_ID_ERROR',
      classification: 'FIRESTORE_PROJECT_ID_ERROR'
    })
  });
}

async function runLocalPreflight(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const env = opts.env && typeof opts.env === 'object' ? opts.env : process.env;
  const fsApi = opts.fsApi && typeof opts.fsApi === 'object' ? opts.fsApi : fs;
  const probeFirestore = typeof opts.probeFirestore === 'function'
    ? opts.probeFirestore
    : probeFirestoreReadOnly;
  const allowGcloudProjectIdDetect = opts.allowGcloudProjectIdDetect === true
    || (!opts.env && opts.allowGcloudProjectIdDetect !== false);

  const rawChecks = {
    credentialsPath: evaluateCredentialsPath(env, fsApi),
    saKeyPath: evaluateSaKeyPath(env, fsApi),
    firestoreProjectId: evaluateProjectId(env, {
      resolveProjectId: opts.resolveProjectId,
      allowGcloudDetect: allowGcloudProjectIdDetect
    }),
    firestoreProbe: await probeFirestore({ timeoutMs: opts.timeoutMs, getDb: opts.getDb })
  };
  const checks = normalizeProjectIdProbeClassification(rawChecks);
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
  evaluateSaKeyPath,
  evaluateProjectId,
  probeFirestoreReadOnly,
  buildSummary,
  classifyProbeError,
  classifyFirestoreProbeClassification
};
