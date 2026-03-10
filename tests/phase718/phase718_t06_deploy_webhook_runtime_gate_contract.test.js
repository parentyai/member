'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('phase718: deploy-webhook workflow enforces strict LLM runtime env/secret wiring and gate', () => {
  const workflow = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deploy-webhook.yml'), 'utf8');

  assert.match(workflow, /LLM_FEATURE_FLAG:\s*\$\{\{\s*vars\.LLM_FEATURE_FLAG\s*\}\}/, 'deploy-webhook must reference LLM_FEATURE_FLAG variable');
  assert.match(workflow, /OPENAI_MODEL:\s*\$\{\{\s*vars\.OPENAI_MODEL\s*\}\}/, 'deploy-webhook must reference OPENAI_MODEL variable');
  assert.match(workflow, /ENABLE_PAID_ORCHESTRATOR_V2:\s*\$\{\{\s*vars\.ENABLE_PAID_ORCHESTRATOR_V2\s*\}\}/, 'deploy-webhook must reference ENABLE_PAID_ORCHESTRATOR_V2 variable');
  assert.match(workflow, /OPENAI_API_KEY/, 'deploy-webhook must include OPENAI_API_KEY secret contract');
  assert.match(workflow, /SET_ENV_VARS=.*LLM_FEATURE_FLAG=\$LLM_FEATURE_FLAG.*OPENAI_MODEL=\$OPENAI_MODEL.*ENABLE_PAID_ORCHESTRATOR_V2=\$ENABLE_PAID_ORCHESTRATOR_V2/s, 'deploy-webhook must set strict LLM env vars');
  assert.match(workflow, /SET_SECRETS=.*OPENAI_API_KEY=OPENAI_API_KEY:latest/s, 'deploy-webhook must bind OPENAI_API_KEY secret');
  assert.match(workflow, /Verify webhook runtime contract/, 'deploy-webhook must run runtime contract check');
  assert.match(workflow, /node scripts\/check_cloud_run_runtime_contract\.js/, 'deploy-webhook must run Cloud Run contract script');
  assert.match(workflow, /--required-env "SERVICE_MODE,LLM_FEATURE_FLAG,OPENAI_MODEL,ENABLE_V1_OPENAI_RESPONSES,ENABLE_PAID_ORCHESTRATOR_V2"/, 'deploy-webhook runtime contract must require responses and orchestrator env');
  assert.match(workflow, /Verify webhook single-region uniqueness \(pre-deploy\)/, 'deploy-webhook must run pre-deploy uniqueness check');
  assert.match(workflow, /Verify webhook single-region uniqueness \(post-deploy\)/, 'deploy-webhook must run post-deploy uniqueness check');
  assert.match(workflow, /node scripts\/check_cloud_run_service_uniqueness\.js/, 'deploy-webhook must run uniqueness contract script');
  assert.match(workflow, /--allow-missing/, 'deploy-webhook pre-deploy uniqueness check must allow missing service for bootstrap');
});
