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
  assert.ok(text.includes('ENABLE_PAID_ORCHESTRATOR_V2=$ORCHESTRATOR_FLAG'), 'deploy.yml must wire paid orchestrator v2 flag env value');
  assert.ok(text.includes('enable_paid_orchestrator_v2:'), 'deploy.yml must expose workflow dispatch input for paid orchestrator canary');
  assert.ok(text.includes('roles/secretmanager.secretAccessor'), 'deploy.yml must keep runtime secretAccessor grant');
  assert.ok(text.includes('ADMIN_OS_TOKEN: ${{ secrets.ADMIN_OS_TOKEN }}'), 'deploy.yml must allow ADMIN_OS_TOKEN secret fallback for runtime verify');
  assert.ok(text.includes('if [ -n "${ADMIN_OS_TOKEN:-}" ]; then'), 'deploy.yml must prefer ADMIN_OS_TOKEN secret before Secret Manager read');
  assert.ok(text.includes('Verify LLM runtime state (strict)'), 'deploy.yml must include runtime verification step');
  assert.ok(text.includes('bash scripts/verify_llm_runtime.sh'), 'deploy.yml must execute runtime verification script');
});
