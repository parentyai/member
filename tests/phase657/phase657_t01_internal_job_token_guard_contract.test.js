'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const INTERNAL_JOB_PATHS = [
  '/internal/jobs/city-pack-source-audit',
  '/internal/jobs/city-pack-audit-light',
  '/internal/jobs/city-pack-audit-heavy',
  '/internal/jobs/city-pack-draft-generator',
  '/internal/jobs/municipality-schools-import',
  '/internal/jobs/school-calendar-audit',
  '/internal/jobs/struct-drift-backfill',
  '/internal/jobs/retention-dry-run',
  '/internal/jobs/retention-apply',
  '/internal/jobs/ops-snapshot-build',
  '/internal/jobs/journey-todo-reminder',
  '/internal/jobs/user-context-snapshot-build',
  '/internal/jobs/user-context-snapshot-recompress',
  '/internal/jobs/journey-kpi-build',
  '/internal/jobs/emergency-sync',
  '/internal/jobs/emergency-provider-fetch',
  '/internal/jobs/emergency-provider-normalize',
  '/internal/jobs/emergency-provider-summarize'
];

const CITY_PACK_TOKEN_FILES = [
  'src/routes/internal/cityPackSourceAuditJob.js',
  'src/routes/internal/cityPackDraftGeneratorJob.js',
  'src/routes/internal/municipalitySchoolsImportJob.js',
  'src/routes/internal/schoolCalendarAuditJob.js',
  'src/routes/internal/structDriftBackfillJob.js',
  'src/routes/internal/retentionDryRunJob.js',
  'src/routes/internal/retentionApplyJob.js',
  'src/routes/internal/opsSnapshotJob.js',
  'src/routes/internal/userContextSnapshotJob.js',
  'src/routes/internal/userContextSnapshotRecompressJob.js',
  'src/routes/internal/journeyKpiBuildJob.js',
  'src/routes/internal/emergencyJobs.js'
];

test('phase657: index route wiring keeps internal jobs explicitly declared', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  for (const routePath of INTERNAL_JOB_PATHS) {
    assert.ok(src.includes(`pathname === '${routePath}'`), `${routePath} must stay wired in src/index.js`);
  }
});

test('phase657: internal job handlers keep token guards (CITY_PACK_JOB_TOKEN / JOURNEY_JOB_TOKEN)', () => {
  const cityPackGuardSource = fs.readFileSync('src/routes/internal/cityPackSourceAuditJob.js', 'utf8');
  assert.ok(cityPackGuardSource.includes("req.headers['x-city-pack-job-token']"));
  assert.ok(cityPackGuardSource.includes('CITY_PACK_JOB_TOKEN'));
  assert.ok(cityPackGuardSource.includes('requireInternalJobToken(req, res)'));

  for (const filePath of CITY_PACK_TOKEN_FILES) {
    const src = fs.readFileSync(filePath, 'utf8');
    if (filePath === 'src/routes/internal/cityPackSourceAuditJob.js') continue;
    assert.ok(src.includes('requireInternalJobToken(req, res)'), `${filePath} must call requireInternalJobToken`);
  }

  const journeySource = fs.readFileSync('src/routes/internal/journeyTodoReminderJob.js', 'utf8');
  assert.ok(journeySource.includes("req.headers['x-journey-job-token']"));
  assert.ok(journeySource.includes('JOURNEY_JOB_TOKEN'));
  assert.ok(journeySource.includes('requireJourneyJobToken(req, res)'));
});
