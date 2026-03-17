'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleMunicipalitySchoolsImportJob } = require('../../src/routes/internal/municipalitySchoolsImportJob');
const { handleSchoolCalendarAuditJob } = require('../../src/routes/internal/schoolCalendarAuditJob');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      Object.entries(headers || {}).forEach(([name, value]) => {
        this.headers[String(name).toLowerCase()] = String(value);
      });
    },
    end(text) {
      this.body = typeof text === 'string' ? text : '';
    }
  };
}

test('phase666: municipality schools import emits partial outcome when some rows fail', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase666_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/municipality-schools-import',
      headers: {
        'x-city-pack-job-token': 'phase666_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase666_import_outcome'
      }
    };
    const res = createResponseRecorder();

    await handleMunicipalitySchoolsImportJob(req, res, JSON.stringify({ rows: [{ name: 'sample' }] }), {
      getKillSwitchFn: async () => false,
      importMunicipalitySchoolsFn: async () => ({
        ok: false,
        dryRun: false,
        processed: 2,
        succeeded: 1,
        failed: 1,
        errors: [{ index: 1, message: 'school type must be public' }],
        traceId: 'trace_phase666_import_outcome'
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_failures');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_failures');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});

test('phase666: school calendar audit emits success no_targets outcome when no linked sources exist', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase666_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/school-calendar-audit',
      headers: {
        'x-city-pack-job-token': 'phase666_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase666_school_calendar_no_targets'
      }
    };
    const res = createResponseRecorder();

    await handleSchoolCalendarAuditJob(req, res, '{}', {
      getKillSwitchFn: async () => false,
      listSchoolCalendarLinksFn: async () => [],
      runCityPackSourceAuditJobFn: async () => ({
        ok: true,
        runId: 'run_phase666_school_calendar',
        processed: 0,
        succeeded: 0,
        failed: 0,
        traceId: 'trace_phase666_school_calendar_no_targets'
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.targetCount, 0);
    assert.deepEqual(body.targetSourceRefIds, []);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'no_targets');
    assert.equal(res.headers['x-member-outcome-state'], 'success');
    assert.equal(res.headers['x-member-outcome-reason'], 'no_targets');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});
