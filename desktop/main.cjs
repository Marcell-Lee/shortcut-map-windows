const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const { prepareWorkspace, readWorkspace } = require('./agent-workspace.cjs');

const execFileAsync = promisify(execFile);
const pagePath = path.join(__dirname, '..', process.argv.includes('--local') && !app.isPackaged ? 'dist' : 'release', 'Alt快捷键占用地图.html');
const pageUrl = pathToFileURL(pagePath).href;
const smokeTest = process.argv.includes('--smoke-test');
if (smokeTest) {
  app.setPath('userData', fs.mkdtempSync(path.join(app.getPath('temp'), 'shortcut-map-smoke-')));
}
let mainWindow;
let agentDirectory;

function checkSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.sender.getURL() !== pageUrl) {
    throw new Error('无效的桌面请求');
  }
}

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

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ipcMain.handle('shortcut-map:detect-keyboards', detectKeyboards);
  agentDirectory = path.join(app.getPath('userData'), 'agent-workspace');
  let workspaceError;
  try { await prepareWorkspace(agentDirectory); } catch (error) { workspaceError = error.message; }
  ipcMain.handle('shortcut-map:agent-read', async event => {
    checkSender(event);
    if (workspaceError) throw Error('无法准备 AI 工作目录：' + workspaceError);
    try { return await readWorkspace(agentDirectory); }
    catch (error) { return { directory: agentDirectory, error: error.message }; }
  });
  ipcMain.handle('shortcut-map:agent-result', async (event, result) => {
    checkSender(event);
    if (!result || !/^[a-f0-9]{64}$/.test(result.hash) || !['applied', 'rejected'].includes(result.state) ||
        typeof result.message !== 'string' || result.message.length > 2000) throw Error('导入状态无效');
    const current = await readWorkspace(agentDirectory);
    if (current.hash !== result.hash) return false;
    const temporary = path.join(agentDirectory, 'import-status.tmp');
    await fs.promises.writeFile(temporary, JSON.stringify({ hash: result.hash, state: result.state, message: result.message, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    await fs.promises.rename(temporary, path.join(agentDirectory, 'import-status.json'));
    return true;
  });
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
      if (process.env.SHORTCUT_MAP_SMOKE_SCENARIO === 'agent') {
        const raw = JSON.stringify({ version: 1, selectedApps: ['Smoke Test App'], apps: [{ name: 'Smoke Test App', shortcuts: [
          { combo: 'Ctrl+S', action: 'Smoke Save', scope: 'app', source: 'Smoke test fixture' },
        ] }] });
        const temporary = path.join(agentDirectory, 'software-shortcuts.tmp');
        await fs.promises.writeFile(temporary, raw, 'utf8');
        await fs.promises.rename(temporary, path.join(agentDirectory, 'software-shortcuts.json'));
        const applied = await mainWindow.webContents.executeJavaScript(`(async () => {
          for (let retry = 0; retry < 80; retry++) {
            await syncAgentWorkspace();
            if (!agentBusy && state.records.some(r => r.app === 'Smoke Test App' && r.action === 'Smoke Save')) {
              return { prompt: document.getElementById('ai-prompt').value, status: document.getElementById('ai-workspace-status').textContent };
            }
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          throw Error('Agent 文件未自动导入');
        })()`);
        if (!applied.prompt.includes(agentDirectory)) throw Error('提示词未包含真实工作目录');
        const receipt = JSON.parse(await fs.promises.readFile(path.join(agentDirectory, 'import-status.json'), 'utf8'));
        const snapshot = await readWorkspace(agentDirectory);
        if (receipt.state !== 'applied' || receipt.hash !== snapshot.hash) throw Error('Agent 导入回执无效');
        result.agentImport = true;
      }
      if (process.env.SHORTCUT_MAP_SMOKE_SCENARIO === 'unassigned') {
        await mainWindow.webContents.executeJavaScript(`(() => {
          document.getElementById('unassigned-toggle').click();
          document.querySelector('.key[data-key-id="AltLeft"]').click();
          document.querySelector('.key[data-key-id="MetaLeft"]').click();
          document.querySelector('.key[data-key-id="="]').click();
          return document.querySelectorAll('.key.combo-muted').length;
        })()`).then(count => {
          if (count) throw new Error('无关按键仍被置灰');
        });
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
      const report = { smokeTest: 'passed', keyboardDevices: devices.devices.length, width, agentImport: result.agentImport || false };
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
