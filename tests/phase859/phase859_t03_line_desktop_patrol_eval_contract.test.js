'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');
const { parseDesktopPatrolArgs, run } = require('../../tools/quality_patrol/run_desktop_patrol_eval');

function runPythonModule(moduleName, args) {
  return JSON.parse(execFileSync('python3', ['-m', moduleName].concat(args || []), {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  }));
}

test('phase859: desktop patrol eval CLI converts dry-run traces into read-only quality patrol artifacts', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase859-'));
  const dryRun = runPythonModule('member_line_patrol.dry_run_harness', [
    '--policy',
    path.join(ROOT, 'tools', 'line_desktop_patrol', 'config', 'policy.example.json'),
    '--scenario',
    path.join(ROOT, 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'),
    '--output-root',
    outputRoot,
    '--route-key',
    'line-desktop-patrol',
    '--allow-disabled-policy'
  ]);

  const mainOutput = path.join(outputRoot, 'desktop_patrol_eval.json');
  const planningOutput = path.join(outputRoot, 'desktop_patrol_eval_planning.json');
  const result = JSON.parse(execFileSync('node', [
    'tools/quality_patrol/run_desktop_patrol_eval.js',
    '--trace',
    dryRun.tracePath,
    '--output',
    mainOutput,
    '--planning-output',
    planningOutput
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  }));

  assert.equal(result.ok, true);
  assert.equal(result.reviewUnitCount, 1);
  assert.equal(result.outputPath, mainOutput);
  assert.ok(fs.existsSync(mainOutput));
  assert.ok(fs.existsSync(planningOutput));

  const mainArtifact = JSON.parse(fs.readFileSync(mainOutput, 'utf8'));
  const planningArtifact = JSON.parse(fs.readFileSync(planningOutput, 'utf8'));
  assert.equal(mainArtifact.reviewUnitCount, 1);
  assert.equal(mainArtifact.runtimeFetchStatus.reviewUnits.status, 'ok');
  assert.ok(mainArtifact.sourceCollections.includes('line_desktop_patrol_trace'));
  assert.ok(Array.isArray(planningArtifact.recommendedPr));
  assert.ok(planningArtifact.recommendedPr.length >= 1);
  assert.ok(['observation_only', 'sample_collection', 'transcript_coverage_repair', 'no_action_until_evidence', 'blocked_by_observation_gap'].includes(planningArtifact.recommendedPr[0].proposalType));
});

test('phase859: desktop patrol eval args default main artifact under local eval artifacts tree', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase859-default-'));
  const dryRun = runPythonModule('member_line_patrol.dry_run_harness', [
    '--policy',
    path.join(ROOT, 'tools', 'line_desktop_patrol', 'config', 'policy.example.json'),
    '--scenario',
    path.join(ROOT, 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'),
    '--output-root',
    outputRoot,
    '--route-key',
    'line-desktop-patrol',
    '--allow-disabled-policy'
  ]);
  const parsed = parseDesktopPatrolArgs([
    'node',
    'tools/quality_patrol/run_desktop_patrol_eval.js',
    '--trace',
    dryRun.tracePath
  ]);
  assert.match(parsed.output, /artifacts\/line_desktop_patrol\/evals\/.*\/desktop_patrol_eval\.json$/);
});

test('phase859: desktop patrol eval treats reviewable execute pass with no issues as ready evidence', async (t) => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'line-desktop-patrol-phase859-ready-'));
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));

  const runRoot = path.join(outputRoot, 'runs', 'line-patrol-ready-execute');
  fs.mkdirSync(runRoot, { recursive: true });
  const tracePath = path.join(runRoot, 'trace.json');
  fs.writeFileSync(tracePath, JSON.stringify({
    run_id: 'line-patrol-ready-execute',
    scenario_id: 'desktop_conversation_loop',
    session_id: 'session_ready_execute_01',
    started_at: '2026-04-01T01:52:58.142Z',
    finished_at: '2026-04-01T01:53:19.690Z',
    target_id: 'member-self-test',
    sent_text: '学校の途中編入で、district は決まっている。予防接種も気になる。今日やることを1つだけ教えて。',
    send_mode: 'execute_once',
    visible_before: [
      { role: 'user', text: '前の相談です。' }
    ],
    visible_after: [
      { role: 'user', text: '学校の途中編入で、district は決まっている。予防接種も気になる。今日やることを1つだけ教えて。' },
      {
        role: 'assistant',
        text: [
          '途中編入で予防接種も気になるなら、まず決まっている district の immunization requirements page を開いて、必要な接種記録と不足分を確認するのが確実です。',
          'いまやる一手は、決まっている district の immunization requirements page を開いて、必要な接種記録と不足分をメモすることです。',
          '確認先は、district immunization requirements pageです。'
        ].join('\n')
      }
    ],
    retrieval_refs: []
  }, null, 2));
  fs.writeFileSync(path.join(runRoot, 'result.json'), JSON.stringify({
    ok: true,
    result: {
      mode: 'execute',
      targetMatchedHeuristic: true,
      replyObserved: true,
      transcriptBefore: 'before',
      transcriptAfterReply: 'after',
      evaluatorScores: {
        sentVisible: true,
        replyObserved: true,
        verdict: 'pass'
      }
    }
  }, null, 2));

  const result = await run([
    'node',
    'tools/quality_patrol/run_desktop_patrol_eval.js',
    '--trace',
    tracePath
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.artifact.observationStatus, 'ready');
  assert.equal(result.artifact.analysisStatus, 'analyzed');
  assert.equal(result.artifact.planningStatus, 'planned');
  assert.equal(result.artifact.summary.overallStatus, 'warning');
  assert.equal(result.artifact.evidenceAvailability.status, 'available');
});
