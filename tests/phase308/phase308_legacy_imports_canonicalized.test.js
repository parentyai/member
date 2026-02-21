'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase308: runtime routes/scripts do not import legacy duplicate repos', () => {
  const targets = [
    'src/routes/admin/osDashboardKpi.js',
    'scripts/phase22_run_gate_and_record.js',
    'scripts/phase22_list_kpi_snapshots.js'
  ];
  const forbidden = [
    'phase2ReadRepo',
    'phase2ReportsRepo',
    'phase2RunsRepo',
    'phase18StatsRepo',
    'phase22KpiSnapshotsRepo',
    'phase22KpiSnapshotsReadRepo'
  ];
  for (const file of targets) {
    const source = readFileSync(file, 'utf8');
    forbidden.forEach((name) => {
      assert.ok(!source.includes(name), `${file} must not import ${name}`);
    });
  }
});
