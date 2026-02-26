'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const {
  parseTrialSeedSetupArgs,
  parseTrialSeedPurgeArgs
} = require('../../tools/seed/lib/trialSeed');

test('phase665: package scripts expose trial seed setup and purge commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['seed:trial'], 'node tools/seed_trial_setup.js');
  assert.equal(pkg.scripts['seed:purge'], 'node tools/seed_trial_purge.js --seedRunId "$SEED_RUN_ID" --confirm SEED_DELETE');
});

test('phase665: trial seed cli wrappers call shared trial library entry points', () => {
  const setupCli = fs.readFileSync(path.join(process.cwd(), 'tools', 'seed_trial_setup.js'), 'utf8');
  const purgeCli = fs.readFileSync(path.join(process.cwd(), 'tools', 'seed_trial_purge.js'), 'utf8');

  assert.ok(setupCli.includes('parseTrialSeedSetupArgs'));
  assert.ok(setupCli.includes('runTrialSeedSetup'));
  assert.ok(setupCli.includes('JSON.stringify(result)'));

  assert.ok(purgeCli.includes('parseTrialSeedPurgeArgs'));
  assert.ok(purgeCli.includes('runTrialSeedPurge'));
  assert.ok(purgeCli.includes('JSON.stringify(result)'));
});

test('phase665: trial seed runbook includes prerequisites, safety guard, and rollback', () => {
  const runbook = fs.readFileSync(path.join(process.cwd(), 'docs', 'TRIAL_SEED_RUNBOOK.md'), 'utf8');

  assert.ok(runbook.includes('# TRIAL_SEED_RUNBOOK'));
  assert.ok(runbook.includes('ENV_NAME'));
  assert.ok(runbook.includes('FIRESTORE_PROJECT_ID'));
  assert.ok(runbook.includes('gcloud auth application-default login'));
  assert.ok(runbook.includes('--planOnly'));
  assert.ok(runbook.includes('--dry-run'));
  assert.ok(runbook.includes('ENV_NAME=prod'));
  assert.ok(runbook.includes('SEED_DELETE'));
  assert.ok(runbook.includes('seed_runs/{seedRunId}'));
  assert.ok(runbook.includes('Rollback'));
});

test('phase665: trial setup/purge argument parsers enforce option contracts', () => {
  const setupOpts = parseTrialSeedSetupArgs([
    'node',
    'tools/seed_trial_setup.js',
    '--seedRunId',
    'trial_20260226',
    '--kind',
    'trial',
    '--users',
    '200',
    '--templates',
    'true',
    '--cityPacks',
    'true',
    '--links',
    'true',
    '--vendors',
    '6',
    '--planOnly',
    '--dry-run'
  ], {
    ENV_NAME: 'local'
  });

  assert.equal(setupOpts.seedRunId, 'trial_20260226');
  assert.equal(setupOpts.kind, 'trial');
  assert.equal(setupOpts.users, 200);
  assert.equal(setupOpts.templates, true);
  assert.equal(setupOpts.cityPacks, true);
  assert.equal(setupOpts.links, true);
  assert.equal(setupOpts.vendors, 6);
  assert.equal(setupOpts.planOnly, true);
  assert.equal(setupOpts.dryRun, true);

  const purgeOpts = parseTrialSeedPurgeArgs([
    'node',
    'tools/seed_trial_purge.js',
    '--seedRunId',
    'trial_20260226',
    '--confirm',
    'SEED_DELETE',
    '--dry-run'
  ], {
    ENV_NAME: 'local'
  });

  assert.equal(purgeOpts.seedRunId, 'trial_20260226');
  assert.equal(purgeOpts.confirm, 'SEED_DELETE');
  assert.equal(purgeOpts.dryRun, true);
});
