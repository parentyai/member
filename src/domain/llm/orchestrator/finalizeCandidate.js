'use strict';

const {
  sanitizePaidMainReply,
  containsLegacyTemplateTerms
} = require('../conversation/paidReplyGuard');
const {
  buildDeepenReplyFromSource,
  buildCityScopedAnswerLines,
  buildParentFriendlyOneLine
} = require('../../../usecases/assistant/generatePaidDomainConciergeReply');
const {
  buildReplyTemplateFingerprint,
  classifyReplyTemplateKind
} = require('../conversation/replyTemplateTelemetry');
const {
  createResponseQualityContext,
  createResponseQualityVerdict
} = require('../quality/responseQualityFoundation');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForPaidLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function extractActionBullets(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('・'))
    .map((line) => line.replace(/^・\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function extractFollowupQuestion(text) {
  const lines = normalizeText(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const questionLine = lines.find((line) => /[?？]$/.test(line) || line.includes('ですか'));
  return questionLine || null;
}

function recoverReplyTextFromContract(replyText, requestContract) {
  const contract = requestContract && typeof requestContract === 'object' ? requestContract : {};
  const normalizedReply = normalizeText(replyText);
  const sourceReplyText = normalizeText(contract.sourceReplyText);
  const depthIntent = normalizeText(contract.depthIntent).toLowerCase();
  const requestShape = normalizeText(contract.requestShape).toLowerCase();
  const primaryDomainIntent = normalizeText(contract.primaryDomainIntent).toLowerCase() || 'general';
  const outputForm = normalizeText(contract.outputForm).toLowerCase() || 'default';
  const locationHint = contract.locationHint && typeof contract.locationHint === 'object' ? contract.locationHint : {};
  const locationHintKind = normalizeText(locationHint.kind).toLowerCase();

  if (
    depthIntent === 'deepen'
    && sourceReplyText
    && /いまの状況を整理します|いま一番困っている|今すぐ進める手続きを1つ決める/.test(normalizedReply)
  ) {
    const deepenLines = buildDeepenReplyFromSource(sourceReplyText, primaryDomainIntent, contract.messageText || '');
    if (Array.isArray(deepenLines) && deepenLines.length > 0) {
      return deepenLines
        .slice(0, outputForm === 'two_sentences' ? 2 : 1)
        .map((line) => normalizeText(line))
        .filter(Boolean)
        .join('\n');
    }
  }

  if (
    requestShape === 'answer'
    && primaryDomainIntent === 'school'
    && ['city', 'regionkey', 'state'].includes(locationHintKind)
    && /学校手続きですね|学区と対象校の条件を確認|次の一手を具体化できます[？?]?$/.test(normalizedReply)
  ) {
    const cityScopedLines = buildCityScopedAnswerLines(contract, primaryDomainIntent);
    if (Array.isArray(cityScopedLines) && cityScopedLines.length > 0) {
      return cityScopedLines.slice(0, 2).map((line) => normalizeText(line)).filter(Boolean).join('\n');
    }
  }

  if (
    requestShape === 'rewrite'
    && outputForm === 'one_line'
    && /(小学生の保護者向け).*(やさしい日本語).*(1文|一文)/i.test(normalizeText(contract.messageText))
  ) {
    return normalizeText(buildParentFriendlyOneLine(primaryDomainIntent || 'general'));
  }

  return normalizedReply;
}

function finalizeCandidate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const selected = payload.selected && typeof payload.selected === 'object' ? payload.selected : {};
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const verificationOutcome = normalizeText(payload.verificationOutcome) || 'passed';
  const readinessDecision = normalizeText(payload.readinessDecision) || 'allow';
  const readinessSafeResponseMode = normalizeText(payload.readinessSafeResponseMode) || 'answer';
  const contradictionFlags = Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [];
  const violationCodes = Array.isArray(payload.violationCodes) ? payload.violationCodes : [];
  const fallbackText = normalizeText(payload.fallbackText)
    || '状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。';
  const readinessClarifyText = normalizeText(payload.readinessClarifyText);
  const atoms = selected.atoms && typeof selected.atoms === 'object' ? selected.atoms : {};
  const preserveReplyText = selected.preserveReplyText === true
    || normalizeText(requestContract.outputForm).toLowerCase() !== 'default'
    || ['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction', 'followup_continue'].includes(
      normalizeText(requestContract.requestShape).toLowerCase()
    );

  const guardResult = preserveReplyText
    ? null
    : sanitizePaidMainReply(selected.replyText, {
      fallbackText,
      situationLine: atoms.situationLine || '',
      nextActions: Array.isArray(atoms.nextActions) ? atoms.nextActions : [],
      pitfall: atoms.pitfall || '',
      followupQuestion: atoms.followupQuestion || '',
      recentAssistantCommitments: Array.isArray(payload.recentAssistantCommitments)
        ? payload.recentAssistantCommitments
        : [],
      defaultQuestion: verificationOutcome === 'clarify'
        ? 'まず対象手続きと期限を1つずつ教えてください。'
        : (payload.repetitionPrevented === true
          ? '対象を絞って案内したいので、いま一番気になっている手続きを1つ教えてください。'
          : ''),
      repetitionPrevented: payload.repetitionPrevented === true,
      conciseMode: selected.conciseModeApplied === true,
      requestContract
    });
  const guardedReplyText = preserveReplyText
    ? (trimForPaidLineMessage(normalizeText(selected.replyText)) || fallbackText)
    : (trimForPaidLineMessage(normalizeText(guardResult && guardResult.text) || fallbackText) || fallbackText);
  const recoveredReplyText = recoverReplyTextFromContract(guardedReplyText, requestContract) || guardedReplyText;
  const responseQualityContext = payload.responseQualityContext && typeof payload.responseQualityContext === 'object'
    ? payload.responseQualityContext
    : createResponseQualityContext({
      entryType: 'orchestrator',
      requestShape: normalizeText(requestContract.requestShape).toLowerCase(),
      outputForm: normalizeText(requestContract.outputForm).toLowerCase(),
      transformSource: normalizeText(requestContract.transformSource).toLowerCase(),
      knowledgeScope: normalizeText(requestContract.knowledgeScope).toLowerCase()
    });
  const responseQualityVerdict = createResponseQualityVerdict({
    responseQualityContext,
    readinessGate: payload.readinessGate,
    readinessOverride: {
      decision: readinessDecision,
      reasonCodes: payload.readinessReasonCodes,
      safeResponseMode: readinessSafeResponseMode
    },
    replyText: recoveredReplyText,
    clarifyText: readinessClarifyText || 'まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。',
    refuseText: 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。'
  });
  const replyText = trimForPaidLineMessage(responseQualityVerdict.replyText) || fallbackText;
  const fallbackTemplateKind = guardResult && typeof guardResult.templateKind === 'string'
    ? guardResult.templateKind
    : classifyReplyTemplateKind({
      replyText: guardedReplyText,
      candidateKind: selected.kind || null,
      conciseModeApplied: selected.conciseModeApplied === true
    });
  const finalizerTemplateKind = classifyReplyTemplateKind({
    replyText,
    candidateKind: selected.kind || null,
    readinessDecision: responseQualityVerdict.readiness.decision,
    conciseModeApplied: selected.conciseModeApplied === true
  });

  return {
    replyText,
    finalMeta: {
      legacyTemplateHit: guardResult ? guardResult.legacyTemplateHit === true : containsLegacyTemplateTerms(replyText),
      actionCount: guardResult && Number.isFinite(Number(guardResult.actionCount)) ? Number(guardResult.actionCount) : extractActionBullets(replyText).length,
      pitfallIncluded: guardResult ? guardResult.pitfallIncluded === true : /(詰まりやすい|注意|リスク|気をつけ|ボトルネック)/.test(replyText),
      followupQuestionIncluded: guardResult ? guardResult.followupQuestionIncluded === true : Boolean(extractFollowupQuestion(replyText)),
      committedNextActions: extractActionBullets(replyText),
      committedFollowupQuestion: extractFollowupQuestion(replyText),
      verificationOutcome,
      contradictionFlags: contradictionFlags.slice(0, 8),
      violationCodes: violationCodes.slice(0, 8),
      candidateId: selected.id || selected.kind || null,
      candidateKind: selected.kind || null,
      fallbackTemplateKind,
      finalizerTemplateKind,
      replyTemplateFingerprint: buildReplyTemplateFingerprint(replyText),
      readinessDecision: responseQualityVerdict.readiness.decision,
      readinessSafeResponseMode,
      readinessEnforced: responseQualityVerdict.enforced === true,
      responseQualityContextVersion: responseQualityContext.contractVersion,
      responseQualityVerdictVersion: responseQualityVerdict.contractVersion
    },
    responseQualityVerdict
  };
}

module.exports = {
  finalizeCandidate
};
