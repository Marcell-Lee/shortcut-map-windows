function createAgentPrompt(directory) {
  if (!directory) return '请在 Windows 桌面版中展开“用 AI 补充软件快捷键”，复制包含本机 AI 工作目录的提示词。网页备用导入不支持 Agent 自动写入。';
  return `请直接为 Windows 快捷键地图补充软件快捷键。你需要本机文件读写能力。专用工作目录（绝对路径）：
${directory}

先完整阅读该目录的 AGENTS.md、shortcut.schema.json、example.json 和现有 software-shortcuts.json。以目录中的更改规范为准，不自行猜测数据结构、文件路径或修改方式。只允许更新 software-shortcuts.json 及创建本次备份、临时文件；不要修改程序源码、安装包或 Windows 系统设置。若不能访问该目录，说明需要在有本机文件权限的编程 Agent 中运行，不要声称已完成，也不要转为让我手动粘贴 JSON。

第一阶段：只识别这台电脑已安装的软件名称和版本，列出候选，询问我选择哪些。若无法读取安装清单，让我填写软件名称。此时不要读取快捷键配置，不修改文件。等待我明确回复所选软件。

第二阶段：只处理我选中的软件。优先只读核对当前启用的自定义快捷键方案；不能确认时查软件官方 Windows 默认快捷键资料，无可靠来源不猜。不读取本机 Windows 快捷键设置，不改已有系统默认资料，不读取无关的密码、令牌或聊天数据。

按 AGENTS.md 的明确字段规范直接更新 software-shortcuts.json：version=1；selectedApps 只写本次已获我选择的软件名；apps 保留未选软件，合并选中软件的结果。每条包含 combo、action、scope（app/global）、source，可附 note 说明版本、条件和默认/自定义依据。组合如 Ctrl+S；连续按键如 Ctrl+K > Ctrl+C；同软件、scope、combo 不重复。禁止填写未分配组合。先备份旧文件，写临时文件，运行目录中的 node validate.cjs 临时文件路径 校验，通过后原子替换目标文件。

应用保持打开即可自动校验、备份并加载，无需我手动导入 JSON。写入后检查 import-status.json：只有 state=applied 且 hash 与本次目标文件的 SHA-256 一致，才报告已加载。应用关闭时先启动应用；若 state=rejected，阅读 message 修复并重试。保留用户手动记录，不删除其他软件。最后报告每个软件的条数、来源、自定义/默认区别、跳过项目及实际导入状态。`;
}

let aiPrompt = createAgentPrompt(null);
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

let agentBusy = false;
let reportedAgentHash = null;
async function syncAgentWorkspace() {
  if (!window.shortcutDesktop?.readAgentWorkspace || agentBusy) return;
  agentBusy = true;
  let snapshot;
  try {
    snapshot = await window.shortcutDesktop.readAgentWorkspace();
    aiPrompt = createAgentPrompt(snapshot.directory);
    if ($('ai-prompt').value !== aiPrompt) $('ai-prompt').value = aiPrompt;
    $('copy-ai-prompt').disabled = false;
    if (snapshot.error) throw Error(snapshot.error);
    const previous = state.agentReceipt;
    if (previous?.hash === snapshot.hash) {
      $('ai-workspace-status').textContent = previous.message;
      if (reportedAgentHash !== snapshot.hash) {
        if (await window.shortcutDesktop.reportAgentResult(previous)) reportedAgentHash = snapshot.hash;
      }
      return;
    }
    const payload = JSON.parse(snapshot.raw);
    if (payload.version === 1 && Array.isArray(payload.apps) && !payload.apps.length && Array.isArray(payload.selectedApps) && !payload.selectedApps.length) {
      $('ai-workspace-status').textContent = 'AI 工作目录已就绪；Agent 写入后自动加载。';
      return;
    }
    const parsed = parseAiResult(snapshot.raw, canonicalAgentCombo, true);
    const result = mergeAiResult(parsed);
    const message = `已加载 ${parsed.names.join('、')}：新增 ${result.added} 条，更新旧资料 ${result.replaced} 条，保留 ${result.skipped} 条。`;
    const receipt = { hash: snapshot.hash, state: 'applied', message };
    // Back up and persist before updating the live UI. Quota errors leave state intact.
    if (result.added || result.replaced) {
      localStorage.setItem(STORE + '-before-agent', JSON.stringify(state));
    }
    result.next.agentReceipt = receipt;
    localStorage.setItem(STORE, JSON.stringify(result.next));
    state = result.next;
    if (result.added || result.replaced) render();
    $('ai-workspace-status').textContent = message;
    if (await window.shortcutDesktop.reportAgentResult(receipt)) reportedAgentHash = snapshot.hash;
  } catch (error) {
    const message = 'AI 更新未完成：' + error.message;
    $('ai-workspace-status').textContent = message;
    if (snapshot?.hash) {
      try { await window.shortcutDesktop.reportAgentResult({ hash: snapshot.hash, state: 'rejected', message: message.slice(0, 2000) }); } catch { /* Keep the visible error and retry on the next check. */ }
    }
  } finally { agentBusy = false; }
}
if (window.shortcutDesktop?.readAgentWorkspace) {
  $('copy-ai-prompt').disabled = true;
  syncAgentWorkspace();
  setInterval(syncAgentWorkspace, 2000);
} else {
  $('ai-workspace-status').textContent = '自动写入功能请使用 Windows 桌面版。';
}

function mergeAiResult(parsed) {
  const next = structuredClone(state);
  let added = 0, replaced = 0, skipped = 0;
  for (const item of parsed.entries) {
    const same = next.records.filter(r => r.app === item.app && r.combo === item.combo && r.scope === item.scope && r.kind === 'keys');
    if (same.some(r => !r.id.startsWith('lib-') && !r.id.startsWith('ai-'))) { skipped++; continue; }
    if (same.some(r => r.action === item.action && r.source === item.source && r.note === item.note)) { skipped++; continue; }
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
    const parsed = parseAiResult($('ai-result').value.trim(), combo);
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
