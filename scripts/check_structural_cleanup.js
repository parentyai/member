'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script].concat(args || []), {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const DELETED_LEGACY_ALIAS_FILES = Object.freeze([
  'src/repos/firestore/phase18StatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js',
  'src/repos/firestore/phase2ReadRepo.js',
  'src/repos/firestore/phase2ReportsRepo.js',
  'src/repos/firestore/phase2RunsRepo.js'
]);

const DELETED_FROZEN_FILES = Object.freeze([
  'src/repos/firestore/checklistsRepo.js',
  'src/repos/firestore/kpiSnapshotsRepo.js',
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

function assertMarker(file, marker) {
  const absolute = path.join(ROOT, file);
  const source = fs.readFileSync(absolute, 'utf8');
  if (!source.includes(marker)) {
    process.stderr.write(`cleanup marker missing: ${file} (${marker})\n`);
    process.exit(1);
  }
}

function assertDeleted(file) {
  const absolute = path.join(ROOT, file);
  if (fs.existsSync(absolute)) {
    process.stderr.write(`cleanup deletion candidate still exists: ${file}\n`);
    process.exit(1);
  }
}

runNode(path.join('scripts', 'generate_cleanup_reports.js'), ['--check']);
DELETED_LEGACY_ALIAS_FILES.forEach((file) => assertDeleted(file));
DELETED_FROZEN_FILES.forEach((file) => assertDeleted(file));
