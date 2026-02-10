'use strict';

const https = require('https');
const systemFlagsRepo = require('../repos/firestore/systemFlagsRepo');

const LINE_API_HOST = 'api.line.me';

function buildHeaders(token, options) {
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN required');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  if (options && typeof options.retryKey === 'string' && options.retryKey.trim().length > 0) {
    // LINE Messaging API idempotency key (UUID recommended).
    headers['X-Line-Retry-Key'] = options.retryKey.trim();
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

async function pushMessage(lineUserId, message, options) {
  if (!lineUserId) throw new Error('lineUserId required');
  const killSwitch = await systemFlagsRepo.getKillSwitch();
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
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const payload = {
    replyToken,
    messages: [message]
  };
  // Replies are interactive (user-initiated). We intentionally do not gate them behind Kill Switch.
  return requestJson('/v2/bot/message/reply', 'POST', token, payload, options);
}

module.exports = {
  pushMessage,
  replyMessage
};
