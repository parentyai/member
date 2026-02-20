'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const llmClient = require('../../src/infra/llmClient');

const VALID_PAYLOAD = {
  schemaId: 'FAQAnswer.v1',
  promptVersion: 'faq_answer_v2_kb_only',
  system: 'You are a FAQ assistant.',
  input: { question: 'test' }
};

test('llmClient: throws when OPENAI_API_KEY is not set', async () => {
  const env = { OPENAI_API_KEY: '' };
  await assert.rejects(
    () => llmClient.answerFaq(VALID_PAYLOAD, env),
    (err) => err.message.includes('OPENAI_API_KEY')
  );
});

test('llmClient: throws when OPENAI_API_KEY is missing entirely', async () => {
  const env = {};
  await assert.rejects(
    () => llmClient.answerFaq(VALID_PAYLOAD, env),
    (err) => err.message.includes('OPENAI_API_KEY')
  );
});

test('llmClient: throws llm_api_error on HTTP non-200 response', async () => {
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    _fetchFn: async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limit'
    })
  };
  await assert.rejects(
    () => llmClient.answerFaq(VALID_PAYLOAD, env),
    (err) => err.message.includes('llm_api_error')
  );
});

test('llmClient: throws llm_api_error on empty response content', async () => {
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    _fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] })
    })
  };
  await assert.rejects(
    () => llmClient.answerFaq(VALID_PAYLOAD, env),
    (err) => err.message.includes('llm_api_error')
  );
});

test('llmClient: throws llm_api_error on non-JSON response content', async () => {
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    _fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'not json at all' } }]
      })
    })
  };
  await assert.rejects(
    () => llmClient.answerFaq(VALID_PAYLOAD, env),
    (err) => err.message.includes('llm_api_error')
  );
});

test('llmClient: returns { answer, model } on successful response', async () => {
  const fakeAnswer = { schemaId: 'FAQAnswer.v1', advisoryOnly: true, faqAnswer: 'test answer' };
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    OPENAI_MODEL: 'gpt-4o',
    _fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gpt-4o',
        choices: [{ message: { content: JSON.stringify(fakeAnswer) } }]
      })
    })
  };
  const result = await llmClient.answerFaq(VALID_PAYLOAD, env);
  assert.deepEqual(result.answer, fakeAnswer);
  assert.equal(result.model, 'gpt-4o');
});

test('llmClient: uses OPENAI_MODEL env var when set', async () => {
  let capturedBody;
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    OPENAI_MODEL: 'gpt-4-turbo',
    _fetchFn: async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4-turbo',
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
        })
      };
    }
  };
  await llmClient.callOpsExplain(VALID_PAYLOAD, env);
  assert.equal(capturedBody.model, 'gpt-4-turbo');
});

test('llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set', async () => {
  let capturedBody;
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    _fetchFn: async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
        })
      };
    }
  };
  await llmClient.callNextActionCandidates(VALID_PAYLOAD, env);
  assert.equal(capturedBody.model, 'gpt-4o-mini');
});

test('llmClient: sends Authorization header with Bearer token', async () => {
  let capturedHeaders;
  const env = {
    OPENAI_API_KEY: 'sk-my-secret-key',
    _fetchFn: async (_url, opts) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
        })
      };
    }
  };
  await llmClient.answerFaq(VALID_PAYLOAD, env);
  assert.equal(capturedHeaders.Authorization, 'Bearer sk-my-secret-key');
});

test('llmClient: uses json_object response_format', async () => {
  let capturedBody;
  const env = {
    OPENAI_API_KEY: 'sk-test-key',
    _fetchFn: async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
        })
      };
    }
  };
  await llmClient.answerFaq(VALID_PAYLOAD, env);
  assert.deepEqual(capturedBody.response_format, { type: 'json_object' });
});
