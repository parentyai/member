'use strict';

const DIRECT_URL_PATTERN = /https?:\/\/[^\s)]+/gi;
const WWW_URL_PATTERN = /\bwww\.[^\s)]+/gi;
const SOURCE_PATTERN = /\(source:\s*[^)]+\)/gi;
const LEGACY_TEMPLATE_PATTERN = /(関連情報です|FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\])/g;

const CERTAINTY_REPLACEMENTS = [
  { pattern: /絶対に?/g, replace: '原則' },
  { pattern: /必ず/g, replace: '通常は' },
  { pattern: /100%/g, replace: '高い可能性' },
  { pattern: /間違いなく/g, replace: '可能性が高く' }
];

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function capSources(text, maxUrls) {
  const cap = Number.isFinite(Number(maxUrls)) ? Math.max(0, Math.floor(Number(maxUrls))) : 0;
  if (cap <= 0) {
    const stripped = text.replace(/\n?根拠:\s*(?:\(source:[^)]+\)\s*,?\s*)+/g, '').trim();
    return { text: stripped, removed: 0 };
  }
  const matches = Array.from(text.matchAll(SOURCE_PATTERN));
  if (matches.length <= cap) return { text, removed: 0 };
  let removed = 0;
  let index = 0;
  const patched = text.replace(SOURCE_PATTERN, (value) => {
    index += 1;
    if (index <= cap) return value;
    removed += 1;
    return '';
  }).replace(/,\s*,+/g, ', ').replace(/\s+,/g, ',').replace(/\n{3,}/g, '\n\n').trim();
  return { text: patched, removed };
}

function softenRiskAssertions(text, topic) {
  const normalizedTopic = normalizeText(topic).toLowerCase();
  const regulated = ['regulation', 'medical', 'visa', 'tax', 'school', 'pricing'];
  if (!regulated.includes(normalizedTopic)) return text;
  return text
    .replace(/問題ありません/g, '確認が必要です')
    .replace(/保証します/g, '可能性があります')
    .replace(/断言できます/g, '一般的にはそう言えます');
}

function lintConciergeText(params) {
  const payload = params && typeof params === 'object' ? params : {};
  let text = normalizeText(payload.text);
  const findings = [];

  if (!text) {
    return {
      text: '',
      findings,
      modified: false
    };
  }

  if (DIRECT_URL_PATTERN.test(text) || WWW_URL_PATTERN.test(text)) {
    text = text.replace(DIRECT_URL_PATTERN, '[removed-url]').replace(WWW_URL_PATTERN, '[removed-url]');
    findings.push('direct_url_removed');
  }

  if (LEGACY_TEMPLATE_PATTERN.test(text)) {
    text = text
      .replace(LEGACY_TEMPLATE_PATTERN, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    findings.push('legacy_template_removed');
  }

  CERTAINTY_REPLACEMENTS.forEach((rule) => {
    if (rule.pattern.test(text)) {
      text = text.replace(rule.pattern, rule.replace);
      findings.push('certainty_softened');
    }
  });

  const softened = softenRiskAssertions(text, payload.topic || payload.mode || '');
  if (softened !== text) {
    text = softened;
    findings.push('regulated_assertion_softened');
  }

  const capped = capSources(text, payload.maxUrls);
  if (capped.removed > 0) {
    text = capped.text;
    findings.push('source_capped');
  }

  return {
    text: text.trim(),
    findings: Array.from(new Set(findings)),
    modified: findings.length > 0
  };
}

module.exports = {
  lintConciergeText
};
