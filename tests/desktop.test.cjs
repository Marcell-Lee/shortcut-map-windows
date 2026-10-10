const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('release/Alt快捷键占用地图.html', 'utf8');

function open(api) {
  const dom = new JSDOM(html, { url: 'https://desktop-test.invalid', runScripts: 'outside-only' });
  const { window: w } = dom;
  w.structuredClone = structuredClone;
  w.crypto.randomUUID = randomUUID;
  w.shortcutDesktop = api;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.eval(w.document.querySelector('script:not([type])').textContent + '\nwindow.inspectDesktop=()=>state;window.syncAgentWorkspace=syncAgentWorkspace;');
  return { dom, w, d: w.document, get: id => w.document.getElementById(id) };
}

async function run() {
  let raw = JSON.stringify({ version: 1, selectedApps: [], apps: [] });
  const receipts = [];
  const agent = open({ detectKeyboards: async () => ({ devices: [] }),
    readAgentWorkspace: async () => ({ directory: 'D:/test-agent-workspace', raw, hash: require('node:crypto').createHash('sha256').update(raw).digest('hex') }),
    reportAgentResult: async receipt => { receipts.push(receipt); return true; },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(agent.get('ai-prompt').value, /D:\/test-agent-workspace/);
  assert.match(agent.get('ai-prompt').value, /AGENTS\.md/);
  const beforeAgent = JSON.stringify(agent.w.inspectDesktop());
  raw = JSON.stringify({ version: 1, selectedApps: ['选中软件'], apps: [
    { name: '选中软件', shortcuts: [{ combo: 'Ctrl+S', action: '保存文档', scope: 'app', source: '本机活动方案' }] },
    { name: '未选软件', shortcuts: [{ combo: 'Ctrl+J', action: '不应加载', scope: 'app', source: '官方资料' }] },
  ] });
  await agent.w.eval('syncAgentWorkspace()');
  assert.equal(agent.w.inspectDesktop().records.filter(r => r.app === '选中软件').length, 1);
  assert.equal(agent.w.inspectDesktop().records.filter(r => r.app === '未选软件').length, 0);
  assert.equal(agent.w.localStorage.getItem('shortcut-map-release-v2-before-agent'), beforeAgent);
  assert.equal(receipts.at(-1).state, 'applied');
  const imported = JSON.stringify(agent.w.inspectDesktop());
  const receiptCount = receipts.length;
  await agent.w.eval('syncAgentWorkspace()');
  assert.equal(receipts.length, receiptCount, 'unchanged file should not rewrite receipt');
  assert.equal(JSON.stringify(agent.w.inspectDesktop()), imported);
  raw = '{broken';
  await agent.w.eval('syncAgentWorkspace()');
  assert.equal(receipts.at(-1).state, 'rejected');
  assert.equal(JSON.stringify(agent.w.inspectDesktop()), imported);
  raw = JSON.stringify({ version: 1, selectedApps: ['Windows'], apps: [{ name: 'Windows', shortcuts: [{ combo: 'Win+L', action: '锁定', scope: 'global', source: 'test' }] }] });
  await agent.w.eval('syncAgentWorkspace()');
  assert.equal(receipts.at(-1).state, 'rejected');
  assert.equal(JSON.stringify(agent.w.inspectDesktop()), imported);
  raw = JSON.stringify({ version: 1, selectedApps: ['新软件'], apps: [{ name: '新软件', shortcuts: [{ combo: 'Ctrl+J', action: '测试', scope: 'app', source: 'test' }] }] });
  agent.w.Storage.prototype.setItem = () => { throw Error('quota'); };
  await agent.w.eval('syncAgentWorkspace()');
  assert.equal(receipts.at(-1).state, 'rejected');
  assert.equal(JSON.stringify(agent.w.inspectDesktop()), imported, 'failed backup must not change live data');
  agent.w.close();

  const t = open({ detectKeyboards: async () => ({ devices: [{ id: 'TEST', name: 'Generic' }], suggestion: null }) });
  assert.equal(t.get('desktop-controls').hidden, false);
  t.get('layout-select').value = 'full';
  t.get('layout-select').dispatchEvent(new t.w.Event('change'));
  assert.equal(t.w.inspectDesktop().layoutId, 'full');
  assert.equal(t.d.body.classList.contains('desktop-wide'), true);
  assert.equal(t.w.inspectDesktop().model, '标准 104 键布局');
  assert.equal(t.d.querySelectorAll('.key').length, 104);
  assert.equal(t.get('map-key').options.length, 104);
  assert.equal(t.d.querySelector('.full-numpad .key[data-key-id="Numpad1"] strong').textContent, '1');
  assert.equal(t.d.querySelector('.full-numpad .key[data-key-id="NumpadAdd"]').style.gridRow, '2 / span 2');
  assert.equal(t.d.querySelector('.full-numpad .key[data-key-id="NumpadEnter"]').style.gridRow, '4 / span 2');
  assert.equal(t.d.querySelector('.full-numpad .key[data-key-id="Numpad0"]').style.gridColumn, '1 / span 2');
  assert.equal(t.d.querySelector('.full-nav .key[data-key-id="ArrowUp"]').style.gridColumn, '2 / span 1');

  t.get('add-key').click();
  t.get('r-combo').value = 'Ctrl+Numpad1';
  t.get('r-app').value = '测试软件';
  t.get('r-action').value = '数字键盘功能';
  t.get('record-form').dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
  assert.ok(t.w.inspectDesktop().records.some(r => r.combo === 'Ctrl+Numpad1'));
  t.get('layout-select').value = 'compact68';
  t.get('layout-select').dispatchEvent(new t.w.Event('change'));
  assert.equal(t.d.querySelectorAll('.key').length, 68);
  assert.equal(t.d.body.classList.contains('desktop-wide'), false);
  assert.equal(t.w.inspectDesktop().model, '68 键示例布局');
  t.get('layout-select').value = 'full';
  t.get('layout-select').dispatchEvent(new t.w.Event('change'));
  assert.ok(t.w.inspectDesktop().records.some(r => r.combo === 'Ctrl+Numpad1'));

  t.get('detect-keyboard').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(t.get('desktop-detection').textContent, /未提供可信的物理键数/);
  t.w.close();

  const selection = open({ detectKeyboards: async () => ({ devices: [], suggestion: null }) });
  selection.get('layout-select').value = 'full';
  selection.get('layout-select').dispatchEvent(new selection.w.Event('change'));
  selection.get('unassigned-toggle').click();
  selection.d.querySelector('.key[data-key-id="AltLeft"]').click();
  selection.d.querySelector('.key[data-key-id="MetaLeft"]').click();
  const range = selection.d.createRange();
  range.selectNodeContents(selection.get('unassigned-guide'));
  selection.w.getSelection().addRange(range);
  const equals = selection.d.querySelector('.key[data-key-id="="]');
  equals.dispatchEvent(new selection.w.Event('pointerdown', { bubbles: true }));
  assert.equal(selection.w.getSelection().rangeCount, 0);
  equals.click();
  assert.equal(selection.d.querySelectorAll('.key.combo-muted').length, 0);
  assert.equal(selection.get('key-popover').hidden, false);
  selection.w.close();

  const identified = open({ detectKeyboards: async () => ({
    devices: [{ id: 'TEST', name: '测试 104 键' }],
    suggestion: { layoutId: 'full', model: '测试 104 键' },
  }) });
  identified.get('detect-keyboard').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(identified.w.inspectDesktop().layoutId, 'full');
  assert.equal(identified.w.inspectDesktop().model, '测试 104 键');
  identified.w.close();
  console.log('桌面版布局切换、记录保留与键盘检测提示检查通过。');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
