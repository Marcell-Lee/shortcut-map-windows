const fs = require('node:fs');
const path = require('node:path');

const key = (id, u = 1) => ({ id, u });
const chars = value => [...value].map(id => key(id));
const row = (...parts) => parts.flat();
const rows = [
  row(key('Escape'), ...Array.from({ length: 12 }, (_, i) => key(`F${i + 1}`)), key('PrintScreen'), key('ScrollLock'), key('Pause')),
  row(key('Backquote'), ...chars('1234567890-='), key('Backspace', 2), key('Insert'), key('Home'), key('PageUp'), key('NumLock'), key('NumpadDivide'), key('NumpadMultiply'), key('NumpadSubtract')),
  row(key('Tab', 1.5), ...chars('QWERTYUIOP[]\\'), key('Delete'), key('End'), key('PageDown'), key('Numpad7'), key('Numpad8'), key('Numpad9'), key('NumpadAdd')),
  row(key('CapsLock', 1.8), ...chars("ASDFGHJKL;'"), key('Enter', 2.2), key('Numpad4'), key('Numpad5'), key('Numpad6')),
  row(key('ShiftLeft', 2.3), ...chars('ZXCVBNM,./'), key('ShiftRight', 2.3), key('ArrowUp'), key('Numpad1'), key('Numpad2'), key('Numpad3'), key('NumpadEnter')),
  row(key('ControlLeft', 1.3), key('MetaLeft', 1.3), key('AltLeft', 1.3), key('Space', 6), key('AltRight', 1.3), key('MetaRight', 1.3), key('ContextMenu', 1.3), key('ControlRight', 1.3), key('ArrowLeft'), key('ArrowDown'), key('ArrowRight'), key('Numpad0', 2), key('NumpadDecimal')),
];
const ids = rows.flat().map(item => item.id);
if (ids.length !== 104 || new Set(ids).size !== ids.length) throw new Error('标准全尺寸布局必须有 104 个不同键位');

const labels = {
  Escape: 'Esc', Backquote: '`', CapsLock: 'Caps', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Win', MetaRight: 'Win',
  AltLeft: 'Alt', AltRight: 'Alt', ContextMenu: 'Menu', Space: 'Space',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  PageUp: 'PgUp', PageDown: 'PgDn', PrintScreen: 'PrtSc', ScrollLock: 'ScrLk',
  NumpadDivide: 'Num /', NumpadMultiply: 'Num *', NumpadSubtract: 'Num -',
  NumpadAdd: 'Num +', NumpadEnter: 'Num Enter', NumpadDecimal: 'Num .',
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, `Num ${i}`])),
};
const output = id => labels[id] || id;
const mappings = Object.fromEntries(ids.map(id => [id, {
  base: { output: id.startsWith('Numpad') ? id : output(id), note: '标准 104 键示例，请按实际键盘核对', status: '待核实' },
  fn: { output: '透传', note: 'Fn 层尚未配置', status: '待核实' },
}]));
const layout = { rows, labels, seed: { version: 1, model: '标准 104 键布局', mappings, records: [] } };
fs.writeFileSync(path.join(__dirname, '../data/layout-full.json'), JSON.stringify(layout, null, 2) + '\n');
