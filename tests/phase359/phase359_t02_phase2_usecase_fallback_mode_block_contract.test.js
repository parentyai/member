'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase2/runAutomation.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const FALLBACK_MODE_ALLOW = \'allow\';'));
  assert.ok(src.includes('const FALLBACK_MODE_BLOCK = \'block\';'));
  assert.ok(src.includes('const fallbackBlocked = resolvedFallbackMode === FALLBACK_MODE_BLOCK;'));
  assert.ok(src.includes("summary.readPath.eventsSource = 'not_available';"));
  assert.ok(
    src.includes("summary.readPath.fallbackSources = ['listAllUsers', 'listAllChecklists', 'listAllUserChecklists'];") ||
      src.includes('listUsersByCreatedAtRange:fallback') ||
      src.includes('listChecklistsByCreatedAtRange:fallback') ||
      src.includes('listUserChecklistsByCreatedAtRange:fallback')
  );
});
