'use strict';

const { generatePaidAssistantReply } = require('./generatePaidAssistantReply');
const { resolvePersonalizedLlmContext } = require('./resolvePersonalizedLlmContext');
const llmQualityLogsRepo = require('../../repos/firestore/llmQualityLogsRepo');
const {
  resolveProcedureReplyPacket,
  buildProcedureSemanticFields
} = require('../../domain/llm/procedureKnowledge/resolveProcedureReplyPacket');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function inferProcedureDomain(question, intent) {
  const sample = `${normalizeText(question)} ${normalizeText(intent)}`.toLowerCase();
  if (/(school|学校|学区|転校|編入|enrollment)/.test(sample)) return 'school';
  if (/(housing|住まい|住宅|賃貸|物件|内見)/.test(sample)) return 'housing';
  if (/(ssn|social security|ソーシャルセキュリティ)/.test(sample)) return 'ssn';
  if (/(bank|banking|銀行|口座|checking|savings)/.test(sample)) return 'banking';
  return 'general';
}

async function generatePaidFaqReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const qualityRepo = resolvedDeps.llmQualityLogsRepo || llmQualityLogsRepo;
  const skipPersonalizedContext = payload.skipPersonalizedContext === true;
  const personalizedContext = skipPersonalizedContext
    ? null
    : (payload.personalizedContext
      || await resolvePersonalizedLlmContext({ lineUserId: payload.lineUserId || payload.userId }, resolvedDeps));

  const result = await generatePaidAssistantReply(Object.assign({}, payload, {
    personalizedContext
  }));

  const minTop1Score = Number(process.env.PAID_FAQ_MIN_TOP1_SCORE || 0);
  const minCitationCount = Number(process.env.PAID_FAQ_MIN_CITATION_COUNT || 1);
  const top1Score = result && Number.isFinite(Number(result.top1Score)) ? Number(result.top1Score) : null;
  const top2Score = result && Number.isFinite(Number(result.top2Score)) ? Number(result.top2Score) : null;
  const citationCount = Array.isArray(result && result.citations) ? result.citations.length : 0;
  const retryCount = Number.isFinite(Number(result && result.retryCount)) ? Number(result.retryCount) : 0;
  let decision = result && result.ok ? 'allow' : 'blocked';
  let blockedReason = result && result.ok ? null : (result && result.blockedReason ? result.blockedReason : 'unknown');

  const confidenceBlocked = Number.isFinite(minTop1Score)
    && minTop1Score > 0
    && Number.isFinite(top1Score)
    && top1Score < minTop1Score;
  const citationBlocked = Number.isFinite(minCitationCount)
    && minCitationCount > 0
    && citationCount < minCitationCount;

  if (result && result.ok && (confidenceBlocked || citationBlocked)) {
    decision = 'blocked';
    blockedReason = confidenceBlocked ? 'low_confidence' : 'citation_missing';
  }

  await qualityRepo.appendLlmQualityLog({
    userId: payload.lineUserId || payload.userId || '',
    intent: payload.intent || (result && result.intent) || 'situation_analysis',
    decision,
    blockedReason,
    top1Score,
    top2Score,
    citationCount,
    retryCount,
    model: result && result.model ? result.model : null,
    createdAt: payload.createdAt || new Date().toISOString()
  });

  const output = Object.assign({}, result, {
    personalizedContext
  });
  const procedurePacket = resolveProcedureReplyPacket({
    messageText: payload.question || payload.messageText || '',
    domainIntent: inferProcedureDomain(payload.question || payload.messageText || '', payload.intent || (result && result.intent) || ''),
    supportingSourceRefs: Array.isArray(result && result.citations)
      ? result.citations.map((citationId) => ({
        ref_id: citationId,
        label: citationId,
        sourceType: 'community'
      }))
      : []
  });
  const semanticFields = buildProcedureSemanticFields(procedurePacket, { maxQuickReplies: 3 });
  output.procedurePacket = procedurePacket;
  output.nextSteps = Array.isArray(result && result.output && result.output.nextActions) && result.output.nextActions.length > 0
    ? result.output.nextActions.slice(0, 3)
    : semanticFields.nextSteps;
  output.warnings = semanticFields.warnings;
  output.tasks = semanticFields.tasks;
  output.quickReplies = semanticFields.quickReplies;
  output.evidenceRefs = semanticFields.evidenceRefs;
  if (decision === 'blocked' && output.ok === true) {
    output.ok = false;
    output.blockedReason = blockedReason || 'quality_gate_blocked';
  }
  return output;
}

module.exports = {
  generatePaidFaqReply
};
