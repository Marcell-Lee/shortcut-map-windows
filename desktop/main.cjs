const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');

const execFileAsync = promisify(execFile);
const pagePath = path.join(__dirname, '..', process.argv.includes('--local') && !app.isPackaged ? 'dist' : 'release', 'Alt快捷键占用地图.html');
const pageUrl = pathToFileURL(pagePath).href;
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) {
  app.setPath('userData', fs.mkdtempSync(path.join(app.getPath('temp'), 'shortcut-map-smoke-')));
}
let mainWindow;

function reportSmokeTest(result) {
  if (process.env.SHORTCUT_MAP_SMOKE_REPORT) {
    fs.writeFileSync(process.env.SHORTCUT_MAP_SMOKE_REPORT, JSON.stringify(result), 'utf8');
  }
}

function scriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'detect-keyboards.ps1')
    : path.join(__dirname, 'detect-keyboards.ps1');
}

async function detectKeyboards(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.sender.getURL() !== pageUrl) {
    throw new Error('无效的键盘检测请求');
  }
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath(),
  ], { windowsHide: true, timeout: 60000, maxBuffer: 128 * 1024, encoding: 'utf8' });
  const result = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  if (!Array.isArray(result.devices) || result.devices.length > 50) throw new Error('键盘设备结果无效');
  return {
    devices: result.devices.map(device => ({
      id: String(device.id || '').slice(0, 80),
      name: String(device.name || '').slice(0, 80),
    })),
    suggestion: result.suggestion && ['compact68', 'full'].includes(result.suggestion.layoutId)
      ? { layoutId: result.suggestion.layoutId, model: String(result.suggestion.model || '').slice(0, 80) }
      : null,
  };
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ipcMain.handle('shortcut-map:detect-keyboards', detectKeyboards);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    icon: path.join(__dirname, '..', 'assets', 'shortcut-map.ico'),
    backgroundColor: '#edf1f5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl !== pageUrl) event.preventDefault();
  });
  if (!smokeTest) mainWindow.once('ready-to-show', () => mainWindow.show());
  else mainWindow.webContents.once('did-finish-load', async () => {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`(() => {
        const controls = document.getElementById('desktop-controls');
        const initial = document.querySelectorAll('.key').length;
        const select = document.getElementById('layout-select');
        select.value = 'full'; select.dispatchEvent(new Event('change'));
        return { bridge: typeof window.shortcutDesktop?.detectKeyboards, controls: !controls.hidden,
          initial, full: document.querySelectorAll('.key').length };
      })()`);
      if (result.bridge !== 'function' || !result.controls || result.initial !== 68 || result.full !== 104) {
        throw new Error('桌面页面或键盘布局加载失败：' + JSON.stringify(result));
      }
      if (process.env.SHORTCUT_MAP_SCREENSHOT) {
        mainWindow.setSize(1680, 1000);
        await mainWindow.webContents.executeJavaScript("document.getElementById('keyboard').scrollIntoView({block:'center'})");
        await new Promise(resolve => setTimeout(resolve, 200));
        fs.writeFileSync(process.env.SHORTCUT_MAP_SCREENSHOT, await mainWindow.webContents.capturePage().then(image => image.toPNG()));
      }
      const width = await mainWindow.webContents.executeJavaScript(`(() => ({
        window: innerWidth,
        keyboard: document.getElementById('keyboard').getBoundingClientRect().width,
        scroll: document.querySelector('.keyboard-scroll').clientWidth,
      }))()`);
      if (width.window >= 1200 && width.keyboard < width.window * 0.85) {
        throw new Error('全键盘未充分利用窗口宽度：' + JSON.stringify(width));
      }
      const devices = await mainWindow.webContents.executeJavaScript('window.shortcutDesktop.detectKeyboards()');
      if (!Array.isArray(devices.devices)) throw new Error('设备检测结果无效');
      const report = { smokeTest: 'passed', keyboardDevices: devices.devices.length, width };
      reportSmokeTest(report);
      console.log(JSON.stringify(report));
      app.exit(0);
    } catch (error) {
      reportSmokeTest({ smokeTest: 'failed', error: String(error.stack || error) });
      console.error(error);
      app.exit(1);
    }
  });
  mainWindow.loadFile(pagePath);
});

app.on('window-all-closed', () => app.quit());
