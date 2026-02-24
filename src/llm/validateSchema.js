'use strict';

const {
  OPS_EXPLANATION_SCHEMA_ID,
  NEXT_ACTION_CANDIDATES_SCHEMA_ID,
  FAQ_ANSWER_SCHEMA_ID,
  PAID_ASSISTANT_REPLY_SCHEMA_ID,
  PAID_ASSISTANT_INTENTS,
  ABSTRACT_ACTIONS
} = require('./schemas');

const MAX_FACTS = 30;
const MAX_INTERPRETATIONS = 10;
const MAX_NOTES = 10;
const MAX_CANDIDATES = 3;
const MAX_CITATIONS = 5;
const MAX_PAID_LIST = 8;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isNonEmptyString(value) {
  return isString(value) && value.trim().length > 0;
}

function isIsoDateString(value) {
  if (!isString(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function isValidConfidence(value) {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

function containsDirectUrl(text) {
  if (!isString(text)) return false;
  return /https?:\/\//i.test(text) || /\bwww\./i.test(text);
}

function validateSafety(value, errors, path) {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be object`);
    return;
  }
  const status = value.status;
  if (!(status === 'OK' || status === 'BLOCK')) {
    errors.push(`${path}.status invalid`);
  }
  if (!Array.isArray(value.reasons)) {
    errors.push(`${path}.reasons must be array`);
  } else if (value.reasons.length > MAX_NOTES) {
    errors.push(`${path}.reasons too many`);
  }
}

function validateOpsExplanation(payload) {
  const errors = [];
  if (!isPlainObject(payload)) {
    return ['payload must be object'];
  }
  if (payload.schemaId !== OPS_EXPLANATION_SCHEMA_ID) {
    errors.push('schemaId mismatch');
  }
  if (!isIsoDateString(payload.generatedAt)) {
    errors.push('generatedAt invalid');
  }
  if (payload.advisoryOnly !== true) {
    errors.push('advisoryOnly must be true');
  }
  if (!Array.isArray(payload.facts) || payload.facts.length > MAX_FACTS) {
    errors.push('facts invalid');
  } else {
    payload.facts.forEach((fact, idx) => {
      if (!isPlainObject(fact)) {
        errors.push(`facts[${idx}] invalid`);
        return;
      }
      if (!isNonEmptyString(fact.id)) errors.push(`facts[${idx}].id invalid`);
      if (!isNonEmptyString(fact.label)) errors.push(`facts[${idx}].label invalid`);
      if (!isNonEmptyString(fact.value)) errors.push(`facts[${idx}].value invalid`);
      if (!['read_model', 'ops_state', 'decision_log', 'audit_log', 'system_flags'].includes(fact.sourceType)) {
        errors.push(`facts[${idx}].sourceType invalid`);
      }
    });
  }
  if (!Array.isArray(payload.interpretations) || payload.interpretations.length > MAX_INTERPRETATIONS) {
    errors.push('interpretations invalid');
  } else {
    payload.interpretations.forEach((item, idx) => {
      if (!isPlainObject(item)) {
        errors.push(`interpretations[${idx}] invalid`);
        return;
      }
      if (!isNonEmptyString(item.statement)) errors.push(`interpretations[${idx}].statement invalid`);
      if (!Array.isArray(item.basedOn) || item.basedOn.length > MAX_NOTES) {
        errors.push(`interpretations[${idx}].basedOn invalid`);
      }
      if (!isValidConfidence(item.confidence)) {
        errors.push(`interpretations[${idx}].confidence invalid`);
      }
    });
  }
  if (payload.candidates !== undefined) {
    if (!Array.isArray(payload.candidates) || payload.candidates.length > MAX_CANDIDATES) {
      errors.push('candidates invalid');
    } else {
      payload.candidates.forEach((item, idx) => {
        if (!isPlainObject(item)) {
          errors.push(`candidates[${idx}] invalid`);
          return;
        }
        if (!ABSTRACT_ACTIONS.includes(item.action)) {
          errors.push(`candidates[${idx}].action invalid`);
        }
        if (!isNonEmptyString(item.reason)) {
          errors.push(`candidates[${idx}].reason invalid`);
        }
        if (!isValidConfidence(item.confidence)) {
          errors.push(`candidates[${idx}].confidence invalid`);
        }
      });
    }
  }
  if (payload.safety !== undefined) {
    validateSafety(payload.safety, errors, 'safety');
  }
  return errors;
}

function validateNextActionCandidates(payload) {
  const errors = [];
  if (!isPlainObject(payload)) {
    return ['payload must be object'];
  }
  if (payload.schemaId !== NEXT_ACTION_CANDIDATES_SCHEMA_ID) {
    errors.push('schemaId mismatch');
  }
  if (!isIsoDateString(payload.generatedAt)) {
    errors.push('generatedAt invalid');
  }
  if (payload.advisoryOnly !== true) {
    errors.push('advisoryOnly must be true');
  }
  if (!Array.isArray(payload.candidates) || payload.candidates.length > MAX_CANDIDATES) {
    errors.push('candidates invalid');
  } else {
    payload.candidates.forEach((item, idx) => {
      if (!isPlainObject(item)) {
        errors.push(`candidates[${idx}] invalid`);
        return;
      }
      if (!ABSTRACT_ACTIONS.includes(item.action)) {
        errors.push(`candidates[${idx}].action invalid`);
      }
      if (!isNonEmptyString(item.reason)) {
        errors.push(`candidates[${idx}].reason invalid`);
      }
      if (!isValidConfidence(item.confidence)) {
        errors.push(`candidates[${idx}].confidence invalid`);
      }
      if (!isPlainObject(item.safety)) {
        errors.push(`candidates[${idx}].safety invalid`);
      } else {
        validateSafety(item.safety, errors, `candidates[${idx}].safety`);
      }
    });
  }
  return errors;
}

function validateFaqAnswer(payload) {
  const errors = [];
  if (!isPlainObject(payload)) {
    return ['payload must be object'];
  }
  if (payload.schemaId !== FAQ_ANSWER_SCHEMA_ID) {
    errors.push('schemaId mismatch');
  }
  if (!isIsoDateString(payload.generatedAt)) {
    errors.push('generatedAt invalid');
  }
  if (payload.advisoryOnly !== true) {
    errors.push('advisoryOnly must be true');
  }
  if (!isNonEmptyString(payload.question)) {
    errors.push('question invalid');
  }
  if (!isNonEmptyString(payload.answer)) {
    errors.push('answer invalid');
  }
  if (containsDirectUrl(payload.answer)) {
    errors.push('direct_url_detected');
  }
  if (!Array.isArray(payload.citations) || payload.citations.length > MAX_CITATIONS) {
    errors.push('citations invalid');
  } else {
    payload.citations.forEach((item, idx) => {
      if (!isPlainObject(item)) {
        errors.push(`citations[${idx}] invalid`);
        return;
      }
      if (!['link_registry', 'docs'].includes(item.sourceType)) {
        errors.push(`citations[${idx}].sourceType invalid`);
      }
      if (!isNonEmptyString(item.sourceId)) {
        errors.push(`citations[${idx}].sourceId invalid`);
      }
    });
  }
  if (payload.safety !== undefined) {
    validateSafety(payload.safety, errors, 'safety');
  }
  return errors;
}

function validatePaidAssistantReply(payload) {
  const errors = [];
  if (!isPlainObject(payload)) {
    return ['payload must be object'];
  }
  if (payload.schemaId !== PAID_ASSISTANT_REPLY_SCHEMA_ID) {
    errors.push('schemaId mismatch');
  }
  if (!isIsoDateString(payload.generatedAt)) {
    errors.push('generatedAt invalid');
  }
  if (payload.advisoryOnly !== true) {
    errors.push('advisoryOnly must be true');
  }
  if (!isNonEmptyString(payload.intent) || !PAID_ASSISTANT_INTENTS.includes(payload.intent)) {
    errors.push('intent invalid');
  }
  if (!isNonEmptyString(payload.situation)) {
    errors.push('situation invalid');
  } else if (containsDirectUrl(payload.situation)) {
    errors.push('situation direct_url_detected');
  }
  if (!Array.isArray(payload.gaps) || payload.gaps.length > MAX_PAID_LIST) {
    errors.push('gaps invalid');
  } else {
    payload.gaps.forEach((item, idx) => {
      if (!isNonEmptyString(item)) errors.push(`gaps[${idx}] invalid`);
      if (containsDirectUrl(item)) errors.push(`gaps[${idx}] direct_url_detected`);
    });
  }
  if (!Array.isArray(payload.risks) || payload.risks.length > MAX_PAID_LIST) {
    errors.push('risks invalid');
  } else {
    payload.risks.forEach((item, idx) => {
      if (!isNonEmptyString(item)) errors.push(`risks[${idx}] invalid`);
      if (containsDirectUrl(item)) errors.push(`risks[${idx}] direct_url_detected`);
    });
  }
  if (!Array.isArray(payload.nextActions) || payload.nextActions.length > MAX_CANDIDATES) {
    errors.push('nextActions invalid');
  } else {
    payload.nextActions.forEach((item, idx) => {
      if (!isNonEmptyString(item)) errors.push(`nextActions[${idx}] invalid`);
      if (containsDirectUrl(item)) errors.push(`nextActions[${idx}] direct_url_detected`);
    });
  }
  if (!Array.isArray(payload.evidenceKeys) || payload.evidenceKeys.length === 0 || payload.evidenceKeys.length > MAX_PAID_LIST) {
    errors.push('evidenceKeys invalid');
  } else {
    payload.evidenceKeys.forEach((item, idx) => {
      if (!isNonEmptyString(item)) errors.push(`evidenceKeys[${idx}] invalid`);
      if (containsDirectUrl(item)) errors.push(`evidenceKeys[${idx}] direct_url_detected`);
    });
  }
  return errors;
}

function validateSchema(schemaId, payload) {
  let errors = [];
  if (schemaId === OPS_EXPLANATION_SCHEMA_ID) {
    errors = validateOpsExplanation(payload);
  } else if (schemaId === NEXT_ACTION_CANDIDATES_SCHEMA_ID) {
    errors = validateNextActionCandidates(payload);
  } else if (schemaId === FAQ_ANSWER_SCHEMA_ID) {
    errors = validateFaqAnswer(payload);
  } else if (schemaId === PAID_ASSISTANT_REPLY_SCHEMA_ID) {
    errors = validatePaidAssistantReply(payload);
  } else {
    errors = ['unknown schemaId'];
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  validateSchema,
  containsDirectUrl
};
