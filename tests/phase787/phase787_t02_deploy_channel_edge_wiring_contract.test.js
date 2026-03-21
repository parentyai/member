'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

test('phase787: deploy.yml wires channel-edge flag with true-by-default fallback', () => {
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /ENABLE_V1_CHANNEL_EDGE:\s*\$\{\{\s*vars\.ENABLE_V1_CHANNEL_EDGE\s*\}\}/, 'deploy.yml must expose ENABLE_V1_CHANNEL_EDGE variable');
  assert.match(workflow, /Normalize paid orchestrator flag/, 'deploy.yml must normalize paid orchestrator flag before validation');
  assert.match(workflow, /echo "ENABLE_PAID_ORCHESTRATOR_V2=\$ORCHESTRATOR_FLAG" >> "\$GITHUB_ENV"/, 'deploy.yml must persist normalized orchestrator flag into GITHUB_ENV');
  assert.match(workflow, /CHANNEL_EDGE_FLAG="\$\{ENABLE_V1_CHANNEL_EDGE:-true\}"/, 'deploy.yml must default channel-edge flag to true when unset');
  assert.match(workflow, /ENABLE_V1_CHANNEL_EDGE=\$CHANNEL_EDGE_FLAG/, 'deploy.yml must inject ENABLE_V1_CHANNEL_EDGE into Cloud Run env');
});

test('phase787: deploy-webhook.yml requires and injects channel-edge runtime env', () => {
  const workflow = read('.github/workflows/deploy-webhook.yml');
  assert.match(workflow, /ENABLE_V1_CHANNEL_EDGE:\s*\$\{\{\s*vars\.ENABLE_V1_CHANNEL_EDGE\s*\}\}/, 'deploy-webhook must expose ENABLE_V1_CHANNEL_EDGE variable');
  assert.match(workflow, /enable_paid_orchestrator_v2:/, 'deploy-webhook must expose workflow dispatch input for orchestrator flag');
  assert.match(workflow, /Normalize paid orchestrator flag/, 'deploy-webhook must normalize paid orchestrator flag before validation');
  assert.match(workflow, /echo "ENABLE_PAID_ORCHESTRATOR_V2=\$ORCHESTRATOR_FLAG" >> "\$GITHUB_ENV"/, 'deploy-webhook must persist normalized orchestrator flag into GITHUB_ENV');
  assert.match(workflow, /CHANNEL_EDGE_FLAG="\$\{ENABLE_V1_CHANNEL_EDGE:-true\}"/, 'deploy-webhook must default channel-edge flag to true when unset');
  assert.match(workflow, /SET_ENV_VARS=.*ENABLE_V1_CHANNEL_EDGE=\$CHANNEL_EDGE_FLAG/s, 'deploy-webhook must inject channel-edge flag into runtime env');
  assert.match(
    workflow,
    /--required-env "SERVICE_MODE,LLM_FEATURE_FLAG,OPENAI_MODEL,ENABLE_V1_OPENAI_RESPONSES,ENABLE_V1_CHANNEL_EDGE,ENABLE_PAID_ORCHESTRATOR_V2"/,
    'deploy-webhook runtime contract must include ENABLE_V1_CHANNEL_EDGE'
  );
});
