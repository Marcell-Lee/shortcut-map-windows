const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepareWorkspace, readWorkspace } = require('../desktop/agent-workspace.cjs');

async function run() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shortcut-agent-test-'));
  try {
    await prepareWorkspace(directory);
    const initial = await readWorkspace(directory);
    assert.deepEqual(JSON.parse(initial.raw).selectedApps, []);
    assert.match(await fs.readFile(path.join(directory, 'AGENTS.md'), 'utf8'), /selectedApps/);
    const raw = JSON.stringify({ version: 1, selectedApps: ['测试软件'], apps: [{ name: '测试软件', shortcuts: [{ combo: 'Ctrl+S', action: '保存', scope: 'app', source: '本机当前方案' }] }] });
    await fs.writeFile(path.join(directory, 'software-shortcuts.json'), raw);
    await prepareWorkspace(directory);
    const modified = await readWorkspace(directory);
    assert.equal(modified.raw, raw, 'startup must preserve user data');
    assert.notEqual(modified.hash, initial.hash);
    const validator = path.join(directory, 'validate.cjs');
    assert.match(execFileSync(process.execPath, [validator], { encoding: 'utf8' }), /校验通过/);
    await fs.writeFile(path.join(directory, 'software-shortcuts.json'), raw.replace('Ctrl+S', 'Ctrl+UnknownKey'));
    assert.throws(() => execFileSync(process.execPath, [validator], { stdio: 'pipe' }));
    await fs.writeFile(path.join(directory, 'software-shortcuts.json'), 'x'.repeat(2_000_001));
    await assert.rejects(readWorkspace(directory), /2 MB/);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('shortcut-agent-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  }
  console.log('Agent 工作目录、独立校验、保留数据与大小限制检查通过。');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
