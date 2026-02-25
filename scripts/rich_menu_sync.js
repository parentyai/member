'use strict';

const fs = require('fs');
const path = require('path');

const {
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  clearDefaultRichMenu,
  linkRichMenuToUser,
  unlinkRichMenuFromUser,
  getUserRichMenu,
  upsertRichMenuAlias,
  deleteRichMenuAlias
} = require('../src/infra/lineClient');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const command = typeof args[0] === 'string' ? args[0].trim() : '';
  const out = { command, flags: {} };
  for (let i = 1; i < args.length; i += 1) {
    const token = String(args[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2).trim();
    if (!key) continue;
    const next = args[i + 1];
    if (next !== undefined && !String(next).startsWith('--')) {
      out.flags[key] = String(next);
      i += 1;
    } else {
      out.flags[key] = 'true';
    }
  }
  return out;
}

function resolveRequiredFlag(flags, name) {
  const value = flags && typeof flags[name] === 'string' ? flags[name].trim() : '';
  if (!value) throw new Error(`--${name} required`);
  return value;
}

function readJsonFile(filePath) {
  const full = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function readFileBytes(filePath) {
  const full = path.resolve(process.cwd(), filePath);
  return fs.readFileSync(full);
}

function inferContentType(filePath, explicit) {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/png';
}

function asBoolean(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
}

function printUsage() {
  console.log([
    'Usage: node scripts/rich_menu_sync.js <command> [flags]',
    '',
    'Commands:',
    '  create --json <path>',
    '  upload-image --rich-menu-id <id> --image <path> [--content-type <mime>]',
    '  set-default --rich-menu-id <id>',
    '  clear-default',
    '  link-user --line-user-id <lineUserId> --rich-menu-id <id>',
    '  unlink-user --line-user-id <lineUserId>',
    '  get-user --line-user-id <lineUserId>',
    '  alias-upsert --alias-id <aliasId> --rich-menu-id <id>',
    '  alias-delete --alias-id <aliasId>',
    '',
    'Options:',
    '  --dry-run true   Callを実行せずパラメータのみ出力する'
  ].join('\n'));
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.command;
  const flags = parsed.flags;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  const dryRun = asBoolean(flags['dry-run']);
  const output = {
    ok: true,
    command,
    dryRun,
    serverTime: new Date().toISOString()
  };

  if (command === 'create') {
    const jsonPath = resolveRequiredFlag(flags, 'json');
    const payload = readJsonFile(jsonPath);
    output.payload = payload;
    if (!dryRun) output.result = await createRichMenu(payload);
  } else if (command === 'upload-image') {
    const richMenuId = resolveRequiredFlag(flags, 'rich-menu-id');
    const imagePath = resolveRequiredFlag(flags, 'image');
    const contentType = inferContentType(imagePath, flags['content-type']);
    output.richMenuId = richMenuId;
    output.imagePath = imagePath;
    output.contentType = contentType;
    if (!dryRun) {
      const bytes = readFileBytes(imagePath);
      output.result = await uploadRichMenuImage(richMenuId, bytes, contentType);
    }
  } else if (command === 'set-default') {
    const richMenuId = resolveRequiredFlag(flags, 'rich-menu-id');
    output.richMenuId = richMenuId;
    if (!dryRun) output.result = await setDefaultRichMenu(richMenuId);
  } else if (command === 'clear-default') {
    if (!dryRun) output.result = await clearDefaultRichMenu();
  } else if (command === 'link-user') {
    const lineUserId = resolveRequiredFlag(flags, 'line-user-id');
    const richMenuId = resolveRequiredFlag(flags, 'rich-menu-id');
    output.lineUserId = lineUserId;
    output.richMenuId = richMenuId;
    if (!dryRun) output.result = await linkRichMenuToUser(lineUserId, richMenuId);
  } else if (command === 'unlink-user') {
    const lineUserId = resolveRequiredFlag(flags, 'line-user-id');
    output.lineUserId = lineUserId;
    if (!dryRun) output.result = await unlinkRichMenuFromUser(lineUserId);
  } else if (command === 'get-user') {
    const lineUserId = resolveRequiredFlag(flags, 'line-user-id');
    output.lineUserId = lineUserId;
    if (!dryRun) output.result = await getUserRichMenu(lineUserId);
  } else if (command === 'alias-upsert') {
    const aliasId = resolveRequiredFlag(flags, 'alias-id');
    const richMenuId = resolveRequiredFlag(flags, 'rich-menu-id');
    output.aliasId = aliasId;
    output.richMenuId = richMenuId;
    if (!dryRun) output.result = await upsertRichMenuAlias(aliasId, richMenuId);
  } else if (command === 'alias-delete') {
    const aliasId = resolveRequiredFlag(flags, 'alias-id');
    output.aliasId = aliasId;
    if (!dryRun) output.result = await deleteRichMenuAlias(aliasId);
  } else {
    throw new Error(`unsupported command: ${command}`);
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  const message = err && err.message ? String(err.message) : 'unknown_error';
  console.error(JSON.stringify({
    ok: false,
    error: message,
    serverTime: new Date().toISOString()
  }, null, 2));
  process.exit(1);
});

