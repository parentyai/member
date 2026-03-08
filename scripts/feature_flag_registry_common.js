'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'feature_flag_registry.json');
const DOC_PATH = path.join(ROOT, 'docs', 'FEATURE_FLAG_GOVERNANCE.md');

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function toRepoRelative(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function listJsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && full.endsWith('.js')) out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function collectEnableFlagOccurrences() {
  const occurrences = new Map();
  const defaultHints = new Map();
  const files = listJsFiles(SRC_DIR);
  const directEnvRe = /process\.env\.(ENABLE_[A-Z0-9_]+)/g;
  const parseFlagRe = /parseFlag\(\s*'(ENABLE_[A-Z0-9_]+)'\s*,\s*(true|false)\s*\)/g;
  const resolveBoolRe = /resolveBooleanEnvFlag\(\s*'(ENABLE_[A-Z0-9_]+)'\s*,\s*(true|false)\s*\)/g;

  function pushOccurrence(name, repoPath, line) {
    if (!occurrences.has(name)) occurrences.set(name, []);
    occurrences.get(name).push(`${repoPath}:${line}`);
  }

  function pushHint(name, value) {
    if (!defaultHints.has(name)) defaultHints.set(name, value === 'true');
  }

  for (const absPath of files) {
    const repoPath = toRepoRelative(absPath);
    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      let match = directEnvRe.exec(line);
      while (match) {
        pushOccurrence(match[1], repoPath, i + 1);
        match = directEnvRe.exec(line);
      }
      directEnvRe.lastIndex = 0;

      match = parseFlagRe.exec(line);
      while (match) {
        pushOccurrence(match[1], repoPath, i + 1);
        pushHint(match[1], match[2]);
        match = parseFlagRe.exec(line);
      }
      parseFlagRe.lastIndex = 0;

      match = resolveBoolRe.exec(line);
      while (match) {
        pushOccurrence(match[1], repoPath, i + 1);
        pushHint(match[1], match[2]);
        match = resolveBoolRe.exec(line);
      }
      resolveBoolRe.lastIndex = 0;
    }
  }

  const flags = Array.from(occurrences.keys()).sort((a, b) => a.localeCompare(b));
  const refs = new Map();
  flags.forEach((flag) => {
    const rows = Array.from(new Set(occurrences.get(flag) || [])).sort((a, b) => a.localeCompare(b));
    refs.set(flag, rows.slice(0, 5));
  });

  return {
    flags,
    refs,
    defaultHints
  };
}

function inferOwner(name) {
  if (name.startsWith('ENABLE_TASK_')) return 'task-platform';
  if (name.startsWith('ENABLE_JOURNEY_')) return 'journey-platform';
  if (name.startsWith('ENABLE_CITY_PACK_')) return 'city-pack';
  if (name.startsWith('ENABLE_ADMIN_')) return 'admin-ops';
  if (name.startsWith('ENABLE_OPS_')) return 'ops-platform';
  if (name.startsWith('ENABLE_UXOS_')) return 'ux-os';
  if (name.startsWith('ENABLE_VENDOR_')) return 'vendor-ranking';
  if (name.startsWith('ENABLE_LINK_REGISTRY_')) return 'link-registry';
  if (name.startsWith('ENABLE_NOTIFICATION_') || name.startsWith('ENABLE_LINE_')) return 'notification-platform';
  if (name.startsWith('ENABLE_BILLING_') || name === 'ENABLE_STRIPE_WEBHOOK') return 'billing';
  if (name.startsWith('ENABLE_EMERGENCY')) return 'emergency-layer';
  if (name.startsWith('ENABLE_PAID_') || name === 'ENABLE_CONVERSATION_ROUTER') return 'assistant-paid';
  if (name.startsWith('ENABLE_CONTEXT_') || name.startsWith('ENABLE_SNAPSHOT_')) return 'context-platform';
  return 'platform-core';
}

function inferBlastRadius(name) {
  if (name.startsWith('ENABLE_ADMIN_') || name.startsWith('ENABLE_OPS_')) return 'ops_facing';
  if (name.startsWith('ENABLE_JOURNEY_')
    || name.startsWith('ENABLE_TASK_')
    || name.startsWith('ENABLE_CITY_PACK_')
    || name.startsWith('ENABLE_NOTIFICATION_')
    || name.startsWith('ENABLE_LINE_')
    || name.startsWith('ENABLE_UXOS_')
    || name.startsWith('ENABLE_PAID_')) return 'user_facing';
  return 'cross_module';
}

module.exports = {
  ROOT,
  SRC_DIR,
  REGISTRY_PATH,
  DOC_PATH,
  collectEnableFlagOccurrences,
  inferOwner,
  inferBlastRadius
};
