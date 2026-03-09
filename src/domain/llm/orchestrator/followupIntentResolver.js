'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function hasPattern(text, pattern) {
  if (!text) return false;
  return pattern.test(text);
}

const DOCS_REQUIRED_PATTERN = /(必要書類|書類|持ち物|必要なもの|何を用意|何が必要|documents?|required\s*docs?|id\s*documents?|提出物|証明書|証憑|身分証)/i;
const APPOINTMENT_NEEDED_PATTERN = /(予約|アポ|appointment|book|walk[\s-]?in|窓口.*予約|予約.*必要|予約するの|予約いる|予約要る|来店予約|面談予約)/i;
const NEXT_STEP_PATTERN = /(後は何|あとは何|次は|つぎは|そのあと|それで|then\s*what|next\s*step|次の一手|どう進める|何から)/i;
const CONTEXTUAL_SHORT_PATTERN = /^(ヒザ|ひざ|ヒザだって|ひざだって|ビザ|びざ|それで|それは|それって|じゃあ|では|どうする|どうするの|何から|次|つぎ|必要書類|必要書類は|書類|予約|予約するの|予約必要|予約要る|後は何|あとは何)$/i;
const DOMAIN_ANCHORED_SHORT_PATTERN = /^(ssn|学校|学区|賃貸|住宅|部屋探し|家探し|銀行|口座|ビザ|visa)[a-zぁ-んァ-ンー0-9\s]*[?？]?$|^(ssnha|ssnは|ssnって)[?？]?$/i;

function resolveFollowupIntent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const domainIntentRaw = normalizeText(payload.domainIntent).toLowerCase();
  const contextDomainRaw = normalizeText(payload.contextResumeDomain).toLowerCase();
  const domainIntent = domainIntentRaw || contextDomainRaw || 'general';

  if (!messageText || domainIntent === 'general') {
    return {
      followupIntent: null,
      reason: 'domain_missing'
    };
  }

  if (hasPattern(messageText, DOCS_REQUIRED_PATTERN)) {
    return {
      followupIntent: 'docs_required',
      reason: 'docs_keyword'
    };
  }

  if (hasPattern(messageText, APPOINTMENT_NEEDED_PATTERN)) {
    return {
      followupIntent: 'appointment_needed',
      reason: 'appointment_keyword'
    };
  }

  if (hasPattern(messageText, NEXT_STEP_PATTERN)) {
    return {
      followupIntent: 'next_step',
      reason: 'next_step_keyword'
    };
  }

  if (messageText.length <= 8 && hasPattern(messageText, CONTEXTUAL_SHORT_PATTERN)) {
    return {
      followupIntent: 'next_step',
      reason: 'contextual_short_followup'
    };
  }

  if (messageText.length <= 14 && hasPattern(messageText, DOMAIN_ANCHORED_SHORT_PATTERN)) {
    return {
      followupIntent: 'next_step',
      reason: 'domain_anchored_short_followup'
    };
  }

  return {
    followupIntent: null,
    reason: 'none'
  };
}

module.exports = {
  resolveFollowupIntent
};
