'use strict';

const { sanitizeTools } = require('./toolAllowlist');
const { parseStructuredOutput, parseGenericJsonOutput } = require('./structuredOutputParser');
const { semanticResponseObjectSchema } = require('../semantic/semanticResponseObject');
const { resolveBooleanEnvFlag, resolveNumberEnvFlag } = require('../shared/flags');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 12000;

function resolveApiKey(env) {
  const source = env && typeof env === 'object' ? env : process.env;
  const key = source.OPENAI_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return key.trim();
}

function resolveModel(payload, env) {
  if (payload && typeof payload.model === 'string' && payload.model.trim()) return payload.model.trim();
  const source = env && typeof env === 'object' ? env : process.env;
  if (typeof source.OPENAI_MODEL === 'string' && source.OPENAI_MODEL.trim()) return source.OPENAI_MODEL.trim();
  return DEFAULT_MODEL;
}

function stringifyInput(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return String(value || '');
  }
}

function buildResponsesInput(system, input) {
  const rows = [];
  const systemText = stringifyInput(system || '');
  if (systemText.trim()) {
    rows.push({ role: 'system', content: [{ type: 'input_text', text: systemText }] });
  }
  rows.push({ role: 'user', content: [{ type: 'input_text', text: stringifyInput(input) }] });
  return rows;
}

function buildFormat(payload, strictSemantic) {
  if (payload && payload.response_format && payload.response_format.type === 'json_schema' && payload.response_format.schema) {
    return {
      format: {
        type: 'json_schema',
        name: payload.response_format.name || 'member_response',
        strict: payload.response_format.strict !== false,
        schema: payload.response_format.schema
      }
    };
  }
  if (strictSemantic) {
    return {
      format: {
        type: 'json_schema',
        name: 'semantic_response_object',
        strict: true,
        schema: semanticResponseObjectSchema
      }
    };
  }
  return {
    format: {
      type: 'json_schema',
      name: 'member_json',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: true
      }
    }
  };
}

async function fetchWithTimeout(url, options, timeoutMs, fetchFn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, Object.assign({}, options, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function callResponsesApi(payload, env) {
  const source = env && typeof env === 'object' ? env : process.env;
  const apiKey = resolveApiKey(source);
  const model = resolveModel(payload, source);
  const strictSemantic = resolveBooleanEnvFlag('ENABLE_V1_SEMANTIC_OBJECT_STRICT', false, source)
    || Boolean(payload && payload.strictSemanticObject === true);
  const retries = resolveNumberEnvFlag('OPENAI_RESPONSES_RETRIES', 1, source, 0, 3);
  const timeoutMs = resolveNumberEnvFlag('OPENAI_RESPONSES_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, source, 1000, 30000);

  const requestPayload = {
    model,
    input: buildResponsesInput(payload && payload.system, payload && payload.input),
    text: buildFormat(payload, strictSemantic),
    max_output_tokens: Number.isFinite(Number(payload && payload.max_output_tokens))
      ? Math.max(1, Math.min(4096, Math.floor(Number(payload.max_output_tokens))))
      : undefined,
    temperature: Number.isFinite(Number(payload && payload.temperature))
      ? Math.max(0, Math.min(2, Number(payload.temperature)))
      : undefined,
    top_p: Number.isFinite(Number(payload && payload.top_p))
      ? Math.max(0, Math.min(1, Number(payload.top_p)))
      : undefined
  };

  const sanitizedTools = sanitizeTools(payload && payload.tools);
  if (sanitizedTools.length > 0) {
    requestPayload.tools = sanitizedTools;
    if (payload && payload.tool_choice) requestPayload.tool_choice = payload.tool_choice;
  }

  Object.keys(requestPayload).forEach((key) => {
    if (requestPayload[key] === undefined) delete requestPayload[key];
  });

  const fetchFn = (source && source._fetchFn) || fetch;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestPayload)
        },
        timeoutMs,
        fetchFn
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`openai_responses_error: HTTP ${response.status} ${errText}`.slice(0, 300));
      }

      const data = await response.json();
      const parsed = strictSemantic
        ? parseStructuredOutput(data, { text: '回答を生成できませんでした。', intent: 'general' })
        : parseGenericJsonOutput(data);

      if (!parsed.ok && attempt < retries) continue;

      return {
        ok: parsed.ok,
        model: typeof data.model === 'string' ? data.model : model,
        usage: data && data.usage ? data.usage : null,
        output: parsed.value || parsed.semanticResponseObject,
        semanticResponseObject: parsed.semanticResponseObject || null,
        rawText: parsed.rawText || null,
        errors: parsed.errors || [],
        fallbackApplied: parsed.fallbackApplied === true || parsed.ok !== true,
        responseId: typeof data.id === 'string' ? data.id : null
      };
    } catch (err) {
      lastError = err;
      if (attempt >= retries) throw err;
    }
  }
  throw lastError || new Error('openai_responses_error: unknown');
}

function toFunctionCallOutputs(toolResults) {
  if (!Array.isArray(toolResults)) return [];
  return toolResults
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const callId = typeof row.call_id === 'string' ? row.call_id.trim() : '';
      if (!callId) return null;
      return {
        type: 'function_call_output',
        call_id: callId,
        output: row.output && typeof row.output === 'object' ? row.output : { ok: Boolean(row.ok) }
      };
    })
    .filter(Boolean);
}

module.exports = {
  callResponsesApi,
  toFunctionCallOutputs
};
