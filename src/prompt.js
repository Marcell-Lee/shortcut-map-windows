const aiProjectPath = location.protocol === 'file:'
  ? decodeURIComponent(new URL(BUNDLE.edition === 'release' ? './' : '../', location.href).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '')
  : '请先告诉我这个页面所在的目录';

const aiPrompt = `请帮我补充快捷键地图中的“软件快捷键”。页面自动识别到的目录：${aiProjectPath}。请自行定位该目录中的快捷键地图页面；如果目录中没有项目源码，就生成下方 JSON 供我粘贴到页面导入。不要让我手动查找项目路径。严格分两阶段，不能跳过我的选择。

第一阶段：只识别这台电脑已安装的软件名称和版本，列出候选，并问我要选择哪些软件。若你不能读取本机安装清单，就直接让我填写软件名称。此阶段不要读取任何软件的快捷键配置，不要修改项目，也不要生成快捷键清单。等待我明确回复所选软件。

第二阶段：只处理我选中的软件。优先用只读方式寻找它当前启用的自定义快捷键方案，核对活动配置；不能确认正在启用时，不要把保存过的方案说成当前配置。若无法读取自定义设置，再查该软件官方的 Windows 默认快捷键资料；无可靠来源的项目不要猜。Windows 系统内置全局快捷键以项目已有默认资料为准，不读取本机 Windows 快捷键设置，也不改动它。不要读取或输出密码、令牌、聊天内容等无关数据。

最后请先告诉我：选中的每个软件各找到多少条、哪些是当前自定义配置、哪些只是官方默认、哪些仍无法确认。然后生成符合下列格式的纯 JSON（不要 Markdown 代码块）。如果你能操作本地页面，请先让我导出备份，再把 JSON 粘入页面的“导入 AI 整理结果”，确认预览后完成导入；如果不能操作页面，就把 JSON 发给我，让我直接粘贴导入。不要直接覆盖其他软件或我的手动记录。JSON 格式如下：
{"version":1,"apps":[{"name":"软件名称","shortcuts":[{"combo":"Ctrl+S","action":"保存","scope":"app","source":"官方资料 URL 或本机配置名称","note":"适用条件或当前方案说明"}]}]}
每条快捷键必须有真实功能和可追溯来源；scope 只能是 app 或 global。不要把未分配组合、没有确认的候选或 Windows 系统默认项填入 JSON。`;

$('ai-prompt').value = aiPrompt;
$('copy-ai-prompt').onclick = async () => {
  try {
    if (!navigator.clipboard?.writeText) throw Error('clipboard unavailable');
    await navigator.clipboard.writeText(aiPrompt);
    $('copy-ai-status').textContent = '已复制';
  } catch {
    $('ai-prompt').focus();
    $('ai-prompt').select();
    $('copy-ai-status').textContent = '已选中提示词，请按 Ctrl+C 复制';
  }
};

function parseAiResult(raw) {
  if (raw.length > 2_000_000) throw Error('内容超过 2 MB。');
  const payload = JSON.parse(raw);
  if (payload?.version !== 1 || !Array.isArray(payload.apps) || !payload.apps.length || payload.apps.length > 20) {
    throw Error('需要 version: 1 和 1 至 20 个软件。');
  }
  const protectedApps = new Set(['Windows', 'Windows 设置', 'Windows 对话框', 'Windows 命令提示符', '文件资源管理器']);
  const names = new Set();
  const combinations = new Set();
  const entries = [];
  for (const app of payload.apps) {
    const name = app?.name?.trim();
    if (typeof name !== 'string' || !name || name.length > 80 || protectedApps.has(name) || names.has(name) || !Array.isArray(app.shortcuts)) {
      throw Error('软件名称重复、无效或包含受保护的 Windows 系统范围。');
    }
    names.add(name);
    if (app.shortcuts.length > 1000) throw Error(`${name} 的快捷键数量超过上限。`);
    for (const item of app.shortcuts) {
      if (typeof item?.combo !== 'string' || typeof item?.action !== 'string' || typeof item?.source !== 'string' ||
          !item.combo.trim() || !item.action.trim() || item.action.length > 160 || !item.source.trim() || item.source.length > 300 ||
          !['app', 'global'].includes(item.scope) || (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500))) {
        throw Error(`${name} 有无效条目；每条必须包含组合键、功能、范围和来源。`);
      }
      const normalized = combo(item.combo);
      const identity = JSON.stringify([name, item.scope, normalized]);
      if (combinations.has(identity)) throw Error(`${name} 的 ${normalized} 重复。`);
      combinations.add(identity);
      entries.push({ app: name, combo: normalized, action: item.action.trim(), scope: item.scope,
        note: item.note?.trim() || '', source: item.source.trim() });
    }
  }
  if (!entries.length || entries.length > 2000) throw Error('快捷键总数必须在 1 至 2000 条之间。');
  return { names: [...names], entries };
}

function mergeAiResult(parsed) {
  const next = structuredClone(state);
  let added = 0, replaced = 0, skipped = 0;
  for (const item of parsed.entries) {
    const same = next.records.filter(r => r.app === item.app && r.combo === item.combo && r.scope === item.scope && r.kind === 'keys');
    if (same.some(r => !r.id.startsWith('lib-') && !r.id.startsWith('ai-'))) { skipped++; continue; }
    if (same.some(r => r.action === item.action && r.source === item.source)) { skipped++; continue; }
    if (same.length) { next.records = next.records.filter(r => !same.includes(r)); replaced += same.length; }
    next.records.push({ id: 'ai-' + crypto.randomUUID(), combo: item.combo, app: item.app, action: item.action,
      scope: item.scope, status: '待核实', category: '', note: item.note, source: item.source, kind: 'keys', enabled: true });
    added++;
  }
  return { next: validate(next), added, replaced, skipped };
}

$('import-ai-result').onclick = () => {
  const status = $('ai-import-status');
  try {
    const parsed = parseAiResult($('ai-result').value.trim());
    const result = mergeAiResult(parsed);
    if (!result.added) { status.textContent = '没有新增记录；相同条目或手动记录已保留。'; return; }
    const summary = `${parsed.names.join('、')}：新增 ${result.added} 条，替换同组合的旧资料 ${result.replaced} 条，跳过 ${result.skipped} 条。不会改变 Windows 默认项和其他软件。建议先导出备份。确定导入吗？`;
    if (!confirm(summary)) return;
    state = result.next;
    save();
    render();
    status.textContent = `已导入 ${result.added} 条；原有手动记录已保留。`;
    $('ai-result').value = '';
  } catch (error) {
    status.textContent = '无法导入：' + error.message;
  }
};
