'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');
const { resolvePathProtection } = require('../../src/domain/security/protectionMatrix');

test('phase315: protection matrix keeps admin/internal protection classes', () => {
  assert.deepStrictEqual(resolvePathProtection('/admin/app'), { auth: 'adminToken' });
  assert.deepStrictEqual(resolvePathProtection('/api/admin/trace'), { auth: 'adminToken' });
  assert.deepStrictEqual(resolvePathProtection('/internal/jobs/retention-dry-run'), { auth: 'internalToken' });
  assert.deepStrictEqual(resolvePathProtection('/internal/jobs/ops-snapshot-build'), { auth: 'internalToken' });
});

test('phase315: internal job routes keep token guard and killSwitch dependency map is generated', () => {
  const internalRouteFiles = [
    'src/routes/internal/cityPackSourceAuditJob.js',
    'src/routes/internal/cityPackDraftGeneratorJob.js',
    'src/routes/internal/structDriftBackfillJob.js',
    'src/routes/internal/retentionDryRunJob.js',
    'src/routes/internal/retentionApplyJob.js',
    'src/routes/internal/opsSnapshotJob.js'
  ];

  internalRouteFiles.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('requireInternalJobToken'), `${file}: missing requireInternalJobToken reference`);
    assert.ok(source.includes('if (!requireInternalJobToken(req, res)) return;'), `${file}: missing internal token guard check`);
  });

  const killSwitchMap = fs.readFileSync('docs/KILLSWITCH_DEPENDENCY_MAP.md', 'utf8');
  assert.ok(killSwitchMap.includes('src/domain/validators.js'), 'kill switch map missing validators reference');
  assert.ok(killSwitchMap.includes('src/routes/internal/cityPackSourceAuditJob.js'), 'kill switch map missing internal job reference');
});
