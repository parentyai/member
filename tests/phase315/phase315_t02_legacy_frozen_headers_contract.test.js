'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

const DELETED_FROZEN_TARGETS = [
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
];

const DELETED_ALIAS_TARGETS = [
  'src/repos/firestore/phase18StatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js',
  'src/repos/firestore/phase2ReadRepo.js',
  'src/repos/firestore/phase2ReportsRepo.js',
  'src/repos/firestore/phase2RunsRepo.js'
];

test('phase315: unreachable frozen candidates are physically removed', () => {
  DELETED_FROZEN_TARGETS.forEach((file) => {
    assert.ok(!fs.existsSync(file), `${file}: expected deleted`);
  });
});

test('phase315: alias deletion candidates are physically removed', () => {
  DELETED_ALIAS_TARGETS.forEach((file) => {
    assert.ok(!fs.existsSync(file), `${file}: expected deleted`);
  });
});
