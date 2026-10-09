const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('release/Alt快捷键占用地图.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://release-test.invalid', runScripts: 'outside-only' });
const { window: w } = dom;
const data = JSON.parse(w.document.getElementById('library-data').textContent);
assert.equal(data.edition, 'release');
assert.equal(data.layout.seed.model, '68 键示例布局');
assert.equal(data.layout.rows.flat().length, 68);
assert.ok(data.records.length >= 700);
assert.ok(data.records.every(record => record.status === '官方默认'));
const profilePath = 'local/profile.json';
const privateMarkers = fs.existsSync(profilePath) ? JSON.parse(fs.readFileSync(profilePath, 'utf8')).privateMarkers : [];
for (const marker of privateMarkers) {
  assert.ok(!html.includes(marker), `分发页面出现本机信息：${marker}`);
}
assert.doesNotMatch(html, /[A-Z]:\\Users\\[^\\\s"']+/i);
const script = w.document.querySelector('script:not([type])').textContent;
w.structuredClone = structuredClone;
w.crypto.randomUUID = require('node:crypto').randomUUID;
w.eval(script + '\nwindow.inspectRelease=()=>({state,STORE,LEGACY});');
const state = w.inspectRelease();
assert.equal(state.STORE, 'shortcut-map-release-v2');
assert.equal(state.LEGACY, null);
assert.equal(state.state.records.length, data.records.length);
assert.ok(w.document.querySelector('[data-view="app:Chrome"]'));
console.log(`分发版检查通过：${data.records.length} 条通用资料，68 键示例布局，本机资料未打包。`);
w.close();
