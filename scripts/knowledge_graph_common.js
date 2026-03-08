'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const KG_DIR = path.join(ROOT, 'docs', 'knowledge-graph');
const AUDIT_INPUT_DIR = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS');

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(text), 'utf8');
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(readText(filePath));
  } catch (_err) {
    if (fallbackValue !== undefined) return fallbackValue;
    throw _err;
  }
}

function writeJson(filePath, payload) {
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function listFilesRecursive(baseDir, predicate) {
  const out = [];
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (typeof predicate === 'function' && !predicate(fullPath)) continue;
      out.push(fullPath);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function runCommand(command, args, options) {
  const result = childProcess.spawnSync(command, Array.isArray(args) ? args : [], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
    ...(options || {})
  });
  return {
    command: [command].concat(args || []).join(' '),
    status: Number(result.status || 0),
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : ''
  };
}

function getGitValue(args, fallback) {
  const result = runCommand('git', args);
  if (result.status === 0 && result.stdout) return result.stdout;
  return fallback;
}

function getGitMeta() {
  return {
    commit: getGitValue(['rev-parse', 'HEAD'], 'NOT_AVAILABLE'),
    branch: getGitValue(['branch', '--show-current'], 'NOT_AVAILABLE')
  };
}

function findLineNumber(filePath, token) {
  try {
    const text = readText(filePath);
    const idx = text.indexOf(String(token || ''));
    if (idx === -1) return 1;
    return text.slice(0, idx).split('\n').length;
  } catch (_err) {
    return 1;
  }
}

const PATH_CANDIDATE_RE = /(?:src|docs|apps|scripts|tools|\.github)\/[A-Za-z0-9_./-]+\.(?:js|md|html|json|yml|yaml|sh)/g;

function toPathLine(reference) {
  const text = String(reference || '').trim();
  if (!text) return null;
  if (/^runtime:/.test(text)) return text;
  if (/:[0-9]+(?:$|[^0-9])/.test(text)) return text;

  const matched = text.match(PATH_CANDIDATE_RE);
  if (matched && matched.length > 0) {
    return `${toPosix(matched[0])}:1`;
  }
  return null;
}

function normalizeEvidence(value, fallbackPathLine) {
  const list = Array.isArray(value) ? value : [value];
  const out = [];

  for (const raw of list) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const chunks = /^runtime:/.test(text)
      ? [text]
      : text.split(',').map((part) => part.trim()).filter(Boolean);

    for (const chunk of chunks) {
      const direct = toPathLine(chunk);
      if (direct) {
        out.push(direct);
        continue;
      }

      const candidates = chunk.match(PATH_CANDIDATE_RE) || [];
      for (const candidate of candidates) {
        out.push(`${toPosix(candidate)}:1`);
      }
    }
  }

  if (out.length > 0) {
    return Array.from(new Set(out));
  }
  if (fallbackPathLine) return [String(fallbackPathLine)];
  return ['scripts/build_project_knowledge_graph.js:1'];
}

function toTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((value) => String(value || '').replace(/\n/g, '<br>')).join(' | ')} |`);
  return [head, sep].concat(body).join('\n');
}

function toEntityName(collection) {
  return String(collection || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

module.exports = {
  ROOT,
  KG_DIR,
  AUDIT_INPUT_DIR,
  toPosix,
  ensureDir,
  readText,
  writeText,
  readJson,
  writeJson,
  listFilesRecursive,
  runCommand,
  getGitMeta,
  findLineNumber,
  normalizeEvidence,
  toTable,
  toEntityName
};
