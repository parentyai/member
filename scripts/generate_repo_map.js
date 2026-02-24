'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS');
const OUTPUT_PATH = path.join(INPUT_DIR, 'repo_map_ui.json');
const DATA_MAP_PATH = path.join(ROOT, 'docs', 'DATA_MAP.md');
const ADMIN_MANUAL_PATH = path.join(ROOT, 'docs', 'ADMIN_MANUAL_JA.md');
const RUNBOOK_JA_PATH = path.join(ROOT, 'docs', 'RUNBOOK_JA.md');
const PHASE24_PLAN_PATH = path.join(ROOT, 'docs', 'PHASE24_PLAN.md');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const DISPLAY_ROOT = (process.env.REPO_MAP_DISPLAY_ROOT || '/Users/parentyai.com/Projects/Member').replace(/\\/g, '/');
const COMMIT_SOURCE_FILES = Object.freeze([
  path.join('docs', 'REPO_AUDIT_INPUTS', 'feature_map.json'),
  path.join('docs', 'REPO_AUDIT_INPUTS', 'dependency_graph.json'),
  path.join('docs', 'REPO_AUDIT_INPUTS', 'state_transitions.json'),
  path.join('docs', 'REPO_AUDIT_INPUTS', 'data_model_map.json'),
  path.join('docs', 'ADMIN_MANUAL_JA.md'),
  path.join('docs', 'DATA_MAP.md'),
  path.join('docs', 'RUNBOOK_JA.md'),
  path.join('docs', 'PHASE24_PLAN.md')
]);

const CATEGORY_ORDER = Object.freeze([
  'notifications',
  'city_pack',
  'faq',
  'users',
  'safety',
  'analytics',
  'platform'
]);

const CATEGORY_LABELS = Object.freeze({
  notifications: '通知',
  city_pack: 'City Pack',
  faq: 'FAQ',
  users: 'ユーザー管理',
  safety: '安全ガード',
  analytics: '分析',
  platform: '共通基盤'
});

const GLOSSARY_JA = Object.freeze({
  link_registry: 'リンク管理（安全チェック）',
  killSwitch: '全配信停止スイッチ',
  validators: '送信前の安全チェック機能',
  notification_deliveries: '通知が実際に送られた記録',
  audit_logs: '誰が何を変更したかの履歴',
  ops_state: '運用判断の現在状態'
});

const FEATURE_NAME_JA = Object.freeze({
  osDashboardKpi: '運用ダッシュボード指標',
  osNotifications: '通知作成・承認・送信',
  monitorInsights: '配信結果インサイト',
  notificationDeliveries: '通知配信履歴',
  readModel: '通知集計ビュー',
  traceSearch: '追跡ID検索',
  cityPacks: 'City Pack管理',
  cityPackRequests: 'City Pack申請フロー',
  cityPackReviewInbox: 'City Packレビュー受信箱',
  cityPackEvidence: 'City Pack証跡閲覧',
  cityPackFeedback: 'City Packフィードバック',
  cityPackBulletins: '変更通知（Bulletin）',
  cityPackUpdateProposals: '更新提案',
  vendors: 'ベンダー一覧',
  linkRegistry: 'リンク管理（安全チェック）',
  killSwitch: '全配信停止スイッチ',
  llmFaq: 'FAQ回答支援',
  kbArticles: 'FAQナレッジ管理',
  implementationTargets: '実装状況トラッキング'
});

function readJson(fileName) {
  const filePath = path.join(INPUT_DIR, fileName);
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

function toDisplayPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  const absolute = path.resolve(filePath);
  const rel = path.relative(ROOT, absolute);
  if (!rel || rel.startsWith('..')) return absolute.replace(/\\/g, '/');
  return path.join(DISPLAY_ROOT, rel).replace(/\\/g, '/');
}

function listTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += listTestFiles(full);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.js')) count += 1;
  }
  return count;
}

function resolveStableSourceCommit() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      const headSha = event && event.pull_request && event.pull_request.head && event.pull_request.head.sha;
      if (typeof headSha === 'string' && headSha.trim().length > 0) {
        return headSha.trim();
      }
    } catch (_err) {
      // continue with git-based fallback
    }
  }

  try {
    const rawParents = execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const parts = rawParents.split(/\s+/).filter(Boolean);
    // In GitHub PR checks, checkout can be a synthetic merge commit.
    // Prefer the PR head (2nd parent) to keep generated artifacts stable.
    if (parts.length >= 3) return parts[2];
    if (parts.length >= 1) return parts[0];
  } catch (_err) {
    // best effort fallback
  }
  return 'HEAD';
}

function computeInputsDigest() {
  const hash = crypto.createHash('sha256');
  COMMIT_SOURCE_FILES.forEach((relPath) => {
    const absolute = path.join(ROOT, relPath);
    hash.update(relPath);
    hash.update('\n');
    if (fs.existsSync(absolute)) {
      hash.update(fs.readFileSync(absolute));
    } else {
      hash.update('MISSING');
    }
    hash.update('\n');
  });
  return hash.digest('hex');
}

function getLastCommit() {
  try {
    const digest = computeInputsDigest();
    return {
      hash: digest.slice(0, 40),
      date: 'NOT AVAILABLE',
      subject: 'repo_map_input_digest'
    };
  } catch (_err) {
    // continue with git fallback
  }

  try {
    const args = ['log', '-1', '--format=%H|%cI|%s', '--', ...COMMIT_SOURCE_FILES];
    const raw = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (raw) {
      const parts = raw.split('|');
      return {
        hash: parts[0] || '',
        date: parts[1] || '',
        subject: parts.slice(2).join('|') || ''
      };
    }
  } catch (_err) {
    // continue with commit fallback
  }

  const sourceCommit = resolveStableSourceCommit();
  const raw = execFileSync('git', ['show', '-s', '--format=%H|%cI|%s', sourceCommit], { cwd: ROOT, encoding: 'utf8' }).trim();
  const parts = raw.split('|');
  return {
    hash: parts[0] || '',
    date: parts[1] || '',
    subject: parts.slice(2).join('|') || ''
  };
}

function readTextSafe(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function extractSectionBullets(filePath, startRegex, endRegex, limit) {
  const text = readTextSafe(filePath);
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const out = [];
  for (const line of lines) {
    const row = line.trim();
    if (!inSection && startRegex.test(row)) {
      inSection = true;
      continue;
    }
    if (inSection && endRegex && endRegex.test(row)) {
      break;
    }
    if (!inSection) continue;
    if (row.startsWith('- ')) {
      out.push(row.slice(2).trim());
      if (out.length >= limit) break;
    }
  }
  return out;
}

function pickLines(primary, fallback, limit) {
  const picked = Array.isArray(primary)
    ? primary.filter((line) => typeof line === 'string' && line.trim().length > 0).slice(0, limit)
    : [];
  if (picked.length) return picked;
  return (fallback || []).slice(0, limit);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectCollectionLinks(collections) {
  if (!Array.isArray(collections)) return [];
  const dataMapText = fs.existsSync(DATA_MAP_PATH) ? fs.readFileSync(DATA_MAP_PATH, 'utf8') : '';
  const links = [];
  collections.forEach((collection) => {
    if (!collection || !dataMapText) return;
    const re = new RegExp('^\\s*-\\s*`' + escapeRegExp(collection) + '`', 'm');
    if (re.test(dataMapText)) {
      links.push(toDisplayPath(DATA_MAP_PATH));
    }
  });
  return links;
}

function resolveFeatureCategory(featureName) {
  if (!featureName) return 'platform';
  if (/^cityPack/i.test(featureName) || featureName === 'cityPacks') return 'city_pack';
  if (/^notifications$|^osNotifications$|^notificationDeliveries$|^monitorInsights$|^readModel$|^notificationTest$|^phase(36|37|61|67|68|73|77|81)/.test(featureName)) return 'notifications';
  if (/^kbArticles$|^llmFaq$|^phaseLLM4FaqAnswer$|^llmOps$|^phaseLLM2OpsExplain$|^phaseLLM3OpsNextActions$/.test(featureName)) return 'faq';
  if (/^userTimeline$|^phase6MemberSummary$|^phase5(AdminUsers|State|Review|Ops)$/.test(featureName)) return 'users';
  if (/killSwitch|linkRegistry|traceSearch|structDrift|osConfig|osAutomationConfig|osDeliveryBackfill|osDeliveryRecovery|osRedacStatus|llmConsent|llmConfig|redacMembershipUnlink|opsDecision|opsAssist|osKillSwitch/i.test(featureName)) return 'safety';
  if (/dashboard|kpi|stats|reports|analytics|opsOverview|phase18|phase22/i.test(featureName)) return 'analytics';
  return 'platform';
}

function resolveFeatureLabelJa(featureName, categoryKey) {
  if (FEATURE_NAME_JA[featureName]) return FEATURE_NAME_JA[featureName];
  const categoryLabel = CATEGORY_LABELS[categoryKey] || '共通';
  return `${categoryLabel}機能（${featureName}）`;
}

function mapCompletionToStatus(completion) {
  if (completion === 'completed') return '実装済み';
  if (completion === 'legacy') return '非推奨';
  return '改修中';
}

function mapCompletionToCanonicalStatus(completion) {
  if (completion === 'completed') return 'completed';
  if (completion === 'legacy') return 'deprecated';
  if (completion === 'planned') return 'planned';
  if (completion === 'in_progress') return 'in_progress';
  return 'in_progress';
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    if (pkg && typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
      return pkg.version.trim();
    }
  } catch (_err) {
    // best effort
  }
  return 'NOT AVAILABLE';
}

function isNotificationOpsFeature(feature) {
  const name = feature && typeof feature.feature === 'string' ? feature.feature : '';
  return name === 'notifications' || name === 'osNotifications';
}

function buildCanDo(feature) {
  if (isNotificationOpsFeature(feature)) {
    return [
      '判定: Kill SwitchがOFFなら送信できます。',
      '判定: CTA/LinkRegistry/配信対象をチェックし、NGなら送信しません。',
      '確認: 送信前はプレビュー、送信後は追跡IDと配信ログで確認できます。'
    ].slice(0, 3);
  }
  const rows = [];
  if (feature.completion === 'completed') rows.push('運用で利用できます（管理画面/API）。');
  if (feature.trace_linked) rows.push('追跡IDで操作の流れを確認できます。');
  if (feature.audit_linked) rows.push('監査ログで変更履歴を確認できます。');
  if (feature.killSwitch_dependent) rows.push('Kill Switchに連動して安全停止できます。');
  if (!rows.length) rows.push('利用可否の判定情報が不足しています。');
  return rows.slice(0, 3);
}

function buildCannotDo(feature) {
  if (isNotificationOpsFeature(feature)) {
    return [
      '停止条件: Kill SwitchがON（全配信停止）',
      '停止条件: CTA未設定 / LinkRegistry未設定 / 直URL',
      '停止条件: WARNリンク / 配信対象0件'
    ].slice(0, 3);
  }
  const rows = [];
  if (feature.completion === 'legacy') rows.push('非推奨経路のため、新規改善の対象ではありません。');
  if (!Number.isFinite(feature.tests_count) || feature.tests_count <= 0) rows.push('自動テストが不足しており、回帰検知が弱いです。');
  if (!feature.ssot_refs || feature.ssot_refs.length === 0) rows.push('この機能を説明するSSOT参照が不足しています。');
  if (!rows.length) rows.push('現時点で制約情報はありません。');
  return rows.slice(0, 3);
}

function buildRisks(feature) {
  if (isNotificationOpsFeature(feature)) {
    return [
      'LinkRegistryがWARNのリンクは送信できません。',
      '対象条件が厳しいと配信対象が0件になります。',
      '送信前にプレビューで内容（リンク/文面）を確認してください。'
    ].slice(0, 3);
  }
  const rows = [];
  if (feature.completion === 'legacy') rows.push('旧経路のため、将来の変更で挙動差が発生しやすいです。');
  if (!Number.isFinite(feature.tests_count) || feature.tests_count <= 0) rows.push('テスト不足のため、不具合を早期検知できない可能性があります。');
  return rows.slice(0, 3);
}

function buildNextActions(feature) {
  if (isNotificationOpsFeature(feature)) {
    return [
      '作成画面でプレビュー→承認→送信。',
      '送れない場合は Kill Switch と LinkRegistry を確認。',
      '送信後は Monitor で結果を確認。'
    ].slice(0, 3);
  }
  const rows = [];
  if (feature.completion === 'legacy') rows.push('正本の機能へ導線を寄せ、利用停止計画を作成する。');
  if (!Number.isFinite(feature.tests_count) || feature.tests_count <= 0) rows.push('最小の契約テストを追加する。');
  if (!feature.ssot_refs || feature.ssot_refs.length === 0) rows.push('SSOT_INDEXに説明ドキュメントを追記する。');
  if (!rows.length) rows.push('現状維持で定期監査を続ける。');
  return rows.slice(0, 3);
}

function resolveRepoPath(repoName) {
  if (!repoName || typeof repoName !== 'string') return null;
  const candidate = path.join(ROOT, 'src', 'repos', 'firestore', `${repoName}.js`);
  if (fs.existsSync(candidate)) return toDisplayPath(candidate);
  return null;
}

function buildRouteIndex(routeToUsecase) {
  const map = new Map();
  Object.entries(routeToUsecase || {}).forEach(([routePath, usecases]) => {
    (usecases || []).forEach((usecase) => {
      if (!map.has(usecase)) map.set(usecase, new Set());
      map.get(usecase).add(toDisplayPath(path.resolve(ROOT, routePath)));
    });
  });
  return map;
}

function buildFeatureCards(features, dependencyGraph) {
  const routeIndex = buildRouteIndex(dependencyGraph.route_to_usecase || {});
  const categories = new Map();
  CATEGORY_ORDER.forEach((key) => {
    categories.set(key, {
      key,
      labelJa: CATEGORY_LABELS[key],
      items: []
    });
  });

  (features || []).forEach((feature) => {
    const categoryKey = resolveFeatureCategory(feature.feature);
    const card = {
      id: feature.feature,
      nameJa: resolveFeatureLabelJa(feature.feature, categoryKey),
      status: mapCompletionToStatus(feature.completion),
      canDo: buildCanDo(feature),
      cannotDo: buildCannotDo(feature),
      risks: buildRisks(feature),
      nextActions: buildNextActions(feature),
      relatedFiles: [],
      evidence: []
    };

    const fileSet = new Set();
    (feature.repos || []).forEach((repoName) => {
      const repoPath = resolveRepoPath(repoName);
      if (repoPath) fileSet.add(repoPath);
    });

    (feature.usecases || []).forEach((usecase) => {
      const routeSet = routeIndex.get(usecase);
      if (!routeSet) return;
      for (const routePath of routeSet.values()) {
        fileSet.add(routePath);
      }
    });

    collectCollectionLinks(feature.collections).forEach((docPath) => {
      fileSet.add(docPath);
    });

    const relatedFiles = Array.from(fileSet.values()).sort().slice(0, 8);
    card.relatedFiles = relatedFiles;
    card.evidence = relatedFiles.slice(0, 3).map((filePath) => `${filePath}:1`);

    const category = categories.get(categoryKey) || categories.get('platform');
    category.items.push(card);
  });

  CATEGORY_ORDER.forEach((key) => {
    const category = categories.get(key);
    category.items.sort((a, b) => a.nameJa.localeCompare(b.nameJa, 'ja'));
  });

  return CATEGORY_ORDER.map((key) => categories.get(key));
}

function buildOperationalLayer() {
  return {
    summaryJa: [
      '登録→通知→行動/チェック→Ops判断の一本道を運用の本線にしています。',
      '通知配信は送信前の安全チェックを通したものだけ実行されます。',
      '操作履歴は追跡IDで横断確認でき、監査ログで証跡を残します。'
    ],
    flows: [
      {
        nameJa: '通知を作る・承認する',
        entryRoute: '/admin/app?pane=composer',
        evidence: [
          '/Users/parentyai.com/Projects/Member/src/index.js:578',
          '/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js:34'
        ]
      },
      {
        nameJa: '配信結果を確認する',
        entryRoute: '/admin/app?pane=monitor',
        evidence: [
          '/Users/parentyai.com/Projects/Member/src/index.js:584',
          '/Users/parentyai.com/Projects/Member/src/index.js:656'
        ]
      },
      {
        nameJa: '運用判断を確定する',
        entryRoute: '/admin/app?pane=audit',
        evidence: [
          '/Users/parentyai.com/Projects/Member/src/index.js:566',
          '/Users/parentyai.com/Projects/Member/docs/PHASE24_PLAN.md:16'
        ]
      }
    ]
  };
}

function buildDeveloperLayer(features, dependencyGraph, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const packageVersion = opts.packageVersion || 'NOT AVAILABLE';
  const lastChanged = opts.lastChanged || 'NOT AVAILABLE';
  const routeIndex = buildRouteIndex(dependencyGraph.route_to_usecase || {});
  const out = [];

  CATEGORY_ORDER.forEach((key) => {
    const labelJa = CATEGORY_LABELS[key] || '共通基盤';
    out.push({ key, labelJa, items: [] });
  });

  const byCategory = new Map(out.map((row) => [row.key, row]));
  (features || []).forEach((feature) => {
    const categoryKey = resolveFeatureCategory(feature.feature);
    const category = byCategory.get(categoryKey) || byCategory.get('platform');
    const entrySet = new Set();
    (feature.usecases || []).forEach((usecase) => {
      const routeSet = routeIndex.get(usecase);
      if (!routeSet) return;
      for (const routePath of routeSet.values()) {
        const normalized = routePath.replace(/\\/g, '/');
        const prefix = `${DISPLAY_ROOT}/`;
        if (normalized.startsWith(prefix)) {
          entrySet.add(normalized.slice(prefix.length));
        } else {
          entrySet.add(normalized);
        }
      }
    });

    const item = {
      id: feature.feature,
      nameJa: resolveFeatureLabelJa(feature.feature, categoryKey),
      categoryJa: category.labelJa,
      status: mapCompletionToCanonicalStatus(feature.completion),
      version: packageVersion,
      lastChanged,
      testsCount: Number.isFinite(Number(feature.tests_count)) ? Number(feature.tests_count) : 0,
      killSwitchDependent: Boolean(feature.killSwitch_dependent),
      auditDependent: Boolean(feature.audit_linked),
      canDo: buildCanDo(feature),
      cannotDo: buildCannotDo(feature),
      risks: buildRisks(feature),
      nextActions: buildNextActions(feature),
      relatedRepos: Array.isArray(feature.repos) ? feature.repos.slice(0, 8) : [],
      relatedCollections: Array.isArray(feature.collections) ? feature.collections.slice(0, 8) : [],
      entrypoints: Array.from(entrySet.values()).slice(0, 8),
      evidence: (Array.isArray(feature.repos) ? feature.repos : [])
        .map((repoName) => resolveRepoPath(repoName))
        .filter(Boolean)
        .slice(0, 3)
        .map((filePath) => `${filePath}:1`)
    };
    category.items.push(item);
  });

  out.forEach((category) => {
    category.items.sort((a, b) => a.nameJa.localeCompare(b.nameJa, 'ja'));
  });
  return out;
}

function buildCommunicationLayer(summaryCounts) {
  const counts = summaryCounts && typeof summaryCounts === 'object' ? summaryCounts : {};
  const legacyCount = Number.isFinite(Number(counts.legacy)) ? Number(counts.legacy) : 0;
  const implementedCount = Number.isFinite(Number(counts.implemented)) ? Number(counts.implemented) : 0;
  const redacCanDo = extractSectionBullets(ADMIN_MANUAL_PATH, /^A\./, /^B\./, 3);
  const redacFlow = extractSectionBullets(ADMIN_MANUAL_PATH, /^B\./, /^C\./, 3);
  const redacSafety = extractSectionBullets(RUNBOOK_JA_PATH, /^## 1\./, /^## 2\./, 3);
  const userOverview = extractSectionBullets(PHASE24_PLAN_PATH, /^## 現状棚卸し/, /^## Phase24でやること/, 3);
  const userPrivacy = extractSectionBullets(DATA_MAP_PATH, /^## Primary Identifiers/, /^## Stored Data/, 3);
  const userConsultation = extractSectionBullets(ADMIN_MANUAL_PATH, /^E\./, /^F\./, 3);

  return {
    redacGuide: {
      whatCanDo: pickLines(redacCanDo, [
        '通知の作成・承認・送信を実行できます。',
        '送信結果の確認と再試行待ちの調査ができます。',
        '追跡IDで判断履歴と変更履歴を確認できます。'
      ], 3),
      safetyDesign: pickLines(redacSafety, [
        '緊急停止の手順を先に実行し、事故の拡大を防ぎます。',
        'traceId で判断ログと監査ログを横断確認します。',
        '再送しない回復（封印）を優先します。'
      ], 3),
      operationFlow: pickLines(redacFlow, [
        'ホーム→作成→承認→送信→結果→安全の順で操作します。',
        '送信前に planHash / confirmToken を確認します。',
        '異常時は runbook 手順で停止と回復を実施します。'
      ], 3),
      roadmap: [
        `実装済み機能は ${implementedCount} 件です。`,
        `非推奨機能は ${legacyCount} 件で、正本導線への集約対象です。`,
        '構造監査入力JSONを基準に運用改善を継続します。'
      ],
      faq: [
        { q: '運用で最初に確認する場所は？', a: 'ダッシュボードと監査ログで、直近の異常と判断履歴を確認します。' },
        { q: '誤送信が不安なときは？', a: '送信前に計画を確認し、必要なら全配信停止スイッチを先にONにします。' },
        { q: '変更履歴はどこで見る？', a: '追跡ID検索で監査ログと判断ログをまとめて確認できます。' }
      ],
      evidence: [
        '/Users/parentyai.com/Projects/Member/docs/ADMIN_MANUAL_JA.md:6',
        '/Users/parentyai.com/Projects/Member/docs/RUNBOOK_JA.md:5',
        '/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:29'
      ]
    },
    userGuide: {
      serviceOverview: pickLines(userOverview, [
        'このサービスは、登録→通知→行動/チェック→運用判断の流れを支援します。',
        '通知は状況に応じて必要な行動を1つずつ案内します。',
        '困ったときは相談導線から運用窓口へつながります。'
      ], 3),
      privacy: pickLines(userPrivacy, [
        '個人情報は最小限を保存し、監査ログで操作履歴を管理します。',
        'リンクは安全確認済みの一覧からのみ配信されます。',
        '全配信停止スイッチにより事故時の拡大を防止します。'
      ], 3),
      consultation: pickLines(userConsultation, [
        '困りごとは運用窓口の手順に従って問い合わせできます。',
        'FAQで解決できない場合は運用者が判断して対応します。',
        '追跡IDにより対応状況を後から確認できます。'
      ], 3),
      evidence: [
        '/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:15',
        '/Users/parentyai.com/Projects/Member/docs/ADMIN_MANUAL_JA.md:40',
        '/Users/parentyai.com/Projects/Member/docs/RUNBOOK_JA.md:14'
      ]
    },
    sourceDocs: [
      toDisplayPath(ADMIN_MANUAL_PATH),
      toDisplayPath(DATA_MAP_PATH),
      toDisplayPath(RUNBOOK_JA_PATH),
      toDisplayPath(PHASE24_PLAN_PATH)
    ]
  };
}

function buildScenarioStepMatrix() {
  const scenarios = ['A', 'B', 'C', 'D'];
  const steps = ['3mo', '1mo', 'week', 'after1w'];
  const cells = [];
  scenarios.forEach((scenarioKey) => {
    steps.forEach((stepKey) => {
      cells.push({
        scenarioKey,
        stepKey,
        notificationCount: 0,
        states: {
          draft: 0,
          active: 0,
          sent: 0
        },
        note: 'NOT AVAILABLE'
      });
    });
  });
  return { scenarios, steps, cells };
}

function buildRepoMapUi() {
  const featureMap = readJson('feature_map.json');
  const dependencyGraph = readJson('dependency_graph.json');
  readJson('state_transitions.json');
  readJson('data_model_map.json');
  const packageVersion = readPackageVersion();

  const features = Array.isArray(featureMap.features) ? featureMap.features : [];
  const implemented = features.filter((item) => item && item.completion === 'completed').length;
  const legacy = features.filter((item) => item && item.completion === 'legacy').length;
  const testCount = listTestFiles(path.join(ROOT, 'tests'));
  const lastCommit = getLastCommit();
  const layers = {
    operational: buildOperationalLayer(),
    developer: {
      categories: buildDeveloperLayer(features, dependencyGraph, {
        packageVersion,
        lastChanged: lastCommit.date || 'NOT AVAILABLE'
      }),
      scenarioStepMatrix: buildScenarioStepMatrix()
    },
    communication: buildCommunicationLayer({ implemented, legacy })
  };

  return {
    meta: {
      generatedAt: lastCommit.date || new Date().toISOString(),
      version: packageVersion,
      lastCommit,
      testCount
    },
    systemOverview: {
      what: [
        'このシステムは、会員の登録から通知配信までを運用する管理基盤です。',
        '通知とCity Packは、安全チェックを通したうえで配信されます。',
        '操作履歴は追跡IDでたどれ、監査ログで確認できます。'
      ],
      statusSummary: {
        implemented,
        legacy
      }
    },
    categories: buildFeatureCards(features, dependencyGraph),
    scenarioStepMatrix: layers.developer.scenarioStepMatrix,
    layers,
    glossaryJa: GLOSSARY_JA
  };
}

function run() {
  const checkMode = process.argv.includes('--check');
  const payload = buildRepoMapUi();
  const rendered = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(`repo map missing: ${OUTPUT_PATH}`);
      process.exit(1);
    }
    const existing = fs.readFileSync(OUTPUT_PATH, 'utf8');
    if (existing !== rendered) {
      console.error('repo map drift detected. run: npm run repo-map:generate');
      process.exit(1);
    }
    console.log('repo map check ok');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, rendered, 'utf8');
  console.log(`repo map generated: ${OUTPUT_PATH}`);
}

run();
