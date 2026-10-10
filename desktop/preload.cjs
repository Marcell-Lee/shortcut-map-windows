const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shortcutDesktop', {
  detectKeyboards: () => ipcRenderer.invoke('shortcut-map:detect-keyboards'),
  readAgentWorkspace: () => ipcRenderer.invoke('shortcut-map:agent-read'),
  reportAgentResult: result => ipcRenderer.invoke('shortcut-map:agent-result', result),
});
