'use strict';

const DEFAULT_CHUNK_SIZE = 4200;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value;
}

function splitLineLongText(text, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const chunkSize = Number.isFinite(Number(payload.chunkSize))
    ? Math.max(200, Math.min(4500, Math.floor(Number(payload.chunkSize))))
    : DEFAULT_CHUNK_SIZE;
  const source = normalizeText(text);
  if (!source) return [];
  if (source.length <= chunkSize) return [source];

  const chunks = [];
  let index = 0;
  while (index < source.length) {
    const next = source.slice(index, index + chunkSize);
    chunks.push(next);
    index += chunkSize;
  }
  return chunks;
}

module.exports = {
  DEFAULT_CHUNK_SIZE,
  splitLineLongText
};
