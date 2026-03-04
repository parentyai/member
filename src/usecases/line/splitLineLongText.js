'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function splitLineLongText(text, maxLength) {
  const content = normalizeText(text);
  if (!content) return [];
  const limit = Number.isFinite(Number(maxLength)) && Number(maxLength) >= 200
    ? Math.floor(Number(maxLength))
    : 4200;
  if (content.length <= limit) return [content];

  const chunks = [];
  let current = '';
  const paragraphs = content.split(/\n{2,}/);
  paragraphs.forEach((paragraph) => {
    const p = paragraph.trim();
    if (!p) return;
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length <= limit) {
      current = candidate;
      return;
    }
    if (current) {
      chunks.push(current);
      current = '';
    }
    if (p.length <= limit) {
      current = p;
      return;
    }
    let start = 0;
    while (start < p.length) {
      const end = Math.min(start + limit, p.length);
      chunks.push(p.slice(start, end));
      start = end;
    }
  });
  if (current) chunks.push(current);
  return chunks.filter((item) => item && item.trim().length > 0);
}

module.exports = {
  splitLineLongText
};
