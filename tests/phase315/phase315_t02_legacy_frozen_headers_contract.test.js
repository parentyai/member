'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

const FROZEN_TARGETS = [
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
];

test('phase315: unreachable baseline files are frozen with LEGACY marker', () => {
  FROZEN_TARGETS.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('LEGACY_FROZEN_DO_NOT_USE'), `${file}: missing LEGACY_FROZEN_DO_NOT_USE marker`);
    assert.ok(source.includes('REPO_FULL_AUDIT_REPORT_2026-02-21'), `${file}: missing ssot report reference`);
  });
});
