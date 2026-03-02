'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_COUNT_PER_TYPE = 3;
const DEFAULT_SEED_TAG = 'dummy';
const DEFAULT_ACTOR = 'admin_seed_notifications';
const DEFAULT_TARGET_REGION = 'nyc';
const DEFAULT_SCENARIO_PERIOD_COUNT = 0;
const DEFAULT_ARTIFACT_DIR = path.join(process.cwd(), 'artifacts', 'admin-seed-notifications');
const NOTIFICATION_TYPES = Object.freeze(['GENERAL', 'ANNOUNCEMENT', 'VENDOR', 'AB', 'STEP']);
const SCENARIOS = Object.freeze(['A', 'B', 'C', 'D']);
const STEPS = Object.freeze(['3mo', '2mo', '1mo', 'week', 'after1w', 'after1mo']);
const PERIOD_STEPS = Object.freeze(['3mo', '2mo', '1mo', 'week', 'after1w', 'after1mo']);
const PERIOD_DEPENDENCY_MAP = Object.freeze({
  '3mo': null,
  '2mo': '3mo',
  '1mo': '2mo',
  week: '1mo',
  after1w: 'week',
  after1mo: 'after1w'
});
const DUMMY_CONTENT_LIBRARY = Object.freeze({
  GENERAL: Object.freeze([
    { title: 'ビザ申請開始のご案内', body: '必要書類の収集を開始してください。申請書下書きと証明写真の準備を推奨します。' },
    { title: 'ビザ面談予約の手順', body: '大使館サイトで面談枠を予約し、予約番号を保存してください。' },
    { title: '申請書類の最終確認', body: '旅券・残高証明・在学証明の有効期限を確認し、不足があれば再発行してください。' },
    { title: '渡航計画の提出依頼', body: '到着日、滞在先、緊急連絡先をフォームに入力してください。' },
    { title: '追加資料アップロード', body: '審査で求められる可能性がある補足資料を先にアップロードしてください。' },
    { title: '審査状況の中間共有', body: '進捗が更新されました。保留理由がある場合はコメント欄を確認してください。' }
  ]),
  ANNOUNCEMENT: Object.freeze([
    { title: '大使館面談枠の更新通知', body: '今週分の面談枠が更新されました。候補日時の再選択が可能です。' },
    { title: '申請締切日のリマインド', body: '締切が近づいています。未提出書類がある場合は期限前に提出してください。' },
    { title: '審査ガイドライン改定', body: '提出フォーマットの新基準が適用されます。最新テンプレートを使用してください。' },
    { title: '渡航前オリエンテーション案内', body: '渡航前説明会の日程が確定しました。参加可否を回答してください。' },
    { title: '現地受入先からの連絡', body: '現地受入先の担当窓口が更新されました。連絡先を確認してください。' },
    { title: 'ビザ発給後の手続き案内', body: '発給後に必要な入国申告と保険手続きを案内します。' }
  ]),
  VENDOR: Object.freeze([
    { title: '翻訳サポートの利用案内', body: '申請書類の公的翻訳に対応する提携ベンダー情報を共有します。' },
    { title: '証明写真サービス予約', body: '規格準拠の証明写真を撮影できる提携店舗の予約案内です。' },
    { title: '書類配送サービス手配', body: '原本提出が必要な方向けに追跡付き配送サービスを案内します。' },
    { title: '面談同席サポート案内', body: '必要時に通訳同席を依頼できるオプションの案内です。' },
    { title: '現地住居サポート案内', body: '渡航後の短期滞在先を手配できる提携先を紹介します。' },
    { title: '保険加入サポート案内', body: '渡航条件に合う保険プランの候補を比較できます。' }
  ]),
  AB: Object.freeze([
    { title: '申請導線A/B検証 #書類一覧', body: '必要書類の見せ方A/Bを比較するダミー通知です。' },
    { title: '申請導線A/B検証 #面談準備', body: '面談準備チェックリストの見せ方A/Bを比較するダミー通知です。' },
    { title: '申請導線A/B検証 #進捗表示', body: '進捗バー表示の有無で反応差を見るダミー通知です。' },
    { title: '申請導線A/B検証 #期限訴求', body: '期限訴求文の強さを比較するダミー通知です。' },
    { title: '申請導線A/B検証 #CTA文言', body: 'CTA文言パターンを比較するダミー通知です。' },
    { title: '申請導線A/B検証 #送信時刻', body: '送信時刻パターンを比較するダミー通知です。' }
  ]),
  STEP: Object.freeze([
    { title: 'ビザ申請チェック開始', body: '申請書・必要証明の不足を確認し、提出順を確定してください。' },
    { title: '住宅候補の一次選定', body: '勤務地アクセスと初期費用で候補を3件まで絞り込みましょう。' },
    { title: '自動車手配の条件確認', body: '通勤距離と保険条件に合わせて車種候補を確定してください。' },
    { title: 'SSN申請書類の準備', body: '入国後に必要な身分証・雇用証明を整理してください。' },
    { title: '運転免許切替の事前確認', body: '州DMVの必要書類と予約可能日を確認してください。' },
    { title: '住居契約の最終レビュー', body: '契約条項、デポジット、解約条件を最終確認してください。' },
    { title: '公共料金の開通予約', body: '電気・ガス・ネット回線の開通日を入居日に合わせて設定してください。' },
    { title: '銀行口座開設の準備', body: '口座開設に必要な身分証・住所証明の有効期限を確認してください。' },
    { title: '初回通勤導線の確認', body: '通勤手段と所要時間を平日想定で再確認してください。' },
    { title: '着任後手続きフォロー', body: '入社後1週間の行政手続き進捗を更新してください。' }
  ])
});

function parsePositiveInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(`value must be integer ${min}-${max}`);
  }
  return num;
}

function parseNotificationTypes(value, fallbackTypes) {
  const fallback = Array.isArray(fallbackTypes) && fallbackTypes.length
    ? Array.from(new Set(fallbackTypes.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)))
    : NOTIFICATION_TYPES.slice();
  if (value === null || value === undefined || value === '') return fallback;
  const list = String(value)
    .split(',')
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);
  if (!list.length) return fallback;
  const unique = Array.from(new Set(list));
  const invalid = unique.filter((item) => !NOTIFICATION_TYPES.includes(item));
  if (invalid.length) throw new Error(`types invalid: ${invalid.join(',')}`);
  return unique;
}

function readValue(argv, index, label) {
  if (index >= argv.length) throw new Error(`${label} value required`);
  return argv[index];
}

function normalizeToken(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readTokenFromFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  const resolved = filePath.trim();
  if (!resolved) return '';
  return normalizeToken(fs.readFileSync(resolved, 'utf8'));
}

function utcCompact(now) {
  const d = now instanceof Date ? now : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}${h}${mm}${ss}`;
}

function parseArgs(argv, env) {
  const sourceEnv = env || process.env;
  const opts = {
    baseUrl: normalizeToken(sourceEnv.ADMIN_BASE_URL || sourceEnv.MEMBER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '') || DEFAULT_BASE_URL,
    countPerType: parsePositiveInt(sourceEnv.SEED_NOTIFICATIONS_COUNT_PER_TYPE, DEFAULT_COUNT_PER_TYPE, 1, 20),
    seedTag: normalizeToken(sourceEnv.SEED_NOTIFICATIONS_TAG || DEFAULT_SEED_TAG) || DEFAULT_SEED_TAG,
    seedRunId: normalizeToken(sourceEnv.SEED_RUN_ID || `seed_${utcCompact(new Date())}`),
    targetRegion: normalizeToken(sourceEnv.SEED_NOTIFICATIONS_REGION || DEFAULT_TARGET_REGION) || DEFAULT_TARGET_REGION,
    scenarioPeriodCount: parsePositiveInt(sourceEnv.SEED_NOTIFICATIONS_SCENARIO_PERIOD_COUNT, DEFAULT_SCENARIO_PERIOD_COUNT, 0, 50),
    types: parseNotificationTypes(sourceEnv.SEED_NOTIFICATIONS_TYPES, NOTIFICATION_TYPES),
    adminToken: normalizeToken(sourceEnv.ADMIN_OS_TOKEN || ''),
    adminTokenFile: normalizeToken(sourceEnv.ADMIN_OS_TOKEN_FILE || ''),
    actor: normalizeToken(sourceEnv.SEED_NOTIFICATIONS_ACTOR || DEFAULT_ACTOR) || DEFAULT_ACTOR,
    dryRun: false,
    apply: false,
    archive: false,
    limit: 2000
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg === '--apply') {
      opts.apply = true;
      continue;
    }
    if (arg === '--archive') {
      opts.archive = true;
      continue;
    }
    if (arg === '--count-per-type') {
      opts.countPerType = parsePositiveInt(readValue(argv, ++i, '--count-per-type'), DEFAULT_COUNT_PER_TYPE, 1, 20);
      continue;
    }
    if (arg === '--seed-tag') {
      opts.seedTag = normalizeToken(readValue(argv, ++i, '--seed-tag')) || DEFAULT_SEED_TAG;
      continue;
    }
    if (arg === '--seed-run-id') {
      opts.seedRunId = normalizeToken(readValue(argv, ++i, '--seed-run-id'));
      continue;
    }
    if (arg === '--target-region') {
      opts.targetRegion = normalizeToken(readValue(argv, ++i, '--target-region')) || DEFAULT_TARGET_REGION;
      continue;
    }
    if (arg === '--scenario-period-count') {
      opts.scenarioPeriodCount = parsePositiveInt(readValue(argv, ++i, '--scenario-period-count'), DEFAULT_SCENARIO_PERIOD_COUNT, 0, 50);
      continue;
    }
    if (arg === '--types') {
      opts.types = parseNotificationTypes(readValue(argv, ++i, '--types'), opts.types);
      continue;
    }
    if (arg === '--base-url') {
      opts.baseUrl = normalizeToken(readValue(argv, ++i, '--base-url')).replace(/\/+$/, '') || DEFAULT_BASE_URL;
      continue;
    }
    if (arg === '--admin-token') {
      opts.adminToken = normalizeToken(readValue(argv, ++i, '--admin-token'));
      continue;
    }
    if (arg === '--admin-token-file') {
      opts.adminTokenFile = normalizeToken(readValue(argv, ++i, '--admin-token-file'));
      continue;
    }
    if (arg === '--actor') {
      opts.actor = normalizeToken(readValue(argv, ++i, '--actor')) || DEFAULT_ACTOR;
      continue;
    }
    if (arg === '--limit') {
      opts.limit = parsePositiveInt(readValue(argv, ++i, '--limit'), 2000, 1, 2000);
      continue;
    }
    throw new Error(`unknown arg: ${arg}`);
  }

  if (!opts.seedRunId) opts.seedRunId = `seed_${utcCompact(new Date())}`;
  if (!opts.adminToken && opts.adminTokenFile) {
    opts.adminToken = readTokenFromFile(opts.adminTokenFile);
  }
  if (!opts.adminToken) {
    throw new Error('admin token required (ADMIN_OS_TOKEN or --admin-token/--admin-token-file)');
  }
  if (opts.archive && opts.apply) {
    throw new Error('--archive and --apply cannot be used together');
  }
  if (!Array.isArray(opts.types) || !opts.types.length) {
    throw new Error('types required');
  }
  return opts;
}

async function request(ctx, method, endpoint, payload, traceId) {
  const url = `${ctx.baseUrl}${endpoint}`;
  const headers = {
    'content-type': 'application/json',
    'x-admin-token': ctx.adminToken,
    'x-actor': ctx.actor,
    'x-trace-id': traceId
  };
  const res = await fetch(url, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    body = null;
  }
  return {
    okStatus: res.status >= 200 && res.status < 300,
    status: res.status,
    body,
    raw: text
  };
}

function ensureArtifactDir() {
  fs.mkdirSync(DEFAULT_ARTIFACT_DIR, { recursive: true });
}

function writeArtifact(seedRunId, payload) {
  ensureArtifactDir();
  const filePath = path.join(DEFAULT_ARTIFACT_DIR, `${seedRunId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

function buildDraftPayload(type, index, ctx) {
  const scenarioKey = typeof ctx.scenarioKey === 'string' && ctx.scenarioKey ? ctx.scenarioKey : SCENARIOS[index % SCENARIOS.length];
  const stepKey = typeof ctx.stepKey === 'string' && ctx.stepKey ? ctx.stepKey : STEPS[index % STEPS.length];
  const contentList = DUMMY_CONTENT_LIBRARY[type] || DUMMY_CONTENT_LIBRARY.GENERAL;
  const content = contentList[index % contentList.length];
  const order = Number.isFinite(Number(ctx.order)) && Number(ctx.order) > 0 ? Math.floor(Number(ctx.order)) : null;
  const dependsOnStep = order && order > 1
    ? stepKey
    : (Object.prototype.hasOwnProperty.call(PERIOD_DEPENDENCY_MAP, stepKey) ? PERIOD_DEPENDENCY_MAP[stepKey] : null);
  const dependsOnOrder = order && order > 1 ? order - 1 : null;
  const dependencyLabel = dependsOnStep
    ? `${scenarioKey}/${dependsOnStep}${dependsOnOrder ? `#${dependsOnOrder}` : ''}`
    : 'NONE';
  const dependencyMeta = {
    dummyDependencyLabel: dependencyLabel,
    dummyDependsOnStep: dependsOnStep || null,
    dummyDependsOnOrder: dependsOnOrder || null,
    dummySequenceOrder: order || null
  };
  const base = {
    notificationType: type,
    notificationCategory: 'DEADLINE_REQUIRED',
    title: `${content.title} [DUMMY][${ctx.seedTag}][${ctx.seedRunId}]`,
    body: `${content.body}\n依存: ${dependencyLabel}`,
    ctaText: '詳細を見る',
    linkRegistryId: ctx.linkRegistryId,
    scenarioKey,
    stepKey,
    trigger: 'manual',
    target: {
      limit: 50,
      region: ctx.targetRegion,
      membersOnly: false
    },
    seedTag: ctx.seedTag,
    seedRunId: ctx.seedRunId,
    seededAt: new Date().toISOString()
  };
  if (order) base.order = order;
  if (type === 'ANNOUNCEMENT') {
    base.notificationMeta = Object.assign({}, dependencyMeta, {
      expiryAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString(),
      priority: 'medium'
    });
  }
  if (type === 'VENDOR') {
    base.notificationMeta = Object.assign({}, dependencyMeta, {
      vendorId: `vendor_${ctx.seedRunId}_${index + 1}`,
      targeting: 'all'
    });
  }
  if (type === 'AB') {
    base.notificationMeta = Object.assign({}, dependencyMeta, {
      variants: ['A', 'B'],
      ratio: '50:50',
      metric: 'click'
    });
  }
  if (type === 'GENERAL' || type === 'STEP') {
    base.notificationMeta = Object.assign({}, dependencyMeta);
  }
  return base;
}

async function ensureLinkRegistry(ctx, traceBase) {
  const traceId = `${traceBase}-link`;
  const payload = {
    title: `[DUMMY][${ctx.seedRunId}] seed link`,
    url: `https://example.com/dummy/${encodeURIComponent(ctx.seedRunId)}`
  };
  const response = await request(ctx, 'POST', '/admin/link-registry', payload, traceId);
  if (!response.okStatus || !response.body || response.body.ok !== true || typeof response.body.id !== 'string') {
    const reason = response.body && response.body.error ? response.body.error : `http_${response.status}`;
    throw new Error(`link registry create failed: ${reason}`);
  }
  return response.body.id.trim();
}

async function pollReadModel(ctx, notificationId, traceBase) {
  for (let i = 0; i < 8; i += 1) {
    const traceId = `${traceBase}-read-model-${i + 1}`;
    const response = await request(
      ctx,
      'GET',
      `/admin/read-model/notifications?limit=200&notificationId=${encodeURIComponent(notificationId)}`,
      undefined,
      traceId
    );
    if (response.okStatus && response.body && response.body.ok === true && Array.isArray(response.body.items)) {
      const row = response.body.items.find((item) => item && item.notificationId === notificationId);
      if (row) return { ok: true, row, attempts: i + 1 };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ok: false, row: null, attempts: 8 };
}

async function pollMonitor(ctx, notificationId, traceBase) {
  for (let i = 0; i < 6; i += 1) {
    const traceId = `${traceBase}-monitor-${i + 1}`;
    const response = await request(
      ctx,
      'GET',
      '/api/admin/monitor-insights?windowDays=30&limit=200&fallbackMode=allow&fallbackOnEmpty=true',
      undefined,
      traceId
    );
    if (response.okStatus && response.body && response.body.ok === true) {
      const ctrTop = Array.isArray(response.body.ctrTop) ? response.body.ctrTop : [];
      const matched = ctrTop.find((row) => row && row.notificationId === notificationId) || null;
      if (matched) return { ok: true, row: matched, attempts: i + 1 };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ok: false, row: null, attempts: 6 };
}

async function createDrafts(ctx, plan, traceBase) {
  const created = [];
  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index];
    const traceId = `${traceBase}-draft-${index + 1}`;
    const response = await request(ctx, 'POST', '/api/admin/os/notifications/draft', item.payload, traceId);
    const notificationId = response && response.body && typeof response.body.notificationId === 'string'
      ? response.body.notificationId.trim()
      : '';
    created.push({
      type: item.type,
      index: item.index,
      title: item.payload.title,
      traceId,
      notificationId: notificationId || null,
      response
    });
  }
  return created;
}

async function applyFlow(ctx, item, traceBase) {
  const result = {
    type: item.type,
    notificationId: item.notificationId,
    approve: null,
    plan: null,
    execute: null,
    deliveries: null,
    readModel: null,
    monitor: null
  };
  result.approve = await request(
    ctx,
    'POST',
    '/api/admin/os/notifications/approve',
    { notificationId: item.notificationId },
    `${traceBase}-approve`
  );
  if (!result.approve.okStatus || !result.approve.body || result.approve.body.ok !== true) return result;
  result.plan = await request(
    ctx,
    'POST',
    '/api/admin/os/notifications/send/plan',
    { notificationId: item.notificationId },
    `${traceBase}-plan`
  );
  if (!result.plan.okStatus || !result.plan.body || result.plan.body.ok !== true) return result;
  const planHash = typeof result.plan.body.planHash === 'string' ? result.plan.body.planHash : '';
  const confirmToken = typeof result.plan.body.confirmToken === 'string' ? result.plan.body.confirmToken : '';
  if (!planHash || !confirmToken) return result;
  result.execute = await request(
    ctx,
    'POST',
    '/api/admin/os/notifications/send/execute',
    { notificationId: item.notificationId, planHash, confirmToken },
    `${traceBase}-execute`
  );
  if (!result.execute.okStatus || !result.execute.body || result.execute.body.ok !== true) return result;
  result.deliveries = {
    ok: true,
    deliveredCount: Number.isFinite(Number(result.execute.body.deliveredCount))
      ? Number(result.execute.body.deliveredCount)
      : 0,
    skippedCount: Number.isFinite(Number(result.execute.body.skippedCount))
      ? Number(result.execute.body.skippedCount)
      : 0
  };
  result.readModel = await pollReadModel(ctx, item.notificationId, `${traceBase}-result`);
  result.monitor = await pollMonitor(ctx, item.notificationId, `${traceBase}-result`);
  return result;
}

function summarizeByType(createdRows) {
  const out = {};
  NOTIFICATION_TYPES.forEach((type) => {
    out[type] = { created: 0, succeeded: 0, failed: 0 };
  });
  createdRows.forEach((row) => {
    const bucket = out[row.type] || (out[row.type] = { created: 0, succeeded: 0, failed: 0 });
    bucket.created += 1;
    const ok = row.response && row.response.okStatus && row.response.body && row.response.body.ok === true;
    if (ok) bucket.succeeded += 1;
    else bucket.failed += 1;
  });
  return out;
}

async function runArchive(ctx, traceBase) {
  const response = await request(
    ctx,
    'POST',
    '/api/admin/os/notifications/seed/archive',
    {
      seedTag: ctx.seedTag,
      seedRunId: ctx.seedRunId,
      reason: 'admin_seed_notifications_archive',
      limit: ctx.limit
    },
    `${traceBase}-archive`
  );
  return response;
}

async function main() {
  const opts = parseArgs(process.argv, process.env);
  const traceBase = `trace-seed-${opts.seedRunId}`;
  const startedAt = new Date().toISOString();
  const context = {
    baseUrl: opts.baseUrl,
    adminToken: opts.adminToken,
    actor: opts.actor,
    seedTag: opts.seedTag,
    seedRunId: opts.seedRunId,
    targetRegion: opts.targetRegion,
    types: opts.types.slice(),
    limit: opts.limit,
    linkRegistryId: null
  };

  if (opts.archive) {
    const archiveResponse = await runArchive(context, traceBase);
    const artifact = {
      ok: archiveResponse.okStatus && archiveResponse.body && archiveResponse.body.ok === true,
      mode: 'archive',
      startedAt,
      endedAt: new Date().toISOString(),
      baseUrl: context.baseUrl,
      seedTag: context.seedTag,
      seedRunId: context.seedRunId,
      targetRegion: context.targetRegion,
      types: context.types,
      response: archiveResponse.body || archiveResponse.raw || null
    };
    const filePath = writeArtifact(opts.seedRunId, artifact);
    process.stdout.write(`${JSON.stringify(Object.assign({ artifact: filePath }, artifact), null, 2)}\n`);
    if (!artifact.ok) process.exitCode = 1;
    return;
  }

  context.linkRegistryId = opts.dryRun ? 'dry_run_link' : await ensureLinkRegistry(context, traceBase);
  const plan = [];
  if (opts.scenarioPeriodCount > 0) {
    let index = 0;
    for (const scenarioKey of SCENARIOS) {
      for (const stepKey of PERIOD_STEPS) {
        for (let i = 0; i < opts.scenarioPeriodCount; i += 1) {
          const type = opts.types[i % opts.types.length];
          plan.push({
            type,
            index,
            payload: buildDraftPayload(type, index, Object.assign({}, context, { scenarioKey, stepKey, order: i + 1 }))
          });
          index += 1;
        }
      }
    }
  } else {
    opts.types.forEach((type) => {
      for (let i = 0; i < opts.countPerType; i += 1) {
        plan.push({
          type,
          index: i,
          payload: buildDraftPayload(type, i, context)
        });
      }
    });
  }

  if (opts.dryRun) {
    const dry = {
      ok: true,
      mode: 'dry-run',
      startedAt,
      endedAt: new Date().toISOString(),
      baseUrl: context.baseUrl,
      seedTag: context.seedTag,
      seedRunId: context.seedRunId,
      targetRegion: context.targetRegion,
      types: context.types,
      countPerType: opts.countPerType,
      scenarioPeriodCount: opts.scenarioPeriodCount,
      totalDrafts: plan.length,
      linkRegistryId: context.linkRegistryId,
      plan: plan.map((item) => ({
        type: item.type,
        title: item.payload.title,
        scenarioKey: item.payload.scenarioKey,
        stepKey: item.payload.stepKey,
        targetRegion: item.payload.target && item.payload.target.region ? item.payload.target.region : null
      }))
    };
    const filePath = writeArtifact(opts.seedRunId, dry);
    process.stdout.write(`${JSON.stringify(Object.assign({ artifact: filePath }, dry), null, 2)}\n`);
    return;
  }

  const createdRows = await createDrafts(context, plan, traceBase);
  const byType = summarizeByType(createdRows);
  const applyResults = [];
  if (opts.apply) {
    for (const type of opts.types) {
      const candidate = createdRows.find((row) => row.type === type && row.notificationId);
      if (!candidate) {
        applyResults.push({
          type,
          notificationId: null,
          reason: 'no_draft_created',
          ok: false
        });
        continue;
      }
      const applied = await applyFlow(context, candidate, `${traceBase}-${type.toLowerCase()}`);
      const ok = Boolean(
        applied.execute
        && applied.execute.okStatus
        && applied.execute.body
        && applied.execute.body.ok === true
      );
      applyResults.push(Object.assign({ ok }, applied));
    }
  }

  const endedAt = new Date().toISOString();
  const output = {
    ok: true,
    mode: opts.apply ? 'apply' : 'create',
    startedAt,
    endedAt,
    baseUrl: context.baseUrl,
    seedTag: context.seedTag,
    seedRunId: context.seedRunId,
    targetRegion: context.targetRegion,
    types: context.types,
    countPerType: opts.countPerType,
    scenarioPeriodCount: opts.scenarioPeriodCount,
    linkRegistryId: context.linkRegistryId,
    byType,
    createdRows: createdRows.map((row) => ({
      type: row.type,
      index: row.index,
      title: row.title,
      notificationId: row.notificationId,
      ok: Boolean(row.response && row.response.okStatus && row.response.body && row.response.body.ok === true),
      status: row.response ? row.response.status : null,
      error: row.response && row.response.body ? row.response.body.error || row.response.body.reason || null : null
    })),
    applyResults
  };

  const requiredCount = opts.scenarioPeriodCount > 0 ? 1 : opts.countPerType;
  const missingType = opts.types.filter((type) => (byType[type] && byType[type].succeeded >= requiredCount) !== true);
  if (missingType.length > 0) {
    output.ok = false;
    output.reason = 'draft_create_incomplete';
    output.missingType = missingType;
  }
  if (opts.apply) {
    const applyFailed = applyResults.filter((row) => row.ok !== true);
    if (applyFailed.length > 0) {
      output.ok = false;
      output.reason = output.reason || 'apply_incomplete';
      output.applyFailedTypes = applyFailed.map((row) => row.type);
    }
  }
  const filePath = writeArtifact(opts.seedRunId, output);
  process.stdout.write(`${JSON.stringify(Object.assign({ artifact: filePath }, output), null, 2)}\n`);
  if (!output.ok) process.exitCode = 1;
}

main().catch((err) => {
  const message = err && err.message ? err.message : 'error';
  process.stderr.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
  process.exitCode = 1;
});
