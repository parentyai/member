'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase160: SSOT docs exist for servicePhase and notificationPreset', () => {
  const phases = readFileSync('docs/SSOT_SERVICE_PHASES.md', 'utf8');
  assert.ok(phases.includes('# SSOT_SERVICE_PHASES'));
  assert.ok(phases.includes('ServicePhase 1'));
  assert.ok(phases.includes('ServicePhase 4'));

  const presets = readFileSync('docs/SSOT_NOTIFICATION_PRESETS.md', 'utf8');
  assert.ok(presets.includes('# SSOT_NOTIFICATION_PRESETS'));
  assert.ok(presets.includes('Preset A'));
  assert.ok(presets.includes('Preset C'));

  const matrix = readFileSync('docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md', 'utf8');
  assert.ok(matrix.includes('# SSOT_SERVICE_PHASE_X_PRESET_MATRIX'));
  assert.ok(matrix.includes('ServicePhase'));
  assert.ok(matrix.includes('Preset'));

  const index = readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(index.includes('docs/SSOT_SERVICE_PHASES.md'));
  assert.ok(index.includes('docs/SSOT_NOTIFICATION_PRESETS.md'));
  assert.ok(index.includes('docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md'));
});

