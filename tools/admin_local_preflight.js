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
  const text = String(message || '').toLowerCase();
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
    return {
      key: 'firestoreProbe',
      status: 'error',
      code: classifyProbeError(message),
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
    const first = errors[0];
    return {
      code: normalizeCode(first.code || 'LOCAL_PREFLIGHT_ERROR'),
      tone: 'danger',
      cause: first.message || 'ローカル前提条件の確認に失敗しました。',
      impact: 'Firestore依存APIが失敗し、管理画面に NOT AVAILABLE が増えます。',
      action: 'GOOGLE_APPLICATION_CREDENTIALS を解除するか有効な認証情報に更新し、`gcloud auth application-default login` を実行してください。'
    };
  }

  if (warns.length > 0) {
    const first = warns[0];
    return {
      code: normalizeCode(first.code || 'LOCAL_PREFLIGHT_WARN'),
      tone: 'warn',
      cause: first.message || 'ローカル前提条件に警告があります。',
      impact: '一部環境では管理APIが不安定になる可能性があります。',
      action: 'ローカル環境変数を見直し、必要値を設定してください。'
    };
  }

  return {
    code: 'LOCAL_PREFLIGHT_OK',
    tone: 'ok',
    cause: 'ローカル前提条件は正常です。',
    impact: 'Firestore依存APIを含む管理機能を実行できます。',
    action: 'この状態を維持して運用確認を続けてください。'
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
  buildSummary
};
