'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');

const requiredDocs = [
  'ADMIN_MANUAL_JA.md',
  'ADMIN_UI_DICTIONARY_JA.md',
  'SSOT_ADMIN_UI_MASTER_TABLE_V1.md',
  'SSOT_ADMIN_UI_ROUTES_V2.md',
  'RUNBOOK_JA.md',
  'SECURITY_MODEL_JA.md',
  'CHANGELOG_DOCS.md'
].map((name) => path.join(DOCS_DIR, name));

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`必須ファイルが見つかりません: ${filePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseJsonBlock(text, startMarker, endMarker, label) {
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    fail(`${label} のJSONブロックが見つかりません (${startMarker} ... ${endMarker})`);
    return null;
  }
  const block = text.slice(startIdx + startMarker.length, endIdx).trim();
  try {
    return JSON.parse(block);
  } catch (err) {
    fail(`${label} のJSONブロックが解析できません: ${err.message}`);
    return null;
  }
}

function normalizeSet(values) {
  return Array.from(new Set((values || []).map((v) => String(v)))).sort();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTextArray(values) {
  return (values || []).map((v) => normalizeText(v)).filter((v) => v.length > 0);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function extractQuotedValues(source, keyLabel) {
  const match = source.match(new RegExp(`${keyLabel}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`, 'm'));
  if (!match) {
    fail(`${keyLabel} の定義が見つかりません: ${keyLabel}`);
    return [];
  }
  const body = match[1];
  const values = [];
  const regex = /'([^']+)'/g;
  let m;
  while ((m = regex.exec(body)) !== null) {
    values.push(m[1]);
  }
  return values;
}

function extractTagTexts(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const stripped = match[1].replace(/<[^>]*>/g, '');
    const normalized = normalizeText(stripped);
    if (normalized) results.push(normalized);
  }
  return results;
}

function extractPaneValuesFromHtml(html) {
  const values = [];
  const regex = /data-pane="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    values.push(match[1]);
  }
  return normalizeSet(values);
}

// 1) required docs exist
requiredDocs.forEach((filePath) => readText(filePath));

// 2) README must link to ADMIN_MANUAL_JA
const readme = readText(path.join(ROOT, 'README.md'));
if (readme && !readme.includes('docs/ADMIN_MANUAL_JA.md')) {
  fail('README.md に docs/ADMIN_MANUAL_JA.md へのリンクがありません');
}

// 3) Admin UI dictionary routes must match implemented routes
const dictPath = path.join(DOCS_DIR, 'ADMIN_UI_DICTIONARY_JA.md');
const dictText = readText(dictPath);
const routesDoc = parseJsonBlock(dictText, '<!-- ADMIN_UI_ROUTES_BEGIN -->', '<!-- ADMIN_UI_ROUTES_END -->', 'ADMIN_UI_ROUTES');
const uiTextsDoc = parseJsonBlock(dictText, '<!-- ADMIN_UI_TEXTS_BEGIN -->', '<!-- ADMIN_UI_TEXTS_END -->', 'ADMIN_UI_TEXTS');
if (routesDoc) {
  const docRoutes = normalizeSet(routesDoc.map((r) => r && r.route).filter(Boolean));
  const routeEntries = routesDoc.filter((r) => r && typeof r.route === 'string');
  const missingFields = routesDoc.filter((r) => !r || typeof r.route !== 'string' || !Object.prototype.hasOwnProperty.call(r, 'uiFile'));
  if (missingFields.length) {
    fail('ADMIN_UI_ROUTES の各行に route と uiFile が必要です');
  }

  const adminFiles = fs.readdirSync(ADMIN_DIR).filter((f) => f.endsWith('.html'));
  const docUiFiles = normalizeSet(routesDoc.map((r) => r && r.uiFile).filter(Boolean));
  const unmapped = adminFiles.filter((file) => !docUiFiles.includes(`apps/admin/${file}`));
  if (unmapped.length) {
    warn(`apps/admin のHTMLが辞書に未対応です（legacy棚卸しドリフト）: ${unmapped.join(', ')}`);
  }

  const indexText = readText(path.join(ROOT, 'src', 'index.js'));
  for (const entry of routeEntries) {
    if (!entry.route.startsWith('/admin')) {
      fail(`ADMIN_UI辞書のルートが /admin 配下ではありません: ${entry.route}`);
    }
    if (!indexText.includes(entry.route)) {
      warn(`src/index.js に旧ADMIN_UI_ROUTESのルート文字列が見つかりません（委譲化の可能性）: ${entry.route}`);
    }
    if (entry.uiFile) {
      const full = path.join(ROOT, entry.uiFile);
      if (!fs.existsSync(full)) {
        warn(`ADMIN_UI辞書の uiFile が存在しません（legacy整合ドリフト）: ${entry.uiFile}`);
      }
    }
  }

  if (uiTextsDoc) {
    const uiTextRoutes = normalizeSet(Object.keys(uiTextsDoc));
    const uiRoutes = routeEntries.filter((entry) => entry.uiFile).map((entry) => entry.route);
    const missingUiTexts = uiRoutes.filter((route) => !uiTextRoutes.includes(route));
    if (missingUiTexts.length) {
      fail(`ADMIN_UI_TEXTS に定義がありません: ${missingUiTexts.join(', ')}`);
    }
    const extraUiTexts = uiTextRoutes.filter((route) => !uiRoutes.includes(route));
    if (extraUiTexts.length) {
      fail(`ADMIN_UI_TEXTS に余分なルートがあります: ${extraUiTexts.join(', ')}`);
    }

    for (const entry of routeEntries) {
      if (!entry.uiFile) continue;
      const expected = uiTextsDoc[entry.route];
      if (!expected || typeof expected !== 'object') {
        fail(`ADMIN_UI_TEXTS に ${entry.route} の定義がありません`);
        continue;
      }
      const htmlPath = path.join(ROOT, entry.uiFile);
      const html = readText(htmlPath);
      const titleText = extractTagTexts(html, 'title')[0] || '';
      const h1Text = extractTagTexts(html, 'h1')[0] || '';
      const h2Texts = extractTagTexts(html, 'h2');

      const expectedTitle = normalizeText(expected.title);
      const expectedH1 = normalizeText(expected.h1);
      const expectedH2 = normalizeTextArray(expected.h2);
      const actualTitle = normalizeText(titleText);
      const actualH1 = normalizeText(h1Text);
      const actualH2 = normalizeTextArray(h2Texts);

      if (!expectedTitle) {
        fail(`ADMIN_UI_TEXTS の title が空です: ${entry.route}`);
      } else if (expectedTitle !== actualTitle) {
        fail(`画面タイトルが不一致 (${entry.route}): expected="${expectedTitle}" actual="${actualTitle}"`);
      }

      if (!expectedH1) {
        fail(`ADMIN_UI_TEXTS の h1 が空です: ${entry.route}`);
      } else if (expectedH1 !== actualH1) {
        fail(`h1 が不一致 (${entry.route}): expected="${expectedH1}" actual="${actualH1}"`);
      }

      if (!arraysEqual(expectedH2, actualH2)) {
        fail(`h2 が不一致 (${entry.route}): expected="${expectedH2.join(' | ')}" actual="${actualH2.join(' | ')}"`);
      }
    }
  }
}

// 3-b) Admin UI routes v2 must align across docs/runtime/server/app pane contract
const routesV2Text = readText(path.join(DOCS_DIR, 'SSOT_ADMIN_UI_ROUTES_V2.md'));
const routesV2Doc = parseJsonBlock(
  routesV2Text,
  '<!-- ADMIN_UI_ROUTES_V2_BEGIN -->',
  '<!-- ADMIN_UI_ROUTES_V2_END -->',
  'ADMIN_UI_ROUTES_V2'
);
if (routesV2Doc) {
  if (!Array.isArray(routesV2Doc) || routesV2Doc.length === 0) {
    fail('ADMIN_UI_ROUTES_V2 は1件以上の配列である必要があります');
  } else {
    const missingFields = routesV2Doc.filter((entry) => {
      return !entry
        || typeof entry.route !== 'string'
        || typeof entry.type !== 'string'
        || typeof entry.pane !== 'string'
        || !Object.prototype.hasOwnProperty.call(entry, 'legacy_source');
    });
    if (missingFields.length) {
      fail('ADMIN_UI_ROUTES_V2 の各行に route/type/pane/legacy_source が必要です');
    }

    const v2Routes = routesV2Doc.map((entry) => entry.route).filter(Boolean);
    const duplicateRoutes = v2Routes.filter((route, idx) => v2Routes.indexOf(route) !== idx);
    if (duplicateRoutes.length) {
      fail(`ADMIN_UI_ROUTES_V2 に重複routeがあります: ${normalizeSet(duplicateRoutes).join(', ')}`);
    }

    const requiredUnifiedRoutes = [
      '/admin/ops',
      '/admin/ops_readonly',
      '/admin/composer',
      '/admin/monitor',
      '/admin/errors',
      '/admin/read-model',
      '/admin/master',
      '/admin/review'
    ];
    const missingUnified = requiredUnifiedRoutes.filter((route) => !v2Routes.includes(route));
    if (missingUnified.length) {
      fail(`ADMIN_UI_ROUTES_V2 に統合対象routeが不足しています: ${missingUnified.join(', ')}`);
    }

    let runtimeRoutes = null;
    try {
      const runtimeModule = require(path.join(ROOT, 'src', 'shared', 'adminUiRoutesV2.js'));
      runtimeRoutes = Array.isArray(runtimeModule.ADMIN_UI_ROUTES_V2) ? runtimeModule.ADMIN_UI_ROUTES_V2 : null;
    } catch (err) {
      fail(`runtime route map の読み込みに失敗しました: ${err.message}`);
    }
    if (!runtimeRoutes) {
      fail('runtime route map (ADMIN_UI_ROUTES_V2) が取得できません');
    } else {
      const docNormalized = routesV2Doc.map((entry) => ({
        route: entry.route,
        type: entry.type,
        pane: entry.pane,
        legacySource: Object.prototype.hasOwnProperty.call(entry, 'legacy_source') ? entry.legacy_source : null
      })).sort((left, right) => left.route.localeCompare(right.route));
      const runtimeNormalized = runtimeRoutes.map((entry) => ({
        route: entry.route,
        type: entry.type,
        pane: entry.pane,
        legacySource: Object.prototype.hasOwnProperty.call(entry, 'legacySource') ? entry.legacySource : null
      })).sort((left, right) => left.route.localeCompare(right.route));
      if (JSON.stringify(docNormalized) !== JSON.stringify(runtimeNormalized)) {
        fail('ADMIN_UI_ROUTES_V2 (docs) と runtime ADMIN_UI_ROUTES_V2 が一致しません');
      }
    }

    const indexText = readText(path.join(ROOT, 'src', 'index.js'));
    if (!indexText.includes('handleAdminUiRoute(req, res, pathname)')) {
      fail('src/index.js に admin UI route 委譲ハンドラ呼び出しが見つかりません');
    }

    const appHtml = readText(path.join(ROOT, 'apps', 'admin', 'app.html'));
    const appPanes = extractPaneValuesFromHtml(appHtml);
    const v2Panes = normalizeSet(routesV2Doc.map((entry) => entry.pane).filter(Boolean));
    const missingPanes = v2Panes.filter((pane) => !appPanes.includes(pane));
    if (missingPanes.length) {
      fail(`ADMIN_UI_ROUTES_V2 のpaneが app.html に存在しません: ${missingPanes.join(', ')}`);
    }
  }
}

// 3-c) Admin UI Master Table V1 must be parseable and runtime-loadable
const masterTablePath = path.join(DOCS_DIR, 'SSOT_ADMIN_UI_MASTER_TABLE_V1.md');
const masterTableText = readText(masterTablePath);
const masterTableDoc = parseJsonBlock(
  masterTableText,
  '<!-- ADMIN_UI_MASTER_TABLE_BEGIN -->',
  '<!-- ADMIN_UI_MASTER_TABLE_END -->',
  'ADMIN_UI_MASTER_TABLE'
);
if (masterTableDoc) {
  if (typeof masterTableDoc.version !== 'string' || !masterTableDoc.version.trim()) {
    fail('ADMIN_UI_MASTER_TABLE.version は必須です');
  }
  if (!Array.isArray(masterTableDoc.flows) || masterTableDoc.flows.length === 0) {
    fail('ADMIN_UI_MASTER_TABLE.flows は1件以上必要です');
  } else {
    const flowIdSet = new Set();
    const actionKeySet = new Set();
    const globalMethodPathSet = new Set();
    masterTableDoc.flows.forEach((flow, index) => {
      const idx = `flows[${index}]`;
      if (!isObject(flow)) {
        fail(`${idx} はobjectである必要があります`);
        return;
      }
      if (typeof flow.flowId !== 'string' || !flow.flowId.trim()) {
        fail(`${idx}.flowId は必須です`);
      } else if (flowIdSet.has(flow.flowId)) {
        fail(`ADMIN_UI_MASTER_TABLE.flowId 重複: ${flow.flowId}`);
      } else {
        flowIdSet.add(flow.flowId);
      }
      if (typeof flow.confirmMode !== 'string' || !flow.confirmMode.trim()) {
        fail(`${idx}.confirmMode は必須です`);
      } else if (!['required', 'warn_only'].includes(flow.confirmMode)) {
        fail(`${idx}.confirmMode が不正です`);
      }
      if (!isObject(flow.stateMachine)) fail(`${idx}.stateMachine はobject必須です`);
      if (!isObject(flow.guardRules)) fail(`${idx}.guardRules はobject必須です`);
      if (!Array.isArray(flow.writeActions) || flow.writeActions.length === 0) fail(`${idx}.writeActions は1件以上必要です`);
      if (!isObject(flow.evidenceBindings)) fail(`${idx}.evidenceBindings はobject必須です`);
      if (!isObject(flow.roleRestrictions)) fail(`${idx}.roleRestrictions はobject必須です`);

      const guardRules = flow.guardRules || {};
      const actorMode = guardRules.actorMode;
      const traceMode = guardRules.traceMode;
      const confirmMode = guardRules.confirmMode;
      const killSwitchCheck = guardRules.killSwitchCheck;
      const auditMode = guardRules.auditMode;
      if (!['required', 'allow_fallback'].includes(actorMode)) fail(`${idx}.guardRules.actorMode が不正です`);
      if (!['required'].includes(traceMode)) fail(`${idx}.guardRules.traceMode が不正です`);
      if (!['required', 'optional', 'none'].includes(confirmMode)) fail(`${idx}.guardRules.confirmMode が不正です`);
      if (!['required', 'none'].includes(killSwitchCheck)) fail(`${idx}.guardRules.killSwitchCheck が不正です`);
      if (!['required'].includes(auditMode)) fail(`${idx}.guardRules.auditMode が不正です`);

      const methodPathSet = new Set();
      (flow.writeActions || []).forEach((action, actionIndex) => {
        const actionIdx = `${idx}.writeActions[${actionIndex}]`;
        if (!isObject(action)) {
          fail(`${actionIdx} はobjectである必要があります`);
          return;
        }
        if (typeof action.actionKey !== 'string' || !action.actionKey.trim()) {
          fail(`${actionIdx}.actionKey は必須です`);
          return;
        }
        if (actionKeySet.has(action.actionKey)) {
          fail(`ADMIN_UI_MASTER_TABLE.actionKey 重複: ${action.actionKey}`);
        } else {
          actionKeySet.add(action.actionKey);
        }
        if (typeof action.method !== 'string' || !action.method.trim()) fail(`${actionIdx}.method は必須です`);
        if (typeof action.pathPattern !== 'string' || !action.pathPattern.trim()) fail(`${actionIdx}.pathPattern は必須です`);
        if (typeof action.dangerClass !== 'string' || !action.dangerClass.trim()) fail(`${actionIdx}.dangerClass は必須です`);
        if (typeof action.handlerFile !== 'string' || !action.handlerFile.trim()) fail(`${actionIdx}.handlerFile は必須です`);
        if (action.workbenchZoneRequired !== true) fail(`${actionIdx}.workbenchZoneRequired は true 固定です`);
        const methodPathKey = `${String(action.method || '').trim().toUpperCase()} ${String(action.pathPattern || '').trim()}`;
        if (methodPathSet.has(methodPathKey)) fail(`${idx}.writeActions method/path 重複: ${methodPathKey}`);
        methodPathSet.add(methodPathKey);
        if (globalMethodPathSet.has(methodPathKey)) fail(`ADMIN_UI_MASTER_TABLE.writeActions method/path 重複: ${methodPathKey}`);
        globalMethodPathSet.add(methodPathKey);
      });
    });
  }

  try {
    const managedFlowRegistry = require(path.join(ROOT, 'src', 'domain', 'managedFlowRegistry.js'));
    managedFlowRegistry.loadManagedFlowTableFromDocs();
  } catch (err) {
    fail(`managedFlowRegistry のdocs読込に失敗しました: ${err.message}`);
  }

  try {
    const bindingsModule = require(path.join(ROOT, 'src', 'routes', 'admin', 'managedFlowBindings.js'));
    const bindings = typeof bindingsModule.getManagedFlowBindings === 'function'
      ? bindingsModule.getManagedFlowBindings()
      : [];
    if (!Array.isArray(bindings) || bindings.length === 0) {
      fail('managedFlowBindings が空です');
    } else {
      const actionSet = new Set();
      const methodPathSet = new Set();
      bindings.forEach((binding, index) => {
        const idx = `managedFlowBindings[${index}]`;
        if (!isObject(binding)) {
          fail(`${idx} はobjectである必要があります`);
          return;
        }
        if (typeof binding.actionKey !== 'string' || !binding.actionKey.trim()) fail(`${idx}.actionKey は必須です`);
        if (typeof binding.method !== 'string' || !binding.method.trim()) fail(`${idx}.method は必須です`);
        if (typeof binding.pathPattern !== 'string' || !binding.pathPattern.trim()) fail(`${idx}.pathPattern は必須です`);
        if (typeof binding.handlerFile !== 'string' || !binding.handlerFile.trim()) fail(`${idx}.handlerFile は必須です`);
        if (!(binding.pathRegex instanceof RegExp)) fail(`${idx}.pathRegex はRegExp必須です`);
        const actionKey = String(binding.actionKey || '').trim();
        if (actionSet.has(actionKey)) fail(`managedFlowBindings.actionKey 重複: ${actionKey}`);
        actionSet.add(actionKey);
        const methodPathKey = `${String(binding.method || '').trim().toUpperCase()} ${String(binding.pathPattern || '').trim()}`;
        if (methodPathSet.has(methodPathKey)) fail(`managedFlowBindings.method/path 重複: ${methodPathKey}`);
        methodPathSet.add(methodPathKey);
        const handlerFilePath = path.join(ROOT, String(binding.handlerFile || '').trim());
        if (!fs.existsSync(handlerFilePath)) fail(`${idx}.handlerFile が存在しません: ${binding.handlerFile}`);
      });
    }
  } catch (err) {
    fail(`managedFlowBindings の読込に失敗しました: ${err.message}`);
  }
}

// 4) Notification statuses must match code
const statuses = parseJsonBlock(dictText, '<!-- NOTIFICATION_STATUSES_BEGIN -->', '<!-- NOTIFICATION_STATUSES_END -->', 'NOTIFICATION_STATUSES');
if (statuses) {
  const templatesSource = readText(path.join(ROOT, 'src', 'repos', 'firestore', 'notificationTemplatesRepo.js'));
  const templatesStatuses = normalizeSet(extractQuotedValues(templatesSource, 'ALLOWED_STATUSES'));
  const templatesDoc = normalizeSet(statuses.notificationTemplates || []);
  if (!arraysEqual(templatesStatuses, templatesDoc)) {
    fail(`notification_templates の状態が不一致: code=${templatesStatuses.join(', ')} doc=${templatesDoc.join(', ')}`);
  }

  const templatesVSource = readText(path.join(ROOT, 'src', 'repos', 'firestore', 'templatesVRepo.js'));
  const templatesVStatuses = normalizeSet(extractQuotedValues(templatesVSource, 'ALLOWED_STATUSES'));
  const templatesVDoc = normalizeSet(statuses.templatesV || []);
  if (!arraysEqual(templatesVStatuses, templatesVDoc)) {
    fail(`templates_v の状態が不一致: code=${templatesVStatuses.join(', ')} doc=${templatesVDoc.join(', ')}`);
  }

  const retrySource = readText(path.join(ROOT, 'src', 'repos', 'firestore', 'sendRetryQueueRepo.js'));
  const retryStatuses = normalizeSet(extractQuotedValues(retrySource, 'STATUS_VALUES'));
  const retryDoc = normalizeSet(statuses.retryQueue || []);
  if (!arraysEqual(retryStatuses, retryDoc)) {
    fail(`send_retry_queue の状態が不一致: code=${retryStatuses.join(', ')} doc=${retryDoc.join(', ')}`);
  }

  const notificationDoc = normalizeSet(statuses.notifications || []);
  const notifSources = [
    readText(path.join(ROOT, 'src', 'routes', 'admin', 'osNotifications.js')),
    readText(path.join(ROOT, 'src', 'usecases', 'notifications', 'sendNotification.js'))
  ].join('\n');
  const missingStatuses = notificationDoc.filter((status) => !notifSources.includes(`'${status}'`));
  if (missingStatuses.length) {
    fail(`notifications の状態がコードに見当たりません: ${missingStatuses.join(', ')}`);
  }
}

// 5) Notification categories
const categoriesDoc = parseJsonBlock(dictText, '<!-- NOTIFICATION_CATEGORIES_BEGIN -->', '<!-- NOTIFICATION_CATEGORIES_END -->', 'NOTIFICATION_CATEGORIES');
if (categoriesDoc) {
  const categorySource = readText(path.join(ROOT, 'src', 'domain', 'notificationCategory.js'));
  const match = categorySource.match(/NOTIFICATION_CATEGORIES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/m);
  if (!match) {
    fail('notificationCategory.js の NOTIFICATION_CATEGORIES が見つかりません');
  } else {
    const values = [];
    const regex = /'([^']+)'/g;
    let m;
    while ((m = regex.exec(match[1])) !== null) values.push(m[1]);
    const code = normalizeSet(values);
    const doc = normalizeSet(categoriesDoc);
    if (!arraysEqual(code, doc)) {
      fail(`通知カテゴリが不一致: code=${code.join(', ')} doc=${doc.join(', ')}`);
    }
  }
}

// 6) Log fields must be declared
const logFields = parseJsonBlock(dictText, '<!-- LOG_FIELDS_BEGIN -->', '<!-- LOG_FIELDS_END -->', 'LOG_FIELDS');
if (logFields) {
  const required = ['audit_logs', 'decision_logs', 'decision_timeline', 'notification_deliveries'];
  required.forEach((key) => {
    if (!Array.isArray(logFields[key]) || logFields[key].length === 0) {
      fail(`LOG_FIELDS に ${key} が定義されていません`);
    }
  });
}

// 7) Security model must state PII boundary and admin protection
const security = readText(path.join(DOCS_DIR, 'SECURITY_MODEL_JA.md'));
if (security) {
  const requiredPhrases = ['会員番号', '平文', 'ADMIN_OS_TOKEN'];
  requiredPhrases.forEach((phrase) => {
    if (!security.includes(phrase)) {
      fail(`SECURITY_MODEL_JA.md に必要な記述がありません: ${phrase}`);
    }
  });
}

// 8) SSOT_INDEX: all file references must resolve to existing files
const ssotIndexPath = path.join(DOCS_DIR, 'SSOT_INDEX.md');
if (fs.existsSync(ssotIndexPath)) {
  const ssotText = fs.readFileSync(ssotIndexPath, 'utf8');
  // Extract all docs/... references from the SSOT index (markdown links and bare paths).
  const docRefRegex = /\bdocs\/[^\s)\]`'"]+\.md\b/g;
  const ssotRefs = Array.from(new Set(ssotText.match(docRefRegex) || []));
  for (const ref of ssotRefs) {
    const refPath = path.join(ROOT, ref);
    if (!fs.existsSync(refPath)) {
      fail(`SSOT_INDEX が参照するファイルが存在しません: ${ref}`);
    }
  }

  // Required SSOT documents must appear in the index.
  const requiredInIndex = [
    'SSOT_ADMIN_UI_OS.md',
    'SSOT_CITY_PACK_SECURITY_RULES.md',
    'SECURITY_MODEL_JA.md',
    'RUNBOOK_JA.md',
    'LLM_GUARDRAILS.md'
  ];
  for (const required of requiredInIndex) {
    if (!ssotText.includes(required)) {
      fail(`SSOT_INDEX に必須ドキュメントが未収録です: docs/${required}`);
    }
  }
} else {
  fail('docs/SSOT_INDEX.md が存在しません');
}

// 9) AGENTS.md must exist and include mandatory execution guardrails
const agents = readText(AGENTS_PATH);
if (agents) {
  const requiredHeadings = [
    '## 第1部：既存規範（原文保持）',
    '## 第2部：強化規範（add-only追記）'
  ];
  requiredHeadings.forEach((heading) => {
    if (!agents.includes(heading)) {
      fail(`AGENTS.md に必須見出しがありません: ${heading}`);
    }
  });

  const requiredKeywords = [
    '観測義務',
    '副作用監査',
    '優先度妥当性',
    '反証義務',
    '認知負債',
    'ドキュメント整合義務',
    '次の一手',
    '曖昧語禁止',
    'ロールバック'
  ];
  requiredKeywords.forEach((keyword) => {
    if (!agents.includes(keyword)) {
      fail(`AGENTS.md に必須キーワードがありません: ${keyword}`);
    }
  });
}

if (errors.length) {
  console.error('[docs] NG');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

if (warnings.length) {
  for (const msg of warnings) {
    console.warn(`[docs][warn] ${msg}`);
  }
}

console.log('[docs] OK');
