// Shared by the renderer and the standalone Agent validator.
function canonicalAgentCombo(value) {
  if (typeof value !== 'string' || value.length > 200) throw Error('组合键无效或过长。');
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Win'];
  const key = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Escape|Space|Tab|Enter|Backspace|Delete|Home|End|Insert|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PrintScreen|CapsLock|Pause|NumLock|ScrollLock|Plus|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|[-=\[\]\\;',.\/`])$/;
  const steps = value.split(' > ');
  if (steps.length > 8) throw Error('连续按键最多八步。');
  return steps.map(step => {
    const parts = step.split('+');
    const ordinary = parts.filter(p => !modifiers.includes(p));
    if (!parts.length || new Set(parts).size !== parts.length || ordinary.length > 1 || parts.some(p => !modifiers.includes(p) && !key.test(p))) throw Error('无法识别键名或包含重复键。');
    return [...modifiers.filter(m => parts.includes(m)), ...ordinary].join('+');
  }).join(' > ');
}

function parseAiResult(raw, normalize = canonicalAgentCombo, selectedOnly = false) {
  if (raw.length > 2_000_000) throw Error('内容超过 2 MB。');
  const payload = JSON.parse(raw);
  const fields = (object, allowed) => object && typeof object === 'object' && Object.keys(object).every(k => allowed.includes(k));
  if (selectedOnly && !fields(payload, ['version', 'selectedApps', 'apps'])) throw Error('根对象包含未知字段。');
  if (payload?.version !== 1 || !Array.isArray(payload.apps) || !payload.apps.length || payload.apps.length > 20) {
    throw Error('需要 version: 1 和 1 至 20 个软件。');
  }
  const protectedApps = new Set(['Windows', 'Windows 设置', 'Windows 对话框', 'Windows 命令提示符', '文件资源管理器']);
  const names = new Set();
  const combinations = new Set();
  const entries = [];
  for (const app of payload.apps) {
    if (selectedOnly && !fields(app, ['name', 'shortcuts'])) throw Error('软件对象包含未知字段。');
    const name = typeof app?.name === 'string' ? app.name.trim() : ''; 
    if (typeof name !== 'string' || !name || name.length > 80 || protectedApps.has(name) || names.has(name) || !Array.isArray(app.shortcuts)) {
      throw Error('软件名称重复、无效或包含受保护的 Windows 系统范围。');
    }
    names.add(name);
    if (app.shortcuts.length > 1000) throw Error(`${name} 的快捷键数量超过上限。`);
    for (const item of app.shortcuts) {
      if (selectedOnly && !fields(item, ['combo', 'action', 'scope', 'source', 'note'])) throw Error('快捷键包含未知字段。');
      if (typeof item?.combo !== 'string' || typeof item?.action !== 'string' || typeof item?.source !== 'string' ||
          !item.combo.trim() || !item.action.trim() || item.action.length > 160 || !item.source.trim() || item.source.length > 300 ||
          !['app', 'global'].includes(item.scope) || (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500))) {
        throw Error(`${name} 有无效条目；每条必须包含组合键、功能、范围和来源。`);
      }
      const normalized = normalize(item.combo);
      const identity = JSON.stringify([name, item.scope, normalized]);
      if (combinations.has(identity)) throw Error(`${name} 的 ${normalized} 重复。`);
      combinations.add(identity);
      entries.push({ app: name, combo: normalized, action: item.action.trim(), scope: item.scope,
        note: item.note?.trim() || '', source: item.source.trim() });
    }
  }
  if (!entries.length || entries.length > 2000) throw Error('快捷键总数必须在 1 至 2000 条之间。');
  if (selectedOnly) {
    const selected = payload.selectedApps;
    if (!Array.isArray(selected) || !selected.length || selected.length > 20 || new Set(selected).size !== selected.length ||
        selected.some(n => typeof n !== 'string' || n !== n.trim() || !names.has(n))) throw Error('selectedApps 必须列出本次选择且包含在 apps 中的软件。');
    const filtered = entries.filter(item => selected.includes(item.app));
    if (!filtered.length) throw Error('所选软件没有可导入的快捷键。');
    return { names: selected, entries: filtered };
  }
  return { names: [...names], entries };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { parseAiResult };
