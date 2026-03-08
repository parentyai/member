'use strict';

const {
  parseSemanticResponseObjectStrict,
  buildDeterministicFallbackSemanticResponseObject
} = require('../semantic/semanticResponseObject');

function resolveOutputText(responseData) {
  if (!responseData || typeof responseData !== 'object') return '';
  if (typeof responseData.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text;
  }
  const output = Array.isArray(responseData.output) ? responseData.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
      if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
  }
  return '';
}

function parseStructuredOutput(responseData, fallbackContext) {
  const rawText = resolveOutputText(responseData);
  const parsed = parseSemanticResponseObjectStrict(rawText, fallbackContext);
  return {
    ok: parsed.ok,
    errors: parsed.errors,
    semanticResponseObject: parsed.value,
    rawText,
    fallbackApplied: parsed.ok !== true
  };
}

function parseGenericJsonOutput(responseData) {
  const rawText = resolveOutputText(responseData);
  if (!rawText) {
    return {
      ok: false,
      errors: ['empty_model_output'],
      value: buildDeterministicFallbackSemanticResponseObject({ text: '回答を生成できませんでした。' }),
      rawText
    };
  }
  try {
    return {
      ok: true,
      errors: [],
      value: JSON.parse(rawText),
      rawText
    };
  } catch (_err) {
    return {
      ok: false,
      errors: ['invalid_json_model_output'],
      value: buildDeterministicFallbackSemanticResponseObject({ text: '回答を生成できませんでした。' }),
      rawText
    };
  }
}

module.exports = {
  resolveOutputText,
  parseStructuredOutput,
  parseGenericJsonOutput
};
