'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');

const requiredDocs = [
  'ADMIN_MANUAL_JA.md',
  'ADMIN_UI_DICTIONARY_JA.md',
  'RUNBOOK_JA.md',
  'SECURITY_MODEL_JA.md',
  'CHANGELOG_DOCS.md'
].map((name) => path.join(DOCS_DIR, name));

const errors = [];

function fail(msg) {
  errors.push(msg);
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
    fail(`apps/admin のHTMLが辞書に未対応です: ${unmapped.join(', ')}`);
  }

  const indexText = readText(path.join(ROOT, 'src', 'index.js'));
  for (const entry of routeEntries) {
    if (!entry.route.startsWith('/admin')) {
      fail(`ADMIN_UI辞書のルートが /admin 配下ではありません: ${entry.route}`);
    }
    if (!indexText.includes(entry.route)) {
      fail(`src/index.js にルートが見つかりません: ${entry.route}`);
    }
    if (entry.uiFile) {
      const full = path.join(ROOT, entry.uiFile);
      if (!fs.existsSync(full)) {
        fail(`ADMIN_UI辞書の uiFile が存在しません: ${entry.uiFile}`);
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

if (errors.length) {
  console.error('[docs] NG');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log('[docs] OK');
