'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase650: deploy workflow wires strict LLM runtime gate and required secrets for member runtime', () => {
  const text = fs.readFileSync(path.join(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');

  assert.ok(text.includes('OPENAI_API_KEY'), 'deploy.yml must reference OPENAI_API_KEY');
  assert.ok(text.includes('REQUIRED_SECRETS=('), 'deploy.yml must keep secret preflight');
  assert.ok(text.includes('OPENAI_API_KEY=OPENAI_API_KEY:latest'), 'deploy.yml must map OPENAI_API_KEY in --set-secrets');
  assert.ok(text.includes('LLM_FEATURE_FLAG=$LLM_FEATURE_FLAG'), 'deploy.yml must set strict LLM_FEATURE_FLAG env value');
  assert.ok(text.includes('OPENAI_MODEL=$OPENAI_MODEL'), 'deploy.yml must set strict OPENAI_MODEL env value');
  assert.ok(text.includes('roles/secretmanager.secretAccessor'), 'deploy.yml must keep runtime secretAccessor grant');
  assert.ok(text.includes('Verify LLM runtime state (strict)'), 'deploy.yml must include runtime verification step');
  assert.ok(text.includes('bash scripts/verify_llm_runtime.sh'), 'deploy.yml must execute runtime verification script');
});
