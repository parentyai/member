'use strict';

const path = require('path');

const LEGACY_DOCS_DIR = 'docs';
const ARCHIVE_PHASE_DIR = path.posix.join('docs', 'archive', 'phases');
const PHASE_DOC_FILE_RE = /^PHASE[A-Z0-9_-]*\.md$/;

function normalizeDocPath(input) {
  return String(input || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

function isPhaseDocFileName(fileName) {
  return PHASE_DOC_FILE_RE.test(String(fileName || ''));
}

function isLegacyPhaseDocPath(docPath) {
  const normalized = normalizeDocPath(docPath);
  return normalized.startsWith(`${LEGACY_DOCS_DIR}/`) && isPhaseDocFileName(path.posix.basename(normalized));
}

function isArchivePhaseDocPath(docPath) {
  const normalized = normalizeDocPath(docPath);
  return normalized.startsWith(`${ARCHIVE_PHASE_DIR}/`) && isPhaseDocFileName(path.posix.basename(normalized));
}

function toArchivePhaseDocPath(legacyPath) {
  const normalized = normalizeDocPath(legacyPath);
  if (!isLegacyPhaseDocPath(normalized)) {
    throw new Error(`legacy phase doc path is invalid: ${legacyPath}`);
  }
  return path.posix.join(ARCHIVE_PHASE_DIR, path.posix.basename(normalized));
}

function toLegacyPhaseDocPath(archivePath) {
  const normalized = normalizeDocPath(archivePath);
  if (!isArchivePhaseDocPath(normalized)) {
    throw new Error(`archive phase doc path is invalid: ${archivePath}`);
  }
  return path.posix.join(LEGACY_DOCS_DIR, path.posix.basename(normalized));
}

module.exports = {
  LEGACY_DOCS_DIR,
  ARCHIVE_PHASE_DIR,
  PHASE_DOC_FILE_RE,
  normalizeDocPath,
  isPhaseDocFileName,
  isLegacyPhaseDocPath,
  isArchivePhaseDocPath,
  toArchivePhaseDocPath,
  toLegacyPhaseDocPath
};
