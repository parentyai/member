'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase872: retention deletes only stale raw artifacts when apply is requested', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase872-retention-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const runRoot = path.join(tempRoot, 'runs', 'ldp_test');
  fs.mkdirSync(runRoot, { recursive: true });
  const stalePng = path.join(runRoot, 'after.png');
  const staleAx = path.join(runRoot, 'after.ax.json');
  const preservedTrace = path.join(runRoot, 'trace.json');
  fs.writeFileSync(stalePng, 'png');
  fs.writeFileSync(staleAx, '{}');
  fs.writeFileSync(preservedTrace, '{}');
  const staleDate = new Date('2026-03-01T00:00:00.000Z');
  fs.utimesSync(stalePng, staleDate, staleDate);
  fs.utimesSync(staleAx, staleDate, staleDate);
  fs.utimesSync(preservedTrace, staleDate, staleDate);

  const code = `
import json
from member_line_patrol.retention import run_retention

dry_run = run_retention(
    output_root=${JSON.stringify(tempRoot)},
    now_iso="2026-03-26T12:00:00.000Z",
    raw_artifact_days=14,
    apply=False,
)
apply_run = run_retention(
    output_root=${JSON.stringify(tempRoot)},
    now_iso="2026-03-26T12:00:00.000Z",
    raw_artifact_days=14,
    apply=True,
)
print(json.dumps({"dry_run": dry_run, "apply_run": apply_run}))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.dry_run.candidateCount, 2);
  assert.equal(result.apply_run.deletedCount, 2);
  assert.equal(fs.existsSync(stalePng), false);
  assert.equal(fs.existsSync(staleAx), false);
  assert.equal(fs.existsSync(preservedTrace), true);
});
