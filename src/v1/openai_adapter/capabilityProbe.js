'use strict';

function probeOpenAiCapabilities(env) {
  const source = env && typeof env === 'object' ? env : process.env;
  return {
    responsesApi: true,
    structuredOutputs: true,
    functionCalling: true,
    model: typeof source.OPENAI_MODEL === 'string' && source.OPENAI_MODEL.trim()
      ? source.OPENAI_MODEL.trim()
      : 'gpt-4o-mini',
    judgeModel: typeof source.OPENAI_JUDGE_MODEL === 'string' && source.OPENAI_JUDGE_MODEL.trim()
      ? source.OPENAI_JUDGE_MODEL.trim()
      : null
  };
}

module.exports = {
  probeOpenAiCapabilities
};
