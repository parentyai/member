'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase650: deploy workflow wires OPENAI_API_KEY secret and LLM env defaults for member runtime', () => {
  const text = fs.readFileSync(path.join(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');

  assert.ok(text.includes('OPENAI_API_KEY'), 'deploy.yml must reference OPENAI_API_KEY');
  assert.ok(text.includes('REQUIRED_SECRETS=('), 'deploy.yml must keep secret preflight');
  assert.ok(text.includes('OPENAI_API_KEY=OPENAI_API_KEY:latest'), 'deploy.yml must map OPENAI_API_KEY in --set-secrets');
  assert.ok(text.includes('LLM_FEATURE_FLAG=${LLM_FEATURE_FLAG:-false}'), 'deploy.yml must set default LLM_FEATURE_FLAG');
  assert.ok(text.includes('OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}'), 'deploy.yml must set default OPENAI_MODEL');
  assert.ok(text.includes('roles/secretmanager.secretAccessor'), 'deploy.yml must keep runtime secretAccessor grant');
});
