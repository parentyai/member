'use strict';

const { callResponsesApi } = require('../v1/openai_adapter/responsesClient');
const { resolveBooleanEnvFlag } = require('../v1/shared/flags');

const DEFAULT_MODEL = 'gpt-4o-mini';

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

async function callOpenAi(payload, env) {
  const source = env && typeof env === 'object' ? env : process.env;
  try {
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
    if (!adapterResult || adapterResult.ok !== true) {
      throw new Error('llm_api_error');
    }
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
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : '';
    if (message.includes('OPENAI_API_KEY')) {
      throw err;
    }
    throw new Error('llm_api_error');
  }
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
