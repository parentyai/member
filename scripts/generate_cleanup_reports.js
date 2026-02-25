'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const INPUT_DIR = path.join(DOCS_DIR, 'REPO_AUDIT_INPUTS');

const DESIGN_META_PATH = path.join(INPUT_DIR, 'design_ai_meta.json');
const LOAD_RISK_PATH = path.join(INPUT_DIR, 'load_risk.json');
const DATA_LIFECYCLE_PATH = path.join(INPUT_DIR, 'data_lifecycle.json');
const AUDIT_REPORT_PATH = path.join(DOCS_DIR, 'REPO_FULL_AUDIT_REPORT_2026-02-21.md');

const OUTPUTS = Object.freeze({
  CLEANUP_PLAN: path.join(DOCS_DIR, 'CLEANUP_PLAN.md'),
  CLEANUP_DIFF_SUMMARY: path.join(DOCS_DIR, 'CLEANUP_DIFF_SUMMARY.md'),
  STRUCTURAL_RISK_BEFORE_AFTER: path.join(DOCS_DIR, 'STRUCTURAL_RISK_BEFORE_AFTER.md'),
  CI_STRUCTURAL_CHECKLIST: path.join(DOCS_DIR, 'CI_STRUCTURAL_CHECKLIST.md'),
  INDEX_PLAN: path.join(DOCS_DIR, 'INDEX_PLAN.md'),
  FULL_SCAN_PLAN: path.join(DOCS_DIR, 'FULL_SCAN_BOUNDING_PLAN.md'),
  NAMING_DRIFT_PLAN: path.join(DOCS_DIR, 'NAMING_DRIFT_SCENARIOKEY_PLAN.md'),
  SSOT_RETENTION_ADDENDUM: path.join(DOCS_DIR, 'SSOT_RETENTION_ADDENDUM.md'),
  KILLSWITCH_MAP: path.join(DOCS_DIR, 'KILLSWITCH_DEPENDENCY_MAP.md'),
  DATA_LIFECYCLE: DATA_LIFECYCLE_PATH
});

const COLLECTION_PATHS = Object.freeze([
  path.join(ROOT, 'src', 'repos'),
  path.join(ROOT, 'src', 'routes'),
  path.join(ROOT, 'src', 'usecases'),
  path.join(ROOT, 'src', 'infra'),
  path.join(ROOT, 'src', 'domain')
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeFileChecked(filePath, content, checkMode) {
  if (checkMode) {
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    if (current !== content) return false;
    return true;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function formatMarkdownTable(rows) {
  if (!rows.length) return '';
  const header = rows[0].map((cell) => String(cell));
  const body = rows.slice(1).map((row) => row.map((cell) => String(cell)));
  const lines = [];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  body.forEach((row) => lines.push(`| ${row.join(' | ')} |`));
  return `${lines.join('\n')}\n`;
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function toRepoRelative(absolutePath) {
  const rel = path.relative(ROOT, absolutePath);
  return toPosix(rel.startsWith('..') ? absolutePath : rel);
}

function listFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) out.push(fullPath);
    }
  }
  return out;
}

function extractUnreachableFromAuditReport(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes('unreachable JS files (static graph)'));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('- `')) {
      if (line.startsWith('### ') || line.startsWith('## ')) break;
      continue;
    }
    const match = line.match(/-\s+`([^`]+)`/);
    if (match) out.push(match[1]);
  }
  return out;
}

function buildFallbackIndexPlan(loadRisk) {
  const grouped = new Map();
  (loadRisk.fallback_points || []).forEach((row) => {
    const file = row.file || 'unknown';
    if (!grouped.has(file)) grouped.set(file, new Set());
    grouped.get(file).add(row.line);
  });
  const rows = [['file', 'lines', 'mode', 'notes']];
  Array.from(grouped.keys()).sort().forEach((file) => {
    const lines = Array.from(grouped.get(file)).sort((a, b) => Number(a) - Number(b)).join(', ');
    rows.push([`\`${file}\``, lines, 'stg/prod=fail-safe, local=test=fail-open', 'index作成完了後にfallback経路を段階停止']);
  });

  return [
    '# INDEX_PLAN',
    '',
    '- 目的: missing-index fallback の発生箇所を固定し、index作成順を明示する。',
    `- 入力: \`docs/REPO_AUDIT_INPUTS/load_risk.json\` (fallback_points=${(loadRisk.fallback_points || []).length})`,
    '- 判定: \`src/repos/firestore/indexFallbackPolicy.js\` により stg/prod は fail-safe。',
    '',
    formatMarkdownTable(rows).trimEnd(),
    '',
    '## CI Gate',
    '- 新規 fallback 発生箇所を追加した場合は fail。',
    '- index未定義クエリの追加時は本ドキュメント追記を必須化。',
    ''
  ].join('\n');
}

function buildFullScanPlan(loadRisk) {
  const hotspots = (loadRisk.hotspots || [])
    .slice()
    .sort((a, b) => Number(b.estimated_scan || 0) - Number(a.estimated_scan || 0))
    .slice(0, 10);

  const rows = [['rank', 'file', 'line', 'call', 'estimated_scan', 'bounded query移行案']];
  hotspots.forEach((row, index) => {
    const hotspot = row.hotspot || {};
    rows.push([
      String(index + 1),
      `\`${hotspot.file || 'unknown'}\``,
      String(hotspot.line || '-'),
      String(hotspot.call || '-'),
      String(row.estimated_scan || 0),
      'limit上限固定 + snapshot/read-model優先 + where条件明示'
    ]);
  });

  return [
    '# FULL_SCAN_BOUNDING_PLAN',
    '',
    `- 推定 worst-case docs scan: ${(loadRisk.estimated_worst_case_docs_scan || 0)}`,
    `- hotspot件数: ${(loadRisk.hotspots || []).length}`,
    '- 本フェーズでは実装変更せず、bounded query移行順のみ固定する。',
    '',
    formatMarkdownTable(rows).trimEnd(),
    '',
    '## 段階移行順',
    '1. `/src/routes/admin/osDashboardKpi.js`',
    '2. `/src/usecases/admin/getUserOperationalSummary.js`',
    '3. `/src/usecases/admin/getNotificationOperationalSummary.js`',
    '4. `/src/usecases/phase5/getUserStateSummary.js`',
    ''
  ].join('\n');
}

function buildNamingDriftPlan(designMeta) {
  const scenario = (designMeta.naming_drift && designMeta.naming_drift.scenario) || [];
  const scenarioKey = (designMeta.naming_drift && designMeta.naming_drift.scenarioKey) || [];

  const rows = [['field', 'count', 'paths']];
  rows.push(['scenario (legacy)', String(scenario.length), scenario.map((row) => `\`${row}\``).join('<br>')]);
  rows.push(['scenarioKey (canonical)', String(scenarioKey.length), scenarioKey.map((row) => `\`${row}\``).join('<br>')]);

  return [
    '# NAMING_DRIFT_SCENARIOKEY_PLAN',
    '',
    '- 目的: `scenario` と `scenarioKey` の命名ドリフトを mapper層で吸収し、書き込みをcanonicalへ収束させる。',
    '- 破壊的renameは行わない。',
    '',
    formatMarkdownTable(rows).trimEnd(),
    '',
    '## 移行方針',
    '1. read: `scenarioKey` 優先、`scenario` fallback',
    '2. write: canonical (`scenarioKey`) のみ',
    '3. legacy phase1 usecaseは `DEPRECATED` 表示 + 参照遮断計画を別PRで実施',
    ''
  ].join('\n');
}

function convertDeletable(policyValue) {
  if (policyValue === 'NO') return false;
  if (policyValue === 'CONDITIONAL') return 'CONDITIONAL';
  if (policyValue === true) return true;
  return policyValue || false;
}

function collectCollectionEvidence(collection) {
  const out = [];
  const needleSingle = `'${collection}'`;
  const needleDouble = `"${collection}"`;
  for (const base of COLLECTION_PATHS) {
    const files = listFiles(base).filter((file) => file.endsWith('.js'));
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.includes(needleSingle) && !line.includes(needleDouble)) continue;
        out.push(`${toRepoRelative(file)}:${i + 1}`);
        if (out.length >= 3) return out;
      }
    }
  }
  return out;
}

function rebuildDataLifecycle(existingLifecycle) {
  const existingByCollection = new Map();
  existingLifecycle.forEach((row) => {
    if (row && typeof row.collection === 'string') {
      existingByCollection.set(row.collection, row);
    }
  });

  const { listRetentionPolicies } = require(path.join(ROOT, 'src', 'domain', 'retention', 'retentionPolicy'));
  const policies = listRetentionPolicies().slice().sort((a, b) => String(a.collection).localeCompare(String(b.collection)));

  const rows = policies.map((policy) => {
    const current = existingByCollection.get(policy.collection) || {};
    const evidence = Array.isArray(current.evidence) && current.evidence.length
      ? current.evidence.slice(0, 5)
      : collectCollectionEvidence(policy.collection);
    let retention = 'UNDEFINED_IN_CODE';
    if (Number.isFinite(policy.retentionDays)) {
      retention = `${policy.retentionDays}d`;
    } else if (typeof policy.retentionDays === 'string' && policy.retentionDays.trim().toUpperCase() === 'INDEFINITE') {
      retention = 'INDEFINITE';
    }

    return {
      collection: policy.collection,
      kind: policy.kind || current.kind || 'unknown',
      recomputable: Boolean(policy.recomputable),
      retention,
      deletable: convertDeletable(policy.deletable),
      evidence
    };
  });

  const known = new Set(rows.map((row) => row.collection));
  existingLifecycle
    .filter((row) => row && typeof row.collection === 'string' && !known.has(row.collection))
    .sort((a, b) => String(a.collection).localeCompare(String(b.collection)))
    .forEach((row) => rows.push(row));

  return rows;
}

function buildRetentionAddendum(lifecycleRows) {
  const groups = new Map();
  lifecycleRows.forEach((row) => {
    const key = row.kind || 'unknown';
    groups.set(key, (groups.get(key) || 0) + 1);
  });

  const groupRows = [['kind', 'count']];
  Array.from(groups.keys()).sort().forEach((kind) => groupRows.push([kind, String(groups.get(kind))]));

  const tableRows = [['collection', 'kind', 'retention', 'deletable', 'recomputable']];
  lifecycleRows.forEach((row) => {
    tableRows.push([
      `\`${row.collection}\``,
      String(row.kind),
      String(row.retention),
      String(row.deletable),
      String(row.recomputable)
    ]);
  });

  return [
    '# SSOT_RETENTION_ADDENDUM',
    '',
    '- 本書は `src/domain/retention/retentionPolicy.js` と `docs/REPO_AUDIT_INPUTS/data_lifecycle.json` の整合補足。',
    '- 物理削除の実行は本フェーズ対象外。',
    '- `retention=INDEFINITE` は削除期限を定義しない明示値を示す。',
    '- `retention=UNDEFINED_IN_CODE` は未定義であり、運用上の解消対象を示す。',
    '',
    '## Collection分類',
    '',
    formatMarkdownTable(groupRows).trimEnd(),
    '',
    '## Collection方針',
    '',
    formatMarkdownTable(tableRows).trimEnd(),
    ''
  ].join('\n');
}

function buildKillSwitchMap() {
  const targets = [
    path.join(ROOT, 'src', 'routes'),
    path.join(ROOT, 'src', 'usecases'),
    path.join(ROOT, 'src', 'infra'),
    path.join(ROOT, 'src', 'domain')
  ];
  const rows = [];
  targets.forEach((dir) => {
    listFiles(dir)
      .filter((file) => file.endsWith('.js'))
      .forEach((file) => {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          if (!/getKillSwitch|validateKillSwitch/.test(line)) continue;
          rows.push({ file: toRepoRelative(file), line: i + 1, snippet: line.trim() });
        }
      });
  });
  rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const table = [['file', 'line', 'reference']];
  rows.forEach((row) => table.push([`\`${row.file}\``, String(row.line), `\`${row.snippet.replace(/`/g, '\\`')}\``]));

  return [
    '# KILLSWITCH_DEPENDENCY_MAP',
    '',
    '- killSwitch依存経路を静的抽出した一覧。',
    `- 抽出件数: ${rows.length}`,
    '',
    formatMarkdownTable(table).trimEnd(),
    ''
  ].join('\n');
}

function buildCleanupPlan(designMeta, loadRisk, lifecycleRows, unreachable) {
  return [
    '# CLEANUP_PLAN',
    '',
    '## 目的',
    '- 削除ではなく、構造整流・負債可視化・可逆整理を実施する。',
    '- add-onlyで legacy/duplicate/fallback/full-scan/drift を制御可能にする。',
    '',
    '## 対象',
    `- canonical repos: ${(designMeta.canonical_repos || []).length}`,
    `- legacy repos: ${(designMeta.legacy_repos || []).length}`,
    `- duplicate groups: ${(designMeta.merge_candidates || []).length}`,
    `- missing-index fallback points: ${(loadRisk.fallback_points || []).length}`,
    `- full-scan hotspots: ${(loadRisk.hotspots || []).length}`,
    `- lifecycle collections: ${lifecycleRows.length}`,
    `- unreachable frozen targets: ${unreachable.length}`,
    '',
    '## 実施フェーズ',
    '1. Canonicalizationコメント統一（LEGACY_HEADER/LEGACY_ALIAS）',
    '2. INDEX/FULL_SCAN/NAMING_DRIFT 設計書固定',
    '3. retention addendum と lifecycle同期',
    '4. unreachable file 凍結コメント追加',
    '5. CIチェック追加（cleanup:check）',
    '',
    '## 互換性',
    '- API仕様/Firestoreスキーマ/ルート契約は変更しない。',
    '- 既存挙動は不変。',
    ''
  ].join('\n');
}

function buildCleanupDiffSummary(designMeta, loadRisk, lifecycleRows, unreachable) {
  const fallbackPoints = (loadRisk.fallback_points || []).length;
  const hotspotCount = (loadRisk.hotspots || []).length;
  const fallbackNote = fallbackPoints === 0
    ? '実行経路置換完了（fallback zero）'
    : '段階移行中（fallback残件あり）';
  const fullScanNote = hotspotCount === 0
    ? 'bounded運用固定（hotspot zero）'
    : '段階移行中（hotspot残件あり）';
  const rows = [['item', 'before', 'after', 'note']];
  rows.push(['canonical repos', String((designMeta.canonical_repos || []).length), String((designMeta.canonical_repos || []).length), '変更なし']);
  rows.push(['legacy repos', String((designMeta.legacy_repos || []).length), String((designMeta.legacy_repos || []).length), 'DEPRECATED/LEGACY_HEADER強化']);
  rows.push(['duplicate groups', String((designMeta.merge_candidates || []).length), String((designMeta.merge_candidates || []).length), '削除なし、可視化のみ']);
  rows.push(['missing-index fallback points', String(fallbackPoints), String(fallbackPoints), fallbackNote]);
  rows.push(['full-scan hotspots', String(hotspotCount), String(hotspotCount), fullScanNote]);
  rows.push(['lifecycle rows', '44', String(lifecycleRows.length), 'retentionPolicy準拠へ再生成']);
  rows.push(['unreachable frozen files', '0 markers', String(unreachable.length), 'LEGACY_FROZEN_DO_NOT_USE を付与']);

  const remarks = fallbackPoints === 0 && hotspotCount === 0
    ? '- 本フェーズは構造文書化/凍結に加え、missing-index fallback と full-scan hotspot の実行経路置換を完了。'
    : '- 本フェーズは構造文書化と凍結のみ。実行経路置換は次PR。';

  return [
    '# CLEANUP_DIFF_SUMMARY',
    '',
    formatMarkdownTable(rows).trimEnd(),
    '',
    '## 備考',
    remarks,
    ''
  ].join('\n');
}

function buildRiskBeforeAfter(designMeta, loadRisk, lifecycleRows) {
  const fallbackPoints = (loadRisk.fallback_points || []).length;
  const hotspotCount = (loadRisk.hotspots || []).length;
  const fallbackAfter = fallbackPoints === 0 ? 'low' : 'medium';
  const fullScanAfter = hotspotCount === 0 ? 'low' : 'medium';
  const undefinedRetention = lifecycleRows.filter((row) => row.retention === 'UNDEFINED_IN_CODE').length;
  const rows = [['risk', 'before', 'after', 'mitigation']];
  rows.push(['duplicate実装の分岐', 'high', 'medium', 'LEGACY_HEADER + canonical alias明示']);
  rows.push(['missing-index fallback依存', 'high', fallbackAfter, 'INDEX_PLAN + CI監視']);
  rows.push(['full-scan常用', 'high', fullScanAfter, 'FULL_SCAN_BOUNDING_PLANで移行順固定']);
  rows.push(['scenario命名ドリフト', 'high', 'medium', 'NAMING_DRIFT_SCENARIOKEY_PLANでmapper統一']);
  rows.push(['retention定義不鮮明', 'high', 'medium', `SSOT_RETENTION_ADDENDUM (${undefinedRetention}件未定義を明示)`]);

  return [
    '# STRUCTURAL_RISK_BEFORE_AFTER',
    '',
    formatMarkdownTable(rows).trimEnd(),
    '',
    '## 注記',
    `- duplicate groups: ${(designMeta.merge_candidates || []).length}`,
    `- fallback points: ${(loadRisk.fallback_points || []).length}`,
    ''
  ].join('\n');
}

function buildCIChecklist() {
  return [
    '# CI_STRUCTURAL_CHECKLIST',
    '',
    '## Required checks',
    '- `npm run test:docs`',
    '- `npm run repo-map:check`',
    '- `npm run retention-risk:check`',
    '- `npm run cleanup:check`',
    '- `npm test`',
    '',
    '## Catchup Required checks (W0-W4)',
    '- `npm run catchup:drift-check`',
    '- `npm run test:admin-nav-contract`',
    '- `npm run firestore-indexes:check -- --contracts-only`',
    '- `npm run catchup:gate:full`',
    '',
    '## cleanup:checkで検証すること',
    '- cleanup関連ドキュメントが再生成差分なし',
    '- data_lifecycleがretention policyと同期',
    '- legacy aliasとfrozen markersが維持',
    '',
    '## catchup:drift-checkで検証すること',
    '- repo map / docs artifacts が再生成差分なし',
    '- retention/structure/load/missing-index が予算以内',
    ''
  ].join('\n');
}

function buildOutputs() {
  const designMeta = readJson(DESIGN_META_PATH);
  const loadRisk = readJson(LOAD_RISK_PATH);
  const lifecycle = readJson(DATA_LIFECYCLE_PATH);
  const reportText = fs.readFileSync(AUDIT_REPORT_PATH, 'utf8');
  const unreachable = extractUnreachableFromAuditReport(reportText);

  const rebuiltLifecycle = rebuildDataLifecycle(lifecycle);

  return {
    [OUTPUTS.CLEANUP_PLAN]: buildCleanupPlan(designMeta, loadRisk, rebuiltLifecycle, unreachable),
    [OUTPUTS.CLEANUP_DIFF_SUMMARY]: buildCleanupDiffSummary(designMeta, loadRisk, rebuiltLifecycle, unreachable),
    [OUTPUTS.STRUCTURAL_RISK_BEFORE_AFTER]: buildRiskBeforeAfter(designMeta, loadRisk, rebuiltLifecycle),
    [OUTPUTS.CI_STRUCTURAL_CHECKLIST]: buildCIChecklist(),
    [OUTPUTS.INDEX_PLAN]: buildFallbackIndexPlan(loadRisk),
    [OUTPUTS.FULL_SCAN_PLAN]: buildFullScanPlan(loadRisk),
    [OUTPUTS.NAMING_DRIFT_PLAN]: buildNamingDriftPlan(designMeta),
    [OUTPUTS.SSOT_RETENTION_ADDENDUM]: buildRetentionAddendum(rebuiltLifecycle),
    [OUTPUTS.KILLSWITCH_MAP]: buildKillSwitchMap(),
    [OUTPUTS.DATA_LIFECYCLE]: `${JSON.stringify(rebuiltLifecycle, null, 2)}\n`
  };
}

function main() {
  const checkMode = process.argv.includes('--check');
  const outputs = buildOutputs();

  const drift = [];
  Object.entries(outputs).forEach(([filePath, content]) => {
    const ok = writeFileChecked(filePath, content, checkMode);
    if (!ok) drift.push(toRepoRelative(filePath));
  });

  if (checkMode && drift.length) {
    process.stderr.write('cleanup drift detected. run: npm run cleanup:generate\n');
    drift.forEach((item) => process.stderr.write(` - ${item}\n`));
    process.exit(1);
  }

  if (!checkMode) {
    process.stdout.write(`cleanup reports generated (${Object.keys(outputs).length} files)\n`);
  } else {
    process.stdout.write('cleanup reports are up-to-date\n');
  }
}

main();
