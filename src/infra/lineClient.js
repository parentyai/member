'use strict';

const https = require('https');
const systemFlagsRepo = require('../repos/firestore/systemFlagsRepo');

const LINE_API_HOST = 'api.line.me';

// Kill-switch cache: one Firestore read per TTL window rather than once per message.
// TTL is short (5 s) so kill-switch activation takes effect quickly.
const KILL_SWITCH_CACHE_TTL_MS = 5000;
let _killSwitchCache = null;
let _killSwitchCachedAt = 0;

async function resolveKillSwitch() {
  const now = Date.now();
  if (_killSwitchCache !== null && (now - _killSwitchCachedAt) < KILL_SWITCH_CACHE_TTL_MS) {
    return _killSwitchCache;
  }
  const value = await systemFlagsRepo.getKillSwitch();
  _killSwitchCache = value;
  _killSwitchCachedAt = now;
  return value;
}

function buildHeaders(token, extraOptions) {
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN required');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  if (extraOptions && typeof extraOptions.retryKey === 'string' && extraOptions.retryKey.trim().length > 0) {
    // LINE Messaging API idempotency key (UUID recommended).
    headers['X-Line-Retry-Key'] = extraOptions.retryKey.trim();
  }
  return headers;
}

function requestJson(path, method, token, payload, extraOptions) {
  const body = JSON.stringify(payload || {});
  const requestOptions = {
    hostname: LINE_API_HOST,
    path,
    method: method || 'POST',
    headers: Object.assign(buildHeaders(token, extraOptions), {
      'Content-Length': Buffer.byteLength(body)
    })
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          const err = new Error(`LINE API error: ${res.statusCode}`);
          err.status = res.statusCode;
          err.body = data;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function requestRaw(path, method, token, body, contentType, extraOptions) {
  const normalizedBody = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
  const headers = buildHeaders(token, extraOptions);
  headers['Content-Type'] = contentType || headers['Content-Type'];
  headers['Content-Length'] = Buffer.byteLength(normalizedBody);
  const requestOptions = {
    hostname: LINE_API_HOST,
    path,
    method: method || 'POST',
    headers
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          const err = new Error(`LINE API error: ${res.statusCode}`);
          err.status = res.statusCode;
          err.body = data;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(normalizedBody);
    req.end();
  });
}

function requestWithoutBody(path, method, token, extraOptions) {
  const requestOptions = {
    hostname: LINE_API_HOST,
    path,
    method: method || 'POST',
    headers: buildHeaders(token, extraOptions)
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          const err = new Error(`LINE API error: ${res.statusCode}`);
          err.status = res.statusCode;
          err.body = data;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseJsonSafe(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
}

async function pushMessage(lineUserId, message, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const payload = {
    to: lineUserId,
    messages: [message]
  };
  return requestJson('/v2/bot/message/push', 'POST', token, payload, options);
}

async function replyMessage(replyToken, message, options) {
  if (!replyToken) throw new Error('replyToken required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const payload = {
    replyToken,
    messages: [message]
  };
  return requestJson('/v2/bot/message/reply', 'POST', token, payload, options);
}

async function createRichMenu(richMenu, options) {
  if (!richMenu || typeof richMenu !== 'object' || Array.isArray(richMenu)) {
    throw new Error('richMenu object required');
  }
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const response = await requestJson('/v2/bot/richmenu', 'POST', token, richMenu, options);
  const parsed = parseJsonSafe(response.body) || {};
  return Object.assign({}, response, {
    richMenuId: typeof parsed.richMenuId === 'string' ? parsed.richMenuId : null,
    parsed
  });
}

async function uploadRichMenuImage(richMenuId, imageBytes, contentType, options) {
  if (!richMenuId) throw new Error('richMenuId required');
  const bytes = Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes || '');
  if (!bytes.length) throw new Error('imageBytes required');
  const mime = typeof contentType === 'string' && contentType.trim()
    ? contentType.trim()
    : 'image/png';
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedRichMenuId = encodeURIComponent(String(richMenuId));
  const path = `/v2/bot/richmenu/${encodedRichMenuId}/content`;
  return requestRaw(path, 'POST', token, bytes, mime, options);
}

async function setDefaultRichMenu(richMenuId, options) {
  if (!richMenuId) throw new Error('richMenuId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedRichMenuId = encodeURIComponent(String(richMenuId));
  const path = `/v2/bot/user/all/richmenu/${encodedRichMenuId}`;
  return requestWithoutBody(path, 'POST', token, options);
}

async function clearDefaultRichMenu(options) {
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  return requestWithoutBody('/v2/bot/user/all/richmenu', 'DELETE', token, options);
}

async function linkRichMenuToUser(lineUserId, richMenuId, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  if (!richMenuId) throw new Error('richMenuId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedUserId = encodeURIComponent(String(lineUserId));
  const encodedRichMenuId = encodeURIComponent(String(richMenuId));
  const path = `/v2/bot/user/${encodedUserId}/richmenu/${encodedRichMenuId}`;
  return requestWithoutBody(path, 'POST', token, options);
}

async function unlinkRichMenuFromUser(lineUserId, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedUserId = encodeURIComponent(String(lineUserId));
  const path = `/v2/bot/user/${encodedUserId}/richmenu`;
  return requestWithoutBody(path, 'DELETE', token, options);
}

async function getUserRichMenu(lineUserId, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedUserId = encodeURIComponent(String(lineUserId));
  const path = `/v2/bot/user/${encodedUserId}/richmenu`;
  const response = await requestWithoutBody(path, 'GET', token, options);
  const parsed = parseJsonSafe(response.body) || {};
  return Object.assign({}, response, {
    richMenuId: typeof parsed.richMenuId === 'string' ? parsed.richMenuId : null,
    parsed
  });
}

async function createRichMenuAlias(richMenuAliasId, richMenuId, options) {
  if (!richMenuAliasId) throw new Error('richMenuAliasId required');
  if (!richMenuId) throw new Error('richMenuId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  return requestJson('/v2/bot/richmenu/alias', 'POST', token, {
    richMenuAliasId: String(richMenuAliasId),
    richMenuId: String(richMenuId)
  }, options);
}

async function updateRichMenuAlias(richMenuAliasId, richMenuId, options) {
  if (!richMenuAliasId) throw new Error('richMenuAliasId required');
  if (!richMenuId) throw new Error('richMenuId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedAliasId = encodeURIComponent(String(richMenuAliasId));
  return requestJson(`/v2/bot/richmenu/alias/${encodedAliasId}`, 'POST', token, {
    richMenuId: String(richMenuId)
  }, options);
}

async function upsertRichMenuAlias(richMenuAliasId, richMenuId, options) {
  try {
    return await updateRichMenuAlias(richMenuAliasId, richMenuId, options);
  } catch (err) {
    if (!err || err.status !== 404) throw err;
    return createRichMenuAlias(richMenuAliasId, richMenuId, options);
  }
}

async function deleteRichMenuAlias(richMenuAliasId, options) {
  if (!richMenuAliasId) throw new Error('richMenuAliasId required');
  const killSwitch = await resolveKillSwitch();
  if (killSwitch) {
    throw new Error('kill switch is ON');
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const encodedAliasId = encodeURIComponent(String(richMenuAliasId));
  return requestWithoutBody(`/v2/bot/richmenu/alias/${encodedAliasId}`, 'DELETE', token, options);
}

module.exports = {
  pushMessage,
  replyMessage,
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  clearDefaultRichMenu,
  linkRichMenuToUser,
  unlinkRichMenuFromUser,
  getUserRichMenu,
  createRichMenuAlias,
  updateRichMenuAlias,
  upsertRichMenuAlias,
  deleteRichMenuAlias
};
