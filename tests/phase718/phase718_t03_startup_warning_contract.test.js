'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

test('phase718: startup guard logs warning when LLM_FEATURE_FLAG is missing', () => {
  const restoreEnv = withEnv({ LLM_FEATURE_FLAG: null });
  const targetPath = require.resolve('../../src/index.js');
  const previous = require.cache[targetPath];
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnings.push(args.map((item) => String(item)).join(' '));
  };

  try {
    delete require.cache[targetPath];
    require('../../src/index.js');
  } finally {
    console.warn = originalWarn;
    if (previous) require.cache[targetPath] = previous;
    else delete require.cache[targetPath];
    restoreEnv();
  }

  assert.ok(
    warnings.some((line) => line.includes('LLM_RUNTIME_WARNING') && line.includes('missing_env_flag')),
    'missing LLM_FEATURE_FLAG warning should be emitted once at startup'
  );
});
