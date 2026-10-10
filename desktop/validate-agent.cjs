// Standalone: copied alongside ai-format.js into the user's Agent workspace.
const fs = require('node:fs');
const path = require('node:path');
const { parseAiResult } = require('./ai-format.js');
try {
  const file = process.argv[2] || path.join(__dirname, 'software-shortcuts.json');
  if (fs.statSync(file).size > 2_000_000) throw Error('内容超过 2 MB。');
  const parsed = parseAiResult(fs.readFileSync(file, 'utf8'), undefined, true);
  console.log(`校验通过：${parsed.names.join('、')}，${parsed.entries.length} 条。`);
} catch (error) {
  console.error('校验失败：' + error.message);
  process.exitCode = 1;
}
