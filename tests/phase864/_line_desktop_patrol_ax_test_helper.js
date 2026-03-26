'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const phase863 = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

function runPythonCode(code) {
  return execFileSync('python3', ['-c', code], {
    cwd: phase863.ROOT,
    env: Object.assign({}, process.env, {
      PYTHONPATH: path.join(phase863.ROOT, 'tools', 'line_desktop_patrol', 'src')
    }),
    encoding: 'utf8'
  });
}

module.exports = Object.assign({}, phase863, {
  runPythonCode
});
