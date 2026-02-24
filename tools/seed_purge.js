'use strict';

const { parseSeedPurgeArgs, runSeedPurge } = require('./seed/lib');

async function main(argv, env) {
  const opts = parseSeedPurgeArgs(argv || process.argv, env || process.env);
  const result = await runSeedPurge(opts);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  main
};
