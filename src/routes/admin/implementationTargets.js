'use strict';

const { listImplementationTargets } = require('../../domain/implementationTargets');

async function handleImplementationTargets(req, res) {
  try {
    const items = listImplementationTargets();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(items));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

module.exports = {
  handleImplementationTargets
};
