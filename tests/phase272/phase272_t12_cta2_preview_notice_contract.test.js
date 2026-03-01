'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: CTA2 keeps preview-only notice and remains payload-disconnected', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="ctaText2"'));
  assert.ok(html.includes('id="composer-cta2-notice"'));
  assert.ok(js.includes('function renderComposerCta2Notice() {'));
  assert.ok(js.includes("ui.desc.composer.cta2.notice"));
  assert.ok(js.includes("ctaText2: document.getElementById('ctaText2')?.value || ''"));
  assert.ok(js.includes('ctaText: document.getElementById(\'ctaText\')?.value?.trim() || \'\','));
  assert.ok(!js.includes('ctaText2: document.getElementById(\'ctaText2\')?.value?.trim() || \'\','));
});

