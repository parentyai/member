'use strict';

const DOMAIN_INTENT_PATTERNS = Object.freeze({
  housing: /(住まい探し|家探し|住宅|部屋探し|賃貸|lease|apartment|引っ越し|引越し|転居|移住|住みやすさ|家賃相場|家賃|初期費用|生活立ち上げ|生活費|暮らし|relocation|move|moving|rent|cost of living|neighborhood|ニューヨーク|new york|ロサンゼルス|los angeles|サンフランシスコ|san francisco|シアトル|seattle|ボストン|boston|シカゴ|chicago|オースティン|austin|サンディエゴ|san diego|ワシントン|washington)/i,
  school: /(学校|学区|入学|転校|ワクチン証明|school|district|enrollment)/i,
  ssn: /(ssn|social security|ソーシャルセキュリティ|番号申請)/i,
  banking: /(銀行|口座|debit|checking|wire|bank account)/i
});

const DOMAIN_INTENTS = Object.freeze(Object.keys(DOMAIN_INTENT_PATTERNS));
const HOUSING_INTENT_PATTERN = DOMAIN_INTENT_PATTERNS.housing;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function detectConversationIntentHits(messageText) {
  const normalized = normalizeText(messageText);
  const hits = {
    housing: false,
    school: false,
    ssn: false,
    banking: false
  };
  if (!normalized) return hits;
  DOMAIN_INTENTS.forEach((intent) => {
    const pattern = DOMAIN_INTENT_PATTERNS[intent];
    hits[intent] = Boolean(pattern && pattern.test(normalized));
  });
  return hits;
}

function normalizeConversationIntent(messageText) {
  const hits = detectConversationIntentHits(messageText);
  const intent = DOMAIN_INTENTS.find((key) => hits[key] === true);
  if (intent) return intent;
  return 'general';
}

module.exports = {
  normalizeConversationIntent,
  detectConversationIntentHits,
  DOMAIN_INTENT_PATTERNS,
  DOMAIN_INTENTS,
  HOUSING_INTENT_PATTERN
};
