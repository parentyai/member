'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { parseSeedSetupArgs, parseSeedPurgeArgs } = require('../../tools/seed/lib');

test('phase635: package scripts expose seed setup and purge commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['seed:setup'], 'node tools/seed_templates_and_citypacks.js');
  assert.equal(pkg.scripts['seed:purge'], 'node tools/seed_purge.js --seedRunId "$SEED_RUN_ID" --confirm SEED_DELETE');
});

test('phase635: seed cli wrappers call shared library entry points', () => {
  const setupCli = fs.readFileSync(path.join(process.cwd(), 'tools', 'seed_templates_and_citypacks.js'), 'utf8');
  const purgeCli = fs.readFileSync(path.join(process.cwd(), 'tools', 'seed_purge.js'), 'utf8');

  assert.ok(setupCli.includes('parseSeedSetupArgs'));
  assert.ok(setupCli.includes('runSeedSetup'));
  assert.ok(setupCli.includes('JSON.stringify(result)'));

  assert.ok(purgeCli.includes('parseSeedPurgeArgs'));
  assert.ok(purgeCli.includes('runSeedPurge'));
  assert.ok(purgeCli.includes('JSON.stringify(result)'));
});

test('phase635: seed runbook includes setup/purge/guard and rollback instructions', () => {
  const runbook = fs.readFileSync(path.join(process.cwd(), 'docs', 'SEED_SETUP_RUNBOOK.md'), 'utf8');

  assert.ok(runbook.includes('# SEED_SETUP_RUNBOOK'));
  assert.ok(runbook.includes('node tools/seed_templates_and_citypacks.js --dry-run'));
  assert.ok(runbook.includes('node tools/seed_purge.js --seedRunId member_seed_20260223 --confirm SEED_DELETE'));
  assert.ok(runbook.includes('ENV_NAME=prod'));
  assert.ok(runbook.includes('SEED_DELETE'));
  assert.ok(runbook.includes('Rollback'));
  assert.ok(runbook.includes('seed_runs/{seedRunId}'));
});

test('phase635: setup/purge argument parsers enforce option contracts', () => {
  const setupOpts = parseSeedSetupArgs([
    'node',
    'tools/seed_templates_and_citypacks.js',
    '--kind',
    'demo',
    '--templatesOnly',
    '--dry-run'
  ], {
    ENV_NAME: 'local'
  });

  assert.equal(setupOpts.kind, 'demo');
  assert.equal(setupOpts.templatesOnly, true);
  assert.equal(setupOpts.cityPacksOnly, false);
  assert.equal(setupOpts.dryRun, true);
  assert.ok(typeof setupOpts.seedRunId === 'string' && setupOpts.seedRunId.length > 0);

  assert.throws(() => parseSeedSetupArgs([
    'node',
    'tools/seed_templates_and_citypacks.js',
    '--templatesOnly',
    '--cityPacksOnly'
  ], {
    ENV_NAME: 'local'
  }), /cannot be used together/);

  const purgeOpts = parseSeedPurgeArgs([
    'node',
    'tools/seed_purge.js',
    '--seedRunId',
    'seed_abc',
    '--confirm',
    'SEED_DELETE',
    '--dry-run'
  ], {
    ENV_NAME: 'local'
  });

  assert.equal(purgeOpts.seedRunId, 'seed_abc');
  assert.equal(purgeOpts.confirm, 'SEED_DELETE');
  assert.equal(purgeOpts.dryRun, true);

  assert.throws(() => parseSeedPurgeArgs([
    'node',
    'tools/seed_purge.js',
    '--seedRunId',
    'seed_abc',
    '--confirm',
    'BAD_TOKEN'
  ], {
    ENV_NAME: 'local'
  }), /SEED_DELETE/);
});
