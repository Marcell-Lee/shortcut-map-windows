const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('dist/Alt快捷键占用地图.html', 'utf8');
const STORE = JSON.parse(new JSDOM(html).window.document.getElementById('library-data').textContent).storageKey;
const passed = [];
function check(name, run) { run(); passed.push(name); }
function load(saved) {
  const dom = new JSDOM(html, { url: 'https://offline-test.invalid', runScripts: 'outside-only' });
  const w = dom.window;
  const d = w.document;
  w.structuredClone = structuredClone;
  w.crypto.randomUUID = randomUUID;
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  if (saved) w.localStorage.setItem(STORE, saved);
  const script = d.querySelector('script:not([type])').textContent;
  new Function(script);
  w.eval(script + '\nwindow.inspect=()=>({state,view,unassigned,availableCache,visibleCache});window.createAgentPrompt=createAgentPrompt;');
  return { dom, w, d, get: id => d.getElementById(id) };
}
function submit(t) { t.get('record-form').dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true })); }
function create(t, combo, app, action) {
  t.get('add-key').click();
  t.get('r-combo').value = combo;
  t.get('r-app').value = app;
  t.get('r-action').value = action;
  submit(t);
}
function aiPayload(name, shortcuts) { return JSON.stringify({ version: 1, apps: [{ name, shortcuts }] }); }
function aiItem(combo, action, source = 'https://example.com/shortcuts') { return { combo, action, scope: 'app', source }; }

const t = load();
check('Keyboard is the primary view and the redundant list is absent', () => {
  assert.equal(t.d.querySelectorAll('.key').length, 68);
  assert.equal(t.get('list'), null);
  assert.equal(t.d.querySelector('#list-title'), null);
  assert.ok(t.d.querySelector('.ai-helper'));
  assert.equal(t.d.querySelector('main').lastElementChild.tagName, 'FOOTER');
  assert.ok(t.d.querySelector('footer').contains(t.get('export')));
});
check('Windows defaults load without any local configuration scan', () => {
  assert.ok(t.w.inspect().state.records.some(r => r.app === 'Windows' && r.scope === 'global'));
  assert.ok(t.w.eval("createAgentPrompt('D:/test-agent-workspace')").includes('不读取本机 Windows 快捷键设置'));
  assert.doesNotMatch(html, /showOpenFilePicker|showDirectoryPicker|ActiveXObject/);
});
check('Scope selector keeps software and global records separate', () => {
  t.d.querySelector('[data-view="global"]').click();
  assert.ok(t.w.inspect().visibleCache.every(r => r.scope === 'global'));
  t.d.querySelector('[data-view="app:Chrome"]').click();
  assert.ok(t.w.inspect().visibleCache.every(r => r.app === 'Chrome'));
  t.d.querySelector('[data-view="all"]').click();
});
check('Clicking a key opens a two-column table whose function can be edited', () => {
  t.d.querySelector('.key[data-key-id="L"]').click();
  const card = t.get('key-popover');
  assert.equal(card.hidden, false);
  assert.deepEqual([...card.querySelectorAll('th')].map(x => x.textContent), ['快捷键', '功能']);
  const edit = card.querySelector('tbody button');
  assert.ok(edit);
  edit.click();
  assert.equal(t.get('editor').open, true);
  assert.equal(t.get('editor-title').textContent, '编辑快捷键');
  t.get('cancel').click();
});
check('Keyboard popup can add, edit and delete a personal shortcut', () => {
  create(t, 'Ctrl+J', '自定义测试', '旧功能');
  assert.ok(t.w.inspect().state.records.some(r => r.app === '自定义测试' && r.combo === 'Ctrl+J'));
  t.d.querySelector('[data-view="app:自定义测试"]').click();
  t.d.querySelector('.key[data-key-id="J"]').click();
  t.get('key-popover').querySelector('tbody button').click();
  t.get('r-action').value = '新功能';
  submit(t);
  assert.ok(t.w.inspect().state.records.some(r => r.app === '自定义测试' && r.action === '新功能'));
  t.get('key-popover').querySelector('tbody button').click();
  t.get('delete').click();
  assert.ok(!t.w.inspect().state.records.some(r => r.app === '自定义测试'));
  t.d.querySelector('[data-view="all"]').click();
});
check('Unassigned combinations can be inspected and added directly from the keyboard', () => {
  t.get('unassigned-toggle').click();
  assert.ok(t.w.inspect().availableCache.length > 100);
  t.d.querySelector('.key[data-key-id="ControlLeft"]').click();
  t.d.querySelector('.key[data-key-id="ShiftLeft"]').click();
  assert.ok(t.d.querySelectorAll('.key.combo-available').length > 0);
  t.d.querySelector('.key.combo-available').click();
  const first = t.get('key-popover').querySelector('tbody button');
  assert.equal(first.textContent, '未分配');
  first.click();
  assert.match(t.get('r-combo').value, /^Ctrl\+Shift\+./);
  t.get('cancel').click();
  t.get('unassigned-toggle').click();
});
check('Unassigned view explains controls and marks occupied combinations', () => {
  const r = load();
  r.d.querySelector('[data-view="app:Chrome"]').click();
  r.get('unassigned-toggle').click();
  assert.equal(r.get('unassigned-guide').hidden, false);
  r.d.querySelector('.key[data-key-id="ControlLeft"]').click();
  const occupiedKey = r.d.querySelector('.key[data-key-id="L"]');
  assert.ok(occupiedKey.classList.contains('combo-assigned'));
  assert.match(occupiedKey.title, /Ctrl\+L：Chrome · 跳转到地址栏/);
  occupiedKey.click();
  assert.match(r.get('key-popover').querySelector('tbody button').textContent, /跳转到地址栏.*Chrome/s);
  assert.equal(r.get('key-popover').querySelector('tbody kbd').textContent, 'Ctrl+L');
  r.get('key-popover').querySelector('tbody button').click();
  assert.equal(r.get('editor-title').textContent, '编辑快捷键');
  r.get('cancel').click();
  r.d.querySelector('[data-view="all"]').click();
  r.d.querySelector('.key[data-key-id="ControlLeft"]').click();
  r.d.querySelector('.key[data-key-id="L"]').click();
  const assignments = [...r.get('key-popover').querySelectorAll('tbody button')].map(button => button.textContent);
  assert.ok(assignments.some(text => text.includes('Chrome')));
  assert.ok(assignments.some(text => text.includes('Edge')));
  assert.ok(assignments.some(text => text.includes('Firefox')));
  r.get('unassigned-toggle').click();
  assert.equal(r.get('unassigned-guide').hidden, true);
  r.get('unassigned-toggle').click();
  r.d.dispatchEvent(new r.w.KeyboardEvent('keydown', { key: 'Control', bubbles: true }));
  assert.ok(r.d.querySelector('.key[data-key-id="L"]').classList.contains('combo-assigned'));
  r.d.dispatchEvent(new r.w.KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
  r.w.close();
});
check('Prompt requires software selection before reading shortcuts', () => {
  const prompt = t.w.eval("createAgentPrompt('D:/test-agent-workspace')");
  assert.match(prompt, /第一阶段.*只识别/s);
  assert.match(prompt, /等待我明确回复所选软件/);
  assert.match(prompt, /第二阶段.*只处理我选中的软件/s);
  assert.match(prompt, /自定义快捷键方案/);
  assert.match(prompt, /官方.*默认快捷键资料/);
  assert.match(prompt, /AGENTS\.md/);
  assert.match(prompt, /software-shortcuts\.json/);
  assert.match(prompt, /D:\/test-agent-workspace/);
  assert.match(prompt, /selectedApps/);
  assert.match(prompt, /无需我手动导入 JSON/);
});
check('Prompt copy has a working manual fallback', () => {
  t.get('copy-ai-prompt').click();
  assert.match(t.get('copy-ai-status').textContent, /Ctrl\+C/);
});
check('AI import rejects Windows system scope and malformed items', () => {
  const before = t.w.inspect().state.records.length;
  t.get('ai-result').value = aiPayload('Windows', [aiItem('Ctrl+J', '错误导入')]);
  t.get('import-ai-result').click();
  assert.match(t.get('ai-import-status').textContent, /无法导入/);
  t.get('ai-result').value = aiPayload('新软件', [{ combo: 'Ctrl+J', action: '无来源', scope: 'app', source: '' }]);
  t.get('import-ai-result').click();
  assert.match(t.get('ai-import-status').textContent, /无法导入/);
  assert.equal(t.w.inspect().state.records.length, before);
});
check('AI import updates only the chosen software and preserves manual records', () => {
  create(t, 'Ctrl+J', '新软件', '我的手动功能');
  const originalWindows = t.w.inspect().state.records.filter(r => r.app === 'Windows').length;
  t.get('ai-result').value = aiPayload('新软件', [aiItem('Ctrl+J', 'AI 想覆盖'), aiItem('Ctrl+K', 'AI 新功能')]);
  t.get('import-ai-result').click();
  const records = t.w.inspect().state.records;
  assert.ok(records.some(r => r.app === '新软件' && r.combo === 'Ctrl+J' && r.action === '我的手动功能'));
  assert.ok(!records.some(r => r.app === '新软件' && r.action === 'AI 想覆盖'));
  assert.ok(records.some(r => r.app === '新软件' && r.combo === 'Ctrl+K' && r.action === 'AI 新功能'));
  assert.equal(records.filter(r => r.app === 'Windows').length, originalWindows);
  assert.match(t.get('ai-import-status').textContent, /已导入 1 条/);
});
check('AI import can replace a selected software default without touching another app', () => {
  const r = load();
  const beforeWindows = r.w.inspect().state.records.filter(x => x.app === 'Windows').length;
  const beforeChrome = r.w.inspect().state.records.filter(x => x.app === 'Chrome').length;
  r.get('ai-result').value = aiPayload('剪映', [aiItem('Ctrl+R', '自定义剪映功能', '本机当前启用方案')]);
  r.get('import-ai-result').click();
  const records = r.w.inspect().state.records;
  assert.ok(records.some(x => x.app === '剪映' && x.combo === 'Ctrl+R' && x.action === '自定义剪映功能'));
  assert.equal(records.filter(x => x.app === 'Windows').length, beforeWindows);
  assert.equal(records.filter(x => x.app === 'Chrome').length, beforeChrome);
  r.w.close();
});
check('AI import rejects markup execution and keeps text inert', () => {
  t.get('ai-result').value = aiPayload('新软件', [aiItem('Ctrl+M', '<img src=x onerror=alert(1)>')]);
  t.get('import-ai-result').click();
  t.d.querySelector('[data-view="app:新软件"]').click();
  t.d.querySelector('.key[data-key-id="M"]').click();
  assert.equal(t.get('key-popover').querySelectorAll('img').length, 0);
});
check('Imported AI records survive reload through the existing local backup state', () => {
  const reopened = load(t.w.localStorage.getItem(STORE));
  assert.ok(reopened.w.inspect().state.records.some(r => r.app === '新软件' && r.combo === 'Ctrl+K'));
  reopened.w.close();
});

fs.writeFileSync('tests/verification.json', JSON.stringify({ passed: passed.length, records: t.w.inspect().state.records.length, checks: passed }, null, 2));
console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
t.w.close();
