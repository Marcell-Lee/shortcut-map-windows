const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shortcutDesktop', {
  detectKeyboards: () => ipcRenderer.invoke('shortcut-map:detect-keyboards'),
});
