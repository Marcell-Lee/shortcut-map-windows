const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const rules = `# 软件快捷键更改规范（版本 1）

此目录是 Windows 快捷键地图的用户数据交换目录，不是程序源码。
先阅读本文件、shortcut.schema.json 和 example.json。只能修改 software-shortcuts.json。
禁止修改程序安装目录、app.asar、系统默认快捷键、浏览器存储和本规范。

## 必须遵循的流程
1. 只识别已安装软件的名称和版本，列出候选，等待用户明确选择。不提前读取快捷键配置。
2. 只处理用户选中的软件。只读检查当前启用的自定义快捷键方案；无法确认时查官方 Windows 默认资料，禁止猜测。
3. 不读取密码、令牌、聊天内容等无关数据，不更改目标软件设置。
4. 读取现有 software-shortcuts.json，保留未选软件的 apps 内容。将选中软件的已核实结果合并进去。
   selectedApps 必须且只能列出本次用户选择的软件名；apps 可保留其他软件，但应用仅处理 selectedApps。
   同软件、scope、combo 只能有一条。不要写未分配组合或 Windows 系统默认项。
   软件内部快捷键 scope=app；软件在后台也能触发的快捷键 scope=global，不凭按键名称推断。
5. 保存旧文件到 backups/ 下唯一命名的备份（可创建此目录）；UTF-8 写入临时文件，校验后原子替换 software-shortcuts.json。
   校验命令：node validate.cjs [临时文件路径]。没有 Node 时按 schema 检查，并说明未运行校验命令。
6. 保持快捷键地图打开。应用约两秒检查一次文件；修改后读取 import-status.json，确认 hash 对应本次文件且 state=applied。
   state=rejected 表示未导入，按 message 修复；应用关闭时先启动应用，不能声称已经加载。
   不要把 JSON 发给用户手动粘贴。最后报告各软件条数、来源、默认/自定义区别、跳过项目及实际导入状态。

## 文件格式与约束
根对象：version=1，selectedApps 为 1–20 个不重复软件名，apps 为 1–20 个软件对象。
软件对象：name 为 1–80 字符，shortcuts 为数组（每软件最多 1000 条，总共最多 2000 条）。
条目：combo（1–200 字符）、action（1–160）、scope（app/global）、source（1–300），note 可选（最多 500）。
source 必须是官方资料 URL 或本机配置文件/活动方案名称；note 写版本、适用条件和默认/自定义依据。
键名：Ctrl、Alt、Shift、Win；字母 A–Z、数字 0–9、F1–F24；Escape、Space、Tab、Enter、Backspace、Delete、Home、End、Insert、PageUp、PageDown、ArrowUp、ArrowDown、ArrowLeft、ArrowRight、PrintScreen、CapsLock、Pause、NumLock、ScrollLock、标点键；数字区用 Numpad0–Numpad9、NumpadAdd、NumpadSubtract、NumpadMultiply、NumpadDivide、NumpadDecimal、NumpadEnter。
组合用 +，修饰键顺序 Ctrl+Alt+Shift+Win；连续按键用空格 > 空格（最多八步）。加号键用 Plus，例如 Ctrl+Plus。
每一步最多一个普通键；Fn、鼠标、长按、未绑定项不在本次格式范围。
禁止的软件范围：Windows、Windows 设置、Windows 对话框、Windows 命令提示符、文件资源管理器。
应用仅合并选中软件；相同组合的资料可更新，手动记录优先保留。缺失条目不会删除，空数组不会清空已有资料。
导入前应用自动保存上一次完整记录到本地备份；读取或保存失败时不应用。此目录含个人软件资料，不应提交公开仓库。
`;

const example = { version: 1, selectedApps: ['示例软件'], apps: [{ name: '示例软件', shortcuts: [
  { combo: 'Ctrl+S', action: '保存', scope: 'app', source: '请替换为真实的官方 URL 或当前配置名称', note: '示例，仅说明格式，请勿直接导入' },
] }] };
const string = maxLength => ({ type: 'string', minLength: 1, maxLength });
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['version', 'selectedApps', 'apps'], additionalProperties: false,
  properties: {
    version: { const: 1 }, selectedApps: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: string(80) },
    apps: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', required: ['name', 'shortcuts'], additionalProperties: false,
      properties: { name: string(80), shortcuts: { type: 'array', maxItems: 1000, items: { type: 'object', additionalProperties: false,
        required: ['combo', 'action', 'scope', 'source'], properties: { combo: string(200), action: string(160), scope: { enum: ['app', 'global'] }, source: string(300), note: { type: 'string', maxLength: 500 } } } } } } },
  },
};

async function prepareWorkspace(directory) {
  await fs.mkdir(directory, { recursive: true });
  const files = { 'AGENTS.md': rules, 'shortcut.schema.json': JSON.stringify(schema, null, 2), 'example.json': JSON.stringify(example, null, 2),
    'validate.cjs': await fs.readFile(path.join(__dirname, 'validate-agent.cjs'), 'utf8'),
    'ai-format.js': await fs.readFile(path.join(__dirname, '..', 'src', 'ai-format.js'), 'utf8') };
  for (const [name, text] of Object.entries(files)) await fs.writeFile(path.join(directory, name), text, 'utf8');
  try { await fs.writeFile(path.join(directory, 'software-shortcuts.json'), JSON.stringify({ version: 1, selectedApps: [], apps: [] }, null, 2), { encoding: 'utf8', flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}

async function readWorkspace(directory) {
  const file = await fs.open(path.join(directory, 'software-shortcuts.json'), 'r');
  let raw;
  try {
    if ((await file.stat()).size > 2_000_000) throw Error('内容超过 2 MB。');
    raw = await file.readFile('utf8');
    if (Buffer.byteLength(raw) > 2_000_000) throw Error('内容超过 2 MB。');
  } finally { await file.close(); }
  return { directory, raw, hash: createHash('sha256').update(raw).digest('hex') };
}

module.exports = { prepareWorkspace, readWorkspace };
