'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const LEGACY_ALIAS_MAP = Object.freeze({
  'src/repos/firestore/phase18StatsRepo.js': 'src/repos/firestore/ctaStatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js': 'src/repos/firestore/kpiSnapshotsReadRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js': 'src/repos/firestore/kpiSnapshotsRepo.js',
  'src/repos/firestore/phase2ReadRepo.js': 'src/repos/firestore/analyticsReadRepo.js',
  'src/repos/firestore/phase2ReportsRepo.js': 'src/repos/firestore/scenarioReportsRepo.js',
  'src/repos/firestore/phase2RunsRepo.js': 'src/repos/firestore/scenarioRunsRepo.js'
});

const UNREACHABLE_FILES = Object.freeze([
  'src/repos/firestore/checklistsRepo.js',
  'src/repos/firestore/kpiSnapshotsRepo.js',
  'src/repos/firestore/phase18StatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js',
  'src/repos/firestore/phase2ReportsRepo.js',
  'src/repos/firestore/phase2RunsRepo.js',
  'src/repos/firestore/redacMembershipLinksRepo.js',
  'src/repos/firestore/userChecklistsRepo.js',
  'src/routes/admin/killSwitch.js',
  'src/usecases/checklists/getChecklistForUser.js',
  'src/usecases/checklists/getChecklistWithStatus.js',
  'src/usecases/checklists/setChecklistItemDone.js',
  'src/usecases/checklists/toggleChecklistItem.js',
  'src/usecases/phase117/resolveAutomationTargets.js',
  'src/usecases/phase43/executeAutomationDecision.js',
  'src/usecases/phase48/listAutomationConfigs.js',
  'src/usecases/phaseLLM4/getFaqAnswer.js',
  'src/usecases/users/getMemberProfile.js',
  'src/usecases/users/setMemberNumber.js'
]);

function ensurePrefix(filePath, markerLines) {
  const absolute = path.join(ROOT, filePath);
  if (!fs.existsSync(absolute)) return false;
  const original = fs.readFileSync(absolute, 'utf8');
  if (original.includes(markerLines[0])) return false;
  const header = `${markerLines.join('\n')}\n`;
  fs.writeFileSync(absolute, `${header}${original}`, 'utf8');
  return true;
}

function run() {
  let changed = 0;

  Object.entries(LEGACY_ALIAS_MAP).forEach(([filePath, canonicalPath]) => {
    const changedNow = ensurePrefix(filePath, [
      '// LEGACY_HEADER: frozen legacy alias (add-only).',
      `// LEGACY_ALIAS: ${filePath} -> ${canonicalPath}`,
      '// LEGACY_STATUS: DEPRECATED'
    ]);
    if (changedNow) changed += 1;
  });

  UNREACHABLE_FILES.forEach((filePath) => {
    const changedNow = ensurePrefix(filePath, [
      '// LEGACY_FROZEN_DO_NOT_USE',
      '// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).',
      '// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md'
    ]);
    if (changedNow) changed += 1;
  });

  process.stdout.write(`insert_legacy_headers: updated ${changed} files\n`);
}

run();
