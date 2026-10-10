const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('src/page.html');
const layout = JSON.parse(read('data/layout.json'));
const fullLayout = JSON.parse(read('data/layout-full.json'));
const library = JSON.parse(read('data/shortcuts.json'));
const release = process.argv.includes('--release') || !fs.existsSync(path.join(root, 'local/profile.json'));
if (process.argv.some(arg => arg.startsWith('--') && arg !== '--release')) throw new Error('未知构建参数');
let records = library.records;
let legacyRecordIds = {};
let storageKey = 'shortcut-map-release-v2';
let legacyStorageKey = null;
if (!release) {
  const profile = JSON.parse(read('local/profile.json'));
  if (profile.version !== 1 || !Array.isArray(profile.records)) throw new Error('本地配置无效');
  layout.seed = { version: 1, model: profile.model, mappings: profile.mappings, records: profile.legacyRecords };
  records = [...records, ...profile.records];
  legacyRecordIds = profile.legacyRecordIds || {};
  storageKey = profile.storageKey || 'shortcut-map-local-v2';
  legacyStorageKey = profile.legacyStorageKey || null;
}
const data = JSON.stringify({ layout, layouts: { compact68: layout, full: fullLayout }, records, sources: library.sources, legacyRecordIds, storageKey, legacyStorageKey, edition: release ? 'release' : 'local' })
  .replace(/</g, '\\u003c');
const replacements = {
  __INLINE_STYLES__: read('src/styles.css'),
  __INLINE_DATA__: data,
  __INLINE_APP__: read('src/app.js') + '\n' + read('src/ai-format.js') + '\n' + read('src/prompt.js'),
};
let html = template;
for (const [marker, content] of Object.entries(replacements)) {
  if (html.split(marker).length !== 2) throw new Error(`模板中的 ${marker} 必须恰好出现一次`);
  html = html.replace(marker, () => content);
}
const dist = path.join(root, process.argv.includes('--release') ? 'release' : 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'Alt快捷键占用地图.html'), html);
console.log(`已生成${release ? '分发' : '本地'}页面：${records.length} 条快捷键`);
