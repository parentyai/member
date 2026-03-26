'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const phase862 = require('../phase862/_line_desktop_patrol_loop_test_helper');

function runPythonCode(code) {
  return execFileSync('python3', ['-c', code], {
    cwd: phase862.ROOT,
    env: Object.assign({}, process.env, {
      PYTHONPATH: path.join(phase862.ROOT, 'tools', 'line_desktop_patrol', 'src')
    }),
    encoding: 'utf8'
  });
}

module.exports = Object.assign({}, phase862, {
  runPythonCode
});
