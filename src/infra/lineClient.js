'use strict';

const https = require('https');
const systemFlagsRepo = require('../repos/firestore/systemFlagsRepo');

const LINE_API_HOST = 'api.line.me';

function buildHeaders(token) {
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN required');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function requestJson(path, method, token, payload) {
  const body = JSON.stringify(payload || {});
  const options = {
    hostname: LINE_API_HOST,
    path,
    method: method || 'POST',
    headers: Object.assign(buildHeaders(token), {
      'Content-Length': Buffer.byteLength(body)
    })
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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

async function pushMessage(lineUserId, message) {
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
  return requestJson('/v2/bot/message/push', 'POST', token, payload);
}

module.exports = {
  pushMessage
};
