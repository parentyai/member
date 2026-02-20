'use strict';

// LLM API adapter — flag gating is handled in the usecase layer (answerFaqFromKb, etc.).
// This module is purely responsible for HTTP transport to the OpenAI-compatible API.
// OPENAI_API_KEY must be set in the environment / Secret Manager. Never hardcode.

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

function buildMessages(system, input) {
  return [
    { role: 'system', content: String(system || '') },
    { role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }
  ];
}

async function callOpenAi(payload, env) {
  const apiKey = resolveApiKey(env);
  const model = resolveModel(env);
  const body = JSON.stringify({
    model,
    messages: buildMessages(payload.system, payload.input),
    response_format: { type: 'json_object' }
  });

  const fetchFn = (env && env._fetchFn) || fetch;
  const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body
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

  return { answer, model: (data && data.model) || model };
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

module.exports = {
  answerFaq,
  callOpsExplain,
  callNextActionCandidates
};
