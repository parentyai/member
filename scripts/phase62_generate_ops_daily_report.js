#!/usr/bin/env node
'use strict';

const { generateOpsDailyReport } = require('../src/usecases/phase62/generateOpsDailyReport');

function parseArgs(argv) {
  const args = argv.slice(2);
  let date = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--date' && args[i + 1]) {
      date = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--date=')) {
      date = arg.slice('--date='.length);
      continue;
    }
    if (!arg.startsWith('-') && !date) {
      date = arg;
    }
  }
  return { date };
}

(async () => {
  try {
    const { date } = parseArgs(process.argv);
    const result = await generateOpsDailyReport({ date });
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(err && err.message ? err.message : 'error');
    process.exit(1);
  }
})();
