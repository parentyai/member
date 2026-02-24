'use strict';

const { parseSeedSetupArgs, runSeedSetup } = require('./seed/lib');

async function main(argv, env) {
  const opts = parseSeedSetupArgs(argv || process.argv, env || process.env);
  const result = await runSeedSetup(opts);
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
