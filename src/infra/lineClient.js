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

module.exports = {
  pushMessage,
  replyMessage,
  linkRichMenuToUser,
  unlinkRichMenuFromUser
};
