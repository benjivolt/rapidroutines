const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = path.join(__dirname, '..', 'test');
const files = fs
  .readdirSync(testDir)
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => path.join(testDir, file));

const failed = files.filter((file) => {
  console.log(`\n# ${path.relative(process.cwd(), file)}`);
  return spawnSync(process.execPath, ['--test', file], { stdio: 'inherit' }).status !== 0;
});

console.log(`\n# ${files.length - failed.length}/${files.length} test files passed`);
process.exit(failed.length ? 1 : 0);
