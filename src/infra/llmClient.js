'use strict';

const { callResponsesApi } = require('../v1/openai_adapter/responsesClient');
const { resolveBooleanEnvFlag } = require('../v1/shared/flags');

const DEFAULT_MODEL = 'gpt-4o-mini';

function resolveApiKey(env) {
  const source = env || process.env;
  const key = source && source.OPENAI_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return key.trim();
}

function resolveModel(env) {
  const source = env || process.env;
  const model = source && source.OPENAI_MODEL;
  if (model && typeof model === 'string' && model.trim()) return model.trim();
  return DEFAULT_MODEL;
}

function resolveRequestModel(payload, env) {
  if (payload && typeof payload.model === 'string' && payload.model.trim()) {
    return payload.model.trim();
  }
  return resolveModel(env);
}

function resolveNumberParam(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min || num > max) return fallback;
  return num;
}

function buildMessages(system, input) {
  return [
    { role: 'system', content: String(system || '') },
    { role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }
  ];
}

async function callChatCompletions(payload, env) {
  const apiKey = resolveApiKey(env);
  const model = resolveRequestModel(payload, env);
  const temperature = resolveNumberParam(payload && payload.temperature, null, 0, 2);
  const topP = resolveNumberParam(payload && payload.top_p, null, 0, 1);
  const maxOutputTokens = resolveNumberParam(payload && payload.max_output_tokens, null, 1, 4096);
  const requestPayload = {
    model,
    messages: buildMessages(payload.system, payload.input),
    response_format: { type: 'json_object' }
  };
  if (temperature !== null) requestPayload.temperature = temperature;
  if (topP !== null) requestPayload.top_p = topP;
  if (maxOutputTokens !== null) requestPayload.max_tokens = Math.floor(maxOutputTokens);

  const fetchFn = (env && env._fetchFn) || fetch;
  const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestPayload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`llm_api_error: HTTP ${response.status} ${errText}`.slice(0, 200));
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content || typeof content !== 'string') {
    throw new Error('llm_api_error: empty response content');
  }

  let answer;
  try {
    answer = JSON.parse(content);
  } catch (_err) {
    throw new Error('llm_api_error: response is not valid JSON');
  }

  return {
    answer,
    model: (data && data.model) || model,
    usage: data && data.usage ? data.usage : null,
    provider: 'chat_completions'
  };
}

async function callOpenAi(payload, env) {
  const source = env && typeof env === 'object' ? env : process.env;
  const useResponsesApi = resolveBooleanEnvFlag('ENABLE_V1_OPENAI_RESPONSES', false, source);
  if (!useResponsesApi) {
    return callChatCompletions(payload, source);
  }

  const adapterResult = await callResponsesApi({
    system: payload && payload.system,
    input: payload && payload.input,
    model: resolveRequestModel(payload || {}, source),
    temperature: payload && payload.temperature,
    top_p: payload && payload.top_p,
    max_output_tokens: payload && payload.max_output_tokens,
    response_format: payload && payload.response_format,
    strictSemanticObject: resolveBooleanEnvFlag('ENABLE_V1_SEMANTIC_OBJECT_STRICT', false, source)
  }, source);

  const answer = adapterResult.semanticResponseObject || adapterResult.output;
  return {
    answer,
    model: adapterResult.model || resolveRequestModel(payload || {}, source),
    usage: adapterResult.usage || null,
    provider: 'responses_api',
    fallbackApplied: adapterResult.fallbackApplied === true,
    responseId: adapterResult.responseId || null,
    errors: Array.isArray(adapterResult.errors) ? adapterResult.errors : []
  };
}

async function answerFaq(payload, env) {
  return callOpenAi(payload, env);
}

async function callOpsExplain(payload, env) {
  return callOpenAi(payload, env);
}

async function callNextActionCandidates(payload, env) {
  return callOpenAi(payload, env);
}

async function explainOps(payload) {
  const result = await callOpenAi(payload, process.env);
  return { explanation: result.answer, model: result.model };
}

async function suggestNextActionCandidates(payload) {
  const result = await callOpenAi(payload, process.env);
  return { nextActionCandidates: result.answer, model: result.model };
}

module.exports = {
  answerFaq,
  callOpsExplain,
  callNextActionCandidates,
  explainOps,
  suggestNextActionCandidates,
  callOpenAi
};
