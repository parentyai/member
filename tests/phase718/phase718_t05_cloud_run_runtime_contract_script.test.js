'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseArgs,
  extractRuntimeContract,
  verifyRuntimeContract
} = require('../../scripts/check_cloud_run_runtime_contract');

test('phase718: cloud run runtime contract parser accepts required env/secret args', () => {
  const args = parseArgs([
    'node',
    'scripts/check_cloud_run_runtime_contract.js',
    '--service-name', 'member-webhook',
    '--project-id', 'member-stg',
    '--region', 'us-east1',
    '--required-env', 'SERVICE_MODE,LLM_FEATURE_FLAG,OPENAI_MODEL',
    '--required-secret-env', 'OPENAI_API_KEY,LINE_CHANNEL_SECRET'
  ]);
  assert.equal(args.serviceName, 'member-webhook');
  assert.equal(args.projectId, 'member-stg');
  assert.equal(args.region, 'us-east1');
  assert.deepEqual(args.requiredEnv, ['SERVICE_MODE', 'LLM_FEATURE_FLAG', 'OPENAI_MODEL']);
  assert.deepEqual(args.requiredSecretEnv, ['OPENAI_API_KEY', 'LINE_CHANNEL_SECRET']);
});

test('phase718: cloud run runtime contract passes when all required env and secret refs are present', () => {
  const contract = extractRuntimeContract({
    spec: {
      template: {
        spec: {
          containers: [
            {
              env: [
                { name: 'SERVICE_MODE', value: 'webhook' },
                { name: 'LLM_FEATURE_FLAG', value: 'true' },
                { name: 'OPENAI_MODEL', value: 'gpt-4o-mini' },
                { name: 'OPENAI_API_KEY', valueFrom: { secretKeyRef: { name: 'OPENAI_API_KEY', key: 'latest' } } },
                { name: 'LINE_CHANNEL_SECRET', valueFrom: { secretKeyRef: { name: 'LINE_CHANNEL_SECRET', key: 'latest' } } }
              ]
            }
          ]
        }
      }
    }
  });
  const result = verifyRuntimeContract(contract, {
    requiredEnv: ['SERVICE_MODE', 'LLM_FEATURE_FLAG', 'OPENAI_MODEL'],
    requiredSecretEnv: ['OPENAI_API_KEY', 'LINE_CHANNEL_SECRET']
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingEnv, []);
  assert.deepEqual(result.missingSecretEnv, []);
  assert.deepEqual(result.secretNameMismatch, []);
});

test('phase718: cloud run runtime contract fails when env/secret refs are missing or mismatched', () => {
  const contract = extractRuntimeContract({
    spec: {
      template: {
        spec: {
          containers: [
            {
              env: [
                { name: 'SERVICE_MODE', value: 'webhook' },
                { name: 'OPENAI_API_KEY', valueFrom: { secretKeyRef: { name: 'WRONG_SECRET', key: 'latest' } } }
              ]
            }
          ]
        }
      }
    }
  });
  const result = verifyRuntimeContract(contract, {
    requiredEnv: ['SERVICE_MODE', 'LLM_FEATURE_FLAG', 'OPENAI_MODEL'],
    requiredSecretEnv: ['OPENAI_API_KEY', 'LINE_CHANNEL_SECRET']
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingEnv, ['LLM_FEATURE_FLAG', 'OPENAI_MODEL']);
  assert.deepEqual(result.missingSecretEnv, ['LINE_CHANNEL_SECRET']);
  assert.deepEqual(result.secretNameMismatch, ['OPENAI_API_KEY']);
});
