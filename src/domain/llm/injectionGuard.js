'use strict';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/i,
  /disregard\s+(all\s+)?instructions?/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(the\s+)?(secret|api key|token|password)/i,
  /send\s+credentials?/i,
  /execute\s+this\s+command/i,
  /follow\s+these\s+instructions?/i,
  /act\s+as\s+root/i
];

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function detectInjection(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return INJECTION_PATTERNS.filter((pattern) => pattern.test(normalized)).map((pattern) => pattern.source);
}

function sanitizeText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return { text: '', findings: [] };
  const lines = normalized.split(/\r?\n/);
  const findings = [];
  const kept = [];
  lines.forEach((line) => {
    const lineFindings = detectInjection(line);
    if (lineFindings.length) {
      findings.push(...lineFindings);
      return;
    }
    kept.push(line);
  });
  return { text: kept.join('\n').trim(), findings };
}

function sanitizeCandidates(candidates) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const output = [];
  const blockedReasons = [];
  let injectionFindings = false;
  rows.forEach((row) => {
    const candidate = row && typeof row === 'object' ? Object.assign({}, row) : null;
    if (!candidate) return;
    const titleResult = sanitizeText(candidate.title);
    const snippetResult = sanitizeText(candidate.snippet);
    const findings = [].concat(titleResult.findings, snippetResult.findings);
    if (findings.length) {
      injectionFindings = true;
      blockedReasons.push('external_instruction_detected');
    }
    candidate.title = titleResult.text;
    candidate.snippet = snippetResult.text;
    if (!candidate.title && !candidate.snippet && findings.length) return;
    output.push(candidate);
  });
  return {
    candidates: output,
    injectionFindings,
    blockedReasons: Array.from(new Set(blockedReasons))
  };
}

module.exports = {
  INJECTION_PATTERNS,
  detectInjection,
  sanitizeText,
  sanitizeCandidates
};
